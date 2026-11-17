import { ThinkingLog } from './thinking.mjs';
import { resolveAnswers } from './questions.mjs';
import { extractJson, normalizePlan, fontLinkFor } from './plan.mjs';
import { validateComposition, stripFences } from './validate.mjs';
import { createLocalPlan, composeLocalHtml, applyVisualDefectPlanAdjustments } from './localComposer.mjs';

const fill = (tpl, map) => Object.entries(map).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(String(v)), tpl);
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * job: { message, intent, answers, attachments:[{id,name,type,facts}] }
 * deps: { llm, library, searchImages, clientTask(task,payload), emit(evt), now() }
 */
export async function runStudioJob(job, deps) {
  const { llm, library, searchImages, inspectDesign, clientTask, emit } = deps;
  const now = deps.now || (() => Date.now());
  const t0 = now();
  const lang = job.intent && job.intent.lang === 'hi' ? 'hi' : 'en';
  const log = new ThinkingLog(lang);
  const sources = [], warnings = [];
  const progress = (percent, stage, label) => emit({ type: 'progress', percent, stage, label, elapsedMs: now() - t0 });
  const step = (s) => { if (s) emit({ type: 'step', step: s }); return s; };

  progress(2, 'understand', 'Understanding');
  const attachments = job.attachments || [];
  for (const a of attachments) {
    if (a.facts) step(log.analysis({ name: a.name, ...a.facts }));
    else step(log.analysisFailed(a.name || a.id));
  }

  // ---- 1. PLAN ----
  const resolved = resolveAnswers({ message: job.message, answers: job.answers || {}, intent: job.intent, library });
  const catalog = library.catalog();
  const plannerSystem = library.raw.instructions.planner + '\n\n# CATALOG\n' + JSON.stringify(catalog);
  const plannerUser = JSON.stringify({ request: job.message, language: resolved.language, userAnswers: resolved, uploads: attachments.map((a) => ({ id: a.id, name: a.name, facts: a.facts || null })), recipeHint: job.intent.recipe || null, ...(job.previousPlan ? { previousPlan: job.previousPlan, isEdit: true } : {}) });
  let rawPlan;
  if (llm && typeof llm.chat === 'function') {
    for (let i = 0; i < 2 && !rawPlan; i++) {
      try {
        const out = await llm.chat(
          [{ role: 'system', content: plannerSystem }, { role: 'user', content: plannerUser + (i ? '\n\nReturn ONLY the JSON object.' : '') }],
          { temperature: 0.5, maxTokens: 2500 }
        );
        rawPlan = extractJson(out);
      } catch {
        // Fallback smoothly to built-in Creative Director engine below
      }
    }
  }
  const norm = rawPlan
    ? normalizePlan(rawPlan, { library, resolved, intent: job.intent, uploads: attachments })
    : createLocalPlan({ message: job.message, resolved, intent: job.intent, uploads: attachments, library, previousPlan: job.previousPlan || null });
  if (norm.refused) { emit({ type: 'refused', reason: String(norm.plan.refuse.reason || norm.plan.refuse).slice(0, 300) }); return { refused: true }; }
  const plan = norm.plan; warnings.push(...norm.warnings.map((w) => w.code + (w.detail ? ': ' + w.detail : '')));
  const recipe = library.recipe(plan.recipe), style = library.idx.styles[plan.style], layout = library.idx.layouts[plan.layout], palette = library.idx.palettes[plan.palette];
  step(log.understand({ recipeName: recipe.name, goal: plan.brief && plan.brief.goal, size: `${plan.size.w}×${plan.size.h}` }));
  step(log.decision(plan, { style: style.name, layout: layout.name, palette: palette.name }));
  progress(15, 'assets', 'Preparing assets');

  // ---- 2. ASSETS ----
  const manifest = [], assetData = {};
  const n = plan.assets.length;
  for (let i = 0; i < n; i++) {
    const a = plan.assets[i];
    try {
      let candidates = [];
      if (a.source === 'search') {
        candidates = await searchImages(a.query, { count: 8 });
        if (!candidates.length) {
          step(log.search(a.query, 0));
          step(log.skipAsset(a.id, 'no results'));
          continue;
        }
      }

      if (a.role === 'face_swap_target' && a.faceUploadId) {
        progress(18, 'assets', 'Safety & face analysis');
        const res = await clientTask('face_swap', {
          assetId: a.id,
          source: a.source,
          targetUploadId: a.uploadId || null,
          faceUploadId: a.faceUploadId,
          candidates,
          promptText: job.message,
          maxSize: Math.min(2000, Math.max(plan.size.w, plan.size.h)),
        });

        if (res && res.refused) {
          const reason = String(res.reason || 'Safety & policy guidelines do not allow this face-swap request.');
          step(log.safetyCheck(false, reason));
          emit({ type: 'refused', reason });
          return { refused: true };
        }
        if (!res || res.error || !res.dataUrl) {
          if (a.source === 'search') step(log.search(a.query, candidates.length));
          step(log.skipAsset(a.id, res && res.error));
          continue;
        }
        const name = a.source === 'upload'
          ? ((attachments.find((x) => x.id === a.uploadId) || {}).name || 'Target Scene')
          : ((res.chosen && res.chosen.title) || a.query);
        if (a.source === 'search') {
          step(log.search(a.query, candidates.length, res.chosen || candidates[0]));
          const c = res.chosen || candidates[0];
          if (c) sources.push({ domain: c.sourceDomain, url: c.sourceUrl, title: c.title });
        }
        step(log.safetyCheck(true, 'Passed NSFW & policy safety verification'));
        step(log.faceSwap(name, !!res.usedWebGpu, {
          ...(res.alignmentScreenshotDataUrl ? { screenshotDataUrl: res.alignmentScreenshotDataUrl, screenshotLabel: 'WebGPU Face Alignment Target' } : {}),
        }));
        if (res.finalScreenshotDataUrl) {
          step(log.push('edit', 'Blended facial lighting, skin tone, and jaw feathering.', {
            screenshotDataUrl: res.finalScreenshotDataUrl,
            screenshotLabel: 'WebGPU Blended Composite',
          }));
        }
        if (res.palette && !plan.extractedPalette) {
          plan.extractedPalette = res.palette;
        }
        assetData[a.id] = res.dataUrl;
        manifest.push({ id: a.id, name, role: 'face_swap_target', width: res.width, height: res.height, hasAlpha: false });
      } else {
        const res = await clientTask('prepare_asset', {
          assetId: a.id,
          source: a.source,
          uploadId: a.uploadId || null,
          candidates,
          removeBackground: !!a.removeBackground,
          adjust: a.adjust || {},
          maxSize: Math.min(2000, Math.max(plan.size.w, plan.size.h)),
        });
        if (!res || res.error || !res.dataUrl) {
          if (a.source === 'search') step(log.search(a.query, candidates.length));
          step(log.skipAsset(a.id, res && res.error));
          continue;
        }
        const name = a.source === 'upload' ? ((attachments.find((x) => x.id === a.uploadId) || {}).name || a.uploadId) : (res.chosen && res.chosen.title) || a.query;
        if (a.source === 'search') {
          step(log.search(a.query, candidates.length, res.chosen || candidates[0]));
          const c = res.chosen || candidates[0];
          if (c) sources.push({ domain: c.sourceDomain, url: c.sourceUrl, title: c.title });
          if (res.facts) step(log.analysis({ name, ...res.facts }));
        }
        if (a.removeBackground && res.outlineScreenshotDataUrl) {
          step(log.contourOutline(name, {
            screenshotDataUrl: res.outlineScreenshotDataUrl,
            screenshotLabel: 'Subject Contour Line Trace',
          }));
        }
        if (a.removeBackground && res.method && res.method !== 'none') {
          step(log.removeBg(name, res.method));
        }
        if (res.palette && (a.role === 'background' || !plan.extractedPalette)) {
          plan.extractedPalette = res.palette;
        }
        step(log.adjust(name, a.adjust));
        assetData[a.id] = res.dataUrl;
        manifest.push({ id: a.id, name, role: a.role, width: res.width, height: res.height, hasAlpha: !!(res.facts && res.facts.hasAlpha) || !!(a.removeBackground && res.method && res.method !== 'none') });
      }
    } catch (e) { step(log.skipAsset(a.id, String(e.message || e).slice(0, 80))); }
    progress(15 + Math.round(((i + 1) / Math.max(1, n)) * 30), 'assets', 'Preparing assets');
  }
  progress(45, 'compose', 'Designing');

  // ---- 3. COMPOSE ----
  const slices = library.slices(plan);
  if (plan.extractedPalette && slices.palette) {
    const ep = plan.extractedPalette;
    slices.palette = {
      ...slices.palette,
      colors: [ep.bgHex, ep.surfaceHex, ep.primaryHex, ep.accentHex, ep.textHex],
    };
  }
  if (plan.paletteOverride && slices.palette) { slices.palette = { ...slices.palette, colors: [...slices.palette.colors.slice(0, 4), plan.paletteOverride.text] }; }
  const U = +(plan.size.w / 100).toFixed(3);
  const composerSystem = fill(library.raw.instructions.composer, { W: plan.size.w, H: plan.size.h, U });
  const composerUser = JSON.stringify({ plan: { ...plan, assets: undefined }, canvas: { width: plan.size.w, height: plan.size.h, unit: U }, fontLink: fontLinkFor(library, plan), library: slices, assetManifest: manifest });
  const messages = [{ role: 'system', content: composerSystem }, { role: 'user', content: composerUser }];
  let html = '';
  let usedLocalComposer = false;
  if (llm && typeof llm.chat === 'function') {
    try {
      html = stripFences(await llm.chat(messages, { temperature: 0.6, maxTokens: 7000 }));
    } catch {
      html = '';
    }
  }
  if (!html) {
    html = composeLocalHtml({ plan, library, assetManifest: manifest });
    usedLocalComposer = true;
  }
  progress(85, 'validate', 'Checking');

  // ---- 4. VALIDATE + REPAIR ----
  const assetIds = manifest.map((m) => m.id);
  const fixed = [];
  let v = validateComposition(html, { width: plan.size.w, height: plan.size.h, assets: assetIds, language: plan.language });
  if (!v.ok && !usedLocalComposer && llm && typeof llm.chat === 'function') {
    for (let r = 0; r < 2 && !v.ok; r++) {
      const errs = v.issues.filter((i) => i.severity === 'error');
      errs.forEach((e) => fixed.push(e.msg.replace(/\.$/, '')));
      const repairSys = fill(library.raw.instructions.repair, { ISSUES: errs.map((e) => `- [${e.code}] ${e.msg}`).join('\n') });
      try {
        html = stripFences(await llm.chat([...messages, { role: 'assistant', content: html }, { role: 'user', content: repairSys }], { temperature: 0.3, maxTokens: 7000 }));
        v = validateComposition(html, { width: plan.size.w, height: plan.size.h, assets: assetIds, language: plan.language });
      } catch {
        break;
      }
    }
  }
  if (!v.ok) {
    html = composeLocalHtml({ plan, library, assetManifest: manifest });
    v = validateComposition(html, { width: plan.size.w, height: plan.size.h, assets: assetIds, language: plan.language });
    fixed.push('Applied high-contrast studio layout guard');
  }
  if (!v.ok) warnings.push('validation-failed: ' + v.issues.filter((i) => i.severity === 'error').map((i) => i.code).join(','));
  warnings.push(...v.issues.filter((i) => i.severity === 'warn').map((i) => i.code));

  // ---- 5. RESOLVE ASSETS + VISUAL AI QUALITY INSPECTION & SELF-REPAIR ----
  const resolveAssetTokens = (rawHtml) =>
    String(rawHtml || '').replace(/\{\{asset:([a-z0-9_-]+)\}\}/gi, (_, id) => assetData[id] || PIXEL);

  let templateHtml = html;
  let activePlan = plan;
  html = resolveAssetTokens(templateHtml);

  if (typeof inspectDesign === 'function' && typeof clientTask === 'function') {
    for (let pass = 0; pass < 3; pass++) {
      try {
        progress(86 + pass * 4, 'inspect', pass === 0 ? 'Inspecting quality' : `Fixing & re-checking (${pass}/2)`);
        const snap = await clientTask('render_preview', {
          html,
          width: activePlan.size.w,
          height: activePlan.size.h,
        });
        if (!snap || snap.error || !snap.dataUrl) {
          if (pass === 0) warnings.push('visual-inspect-skipped: preview capture unavailable');
          break;
        }

        const audit = await inspectDesign({
          imageDataUrl: snap.dataUrl,
          prompt: job.message,
          plan: activePlan,
          width: activePlan.size.w,
          height: activePlan.size.h,
        });

        step(
          log.visualInspect({
            pass: pass + 1,
            audit,
            screenshotDataUrl: snap.dataUrl,
            screenshotLabel: audit.approved ? `Quality Approved · Pass ${pass + 1}` : `Inspection Pass ${pass + 1} · Issues Found`,
          })
        );

        if (audit.approved || !audit.defects || audit.defects.length === 0) {
          break;
        }

        if (pass === 2) {
          warnings.push('visual-check: ' + audit.defects.map((d) => d.area).slice(0, 3).join(','));
          break;
        }

        // Apply automatic visual repair based on inspector findings
        step(log.visualRepair(audit.defects, pass + 1));
        audit.defects.slice(0, 3).forEach((d) => fixed.push(`${d.area}: ${d.issue}`));

        let repairedTemplate = '';
        if (!usedLocalComposer && llm && typeof llm.chat === 'function') {
          const defectSummary = audit.defects
            .map((d) => `- [${d.area} · ${d.severity}] ${d.issue} -> FIX: ${d.fixInstruction}`)
            .join('\n');
          const visualRepairPrompt = fill(library.raw.instructions.repair, {
            ISSUES:
              `VISUAL INSPECTION DEFECTS (the rendered PNG failed visual QA; fix ALL spacing, contrast, edge clipping, cutout halo, or face-crop defects while preserving <!DOCTYPE html>, #canvas ${activePlan.size.w}px×${activePlan.size.h}px, and {{asset:ID}} tokens):\n` +
              defectSummary,
          });
          try {
            const candidate = stripFences(
              await llm.chat(
                [...messages, { role: 'assistant', content: templateHtml }, { role: 'user', content: visualRepairPrompt }],
                { temperature: 0.25, maxTokens: 7000 }
              )
            );
            const cv = validateComposition(candidate, {
              width: activePlan.size.w,
              height: activePlan.size.h,
              assets: assetIds,
              language: activePlan.language,
            });
            if (cv.ok) {
              repairedTemplate = candidate;
            }
          } catch {
            // Fall through to deterministic repair guard below
          }
        }

        if (!repairedTemplate) {
          activePlan = applyVisualDefectPlanAdjustments(activePlan, audit.defects);
          repairedTemplate = composeLocalHtml({ plan: activePlan, library, assetManifest: manifest });
          usedLocalComposer = true;
        }

        templateHtml = repairedTemplate;
        html = resolveAssetTokens(templateHtml);
      } catch (inspErr) {
        warnings.push('visual-inspect-error: ' + String(inspErr?.message || inspErr).slice(0, 60));
        break;
      }
    }
  }

  const fin = validateComposition(html, { width: activePlan.size.w, height: activePlan.size.h, language: activePlan.language, preResolve: false });
  if (!fin.ok) warnings.push('final-check: ' + fin.issues.map((i) => i.code).join(','));
  step(log.check(v.checksPassed, [...new Set(fixed)].slice(0, 4), warnings.filter((w) => !/^(font-swapped|contrast-fixed)/.test(w)).slice(0, 3)));
  progress(100, 'done', 'Done');
  const seconds = Math.max(1, Math.round((now() - t0) / 1000));
  step(log.result(activePlan.size.w, activePlan.size.h, seconds));
  const result = { type: 'result', html, width: activePlan.size.w, height: activePlan.size.h, summary: log.steps, sources, warnings, styleName: style.name, plan: { recipe: activePlan.recipe, style: activePlan.style, styleName: style.name, palette: activePlan.palette, fonts: activePlan.fonts, layout: activePlan.layout, text: activePlan.text, assets: activePlan.assets }, elapsedMs: now() - t0, ok: v.ok && fin.ok };
  emit(result);
  return result;
}
