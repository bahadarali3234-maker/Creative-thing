import { analyzeRequestSignals, parseCustomSize } from './intent.mjs';

/** Decide which questions to ask (max 4), in the app's tappable-options format. */
export function pickQuestions({ message, intent, attachments = [], answers = {}, library }) {
  const lang = intent.lang === 'hi' ? 'hi' : 'en';
  const sig = analyzeRequestSignals(message);
  const recipe = library.recipe(intent.recipe || 'generic');
  const hasUpload = attachments.some((a) => /^image\//.test(a.type || '') || a.kind === 'image');
  const out = [];
  const add = (q, options) => out.push({ id: q.id, type: q.type, allowCustomText: !!q.allowCustomText, question: q.ask[lang] || q.ask.en, options: (options || q.options || []).map((o) => ({ id: o.id, label: o.label[lang] || o.label.en })) });

  if (!answers.size && !sig.sizeKnown) {
    const q = library.idx.questions.size;
    const def = library.size(recipe.defaultSize);
    const presetOpts = [recipe.defaultSize, ...recipe.altSizes, 'ig-square', 'yt-thumbnail', 'story-reel', 'poster-2-3'];
    const seen = new Set(); const opts = [];
    for (const id of presetOpts) { const s = library.size(id); if (s && !seen.has(id) && opts.length < 5) { seen.add(id); opts.push({ id: 'preset:' + id, label: { en: `${s.name} ${s.w}×${s.h}`, hi: `${s.name} ${s.w}×${s.h}` } }); } }
    opts.push(q.options.find((o) => o.id === 'custom'));
    add(q, opts);
    out[out.length - 1].default = 'preset:' + (def ? def.id : 'ig-square');
  }
  if (hasUpload && !answers.photo) add(library.idx.questions.photo);
  if (!answers.style && !sig.styleKnown) {
    const q = library.idx.questions.style;
    const opts = [q.options[0], ...recipe.stylePrefs.slice(0, 4).map((id) => { const s = library.idx.styles[id]; return { id: 'style:' + id, label: { en: s.name, hi: s.name } }; })];
    add(q, opts); out[out.length - 1].default = 'auto';
  }
  if (recipe.needsText && !answers.text && !sig.quotedText) add(library.idx.questions.text);
  return out.slice(0, 4);
}

/** Merge answers into a structured brief the planner receives. */
export function resolveAnswers({ message, answers = {}, intent, library }) {
  const sig = analyzeRequestSignals(message);
  const recipe = library.recipe(intent.recipe || 'generic');
  let size = null;
  const a = answers.size;
  if (a && a.startsWith('preset:')) { const s = library.size(a.slice(7)); if (s) size = { w: s.w, h: s.h, preset: s.id }; }
  if (!size && (answers.sizeCustom || (a === 'custom'))) { const c = sig.custom || null; const t = answers.sizeCustom ? parseCustomSize(answers.sizeCustom) : null; size = t || c; }
  if (!size && sig.custom) size = sig.custom;
  if (!size && sig.preset) { const s = library.size(sig.preset); if (s) size = { w: s.w, h: s.h, preset: s.id }; }
  if (!size) { const s = library.size(recipe.defaultSize); size = { w: s.w, h: s.h, preset: s.id }; }
  const style = answers.style && answers.style.startsWith('style:') ? answers.style.slice(6) : null;
  return { size, style, text: answers.text || sig.quotedText || null, photo: answers.photo || null, web: answers.web || null, language: answers.language || sig.lang };
}
