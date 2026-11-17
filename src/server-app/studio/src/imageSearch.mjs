// Uses the Visual A-Z search app's endpoint: POST {IMAGE_SEARCH_URL} { query, offset } → { images:[...] }
export function createImageSearch({ url, fetchImpl = fetch, timeoutMs = 15000 }) {
  return async function searchImages(query, { count = 6 } = {}) {
    if (!url) return [];
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, offset: 0 }), signal: ctl.signal });
      if (!res.ok) return [];
      const data = await res.json();
      const seen = new Set(); const out = [];
      for (const im of data.images || []) {
        const u = im.url || im.thumbnail; if (!u || seen.has(u)) continue;
        if (/\.svg(\?|$)/i.test(u)) continue;
        if (im.width && im.width < 500) continue;
        seen.add(u); out.push({ url: im.url, thumbnail: im.thumbnail, sourceUrl: im.sourceUrl, sourceDomain: im.sourceDomain, width: im.width, height: im.height, title: im.title });
        if (out.length >= count) break;
      }
      return out;
    } catch { return []; } finally { clearTimeout(t); }
  };
}
