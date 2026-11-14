import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

// CRITICAL: Bind to configured firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Test Firestore connectivity on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
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
  photoURL: string | null;
  isAnonymous: boolean;
}

function toUser(u: FbUser | null | undefined): User | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName || u.email?.split('@')[0] || null,
    photoURL: u.photoURL ?? null,
    isAnonymous: Boolean(u.isAnonymous),
  };
}

let currentUser: User | null = null;

async function recordUserProfile(user: User) {
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
    localStorage.setItem(
      'think_creative_user',
      JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      })
    );
  } catch (err) {
    console.warn('User profile sync warning:', err);
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
      recordUserProfile(u);
    } else if (!u) {
      localStorage.removeItem('think_creative_user');
    }
    callback(u);
  });
  return unsubscribe;
}

export async function signInWithGoogle(): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const u = toUser(cred.user);
    currentUser = u;
    if (u) await recordUserProfile(u);
    return { success: true, user: u || undefined };
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

export async function signInWithEmail(email: string, pass: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const u = toUser(cred.user);
    currentUser = u;
    if (u) await recordUserProfile(u);
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
    if (u) await recordUserProfile(u);
    return { success: true, user: u || undefined };
  } catch (err: any) {
    console.error('Email sign up error:', err);
    return { success: false, error: err?.message || 'Could not create account' };
  }
}

export async function logOut(): Promise<void> {
  try {
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

export async function saveBookingToFirestore(data: {
  name: string;
  email: string;
  phone?: string;
  topic?: string;
  selectedDate: string;
  selectedSlot: string;
}): Promise<string | null> {
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
    console.error('Failed to save booking:', error);
    return null;
  }
}

export async function syncProjectMemoryToFirestore(project: any): Promise<boolean> {
  try {
    const user = await ensureAuth();
    if (!user || !project?.id) return false;
    const projectRef = doc(db, 'user_projects', String(project.id));
    await setDoc(
      projectRef,
      {
        id: String(project.id),
        userId: user.uid,
        data: JSON.parse(JSON.stringify(project)),
        lastSyncedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('Project memory sync warning:', err);
    return false;
  }
}

export async function syncChatThreadToFirestore(thread: any, explicitUserId?: string): Promise<boolean> {
  try {
    const uid = explicitUserId || (await ensureAuth())?.uid;
    if (!uid || !thread?.id) return false;
    const sanitizedMessages = Array.isArray(thread.messages)
      ? thread.messages.map((m: any) => ({
          ...m,
          id: m.id || crypto.randomUUID(),
          isStreaming: false,
        }))
      : [];
    const threadRef = doc(db, 'chat_threads', String(thread.id));
    await setDoc(
      threadRef,
      {
        id: String(thread.id),
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
    return true;
  } catch (err) {
    console.warn('Chat thread sync warning:', err);
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
      onUpdate(threads);
    },
    (err) => {
      console.warn('Chat threads subscription error:', err);
    }
  );
  return unsubscribe;
}

export async function deleteChatThreadFromFirestore(threadId: string, explicitUserId?: string): Promise<boolean> {
  try {
    const uid = explicitUserId || (await ensureAuth())?.uid;
    if (!uid) return false;
    const threadRef = doc(db, 'chat_threads', threadId);
    await deleteDoc(threadRef);
    return true;
  } catch (err) {
    console.warn('Failed to delete chat thread:', err);
    return false;
  }
}

export type FirestoreOperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

export function handleFirestoreError(error: unknown, operationType: FirestoreOperationType, path: string | null) {
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
  try {
    const user = await ensureAuth();
    const uid = explicitUserId || user?.uid;
    if (!uid || user?.isAnonymous || !template?.id || !template?.kind) return false;
    const safeId = String(template.id).slice(0, 128);
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
    return true;
  } catch (err) {
    handleFirestoreError(err, 'write', `custom_templates/${template?.id || ''}`);
    return false;
  }
}

export async function deleteCustomTemplateFromFirestore(templateId: string, explicitUserId?: string): Promise<boolean> {
  try {
    const user = await ensureAuth();
    const uid = explicitUserId || user?.uid;
    if (!uid || user?.isAnonymous || !templateId) return false;
    const tplRef = doc(db, 'custom_templates', String(templateId).slice(0, 128));
    await deleteDoc(tplRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'delete', `custom_templates/${templateId}`);
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
      handleFirestoreError(err, 'list', 'custom_templates');
    }
  );
  return unsubscribe;
}

