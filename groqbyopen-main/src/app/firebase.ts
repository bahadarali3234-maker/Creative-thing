// @ts-nocheck
// Lovable Cloud replacement for the original Firebase module.
// Same exported API so the rest of the app is unchanged.
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import type { User as SbUser } from '@supabase/supabase-js';
import { threadsFromRows } from './utils/chatThreads';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

function toUser(u: SbUser | null | undefined): User | null {
  if (!u) return null;
  const meta: any = u.user_metadata || {};
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: meta.full_name || meta.name || u.email?.split('@')[0] || null,
    photoURL: meta.avatar_url || meta.picture || null,
    isAnonymous: Boolean((u as any).is_anonymous),
  };
}

let currentUser: User | null = null;

async function recordUserProfile(user: User) {
  try {
    await supabase.from('profiles').upsert({
      id: user.uid,
      email: user.email || '',
      display_name: user.displayName || user.email?.split('@')[0] || 'User',
      photo_url: user.photoURL || '',
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    localStorage.setItem(
      'think_creative_user',
      JSON.stringify({ uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL })
    );
  } catch (err) {
    console.warn('User profile sync warning:', err);
  }
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  const handle = (u: User | null) => {
    currentUser = u;
    if (u && !u.isAnonymous) recordUserProfile(u);
    else localStorage.removeItem('think_creative_user');
    callback(u);
  };
  const { data } = supabase.auth.onAuthStateChange((_e, session) => {
    setTimeout(() => handle(toUser(session?.user)), 0);
  });
  supabase.auth.getSession().then(({ data: d }) => handle(toUser(d.session?.user)));
  return () => data.subscription.unsubscribe();
}

export async function signInWithGoogle(): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
    if (result.error) return { success: false, error: (result.error as any)?.message || 'Failed to sign in with Google' };
    if (result.redirected) return { success: true };
    const { data } = await supabase.auth.getUser();
    const u = toUser(data.user);
    currentUser = u;
    if (u) await recordUserProfile(u);
    return { success: true, user: u || undefined };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to sign in with Google' };
  }
}

export async function signInWithEmail(email: string, pass: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) return { success: false, error: error.message || 'Invalid credentials' };
  const u = toUser(data.user);
  currentUser = u;
  if (u) await recordUserProfile(u);
  return { success: true, user: u || undefined };
}

export async function signUpWithEmail(email: string, pass: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return { success: false, error: error.message || 'Could not create account' };
  if (!data.session) {
    return { success: false, error: 'Account created! Please check your email to confirm, then sign in.' };
  }
  const u = toUser(data.user);
  currentUser = u;
  if (u) await recordUserProfile(u);
  return { success: true, user: u || undefined };
}

export async function logOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
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
  const { data } = await supabase.auth.getUser();
  currentUser = toUser(data.user);
  return currentUser;
}

export async function saveBookingToFirestore(data: {
  name: string;
  email: string;
  phone?: string;
  topic?: string;
  selectedDate: string;
  selectedSlot: string;
}): Promise<string | null> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('bookings').insert({
    id,
    user_id: currentUser?.uid ?? null,
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    topic: data.topic ?? null,
    selected_date: data.selectedDate,
    selected_slot: data.selectedSlot,
  });
  if (error) {
    console.error('Failed to save booking:', error);
    return null;
  }
  return id;
}

export async function syncProjectMemoryToFirestore(project: any): Promise<boolean> {
  try {
    const user = await ensureAuth();
    if (!user || !project?.id) return false;
    const { error } = await supabase.from('user_projects').upsert({
      id: String(project.id),
      user_id: user.uid,
      data: JSON.parse(JSON.stringify(project)),
      last_synced_at: new Date().toISOString(),
    });
    return !error;
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
    const { error } = await supabase.from('chat_threads').upsert({
      id: String(thread.id),
      user_id: uid,
      title: thread.title || thread.name || 'Untitled Thread',
      prompt_banner: thread.promptBanner || '',
      active_tab: thread.activeTab || 'prompt',
      messages: sanitizedMessages,
      messages_count: sanitizedMessages.length,
      last_updated: new Date().toISOString(),
    });
    if (error) console.warn('Chat save failed:', error.message);
    return !error;
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
  let active = true;
  const load = async () => {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('last_updated', { ascending: false });
    if (!active || error) return;
    const threads = threadsFromRows(data || []);
    onUpdate(threads);
  };
  load();
  const channel = supabase
    .channel(`chat_threads_${userId}_${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads', filter: `user_id=eq.${userId}` }, () => load())
    .subscribe();
  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export async function deleteChatThreadFromFirestore(threadId: string, explicitUserId?: string): Promise<boolean> {
  try {
    const uid = explicitUserId || (await ensureAuth())?.uid;
    if (!uid) return false;
    const { error } = await supabase.from('chat_threads').delete().eq('user_id', uid).eq('id', threadId);
    return !error;
  } catch (err) {
    console.warn('Failed to delete chat thread:', err);
    return false;
  }
}
