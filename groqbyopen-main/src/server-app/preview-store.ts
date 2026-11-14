// Generated website previews are stored in Lovable Cloud (expire after 1 hour).
async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}

export const previewStore = {
  async set(id: string, html: string) {
    const db = await admin();
    await db.from('site_previews').insert({ id, html });
  },
  async get(id: string): Promise<{ html: string } | null> {
    const db = await admin();
    const { data } = await db
      .from('site_previews')
      .select('html, created_at')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    if (Date.now() - new Date(data.created_at).getTime() > 3600000) return null;
    return { html: data.html };
  },
};
