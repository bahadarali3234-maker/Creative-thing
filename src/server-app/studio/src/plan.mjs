import { contrastRatio, readableOn } from './color.mjs';
import { parseCustomSize } from './intent.mjs';

export function extractJson(text) {
  const t = String(text || '');
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  const body = fence ? fence[1] : t;
  const a = body.indexOf('{'), b = body.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('No JSON object found in model output');
  return JSON.parse(body.slice(a, b + 1));
}

function pick(idx, id, fallbacks) { if (id && idx[id]) return id; for (const f of fallbacks) if (idx[f]) return f; return Object.keys(idx)[0]; }

/** Repair/clamp a planner plan so the composer can never receive invalid ids, sizes or unsafe queries. */
export function normalizePlan(plan, { library, resolved, intent, uploads = [] }) {
  const warnings = [];
  const p = { ...plan };
  if (p.refuse) return { plan: p, warnings, refused: true };
  const { idx, raw } = library;
  const recipeId = idx.recipes[p.recipe] ? p.recipe : (intent.recipe && idx.recipes[intent.recipe] ? intent.recipe : 'generic');
  const recipe = idx.recipes[recipeId];
  p.recipe = recipeId;

  // size: the USER's size always wins
  if (resolved.size) p.size = { w: resolved.size.w, h: resolved.size.h, preset: resolved.size.preset || null };
  else if (!p.size || !p.size.w) { const s = idx.sizes[recipe.defaultSize]; p.size = { w: s.w, h: s.h, preset: s.id }; }
  p.size.w = Math.max(200, Math.min(4096, Math.round(p.size.w))); p.size.h = Math.max(200, Math.min(4096, Math.round(p.size.h)));

  p.language = ['hi', 'en', 'hinglish'].includes(p.language) ? p.language : (resolved.language || 'en');
  const hindi = p.language === 'hi' || p.language === 'hinglish' || /[\u0900-\u097F]/.test(JSON.stringify(p.text || {}));

  p.style = resolved.style && idx.styles[resolved.style] ? resolved.style : pick(idx.styles, p.style, recipe.stylePrefs);
  const style = idx.styles[p.style];
  p.palette = pick(idx.palettes, p.palette, style.palettes);
  let fontsId = pick(idx.fonts, p.fonts, style.fonts);
  if (hindi && !idx.fonts[fontsId].scripts.includes('devanagari')) { const alt = style.fonts.find((f) => idx.fonts[f].scripts.includes('devanagari')) || 'hi-bold-poppins'; warnings.push({ code: 'font-swapped', detail: `${fontsId} → ${alt} (Devanagari)` }); fontsId = alt; }
  p.fonts = fontsId;
  p.layout = pick(idx.layouts, p.layout, recipe.layoutPrefs);
  p.effects = (Array.isArray(p.effects) ? p.effects : []).filter((e) => idx.effects[e]);
  p.motifs = (Array.isArray(p.motifs) ? p.motifs : []).filter((m) => idx.motifs[m]);

  p.text = p.text && typeof p.text === 'object' ? p.text : {};
  if (resolved.text && !p.text.title) p.text.title = resolved.text;

  // palette contrast safety
  const pal = idx.palettes[p.palette]; const ratio = contrastRatio(pal.colors[0], pal.colors[4]);
  p.paletteOverride = null;
  if (ratio !== null && ratio < 4.5) { p.paletteOverride = { text: readableOn(pal.colors[0]) }; warnings.push({ code: 'contrast-fixed', detail: `palette text/bg ${ratio.toFixed(1)}:1 → using ${p.paletteOverride.text}` }); }

  // assets
  const bad = new RegExp('\\b(' + raw.safety.blockedQueryTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
  const uploadIds = new Set(uploads.map((u) => u.id));
  const out = [];
  for (const a of (Array.isArray(p.assets) ? p.assets : [])) {
    if (out.length >= raw.safety.maxSearchAssets) { warnings.push({ code: 'asset-capped' }); break; }
    const id = String(a.id || 'a' + (out.length + 1)).replace(/[^a-z0-9_-]/gi, '').slice(0, 12) || 'a' + (out.length + 1);
    if (a.source === 'upload') {
      if (!uploadIds.has(a.uploadId)) { warnings.push({ code: 'upload-missing', detail: a.uploadId }); continue; }
      const faceUploadId = a.faceUploadId && uploadIds.has(a.faceUploadId) ? a.faceUploadId : null;
      out.push({ ...a, id, role: a.role || 'subject', ...(faceUploadId ? { faceUploadId } : {}) });
    }
    else if (a.source === 'search') {
      if (resolved.web === 'no') { warnings.push({ code: 'web-disabled-by-user' }); continue; }
      const q = String(a.query || '').trim().slice(0, 80);
      if (!q || q.split(/\s+/).length > 10) { warnings.push({ code: 'bad-query' }); continue; }
      if (bad.test(q)) { warnings.push({ code: 'blocked-query', detail: q }); continue; }
      const faceUploadId = a.faceUploadId && uploadIds.has(a.faceUploadId) ? a.faceUploadId : null;
      out.push({ ...a, id, query: q, role: a.role || 'subject', ...(faceUploadId ? { faceUploadId } : {}) });
    }
  }
  // user answered "no photo" → drop upload assets
  p.assets = resolved.photo === 'no' ? out.filter((a) => a.source !== 'upload') : out;
  if (resolved.photo === 'yes-cutout') p.assets = p.assets.map((a) => (a.source === 'upload' ? { ...a, removeBackground: true } : a));
  if (resolved.photo === 'yes-asis') p.assets = p.assets.map((a) => (a.source === 'upload' ? { ...a, removeBackground: false } : a));
  p.rationale = String(p.rationale || '').trim();
  return { plan: p, warnings, refused: false };
}

export function fontLinkFor(library, plan) { return library.idx.fonts[plan.fonts].googleFonts; }
