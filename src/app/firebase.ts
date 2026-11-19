import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User as FbUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDocFromServer,
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { threadsFromRows } from './utils/chatThreads';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// CRITICAL: Bind to configured firestoreDatabaseId if present
const configuredDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = configuredDatabaseId ? getFirestore(app, configuredDatabaseId) : getFirestore(app);
export const auth = getAuth(app);

// ============================================================================
// QUOTA CIRCUIT BREAKER & WRITE DEDUPLICATION
// Prevents retry storms / free daily write exhaustion while keeping localStorage active
// ============================================================================
let firestoreQuotaBlocked = false;
const lastSyncedThreadSignature = new Map<string, string>();
const lastSyncedProjectSignature = new Map<string, string>();
const lastSyncedTemplateSignature = new Map<string, string>();

function getTodayQuotaStorageKey(): string {
  const d = new Date();
  return `fs_quota_blocked_${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function hydrateQuotaFlag(): boolean {
  if (firestoreQuotaBlocked) return true;
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(getTodayQuotaStorageKey()) === '1') {
      firestoreQuotaBlocked = true;
    }
  } catch {}
  return firestoreQuotaBlocked;
}

export function isFirestoreQuotaBlocked(): boolean {
  return hydrateQuotaFlag();
}

export function getFirestoreUpgradeUrl(): string {
  const pid = (firebaseConfig as any).projectId || '';
  const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
  return `https://console.firebase.google.com/project/${pid}/firestore/databases/${dbId}/data?openUpgradeDialog=true`;
}

function isQuotaExhaustedError(err: unknown): boolean {
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return (
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('free daily write units') ||
    msg.includes('quota exceeded')
  );
}

function tripQuotaBreakerIfNeeded(err: unknown): boolean {
  if (!isQuotaExhaustedError(err)) return false;
  if (!firestoreQuotaBlocked) {
    firestoreQuotaBlocked = true;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(getTodayQuotaStorageKey(), '1');
      }
    } catch {}
    console.warn(
      `[Firestore] Daily write quota reached. Pausing background Firestore writes for this session (local storage stays active). Quota resets daily or can be upgraded: ${getFirestoreUpgradeUrl()}`
    );
  }
  return true;
}

function computeThreadSignature(thread: any): string {
  const msgs = Array.isArray(thread?.messages) ? thread.messages : [];
  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
  const lastLen = typeof lastMsg?.text === 'string' ? lastMsg.text.length : 0;
  return `${thread?.title || ''}|${thread?.promptBanner || ''}|${thread?.activeTab || ''}|${msgs.length}|${lastMsg?.id || ''}|${lastLen}`;
}

// Lightweight connectivity check (runs at most once per session)
async function testConnection() {
  if (hydrateQuotaFlag()) return;
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fs_conn_checked') === '1') {
      return;
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('fs_conn_checked', '1');
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (tripQuotaBreakerIfNeeded(error)) return;
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline status:', error.message);
    }
  }
}
testConnection();

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  givenName?: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

// Strict in-memory Google Workspace OAuth access token (NEVER persisted to localStorage/sessionStorage)
let inMemoryGoogleAccessToken: string | null = null;

export function getGoogleAccessToken(): string | null {
  return inMemoryGoogleAccessToken;
}

export function clearGoogleAccessToken(): void {
  inMemoryGoogleAccessToken = null;
}

async function fetchGooglePeopleMe(accessToken: string): Promise<{ displayName?: string; givenName?: string; email?: string }> {
  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) return {};
    const data: any = await res.json();
    const primaryName = Array.isArray(data?.names)
      ? data.names.find((n: any) => n?.metadata?.primary) || data.names[0]
      : null;
    const primaryEmail = Array.isArray(data?.emailAddresses)
      ? data.emailAddresses.find((e: any) => e?.metadata?.primary) || data.emailAddresses[0]
      : null;
    return {
      displayName: primaryName?.displayName || undefined,
      givenName: primaryName?.givenName || undefined,
      email: primaryEmail?.value || undefined,
    };
  } catch {
    return {};
  }
}

