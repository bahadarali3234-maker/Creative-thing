const WORKSPACE_SESSION_STORAGE_KEY = 'think_creative_ws_session_v1';

export function getWorkspaceSessionId(): string {
  if (typeof window === 'undefined') return 'ws_default_workspace';
  try {
    const existing = localStorage.getItem(WORKSPACE_SESSION_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{12,72}$/.test(existing)) {
      return existing;
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const id = `ws_${hex}`;
    localStorage.setItem(WORKSPACE_SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return 'ws_default_workspace';
  }
}

export function buildWorkspaceAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Workspace-Session': getWorkspaceSessionId(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
