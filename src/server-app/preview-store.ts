// Generated website previews are stored in Lovable Cloud or in-memory fallback.
const inMemoryPreviews = new Map<string, { html: string; createdAt: number }>();

async function admin() {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    return supabaseAdmin;
  } catch {
    return null;
  }
}

export const previewStore = {
  async set(id: string, html: string) {
    inMemoryPreviews.set(id, { html, createdAt: Date.now() });
    try {
      const db = await admin();
      if (db) {
        await db.from('site_previews').insert({ id, html });
      }
    } catch (err) {
      // In-memory store already saved it
    }
  },
  async get(id: string): Promise<{ html: string } | null> {
    const cached = inMemoryPreviews.get(id);
    if (cached) {
      if (Date.now() - cached.createdAt > 3600000) {
        inMemoryPreviews.delete(id);
        return null;
      }
      return { html: cached.html };
    }

    try {
      const db = await admin();
      if (!db) return null;
      const { data } = await db
        .from('site_previews')
        .select('html, created_at')
        .eq('id', id)
        .maybeSingle();
      if (!data) return null;
      if (Date.now() - new Date(data.created_at).getTime() > 3600000) return null;
      return { html: data.html };
    } catch {
      return null;
    }
  },
};
