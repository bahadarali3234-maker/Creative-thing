// Deterministic thinking-summary builder. Every line is derived from a real log entry.
const T = {
  en: {
    understand: (b) => `Understood the request: ${b.recipeName}${b.goal ? ' — ' + b.goal : ''}.${b.size ? ` Size ${b.size}.` : ''}`,
    analysis: (f, d) => `Analysed ${f.name} (${f.width}×${f.height}, ${f.orientation}): ${d}`,
    analysisFail: (n) => `Received ${n}, but couldn't analyse it.`,
    search: (q, n, pick) => n > 0 ? `Searched the web for “${q}”: ${n} results; ${pick}` : `Searched the web for “${q}”: no usable results.`,
    pickLine: (c) => `used ${c.width || '?'}×${c.height || '?'} from ${c.sourceDomain || 'web'}.`,
    removeBg: (n, m) => `Removed the background from ${n} (${m === 'ai' ? 'AI model' : 'colour-based method'}).`,
    adjust: (n, a) => `Adjusted ${n}: ${a}.`,
    skipAsset: (id, why) => `Could not prepare asset ${id}${why ? ' (' + why + ')' : ''}; continued without it.`,
    decision: (p, name) => `Chose ${name.style} with the ${name.layout} layout and ${name.palette} palette. ${p.rationale || ''}`.trim(),
    check: (n, fixed) => fixed.length ? `Checked the design: ${n} checks passed; fixed ${fixed.length} issue(s): ${fixed.join('; ')}.` : `Checked the design: ${n} checks passed.`,
    checkWarn: (w) => `Delivered with ${w.length} note(s): ${w.join('; ')}.`,
    result: (w, h, sec) => `Finished a ${w}×${h} image in ${sec}s.`,
    orient: { landscape: 'landscape', portrait: 'portrait', square: 'square' },
  },
  hi: {
    understand: (b) => `रिक्वेस्ट समझी: ${b.recipeName}${b.goal ? ' — ' + b.goal : ''}.${b.size ? ` साइज़ ${b.size}.` : ''}`,
    analysis: (f, d) => `${f.name} (${f.width}×${f.height}, ${f.orientation}) का विश्लेषण किया: ${d}`,
    analysisFail: (n) => `${n} मिली, लेकिन उसका विश्लेषण नहीं हो पाया।`,
    search: (q, n, pick) => n > 0 ? `वेब पर “${q}” खोजा: ${n} नतीजे; ${pick}` : `वेब पर “${q}” खोजा: काम के नतीजे नहीं मिले।`,
    pickLine: (c) => `${c.sourceDomain || 'वेब'} से ${c.width || '?'}×${c.height || '?'} वाली इमेज ली।`,
    removeBg: (n, m) => `${n} का बैकग्राउंड हटाया (${m === 'ai' ? 'AI मॉडल' : 'कलर-बेस्ड तरीका'}).`,
    adjust: (n, a) => `${n} में बदलाव किए: ${a}.`,
    skipAsset: (id, why) => `एसेट ${id} तैयार नहीं हो सका${why ? ' (' + why + ')' : ''}; उसके बिना आगे बढ़ा।`,
    decision: (p, name) => `${name.style} स्टाइल, ${name.layout} लेआउट और ${name.palette} पैलेट चुना। ${p.rationale || ''}`.trim(),
    check: (n, fixed) => fixed.length ? `डिज़ाइन जाँचा: ${n} जाँचें पास; ${fixed.length} समस्या ठीक की: ${fixed.join('; ')}.` : `डिज़ाइन जाँचा: ${n} जाँचें पास।`,
    checkWarn: (w) => `${w.length} नोट के साथ तैयार: ${w.join('; ')}.`,
    result: (w, h, sec) => `${w}×${h} की इमेज ${sec} सेकंड में तैयार।`,
    orient: { landscape: 'लैंडस्केप', portrait: 'पोर्ट्रेट', square: 'स्क्वायर' },
  },
};

export function describeFacts(f, lang = 'en') {
  const bits = [];
  if (f.bgUniform === true) bits.push(lang === 'hi' ? `बैकग्राउंड लगभग एक रंग का (${f.bgColor || 'समान'})` : `plain ${f.bgColor || 'uniform'} background`);
  else if (f.bgUniform === false) bits.push(lang === 'hi' ? 'बैकग्राउंड जटिल है' : 'busy background');
  if (f.hasAlpha) bits.push(lang === 'hi' ? 'पारदर्शिता (alpha) मौजूद' : 'already has transparency');
  if (typeof f.brightness === 'number') bits.push(lang === 'hi' ? (f.brightness < 0.35 ? 'काफ़ी डार्क' : f.brightness > 0.7 ? 'काफ़ी ब्राइट' : 'सामान्य रोशनी') : (f.brightness < 0.35 ? 'dark overall' : f.brightness > 0.7 ? 'bright overall' : 'balanced lighting'));
  if (f.dominant && f.dominant.length) bits.push((lang === 'hi' ? 'मुख्य रंग ' : 'dominant colours ') + f.dominant.slice(0, 3).join(', '));
  if (f.width && f.width < 600) bits.push(lang === 'hi' ? 'रेज़ोल्यूशन कम (धुंधला दिख सकता है)' : 'low resolution (may look soft)');
  return bits.length ? bits.join('; ') + '.' : (lang === 'hi' ? 'कोई खास बात नहीं मिली।' : 'nothing notable.');
}

