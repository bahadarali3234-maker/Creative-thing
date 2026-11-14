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