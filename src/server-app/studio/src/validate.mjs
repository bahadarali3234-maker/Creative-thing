import { contrastRatio } from './color.mjs';

export const CHECK_COUNT = 16;
const DEVA_FAMILIES = ['Poppins','Khand','Hind','Rozha One','Yatra One','Kalam','Baloo 2','Rajdhani','Noto Serif Devanagari','Noto Sans Devanagari','Anek Devanagari','Tiro Devanagari Hindi'];

/** Static checks on generated HTML. `assets` = array of ids available. */
export function validateComposition(html, { width, height, assets = [], language = 'en', preResolve = true } = {}) {
  const issues = [];
  const add = (code, severity, msg) => issues.push({ code, severity, msg });
  const h = String(html || '');
  if (!/^\s*<!doctype html/i.test(h)) add('no-doctype', 'error', 'Output must start with <!DOCTYPE html> (no markdown fences or commentary).');
  if (!/id=["']canvas["']/.test(h)) add('no-canvas', 'error', 'Missing root <div id="canvas">.');
  const wOk = new RegExp(`width:\\s*${width}px`).test(h), hOk = new RegExp(`height:\\s*${height}px`).test(h);
  if (!wOk || !hOk) add('bad-size', 'error', `#canvas must be exactly width:${width}px; height:${height}px.`);
  if (!/overflow:\s*hidden/.test(h)) add('no-overflow-hidden', 'warn', '#canvas should have overflow:hidden.');
  if (/<script/i.test(h)) add('script', 'error', '<script> is not allowed.');
  if (/\son[a-z]+\s*=/i.test(h)) add('event-attr', 'error', 'Inline event attributes (onclick, onerror…) are not allowed.');
  if (/<(iframe|video|audio|form|object|embed)\b/i.test(h)) add('forbidden-tag', 'error', 'iframe/video/audio/form/object/embed are not allowed.');
  if (/\b(fetch|XMLHttpRequest|localStorage|sessionStorage)\b/.test(h)) add('forbidden-api', 'error', 'Network/storage APIs are not allowed.');
  if (/javascript:/i.test(h)) add('js-url', 'error', 'javascript: URLs are not allowed.');
  // external resources
  const urls = [...h.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const u of urls) {
    if (/^(data:|#|\{\{asset:)/.test(u)) continue;
    if (/^https:\/\/fonts\.googleapis\.com\//.test(u)) continue;
    add('external-resource', 'error', `External resource not allowed: ${u.slice(0, 80)}`);
  }
  for (const m of h.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const u = m[1];
    if (/^(data:|#|\{\{asset:)/.test(u) || /^%23/.test(u)) continue;
    if (/^https?:/i.test(u)) add('external-css-url', 'error', `External url() not allowed: ${u.slice(0, 80)}`);
  }
  if (/@import/i.test(h)) add('css-import', 'error', '@import is not allowed; use the single font <link>.');
  // placeholders
  const ph = [...h.matchAll(/\{\{asset:([a-z0-9_-]+)\}\}/gi)].map((m) => m[1]);
  if (preResolve) for (const id of ph) if (!assets.includes(id)) add('unknown-asset', 'error', `Placeholder {{asset:${id}}} is not in the asset manifest.`);
  if (!preResolve && /\{\{asset:/.test(h)) add('unresolved-asset', 'error', 'Unresolved asset placeholder remained.');
  if (/<img\b(?![^>]*\bsrc=)/i.test(h)) add('img-no-src', 'warn', '<img> without src.');
  if (h.replace(/data:[^"')]+/g, '').length > 160000) add('too-long', 'warn', 'Document is very long (>160KB without embedded data); simplify.');
  // fonts
  if (language === 'hi' || language === 'hinglish') {
    const fam = [...h.matchAll(/font-family\s*:\s*([^;}"]+)/gi)].map((m) => m[1]).join(',');
    if (!DEVA_FAMILIES.some((f) => fam.includes(f))) add('no-devanagari-font', 'warn', 'Hindi text needs a Devanagari-capable font family (Poppins, Hind, Khand, Noto Sans Devanagari…).');
    if (/text-transform\s*:\s*uppercase/.test(h) && language === 'hi') add('uppercase-devanagari', 'warn', 'Do not uppercase Devanagari text.');
  }
  const errors = issues.filter((i) => i.severity === 'error');
  const failedCodes = new Set(issues.map((i) => i.code));
  return { ok: errors.length === 0, issues, checksRun: CHECK_COUNT, checksPassed: Math.max(0, CHECK_COUNT - failedCodes.size) };
}

export function stripFences(text) {
  let t = String(text || '').trim();
  const m = /```(?:html)?\s*([\s\S]*?)```/i.exec(t);
  if (m && /<!doctype/i.test(m[1])) t = m[1].trim();
  const i = t.search(/<!doctype html/i);
  if (i > 0) t = t.slice(i);
  const j = t.toLowerCase().lastIndexOf('</html>');
  if (j > 0) t = t.slice(0, j + 7);
  return t;
}

export function palettePairContrast(palette) {
  const [bg, surface, , , text] = palette.colors;
  return { bgText: contrastRatio(bg, text), surfaceText: contrastRatio(surface, text) };
}