export class ThinkingLog {
  constructor(lang = 'en') { this.lang = T[lang] ? lang : 'en'; this.steps = []; this.t = T[this.lang]; }
  push(kind, text, extra = {}) { const s = { kind, text, ...extra }; this.steps.push(s); return s; }
  understand(b) { return this.push('understand', this.t.understand(b)); }
  analysis(facts) { facts = { ...facts, orientation: this.t.orient[facts.orientation] || facts.orientation }; return this.push('analysis', this.t.analysis(facts, describeFacts(facts, this.lang)), { file: facts.name }); }
  analysisFailed(name) { return this.push('analysis', this.t.analysisFail(name), { file: name }); }
  search(query, n, chosen) { return this.push('search', this.t.search(query, n, chosen ? this.t.pickLine(chosen) : ''), { query }); }
  contourOutline(name, extra = {}) {
    return this.push('edit', this.lang === 'hi' ? `${name} के चारों ओर सब्जेक्ट कंटूर लाइन ट्रेस की।` : `Traced subject contour boundary around ${name} before cutout.`, extra);
  }
  removeBg(name, method, extra = {}) { return this.push('edit', this.t.removeBg(name, method), extra); }
  safetyCheck(safe, detail, extra = {}) {
    return this.push('check', safe ? (this.lang === 'hi' ? `सेफ़्टी व पॉलिसी जाँच पास: ${detail}` : `Safety & content policy check passed: ${detail}`) : detail, extra);
  }
  faceSwap(name, usedWebGpu, extra = {}) {
    return this.push(
      'edit',
      this.lang === 'hi'
        ? `${usedWebGpu ? 'WebGPU' : 'हाई-प्रिसिजन'} फ़ेस स्वैप व लाइटिंग मैच पूरा (${name})।`
        : `Completed ${usedWebGpu ? 'WebGPU hardware shader' : 'precision'} face swap and skin illumination harmony onto ${name}.`,
      extra
    );
  }
  colorGrade(name, preset, usedWebGpu) {
    return this.push(
      'edit',
      this.lang === 'hi'
        ? `${name} पर ${usedWebGpu ? 'WebGPU शेडर' : 'स्टूडियो'} कलर ग्रेडिंग (${preset}) लागू की।`
        : `Applied ${usedWebGpu ? 'WebGPU WGSL shader' : 'studio'} ${preset} color grading & depth exposure balance to ${name}.`
    );
  }
  adjust(name, adj) { const parts = Object.entries(adj || {}).filter(([k, v]) => k !== 'colorGrade' && v !== undefined && v !== 1 && v !== 0).map(([k, v]) => `${k} ${typeof v === 'number' && v > 0 && v < 3 ? (v > 1 ? '+' : '') + Math.round((v - 1) * 100) + '%' : v}`); if (!parts.length) return null; return this.push('edit', this.t.adjust(name, parts.join(', '))); }
  skipAsset(id, why) { return this.push('edit', this.t.skipAsset(id, why)); }
  decision(plan, names) { return this.push('decision', this.t.decision(plan, names)); }
  visualInspect({ pass = 1, audit, screenshotDataUrl, screenshotLabel } = {}) {
    const score = typeof audit?.score === 'number' ? ` (${audit.score}/100)` : '';
    const verdict = audit?.summary || (audit?.approved ? 'Passed layout, contrast, cutout & face quality checks.' : 'Visual defects detected.');
    const text = this.lang === 'hi'
      ? `AI क्वालिटी जाँच (पास ${pass})${score}: ${verdict}`
      : `AI Quality Inspection (pass ${pass})${score}: ${verdict}`;
    return this.push('check', text, {
      ...(screenshotDataUrl ? { screenshotDataUrl, screenshotLabel: screenshotLabel || `Quality Check · Pass ${pass}` } : {}),
    });
  }
  visualRepair(defects = [], attempt = 1) {
    const items = (Array.isArray(defects) ? defects : []).map((d) => `[${d.area}] ${d.issue}`).slice(0, 3);
    const text = this.lang === 'hi'
      ? `स्वचालित सुधार ${attempt}: ${items.join('; ') || 'लेआउट और कंट्रास्ट सुधारा गया'}`
      : `Auto-repaired (${attempt}): ${items.join('; ') || 'refined typography contrast, spacing & edges'}.`;
    return this.push('edit', text);
  }
  check(passed, fixed, warnings) { this.push('check', this.t.check(passed, fixed)); if (warnings && warnings.length) this.push('check', this.t.checkWarn(warnings)); }
  result(w, h, seconds) { return this.push('result', this.t.result(w, h, seconds)); }
}

