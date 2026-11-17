import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface FirebaseConfigJson {
  projectId: string;
  firestoreDatabaseId: string;
}

let cachedFbConfig: FirebaseConfigJson | null = null;
function getFirebaseConfig(): FirebaseConfigJson {
  if (cachedFbConfig) return cachedFbConfig;
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  cachedFbConfig = {
    projectId: String(raw.projectId || ''),
    firestoreDatabaseId: String(raw.firestoreDatabaseId || '(default)'),
  };
  return cachedFbConfig;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
  token: string;
}

let jwkCache: { keys: Record<string, any>; expiresAt: number } = { keys: {}, expiresAt: 0 };

async function fetchGooglePublicJwk(kid: string): Promise<any | null> {
  const now = Date.now();
  if (jwkCache.expiresAt > now && jwkCache.keys[kid]) {
    return jwkCache.keys[kid];
  }

  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase public JWK (${res.status})`);
  }

  const cc = res.headers.get('cache-control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 1800 * 1000;
  const body = (await res.json()) as { keys?: Array<Record<string, any>> };

  const mapped: Record<string, any> = {};
  for (const k of body?.keys || []) {
    if (k.kid) mapped[k.kid] = k;
  }
  jwkCache = { keys: mapped, expiresAt: now + Math.max(60_000, maxAgeMs) };
  return mapped[kid] || null;
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  if (!idToken || typeof idToken !== 'string') return null;
  const parts = idToken.trim().split('.');
  if (parts.length !== 3) return null;

  try {
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64).toString('utf-8')) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf-8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
      firebase?: { sign_in_provider?: string };
    };

    if (header.alg !== 'RS256' || !header.kid) return null;

    const { projectId } = getFirebaseConfig();
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.exp || payload.exp <= nowSec - 30) return null;
    if (payload.iat && payload.iat > nowSec + 300) return null;

    const signInProvider = payload.firebase?.sign_in_provider || null;
    if (signInProvider === 'anonymous') return null;

    const jwk = await fetchGooglePublicJwk(header.kid);
    if (!jwk) return null;

    const keyObj = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const signatureValid = verifier.verify(keyObj, base64UrlDecode(sigB64));
    if (!signatureValid) return null;

    return {
      uid: payload.sub,
      email: payload.email || null,
      emailVerified: Boolean(payload.email_verified),
      signInProvider,
      token: idToken.trim(),
    };
  } catch {
    return null;
  }
}

export async function extractVerifiedUserFromRequest(req: any): Promise<VerifiedFirebaseUser | null> {
  const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return verifyFirebaseIdToken(token);
}

// ============================================================================
// AES-256-GCM Server-Side Encryption for User API Keys
// Plaintext keys never leave the backend, never touch localStorage, never stored in plaintext.
// ============================================================================
let cachedEncryptionKey: Buffer | null = null;
function getEncryptionKey(): Buffer {
  if (cachedEncryptionKey) return cachedEncryptionKey;
  const { projectId, firestoreDatabaseId } = getFirebaseConfig();
  const rawSecret =
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.GEMINI_API_KEY ||
    `${projectId}::${firestoreDatabaseId}::think-creative-vault-secret`;
  cachedEncryptionKey = crypto.scryptSync(rawSecret, `salt::${projectId}::${firestoreDatabaseId}`, 32);
  return cachedEncryptionKey;
}

export function encryptApiKey(plainKey: string): {
  encryptedKey: string;
  iv: string;
  authTag: string;
  maskedKey: string;
} {
  const trimmed = plainKey.trim();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.length > 10 ? trimmed.slice(-4) : '';
  const maskedKey = `${prefix}...${suffix}`;

  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    maskedKey,
  };
}

export function decryptApiKey(record: { encryptedKey: string; iv: string; authTag: string }): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(record.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(record.encryptedKey, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ============================================================================
// Scoped Firestore REST Helper (Uses verified user Bearer token so firestore.rules apply!)
// ============================================================================
function firestoreBaseUrl(): string {
  const { projectId, firestoreDatabaseId } = getFirebaseConfig();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(firestoreDatabaseId)}/documents`;
}

