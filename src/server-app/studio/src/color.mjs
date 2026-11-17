export function hexToRgb(h) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h).trim());
  if (!m) return null;
  let s = m[1]; if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrastRatio(a, b) {
  const A = hexToRgb(a), B = hexToRgb(b); if (!A || !B) return null;
  const la = luminance(A), lb = luminance(B); const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
/** Returns #ffffff or #0b0b0b, whichever contrasts more with bg. */
export function readableOn(bg) { return (contrastRatio('#ffffff', bg) || 0) >= (contrastRatio('#0b0b0b', bg) || 0) ? '#ffffff' : '#0b0b0b'; }