function toUser(u: FbUser | null | undefined, overrides?: { displayName?: string; givenName?: string; email?: string }): User | null {
  if (!u) return null;
  const resolvedEmail = overrides?.email || u.email || null;
  const resolvedDisplayName = overrides?.displayName || u.displayName || resolvedEmail?.split('@')[0] || null;
  const resolvedGiven =
    overrides?.givenName ||
    (resolvedDisplayName ? resolvedDisplayName.trim().split(/\s+/)[0] : null);
  return {
    uid: u.uid,
    email: resolvedEmail,
    displayName: resolvedDisplayName,
    givenName: resolvedGiven,
    photoURL: u.photoURL ?? null,
    isAnonymous: Boolean(u.isAnonymous),
  };
}

let currentUser: User | null = null;

async function recordUserProfile(user: User, force = false) {
  try {
    localStorage.setItem(
      'think_creative_user',
      JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        givenName: user.givenName || null,
        photoURL: user.photoURL,
      })
    );
  } catch {}

  if (hydrateQuotaFlag()) return;

  // Deduplicate user profile write: only write once per browser session unless explicit sign-in
  const sessionKey = `fs_profile_synced_${user.uid}`;
  try {
    if (!force && typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey) === '1') {
      return;
    }
  } catch {}

  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        givenName: user.givenName || '',
        photoURL: user.photoURL || '',
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(sessionKey, '1');
      }
    } catch {}
  } catch (err) {
    if (!tripQuotaBreakerIfNeeded(err)) {
      console.warn('User profile sync warning:', err);
    }
  }
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  // Pre-seed from local storage for zero-flicker UI
  try {
    const saved = localStorage.getItem('think_creative_user');
    if (saved) {
      currentUser = JSON.parse(saved);
      callback(currentUser);
    }
  } catch {
    // Ignore invalid storage
  }

  const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
    const u = toUser(fbUser);
    currentUser = u;
    if (u && !u.isAnonymous) {
      recordUserProfile(u, false);
    } else if (!u) {
      inMemoryGoogleAccessToken = null;
      localStorage.removeItem('think_creative_user');
    }
    callback(u);
  });
  return unsubscribe;
}

function buildGoogleWorkspaceProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/gmail.send');
  provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
  provider.addScope('https://www.googleapis.com/auth/userinfo.email');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function dispatchAuthLoginEvent(user: User, method: 'google' | 'email' | 'gmail-connect') {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('think-creative-auth-login', {
        detail: {
          user,
          method,
          hasGoogleToken: Boolean(inMemoryGoogleAccessToken),
        },
      })
    );
  } catch {}
}

export async function signInWithGoogle(): Promise<{ success: boolean; user?: User; hasGoogleToken?: boolean; error?: string }> {
  try {
    const provider = buildGoogleWorkspaceProvider();
    const cred = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(cred);
    if (credential?.accessToken) {
      inMemoryGoogleAccessToken = credential.accessToken;
    }

    let peopleProfile: { displayName?: string; givenName?: string; email?: string } = {};
    if (inMemoryGoogleAccessToken) {
      peopleProfile = await fetchGooglePeopleMe(inMemoryGoogleAccessToken);
      if (peopleProfile.displayName && cred.user && cred.user.displayName !== peopleProfile.displayName) {
        await updateProfile(cred.user, { displayName: peopleProfile.displayName }).catch(() => {});
      }
    }

    const u = toUser(cred.user, peopleProfile);
    currentUser = u;
    if (u) {
      await recordUserProfile(u, true);
      dispatchAuthLoginEvent(u, 'google');
    }
    return { success: true, user: u || undefined, hasGoogleToken: Boolean(inMemoryGoogleAccessToken) };
  } catch (err: any) {
    console.error('Google Sign-In Error:', err);
    if (err?.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Google sign-in popup was closed before completion.' };
    }
    if (err?.code === 'auth/cancelled-popup-request') {
      return { success: false, error: 'Sign-in was cancelled by another action.' };
    }
    return { success: false, error: err?.message || 'Failed to sign in with Google' };
  }
}

export async function connectGoogleGmailPermissions(): Promise<{ success: boolean; accessToken?: string; user?: User; error?: string }> {
  const res = await signInWithGoogle();
  if (!res.success || !inMemoryGoogleAccessToken) {
    return {
      success: false,
      error: res.error || 'Could not obtain Gmail send permissions from Google sign-in.',
    };
  }
  if (res.user) {
    dispatchAuthLoginEvent(res.user, 'gmail-connect');
  }
  return {
    success: true,
    accessToken: inMemoryGoogleAccessToken,
    user: res.user,
  };
}