function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('arrayValue' in val) {
    const vals = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return vals.map((item: any) => fromFirestoreValue(item));
  }
  if ('mapValue' in val) {
    const obj: Record<string, any> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

function fromFirestoreDoc(doc: any): Record<string, any> | null {
  if (!doc || !doc.fields) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    out[k] = fromFirestoreValue(v);
  }
  if (!out.id && typeof doc.name === 'string') {
    out.id = doc.name.split('/').pop();
  }
  return out;
}

export async function firestoreGetDocument(
  collection: string,
  docId: string,
  idToken: string
): Promise<Record<string, any> | null> {
  const url = `${firestoreBaseUrl()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(7000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Firestore read failed (${res.status}): ${txt.slice(0, 180)}`);
  }
  const data = await res.json();
  return fromFirestoreDoc(data);
}

export async function firestoreSetDocument(
  collection: string,
  docId: string,
  data: Record<string, any>,
  idToken: string
): Promise<void> {
  const url = `${firestoreBaseUrl()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Firestore write failed (${res.status}): ${txt.slice(0, 220)}`);
  }
}

export async function firestoreDeleteDocument(
  collection: string,
  docId: string,
  idToken: string
): Promise<void> {
  const url = `${firestoreBaseUrl()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(7000),
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Firestore delete failed (${res.status}): ${txt.slice(0, 180)}`);
  }
}

export async function firestoreQueryUserDocs(
  collectionId: string,
  userId: string,
  idToken: string,
  limit = 40
): Promise<Array<Record<string, any>>> {
  const url = `${firestoreBaseUrl()}:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: userId },
          },
        },
        limit,
      },
    }),
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Firestore query failed (${res.status}): ${txt.slice(0, 180)}`);
  }
  const rows = (await res.json()) as Array<{ document?: any }>;
  const docs: Array<Record<string, any>> = [];
  for (const r of rows) {
    if (r?.document) {
      const parsed = fromFirestoreDoc(r.document);
      if (parsed) docs.push(parsed);
    }
  }
  return docs;
}

export type AiProviderId = 'groq' | 'openai' | 'gemini';

const WORKSPACE_VAULT_PATH = path.join(process.cwd(), '.cache', 'workspace-keys.enc.json');

export function extractWorkspaceSessionId(req: any): string {
  const raw = String(
    req?.headers?.['x-workspace-session'] ||
      req?.headers?.['X-Workspace-Session'] ||
      req?.query?.ws ||
      ''
  ).trim();
  if (/^[a-zA-Z0-9_-]{8,72}$/.test(raw)) {
    return raw;
  }
  return 'ws_shared_default';
}

