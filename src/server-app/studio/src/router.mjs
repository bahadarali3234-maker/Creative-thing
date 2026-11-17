// Express router. The design library is NEVER exposed: no route returns library content.
// Mount behind your app's own auth:  app.use(createStudioRouter({ express, library, keystore, ... }))
import crypto from 'node:crypto';
import { detectIntent, POPUP_TEXT } from './intent.mjs';
import { pickQuestions } from './questions.mjs';
import { createLlm, testLlmConfig, PROVIDERS } from './llm.mjs';
import { createImageSearch } from './imageSearch.mjs';
import { runStudioJob } from './orchestrator.mjs';
import { fetchImageSafe } from './ssrf.mjs';

const safeEq = (a, b) => { const A = Buffer.from(String(a)), B = Buffer.from(String(b)); return A.length === B.length && crypto.timingSafeEqual(A, B); };

export function createStudioRouter({ express, library, keystore, adminToken, imageSearchUrl, clientTaskTimeoutMs = 40000, jobTtlMs = 15 * 60 * 1000, llmOverride = null, llmFactory = null, searchImagesOverride = null, inspectDesignOverride = null }) {
  const router = express.Router();
  const jsonSmall = express.json({ limit: '500kb' });
  const jsonBig = express.json({ limit: '16mb' });
  const searchImages = typeof searchImagesOverride === 'function' ? searchImagesOverride : createImageSearch({ url: imageSearchUrl });
  const inspectDesign = typeof inspectDesignOverride === 'function' ? inspectDesignOverride : null;
  const jobs = new Map();
  const hits = new Map();

  const rate = (key, max, windowMs) => { const t = Date.now(); const arr = (hits.get(key) || []).filter((x) => t - x < windowMs); arr.push(t); hits.set(key, arr); return arr.length <= max; };
  setInterval(() => { const t = Date.now(); for (const [id, j] of jobs) if (t - j.createdAt > jobTtlMs) jobs.delete(id); }, 60000).unref();

  const adminOnly = (req, res, next) => { if (!adminToken || !safeEq(req.get('x-admin-token') || '', adminToken)) return res.status(401).json({ error: 'admin token required' }); next(); };

  // ---------- user-facing ----------
  router.post('/api/studio/intent', jsonSmall, (req, res) => {
    const { message = '', attachments = [] } = req.body || {};
    const r = detectIntent(message, attachments);
    const out = { intent: r.intent, confidence: r.confidence, recipe: r.recipe || null, lang: r.lang };
    if (r.intent === 'generate' || r.intent === 'edit') out.popup = POPUP_TEXT[r.lang] || POPUP_TEXT.en;
    res.json(out); // note: no reasons/library data leave the server
  });

  router.post('/api/studio/questions', jsonSmall, (req, res) => {
    const { message = '', attachments = [], answers = {}, recipeOverride = null, intentOverride = null } = req.body || {};
    const intent = detectIntent(message, attachments);
    if (recipeOverride) intent.recipe = recipeOverride;
    if (intentOverride) intent.intent = intentOverride;
    res.json({ questions: pickQuestions({ message, intent, attachments, answers, library }) });
  });

  router.post('/api/studio/jobs', jsonSmall, async (req, res) => {
    const ip = req.ip || 'x';
    if (!rate('job:' + ip, 12, 60000)) return res.status(429).json({ error: 'Too many image jobs, wait a minute.' });
    const reqLlm = typeof llmFactory === 'function' ? await llmFactory(req) : llmOverride;
    const cfg = reqLlm ? null : keystore.load();
    const { message = '', answers = {}, attachments = [], previousPlan = null, recipeOverride = null, intentOverride = null } = req.body || {};
    if (!message.trim()) return res.status(400).json({ error: 'message required' });
    const intent = detectIntent(message, attachments);
    if (recipeOverride) intent.recipe = recipeOverride;
    if (intentOverride) intent.intent = intentOverride;
    if (!['generate', 'edit', 'maybe_generate'].includes(intent.intent)) intent.recipe = intent.recipe || 'generic';
    const id = crypto.randomBytes(9).toString('hex');
    const job = { id, createdAt: Date.now(), events: [], clients: new Set(), pending: new Map(), done: false, cancelled: false };
    jobs.set(id, job);
    const emit = (evt) => { job.events.push(evt); for (const c of job.clients) c.write(`data: ${JSON.stringify(evt)}\n\n`); };
    const clientTask = (task, payload) => new Promise((resolve) => {
      if (job.cancelled) return resolve({ error: 'cancelled' });
      const taskId = crypto.randomBytes(6).toString('hex');
      const to = setTimeout(() => { job.pending.delete(taskId); resolve({ error: 'client timeout' }); }, clientTaskTimeoutMs);
      job.pending.set(taskId, (result) => { clearTimeout(to); resolve(result); });
      emit({ type: 'client_task', taskId, task, payload });
    });
    const llm = reqLlm || (cfg ? createLlm(cfg) : null);
    (async () => {
      try { await runStudioJob({ message, intent: { ...intent, recipe: intent.recipe || 'generic' }, answers, attachments, previousPlan }, { llm, library, searchImages, inspectDesign, clientTask, emit }); }
      catch (e) { emit({ type: 'error', message: String(e.message || e).slice(0, 300) }); }
      finally { job.done = true; for (const c of job.clients) c.end(); job.clients.clear(); }
    })();
    res.json({ jobId: id });
  });

  router.get('/api/studio/jobs/:id/events', (req, res) => {
    const job = jobs.get(req.params.id); if (!job) return res.status(404).end();
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.flushHeaders && res.flushHeaders();
    for (const e of job.events) res.write(`data: ${JSON.stringify(e)}\n\n`);
    if (job.done) return res.end();
    job.clients.add(res); req.on('close', () => job.clients.delete(res));
  });

  router.post('/api/studio/jobs/:id/client-result', jsonBig, (req, res) => {
    const job = jobs.get(req.params.id); if (!job) return res.status(404).json({ error: 'no such job' });
    const { taskId, result } = req.body || {}; const cb = job.pending.get(taskId);
    if (!cb) return res.status(404).json({ error: 'no such task' });
    job.pending.delete(taskId); cb(result || { error: 'empty result' }); res.json({ ok: true });
  });

  router.post('/api/studio/jobs/:id/cancel', (req, res) => { const job = jobs.get(req.params.id); if (job) { job.cancelled = true; for (const cb of job.pending.values()) cb({ error: 'cancelled' }); job.pending.clear(); } res.json({ ok: true }); });

  router.get('/api/studio/img-proxy', async (req, res) => {
    if (!rate('proxy:' + (req.ip || 'x'), 120, 60000)) return res.status(429).end();
    try { const { buffer, contentType } = await fetchImageSafe(String(req.query.url || '')); res.set({ 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' }); res.send(buffer); }
    catch (e) { res.status(400).json({ error: String(e.message || e).slice(0, 120) }); }
  });

  // ---------- admin (LLM key setup: test → save) ----------
  router.get('/api/studio/admin/status', adminOnly, (_req, res) => res.json({ ...keystore.status(), providers: Object.keys(PROVIDERS) }));
  router.post('/api/studio/admin/llm/models', adminOnly, jsonSmall, async (req, res) => {
    const { provider = 'xai', apiKey, baseUrl } = req.body || {}; if (!apiKey) return res.status(400).json({ error: 'apiKey required' });
    const r = await testLlmConfig({ provider, apiKey, baseUrl, model: null }); res.json({ models: r.models, steps: r.steps });
  });
  router.post('/api/studio/admin/llm', adminOnly, jsonSmall, async (req, res) => {
    const { provider = 'xai', apiKey, model, baseUrl, tokenParam = 'max_tokens', testOnly = false } = req.body || {};
    if (!apiKey || !model) return res.status(400).json({ error: 'apiKey and model are required' });
    const cfg = { provider, apiKey, model, baseUrl, tokenParam };
    const result = await testLlmConfig(cfg);
    if (!result.ok) return res.status(422).json({ saved: false, ...result });
    if (!testOnly) keystore.save(cfg);
    res.json({ saved: !testOnly, ...result, status: keystore.status() });
  });
  router.delete('/api/studio/admin/llm', adminOnly, (_req, res) => { keystore.clear(); res.json({ ok: true }); });

  return router;
}