export async function signInWithEmail(email: string, pass: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const u = toUser(cred.user);
    currentUser = u;
    if (u) {
      await recordUserProfile(u, true);
      dispatchAuthLoginEvent(u, 'email');
    }
    return { success: true, user: u || undefined };
  } catch (err: any) {
    console.error('Email sign in error:', err);
    return { success: false, error: err?.message || 'Invalid email or password' };
  }
}

export async function signUpWithEmail(email: string, pass: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const u = toUser(cred.user);
    currentUser = u;
    if (u) {
      await recordUserProfile(u, true);
      dispatchAuthLoginEvent(u, 'email');
    }
    return { success: true, user: u || undefined };
  } catch (err: any) {
    console.error('Email sign up error:', err);
    return { success: false, error: err?.message || 'Could not create account' };
  }
}

export async function logOut(): Promise<void> {
  try {
    inMemoryGoogleAccessToken = null;
    await fbSignOut(auth);
    currentUser = null;
    localStorage.removeItem('think_creative_user');
    localStorage.removeItem('think_creative_guest_threads');
    localStorage.removeItem('think_creative_projects');
    localStorage.removeItem('gemini_project_memory_v2');
    localStorage.removeItem('gemini_active_project_id_v2');
  } catch (err) {
    console.warn('Sign out error:', err);
  }
}