function readWorkspaceVaultFile(): Record<string, any> {
  try {
    if (!fs.existsSync(WORKSPACE_VAULT_PATH)) return {};
    const raw = fs.readFileSync(WORKSPACE_VAULT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeWorkspaceVaultFile(data: Record<string, any>): void {
  try {
    const dir = path.dirname(WORKSPACE_VAULT_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(WORKSPACE_VAULT_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[WorkspaceKeyVault] Persist warning:', (err as any)?.message || err);
  }
}

export function saveWorkspaceVaultKey(
  workspaceId: string,
  provider: AiProviderId,
  plainKey: string | null,
  model: string
): { configured: boolean; maskedKey: string | null; model: string; updatedAt: string } {
  const store = readWorkspaceVaultFile();
  const key = `${workspaceId}_${provider}`;
  const existing = store[key];
  const nowIso = new Date().toISOString();

  let enc = existing;
  if (plainKey && plainKey.trim()) {
    const encrypted = encryptApiKey(plainKey.trim());
    enc = {
      encryptedKey: encrypted.encryptedKey,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      maskedKey: encrypted.maskedKey,
      createdAt: existing?.createdAt || nowIso,
    };
  }
  if (!enc?.encryptedKey) {
    throw new Error(`No ${provider} key supplied`);
  }

  store[key] = {
    ...enc,
    provider,
    workspaceId,
    model,
    updatedAt: nowIso,
  };
  writeWorkspaceVaultFile(store);
  return {
    configured: true,
    maskedKey: String(store[key].maskedKey || ''),
    model,
    updatedAt: nowIso,
  };
}

export function getWorkspaceVaultKeyRecord(
  workspaceId: string,
  provider: AiProviderId
): { apiKey: string; model?: string; maskedKey: string; updatedAt?: string } | null {
  try {
    const store = readWorkspaceVaultFile();
    const rec = store[`${workspaceId}_${provider}`] || store[`ws_shared_default_${provider}`];
    if (!rec?.encryptedKey || !rec?.iv || !rec?.authTag) return null;
    const apiKey = decryptApiKey({
      encryptedKey: rec.encryptedKey,
      iv: rec.iv,
      authTag: rec.authTag,
    });
    return {
      apiKey,
      model: rec.model ? String(rec.model) : undefined,
      maskedKey: String(rec.maskedKey || ''),
      updatedAt: rec.updatedAt ? String(rec.updatedAt) : undefined,
    };
  } catch {
    return null;
  }
}

export function getWorkspaceVaultMetadata(
  workspaceId: string,
  provider: AiProviderId
): { configured: boolean; maskedKey: string | null; model?: string; updatedAt?: string | null } {
  const store = readWorkspaceVaultFile();
  const rec = store[`${workspaceId}_${provider}`];
  if (!rec?.encryptedKey) {
    return { configured: false, maskedKey: null };
  }
  return {
    configured: true,
    maskedKey: rec.maskedKey || null,
    model: rec.model || undefined,
    updatedAt: rec.updatedAt || null,
  };
}

export function deleteWorkspaceVaultKey(workspaceId: string, provider: AiProviderId): void {
  const store = readWorkspaceVaultFile();
  const key = `${workspaceId}_${provider}`;
  if (key in store) {
    delete store[key];
    writeWorkspaceVaultFile(store);
  }
}

export async function getUserProviderKeyRecord(
  userId: string,
  provider: AiProviderId,
  idToken: string
): Promise<{ apiKey: string; model?: string; maskedKey: string; updatedAt?: string } | null> {
  const docId = `${userId}_${provider}`;
  try {
    const doc = await firestoreGetDocument('user_provider_keys', docId, idToken);
    if (!doc || !doc.encryptedKey || !doc.iv || !doc.authTag) return null;
    const apiKey = decryptApiKey({
      encryptedKey: doc.encryptedKey,
      iv: doc.iv,
      authTag: doc.authTag,
    });
    return {
      apiKey,
      model: doc.model ? String(doc.model) : undefined,
      maskedKey: String(doc.maskedKey || ''),
      updatedAt: doc.updatedAt ? String(doc.updatedAt) : undefined,
    };
  } catch (err) {
    console.warn(`[UserKeyVault] Could not read ${provider} key for user:`, (err as any)?.message || err);
    return null;
  }
}

export async function resolveProviderKeyForRequest(
  req: any,
  provider: AiProviderId
): Promise<{ apiKey: string; model?: string; maskedKey: string } | null> {
  try {
    const user = await extractVerifiedUserFromRequest(req);
    if (user) {
      const fb = await getUserProviderKeyRecord(user.uid, provider, user.token);
      if (fb?.apiKey) return fb;
    }
  } catch {}
  const wsId = extractWorkspaceSessionId(req);
  const ws = getWorkspaceVaultKeyRecord(wsId, provider);
  if (ws?.apiKey) return ws;
  return null;
}

