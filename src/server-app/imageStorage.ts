import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const STORAGE_ROOT = path.join(process.cwd(), '.storage', 'images');

function ensureStorageDir(subDir = '') {
  const dir = subDir ? path.join(STORAGE_ROOT, subDir) : STORAGE_ROOT;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function sanitizeId(raw: string): string {
  return String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

let cachedHmacSecret: string | null = null;
function getUrlSigningSecret(): string {
  if (cachedHmacSecret) return cachedHmacSecret;
  cachedHmacSecret =
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.GEMINI_API_KEY ||
    'think-creative-image-storage-signing-key-v1';
  return cachedHmacSecret;
}

export function extFromMimeType(mimeType: string): 'png' | 'jpg' | 'webp' {
  const m = String(mimeType || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  return 'png';
}

export function mimeTypeFromExt(ext: string): string {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'webp') return 'image/webp';
  return 'image/png';
}

export function saveImageBufferToDisk(params: {
  userId: string;
  imageId: string;
  buffer: Buffer;
  mimeType: string;
}): { fileName: string; relativePath: string; bytes: number; mimeType: string } {
  const safeUid = sanitizeId(params.userId) || 'anonymous';
  const safeId = sanitizeId(params.imageId) || `img_${Date.now()}`;
  const ext = extFromMimeType(params.mimeType);
  const fileName = `${safeId}.${ext}`;
  const userDir = ensureStorageDir(safeUid);
  const absPath = path.join(userDir, fileName);

  fs.writeFileSync(absPath, params.buffer);

  return {
    fileName,
    relativePath: `${safeUid}/${fileName}`,
    bytes: params.buffer.length,
    mimeType: mimeTypeFromExt(ext),
  };
}

export function loadImageBufferFromDisk(params: {
  userId: string;
  imageId: string;
}): { buffer: Buffer; mimeType: string; fileName: string } | null {
  const safeUid = sanitizeId(params.userId);
  const safeId = sanitizeId(params.imageId);
  if (!safeUid || !safeId) return null;

  const userDir = path.join(STORAGE_ROOT, safeUid);
  if (!fs.existsSync(userDir)) return null;

  for (const ext of ['png', 'jpg', 'webp']) {
    const fileName = `${safeId}.${ext}`;
    const candidate = path.join(userDir, fileName);
    if (fs.existsSync(candidate)) {
      return {
        buffer: fs.readFileSync(candidate),
        mimeType: mimeTypeFromExt(ext),
        fileName,
      };
    }
  }
  return null;
}

export function createSignedImageUrl(imageId: string, userId: string, ttlSeconds = 7 * 24 * 3600): string {
  const safeId = sanitizeId(imageId);
  const safeUid = sanitizeId(userId);
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = crypto
    .createHmac('sha256', getUrlSigningSecret())
    .update(`${safeId}:${safeUid}:${exp}`)
    .digest('hex')
    .slice(0, 32);
  return `/api/images/file/${encodeURIComponent(safeId)}?uid=${encodeURIComponent(safeUid)}&exp=${exp}&sig=${sig}`;
}

export function verifySignedImageQuery(params: {
  imageId: string;
  uid: string;
  exp: number;
  sig: string;
}): boolean {
  const safeId = sanitizeId(params.imageId);
  const safeUid = sanitizeId(params.uid);
  if (!safeId || !safeUid || !params.sig || !Number.isFinite(params.exp)) return false;
  if (params.exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto
    .createHmac('sha256', getUrlSigningSecret())
    .update(`${safeId}:${safeUid}:${params.exp}`)
    .digest('hex')
    .slice(0, 32);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(params.sig)));
  } catch {
    return false;
  }
}