export async function ensureAuth(): Promise<User | null> {
  if (currentUser) return currentUser;
  return toUser(auth.currentUser);
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const fbUser = auth.currentUser;
    if (!fbUser || fbUser.isAnonymous) return null;
    return await fbUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export async function saveBookingToFirestore(data: {
  name: string;
  email: string;
  phone?: string;
  topic?: string;
  selectedDate: string;
  selectedSlot: string;
}): Promise<string | null> {
  if (hydrateQuotaFlag()) return null;
  try {
    const id = crypto.randomUUID();
    const bookingRef = doc(db, 'bookings', id);
    await setDoc(bookingRef, {
      id,
      userId: currentUser?.uid ?? null,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      topic: data.topic ?? null,
      selectedDate: data.selectedDate,
      selectedSlot: data.selectedSlot,
      createdAt: new Date().toISOString(),
    });
    return id;
  } catch (error) {
    if (!tripQuotaBreakerIfNeeded(error)) {
      handleFirestoreError(error, 'write', 'bookings');
    }
    return null;
  }
}

export async function syncProjectMemoryToFirestore(project: any): Promise<boolean> {
  if (hydrateQuotaFlag()) return false;
  try {
    const user = await ensureAuth();
    if (!user || user.isAnonymous || !project?.id) return false;
    const serialized = JSON.stringify(project);
    const sig = `${serialized.length}:${project?.artifacts?.length || 0}:${project?.updatedAt || ''}`;
    if (lastSyncedProjectSignature.get(String(project.id)) === sig) {
      return true;
    }
    const projectRef = doc(db, 'user_projects', String(project.id));
    await setDoc(
      projectRef,
      {
        id: String(project.id),
        userId: user.uid,
        data: JSON.parse(serialized),
        lastSyncedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    lastSyncedProjectSignature.set(String(project.id), sig);
    return true;
  } catch (err) {
    if (!tripQuotaBreakerIfNeeded(err)) {
      console.warn('Project memory sync warning:', err);
    }
    return false;
  }
}

export async function syncChatThreadToFirestore(thread: any, explicitUserId?: string): Promise<boolean> {
  if (hydrateQuotaFlag()) return false;
  try {
    const uid = explicitUserId || (await ensureAuth())?.uid;
    if (!uid || !thread?.id) return false;

    const threadId = String(thread.id);
    const sig = `${uid}|${computeThreadSignature(thread)}`;
    if (lastSyncedThreadSignature.get(threadId) === sig) {
      return true;
    }

    const sanitizedMessages = Array.isArray(thread.messages)
      ? thread.messages.map((m: any) => ({
          ...m,
          id: m.id || crypto.randomUUID(),
          isStreaming: false,
        }))
      : [];
    const threadRef = doc(db, 'chat_threads', threadId);
    await setDoc(
      threadRef,
      {
        id: threadId,
        userId: uid,
        title: thread.title || thread.name || 'Untitled Thread',
        prompt_banner: thread.promptBanner || '',
        promptBanner: thread.promptBanner || '',
        active_tab: thread.activeTab || 'prompt',
        activeTab: thread.activeTab || 'prompt',
        messages: sanitizedMessages,
        messagesCount: sanitizedMessages.length,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
    lastSyncedThreadSignature.set(threadId, sig);
    return true;
  } catch (err) {
    if (!tripQuotaBreakerIfNeeded(err)) {
      console.warn('Chat thread sync warning:', err);
    }
    return false;
  }
}

export function subscribeToUserChatThreads(
  userId: string | null | undefined,
  onUpdate: (threads: Record<string, any>) => void
): () => void {
  if (!userId) {
    onUpdate({});
    return () => {};
  }
  const q = query(collection(db, 'chat_threads'), where('userId', '==', userId));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const threads = threadsFromRows(rows);
      // Seed deduplication map from server snapshot so we never re-write identical server data
      for (const th of Object.values(threads)) {
        if (th?.id) {
          lastSyncedThreadSignature.set(String(th.id), `${userId}|${computeThreadSignature(th)}`);
        }
      }
      onUpdate(threads);
    },
    (err) => {
      if (!tripQuotaBreakerIfNeeded(err)) {
        console.warn('Chat threads subscription error:', err);
      }
    }
  );
  return unsubscribe;
}

export async function deleteChatThreadFromFirestore(threadId: string, explicitUserId?: string): Promise<boolean> {
  if (hydrateQuotaFlag()) return false;
  try {
    const uid = explicitUserId || (await ensureAuth())?.uid;
    if (!uid) return false;
    const threadRef = doc(db, 'chat_threads', threadId);
    await deleteDoc(threadRef);
    lastSyncedThreadSignature.delete(threadId);
    return true;
  } catch (err) {
    if (!tripQuotaBreakerIfNeeded(err)) {
      console.warn('Failed to delete chat thread:', err);
    }
    return false;
  }
}

export type FirestoreOperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

export function handleFirestoreError(error: unknown, operationType: FirestoreOperationType, path: string | null) {
  tripQuotaBreakerIfNeeded(error);
  const fbUser = auth.currentUser;
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: fbUser?.uid || currentUser?.uid,
      email: fbUser?.email || currentUser?.email,
      emailVerified: fbUser?.emailVerified,
      isAnonymous: fbUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

export async function saveCustomTemplateToFirestore(template: any, explicitUserId?: string): Promise<boolean> {
  if (hydrateQuotaFlag()) return false;
  try {
    const user = await ensureAuth();
    const uid = explicitUserId || user?.uid;
    if (!uid || user?.isAnonymous || !template?.id || !template?.kind) return false;
    const safeId = String(template.id).slice(0, 128);
    const sig = `${uid}|${safeId}|${JSON.stringify(template).length}`;
    if (lastSyncedTemplateSignature.get(safeId) === sig) return true;

    const tplRef = doc(db, 'custom_templates', safeId);
    const payload = JSON.parse(
      JSON.stringify({
        ...template,
        id: safeId,
        userId: uid,
        kind: String(template.kind),
        name: String(template.name || safeId).slice(0, 160),
        custom: true,
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(tplRef, payload, { merge: true });
    lastSyncedTemplateSignature.set(safeId, sig);
    return true;
  } catch (err) {
    if (!tripQuotaBreakerIfNeeded(err)) {
      handleFirestoreError(err, 'write', `custom_templates/${template?.id || ''}`);
    }
    return false;
  }
}

export async function deleteCustomTemplateFromFirestore(templateId: string, explicitUserId?: string): Promise<boolean> {
  if (hydrateQuotaFlag()) return false;
  try {
    const user = await ensureAuth();
    const uid = explicitUserId || user?.uid;
    if (!uid || user?.isAnonymous || !templateId) return false;
    const tplRef = doc(db, 'custom_templates', String(templateId).slice(0, 128));
    await deleteDoc(tplRef);
    lastSyncedTemplateSignature.delete(String(templateId).slice(0, 128));
    return true;
  } catch (err) {
    if (!tripQuotaBreakerIfNeeded(err)) {
      handleFirestoreError(err, 'delete', `custom_templates/${templateId}`);
    }
    return false;
  }
}

export function subscribeToCustomTemplates(
  userId: string | null | undefined,
  onUpdate: (templates: any[]) => void
): () => void {
  if (!userId) {
    return () => {};
  }
  const q = query(collection(db, 'custom_templates'), where('userId', '==', userId));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), custom: true }));
      onUpdate(items);
    },
    (err) => {
      if (!tripQuotaBreakerIfNeeded(err)) {
        handleFirestoreError(err, 'list', 'custom_templates');
      }
    }
  );
  return unsubscribe;
}

