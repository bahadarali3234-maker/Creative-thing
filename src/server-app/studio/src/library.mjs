// Loads the private design library from disk. NEVER serve these files or this object to the browser.
import fs from 'node:fs';
import path from 'node:path';

const JSON_FILES = ['sizes','palettes','typography','styles','layouts','effects','motifs','recipes','questions','safety','tools'];

export function loadLibrary(dir) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const raw = {};
  for (const n of JSON_FILES) raw[n] = read(n + '.json');
  raw.instructions = {};
  const insDir = path.join(dir, 'instructions');
  for (const f of fs.readdirSync(insDir)) if (f.endsWith('.md')) raw.instructions[f.replace(/\.md$/, '')] = fs.readFileSync(path.join(insDir, f), 'utf8');

  const by = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const idx = {
    sizes: by(raw.sizes.presets), palettes: by(raw.palettes), fonts: by(raw.typography.pairs), styles: by(raw.styles),
    layouts: by(raw.layouts.layouts), effects: by(raw.effects.effects), motifs: by(raw.motifs.motifs), recipes: by(raw.recipes), questions: by(raw.questions.questions),
  };

  const lib = {
    raw, idx,
    size: (id) => idx.sizes[id] || null,
    recipe: (id) => idx.recipes[id] || idx.recipes.generic,

    /** Compact catalog for the planner (ids + one-liners only). */
    catalog() {
      return {
        recipes: raw.recipes.map((r) => ({ id: r.id, name: r.name, size: r.defaultSize, needsText: r.needsText, styles: r.stylePrefs, layouts: r.layoutPrefs })),
        styles: raw.styles.map((s) => ({ id: s.id, mood: s.mood, palettes: s.palettes, fonts: s.fonts })),
        palettes: raw.palettes.map((p) => ({ id: p.id, mood: p.mood })),
        fonts: raw.typography.pairs.map((f) => ({ id: f.id, hindi: f.scripts.includes('devanagari'), bestFor: f.bestFor })),
        layouts: raw.layouts.layouts.map((l) => ({ id: l.id, bestFor: l.bestFor })),
        effects: raw.effects.effects.map((e) => e.id),
        motifs: raw.motifs.motifs.map((m) => m.id),
        sizes: raw.sizes.presets.map((s) => `${s.id}:${s.w}x${s.h}`),
      };
    },

    /** Full detail of ONLY the chosen items — what the composer needs. */
    slices(plan) {
      const style = idx.styles[plan.style];
      const palette = idx.palettes[plan.palette];
      const fonts = idx.fonts[plan.fonts];
      const layout = idx.layouts[plan.layout];
      const fxIds = [...new Set([...(plan.effects || []), ...((style && style.effects) || [])])];
      const effects = fxIds.map((i) => idx.effects[i]).filter(Boolean);
      const motifIds = new Set(plan.motifs || []);
      for (const e of effects) if (e.type === 'ref' && e.code.startsWith('motif:')) motifIds.add(e.code.slice(6));
      const motifs = [...motifIds].map((i) => idx.motifs[i]).filter(Boolean);
      return { recipe: idx.recipes[plan.recipe], style, palette, fonts, layout, effects: effects.filter((e) => e.type !== 'ref'), motifs, conventions: raw.effects.conventions };
    },
  };
  return lib;
}

/** Cross-reference integrity check (used by tests). Returns list of problems. */
export function checkLibrary(lib) {
  const p = [];
  const { idx, raw } = lib;
  for (const s of raw.styles) {
    for (const x of s.palettes) if (!idx.palettes[x]) p.push(`style ${s.id}: palette ${x} missing`);
    for (const x of s.fonts) if (!idx.fonts[x]) p.push(`style ${s.id}: fonts ${x} missing`);
    for (const x of s.effects) if (!idx.effects[x]) p.push(`style ${s.id}: effect ${x} missing`);
  }
  for (const r of raw.recipes) {
    if (!idx.sizes[r.defaultSize]) p.push(`recipe ${r.id}: size ${r.defaultSize} missing`);
    for (const x of r.altSizes) if (!idx.sizes[x]) p.push(`recipe ${r.id}: altSize ${x} missing`);
    for (const x of r.stylePrefs) if (!idx.styles[x]) p.push(`recipe ${r.id}: style ${x} missing`);
    for (const x of r.layoutPrefs) if (!idx.layouts[x]) p.push(`recipe ${r.id}: layout ${x} missing`);
  }
  for (const e of raw.effects.effects) if (e.type === 'ref' && !idx.motifs[e.code.replace('motif:', '')]) p.push(`effect ${e.id}: motif missing`);
  for (const f of raw.typography.pairs) if (!/^https:\/\/fonts\.googleapis\.com\/css2\?/.test(f.googleFonts)) p.push(`font ${f.id}: bad url`);
  return p;
}
