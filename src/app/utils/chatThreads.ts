export function threadsFromRows(rows: any[]) {
  const threads: Record<string, any> = {};
  for (const row of rows) {
    const key = row.title || row.id;
    threads[key] = {
      id: row.id, title: key, promptBanner: row.prompt_banner || '',
      activeTab: row.active_tab || 'prompt', messages: Array.isArray(row.messages) ? row.messages : [],
    };
  }
  return threads;
}

export function mergeChatThreads(remote: Record<string, any>, local: Record<string, any>) {
  const merged = { ...remote };
  for (const [key, thread] of Object.entries(local)) {
    const incoming = merged[key];
    if (!incoming || thread.messages?.some((m: any) => m.isStreaming) ||
        (thread.messages?.length || 0) > (incoming.messages?.length || 0)) merged[key] = thread;
  }
  return merged;
}

export const CHAT_THREADS_UPDATED_EVENT = 'tc-local-chats-updated';

export function getUserStorageScope(user: { uid?: string; isAnonymous?: boolean } | null | undefined): string {
  return user?.uid && !user.isAnonymous ? user.uid : 'guest';
}

export function getLocalChatsStorageKey(scope: string): string {
  return `tc_chat_threads_v1_${scope || 'guest'}`;
}

export function getLocalActiveTopicKey(scope: string): string {
  return `tc_active_topic_v1_${scope || 'guest'}`;
}

export function getLocalDraftInputKey(scope: string): string {
  return `tc_draft_input_v1_${scope || 'guest'}`;
}

function sanitizeThreadsForStorage(threads: Record<string, any>, stripHeavyBlobs = false): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const entries = Object.entries(threads || {}).slice(0, stripHeavyBlobs ? 25 : 60);
  for (const [key, thread] of entries) {
    if (!thread || typeof thread !== 'object') continue;
    const msgs = Array.isArray(thread.messages) ? thread.messages : [];
    const cleanMsgs = msgs.slice(stripHeavyBlobs ? -40 : -120).map((m: any) => {
      const nextMsg: any = {
        ...m,
        isStreaming: false,
      };
      if (stripHeavyBlobs && Array.isArray(nextMsg.attachments)) {
        nextMsg.attachments = nextMsg.attachments.map((att: any) => ({
          ...att,
          preview:
            typeof att.preview === 'string' && att.preview.startsWith('data:') && att.preview.length > 48000
              ? ''
              : att.preview,
        }));
      }
      if (stripHeavyBlobs && nextMsg.studioJob?.resultDataUrl?.length > 120000) {
        nextMsg.studioJob = {
          ...nextMsg.studioJob,
          resultDataUrl: '',
        };
      }
      if (stripHeavyBlobs && nextMsg.thoughtSummary?.verificationScreenshotUrl?.length > 60000) {
        nextMsg.thoughtSummary = {
          ...nextMsg.thoughtSummary,
          verificationScreenshotUrl: undefined,
        };
      }
      return nextMsg;
    });
    sanitized[key] = {
      ...thread,
      messages: cleanMsgs,
    };
  }
  return sanitized;
}

export function loadChatThreadsFromStorage(scope: string): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getLocalChatsStorageKey(scope));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveChatThreadsToStorage(scope: string, threads: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  const key = getLocalChatsStorageKey(scope);
  try {
    const payload = sanitizeThreadsForStorage(threads, false);
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    try {
      const compact = sanitizeThreadsForStorage(threads, true);
      localStorage.setItem(key, JSON.stringify(compact));
    } catch {}
  }
  try {
    window.dispatchEvent(new CustomEvent(CHAT_THREADS_UPDATED_EVENT, { detail: { scope } }));
  } catch {}
}

export function loadActiveTopicFromStorage(scope: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(getLocalActiveTopicKey(scope)) || '';
  } catch {
    return '';
  }
}

export function saveActiveTopicToStorage(scope: string, topic: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getLocalActiveTopicKey(scope), topic || '');
  } catch {}
}