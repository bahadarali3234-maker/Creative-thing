// @ts-nocheck
import express from 'express';
import path from 'path';
import os from 'os';
import { GoogleGenAI } from '@google/genai';
import {
  loadLibrary,
  createKeystore,
  createStudioRouter,
} from './studio/src/index.mjs';
import {
  getAvailableGrokKeys,
  isRateLimitResponse,
  markKeyRateLimited,
} from './grokKeyPool';
import {
  resolveProviderKeyForRequest,
} from './firebaseServerAuth';
import {
  executeSubjectSearch,
  crawlWikimediaImages,
  filterAndScoreImages,
} from './serverReferenceImages';
import { isUnsafeImageQuery } from './imageFinderModule';
import { inspectRenderedStudioDesign } from './studioInspector';
import {
  buildBackendPoweredStudioHtml,
  buildPlannerSystemPrompt,
  fallbackSpec,
  normalizeCanvasSpec,
  RECIPE_DEFAULTS,
  STUDIO_DATA,
} from './studio/canvasStudioSetup';
import { extractJson } from './studio/src/plan.mjs';
import { resolveAnswers } from './studio/src/questions.mjs';

let cachedLibrary: any = null;
let cachedKeystore: any = null;

function getStudioLibrary() {
  if (!cachedLibrary) {
    const libDir = path.join(process.cwd(), 'src', 'server-app', 'studio', 'library');
    cachedLibrary = loadLibrary(libDir);
  }
  return cachedLibrary;
}

function getStudioKeystore() {
  if (!cachedKeystore) {
    const dataDir = path.join(os.tmpdir(), 'ai-studio-creative-studio');
    const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.STUDIO_SECRET || 'ai-studio-creative-secret';
    cachedKeystore = createKeystore({ dir: dataDir, secret });
  }
  return cachedKeystore;
}

function createStudioLlmAdapter(userKey?: string, userModel?: string) {
  return {
    async chat(messages: Array<{ role: string; content: string }>, { temperature = 0.6, maxTokens = 4500 } = {}) {
      const pool = getAvailableGrokKeys({ includeCooldownAsLastResort: true });
      const candidates: Array<{ endpoint: string; key: string; provider: string; models: string[]; slotLabel: string }> = [];

      if (userKey && userKey.trim()) {
        const isXai = userKey.startsWith('xai-');
        candidates.push({
          endpoint: isXai ? 'https://api.x.ai/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions',
          key: userKey.trim(),
          provider: isXai ? 'xai' : 'groq',
          models: userModel
            ? [userModel, 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b']
            : isXai
              ? ['grok-3', 'grok-3-mini']
              : ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
          slotLabel: 'user-key',
        });
      }

      for (const entry of pool) {
        candidates.push({
          endpoint: entry.endpoint,
          key: entry.key,
          provider: entry.provider,
          models:
            entry.provider === 'xai'
              ? ['grok-3', 'grok-3-mini']
              : ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-70b-versatile'],
          slotLabel: entry.slotLabel,
        });
      }

      if (candidates.length === 0) {
        throw new Error('No Groq or xAI API key is configured for Creative Studio.');
      }

      let lastErr = 'Studio LLM call failed.';
      for (const cand of candidates) {
        for (const model of cand.models) {
          try {
            const clampedTokens = Math.min(maxTokens, cand.provider === 'groq' ? 6000 : 7000);
            const res = await fetch(cand.endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cand.key}`,
              },
              body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: clampedTokens,
              }),
              signal: AbortSignal.timeout(45000),
            });

            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              lastErr = `Studio LLM (${model}) ${res.status}: ${errText.slice(0, 180)}`;
              if (isRateLimitResponse(res.status, errText)) {
                markKeyRateLimited(cand.key, res.headers.get('retry-after'));
                break; // move to next key
              }
              continue; // try next model on this key
            }

            const data: any = await res.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text && String(text).trim()) {
              return String(text);
            }
            lastErr = `Studio LLM (${model}) returned empty content.`;
          } catch (e: any) {
            lastErr = e?.message || 'Network timeout calling studio LLM.';
          }
        }
      }

      throw new Error(lastErr);
    },
  };
}

async function searchStudioWebImages(query: string, { count = 8 } = {}) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery || isUnsafeImageQuery(cleanQuery)) return [];

  const keywords = cleanQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const rankCandidates = (rawList: any[]) => {
    const validRaw = Array.isArray(rawList) ? rawList : [];
    const { topImages, backupPool } = filterAndScoreImages(validRaw, {
      label: cleanQuery,
      queries: [cleanQuery],
      count: Math.max(count, 12),
    });
    const combined = [...(topImages || []), ...(backupPool || [])];
    return combined
      .filter((im: any) => im?.url && !/\.svg(\?|$)/i.test(im.url))
      .map((im: any) => {
        const hay = `${im.alt || ''} ${im.title || ''} ${im.url || ''}`.toLowerCase();
        const kwHits = keywords.filter((kw) => hay.includes(kw)).length;
        const pxScore = ((im.width || 800) * (im.height || 600)) >= 500_000 ? 2 : 0;
        return {
          ...im,
          _rank: kwHits * 5 + pxScore,
        };
      })
      .sort((a: any, b: any) => b._rank - a._rank)
      .map((im: any) => ({
        url: im.url,
        thumbnail: im.thumbnail || im.url,
        sourceUrl: im.sourceUrl || im.url,
        sourceDomain: im.sourceDomain || 'web',
        width: im.width || 1000,
        height: im.height || 800,
        title: im.alt || im.title || cleanQuery,
      }));
  };

  try {
    const subjResult = await executeSubjectSearch(
      { label: cleanQuery, queries: [cleanQuery], count: Math.max(count, 12) },
      'USER_REQUESTED'
    );
    const list = [
      ...(Array.isArray(subjResult?.images) ? subjResult.images : []),
      ...(Array.isArray(subjResult?.backupPool) ? subjResult.backupPool : []),
    ];
    const mapped = rankCandidates(list);
    if (mapped.length > 0) return mapped.slice(0, count);
  } catch (err) {
    console.warn('[Studio Image Search] Primary search error:', err);
  }

  try {
    const wiki = await crawlWikimediaImages(cleanQuery);
    return rankCandidates(wiki || []).slice(0, count);
  } catch (err) {
    console.warn('[Studio Image Search] Wikimedia fallback error:', err);
    return [];
  }
}

async function callSecretGroqChat(
  messages: Array<{ role: string; content: string }>,
  opts: { temperature?: number; maxTokens?: number; req?: any } = {}
): Promise<{ text: string; model: string }> {
  const groqPool = getAvailableGrokKeys({ providerFilter: 'groq', includeCooldownAsLastResort: true });
  const fallbackPool = getAvailableGrokKeys({ includeCooldownAsLastResort: true }).filter(
    (k) => k.provider !== 'groq'
  );
  const pool = [...groqPool, ...fallbackPool];

  const candidates: Array<{ endpoint: string; key: string; provider: string; models: string[]; slotLabel: string }> = [];

  for (const entry of pool) {
    candidates.push({
      endpoint: entry.endpoint,
      key: entry.key,
      provider: entry.provider,
      models:
        entry.provider === 'xai'
          ? ['grok-3', 'grok-3-mini']
          : ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-70b-versatile'],
      slotLabel: entry.slotLabel,
    });
  }

  // Optional workspace/personal user key only as secondary backup if server secrets weren't set
  if (candidates.length === 0 && opts.req) {
    try {
      const rec = await resolveProviderKeyForRequest(opts.req, 'groq');
      if (rec?.apiKey) {
        const isXai = rec.apiKey.startsWith('xai-');
        candidates.push({
          endpoint: isXai ? 'https://api.x.ai/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions',
          key: rec.apiKey.trim(),
          provider: isXai ? 'xai' : 'groq',
          models: rec.model ? [rec.model, 'llama-3.3-70b-versatile'] : ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
          slotLabel: 'backup-user-key',
        });
      }
    } catch {}
  }

  if (candidates.length === 0) {
    throw new Error('Groq API secret is not configured on backend.');
  }

  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.6;
  const maxTokens = Math.max(128, Math.min(6000, Number(opts.maxTokens) || 1800));
  let lastErr = 'Backend Groq request failed.';

  for (const cand of candidates) {
    for (const model of cand.models) {
      try {
        const res = await fetch(cand.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cand.key}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          lastErr = `Studio Groq (${model}) ${res.status}: ${errText.slice(0, 180)}`;
          if (isRateLimitResponse(res.status, errText)) {
            markKeyRateLimited(cand.key, res.headers.get('retry-after'));
            break;
          }
          continue;
        }

        const data: any = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text && String(text).trim()) {
          return { text: String(text), model };
        }
        lastErr = `Studio Groq (${model}) returned empty content.`;
      } catch (e: any) {
        lastErr = e?.message || 'Network timeout calling Studio Groq.';
      }
    }
  }

  throw new Error(lastErr);
}

async function discoverGroqVisionModels(key: string): Promise<string[]> {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const j: any = await r.json().catch(() => ({}));
    const ids: string[] = Array.isArray(j?.data) ? j.data.map((m: any) => String(m?.id || '')) : [];
    return ids.filter((id) =>
      /(vision|llama-4|scout|maverick|pixtral|llava|vl)/i.test(id) &&
      !/guard|whisper|tts/i.test(id)
    );
  } catch {
    return [];
  }
}

async function callSecretGroqVision(
  promptText: string,
  imageDataUrl: string,
  opts: { temperature?: number; maxTokens?: number; req?: any } = {}
): Promise<{ text: string; model: string }> {
  const groqPool = getAvailableGrokKeys({ providerFilter: 'groq', includeCooldownAsLastResort: true });
  const xaiPool = getAvailableGrokKeys({ providerFilter: 'xai', includeCooldownAsLastResort: true });
  const candidates: Array<{ endpoint: string; key: string; models: string[]; provider: 'groq' | 'xai' }> = [];

  for (const entry of groqPool) {
    const discovered = await discoverGroqVisionModels(entry.key);
    const defaultVision = [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-4-maverick-17b-128e-instruct',
    ];
    const merged = [...new Set([...discovered, ...defaultVision])];
    candidates.push({
      endpoint: entry.endpoint,
      key: entry.key,
      provider: 'groq',
      models: merged,
    });
  }

  for (const entry of xaiPool) {
    candidates.push({
      endpoint: entry.endpoint,
      key: entry.key,
      provider: 'xai',
      models: ['grok-2-vision-1212', 'grok-4'],
    });
  }

  if (candidates.length === 0 && opts.req) {
    try {
      const rec = await resolveProviderKeyForRequest(opts.req, 'groq');
      if (rec?.apiKey && !rec.apiKey.startsWith('xai-')) {
        const discovered = await discoverGroqVisionModels(rec.apiKey.trim());
        candidates.push({
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          key: rec.apiKey.trim(),
          provider: 'groq',
          models: [
            ...new Set([
              ...discovered,
              'meta-llama/llama-4-scout-17b-16e-instruct',
              'meta-llama/llama-4-maverick-17b-128e-instruct',
            ]),
          ],
        });
      }
    } catch {}
  }

  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.25;
  const maxTokens = Math.max(256, Math.min(2400, Number(opts.maxTokens) || 1600));
  let lastErr = 'Backend Vision request failed.';

  for (const cand of candidates) {
    for (const model of cand.models) {
      try {
        const res = await fetch(cand.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cand.key}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptText },
                  { type: 'image_url', image_url: { url: imageDataUrl } },
                ],
              },
            ],
            temperature,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          lastErr = `Studio Vision (${model}) ${res.status}: ${errText.slice(0, 180)}`;
          if (isRateLimitResponse(res.status, errText)) {
            markKeyRateLimited(cand.key, res.headers.get('retry-after'));
            break;
          }
          continue;
        }

        const data: any = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text && String(text).trim()) {
          return { text: String(text), model };
        }
      } catch (e: any) {
        lastErr = e?.message || 'Network timeout calling Studio Vision.';
      }
    }
  }

  // Gemini multimodal fallback when GEMINI_API_KEY is available
  const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) {
    try {
      const m = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const resp = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: promptText },
                { inlineData: { mimeType: m[1] || 'image/png', data: m[2] } },
              ],
            },
          ],
        });
        const text = resp?.text;
        if (text && String(text).trim()) {
          return { text: String(text), model: 'gemini-2.5-flash' };
        }
      }
    } catch (ge: any) {
      lastErr = ge?.message || lastErr;
    }
  }

  throw new Error(lastErr);
}

export function mountStudioRoutes(app: any) {
  if (typeof app?.use !== 'function') {
    console.warn('[Studio Bridge] App does not support .use() middleware mounting.');
    return;
  }

  const library = getStudioLibrary();
  const keystore = getStudioKeystore();
  const adminToken = process.env.ADMIN_TOKEN || 'studio-admin-disabled';

  // Embedded Creative Studio HTML setup served directly from backend (zero key prompt / secret Groq key)
  app.get('/api/studio/app', (_req: any, res: any) => {
    try {
      const html = buildBackendPoweredStudioHtml();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err: any) {
      res.status(500).send(err?.message || 'Failed to load Creative Studio setup.');
    }
  });

  // Backend Groq chat/planner endpoint for Creative Studio HTML setup
  app.post('/api/studio/llm-chat', express.json({ limit: '2mb' }), async (req: any, res: any) => {
    try {
      const { messages, temperature = 0.6, maxTokens = 1800 } = req.body || {};
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array is required.' });
      }
      const out = await callSecretGroqChat(messages, { temperature, maxTokens, req });
      return res.json({ text: out.text, model: out.model, provider: 'groq' });
    } catch (err: any) {
      return res.status(502).json({ error: err?.message || 'Studio Groq backend failed.' });
    }
  });

  // Backend JSON Canvas Spec Planner (exact HTML PLANNER_SYSTEM + backend secret Groq API key)
  app.post('/api/studio/canvas-plan', express.json({ limit: '2mb' }), async (req: any, res: any) => {
    try {
      const {
        message = '',
        intent = { recipe: 'generic', lang: 'en' },
        answers = {},
        resolved: resolvedInput = null,
        uploads = [],
        attachments = [],
        uploadAnalyses = [],
        previousSpec = null,
      } = req.body || {};

      const incomingUploads =
        Array.isArray(uploads) && uploads.length > 0
          ? uploads
          : Array.isArray(attachments)
            ? attachments
            : [];

      const safeAnalyses = Array.isArray(uploadAnalyses) ? uploadAnalyses : [];

      const cleanMsg = String(message || '').trim();
      if (!cleanMsg) {
        return res.status(400).json({ error: 'message is required.' });
      }

      const resolved =
        resolvedInput && resolvedInput.size
          ? resolvedInput
          : resolveAnswers({ message: cleanMsg, answers, intent, library });

      const recipeId = RECIPE_DEFAULTS[intent?.recipe] ? intent.recipe : 'generic';
      const systemPrompt = buildPlannerSystemPrompt();
      const userPayload = JSON.stringify({
        request: cleanMsg,
        language: resolved.language || intent?.lang || 'en',
        userChoices: {
          size: resolved.size,
          style: resolved.style || null,
          text: resolved.text || null,
          photo: resolved.photo || null,
        },
        recipeHint: recipeId,
        webSearch: true,
        uploads: incomingUploads.map((u: any) => ({
          id: u.id,
          name: u.name,
          ...(u.facts || {}),
        })),
        uploadAnalyses: safeAnalyses,
        detectedOcrText: safeAnalyses.flatMap((u: any) => (Array.isArray(u.ocrText) ? u.ocrText : [])).slice(0, 8),
        ...(previousSpec ? { previousSpec, isEdit: true } : {}),
      });

      let rawPlan: any = null;
      let usedGroq = false;
      let plannerError = '';
      let usedModel = '';

      for (let attempt = 0; attempt < 2 && !rawPlan; attempt++) {
        try {
          const out = await callSecretGroqChat(
            [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: userPayload + (attempt ? '\nReturn ONLY the JSON object.' : ''),
              },
            ],
            { temperature: 0.55, maxTokens: 1750, req }
          );
          rawPlan = extractJson(out.text);
          usedGroq = true;
          usedModel = out.model;
        } catch (err: any) {
          plannerError = String(err?.message || err || 'Groq planner unavailable');
        }
      }

      const workingPlan =
        rawPlan || fallbackSpec(cleanMsg, resolved, recipeId, incomingUploads, safeAnalyses, previousSpec);
      const normalized = normalizeCanvasSpec(workingPlan, {
        resolved,
        recipeId,
        uploads: incomingUploads,
        uploadAnalyses: safeAnalyses,
        message: cleanMsg,
        previousSpec,
      });

      if (normalized.refused) {
        return res.json({
          refused: normalized.refused,
          spec: null,
          usedGroq,
          model: usedModel || null,
          warn: [],
          resolved,
        });
      }

      return res.json({
        refused: null,
        spec: normalized.spec,
        usedGroq,
        model: usedModel || 'built-in-fallback',
        plannerNote: usedGroq ? null : plannerError,
        warn: normalized.warn,
        resolved,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Canvas planner error.' });
    }
  });

  // Backend Multi-Upload Vision Analyzer (inspects all user-uploaded files before generation)
  app.post('/api/studio/analyze-uploads', express.json({ limit: '16mb' }), async (req: any, res: any) => {
    try {
      const { uploads = [], instruction = '' } = req.body || {};
      const list = Array.isArray(uploads) ? uploads.slice(0, 4) : [];
      if (list.length === 0) {
        return res.json({ ok: true, analyses: [], ocrTexts: [] });
      }

      const analyses: any[] = [];
      for (let i = 0; i < list.length; i++) {
        const up = list[i];
        const uploadId = String(up?.id || `u${i + 1}`);
        const name = String(up?.name || `upload-${i + 1}`);
        const dataUrl = String(up?.dataUrl || '');
        if (!dataUrl.startsWith('data:image/')) {
          analyses.push({
            uploadId,
            name,
            role: i === 0 ? 'main-character' : 'design-reference',
            subjectDescription: name,
            ocrText: [],
            preserveIdentity: true,
          });
          continue;
        }

        const inspectPrompt = `Inspect this user-uploaded reference image ("${name}") for a graphic design & image composition engine.
User prompt: "${String(instruction || '').slice(0, 260).replace(/"/g, '\\"')}"

Identify carefully:
1. "role": Choose the best role for this upload:
   - "main-character" (a person, character, animal, or hero figure to keep or feature)
   - "face-reference" (close-up selfie/headshot intended primarily as a face identity reference)
   - "background-reference" (a location, room, sky, scenery, studio backdrop with no single foreground person)
   - "design-reference" (an existing poster/thumbnail/flyer whose layout, style, or text is being edited/recreated)
   - "object" (a product, bottle, gadget, shoe, car, or prop)
2. "subjectDescription": concise description (8-18 words) including clothing, pose, objects, and setting.
3. "ocrText": exact array of any clearly readable visible text strings in the image (empty array [] if none).
4. "clothing": brief outfit description if a person is visible, else "".
5. "colors": top 3 hex or named colors visible.
6. "lighting": lighting direction and mood (e.g. "soft front daylight", "dramatic warm side light").
7. "cameraAngle": e.g. "eye-level close-up", "medium shot", "wide landscape", "low angle".
8. "preserveIdentity": true if a specific person/character's face or appearance is present.

Return ONLY valid JSON (no markdown):
{"role":"main-character","subjectDescription":"","ocrText":[],"clothing":"","colors":[],"lighting":"","cameraAngle":"","preserveIdentity":true}`;

        let parsed: any = null;
        let usedModel = 'heuristic';
        try {
          const out = await callSecretGroqVision(inspectPrompt, dataUrl, {
            temperature: 0.15,
            maxTokens: 700,
            req,
          });
          parsed = extractJson(out.text);
          usedModel = out.model;
        } catch {}

        const validRoles = new Set([
          'main-character',
          'face-reference',
          'background-reference',
          'design-reference',
          'object',
        ]);

        const role =
          parsed && validRoles.has(String(parsed.role))
            ? String(parsed.role)
            : list.length >= 2 && i === 1
              ? 'background-reference'
              : 'main-character';

        analyses.push({
          uploadId,
          name,
          model: usedModel,
          role,
          subjectDescription: String(parsed?.subjectDescription || name).slice(0, 180),
          ocrText: Array.isArray(parsed?.ocrText)
            ? parsed.ocrText.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 8)
            : [],
          clothing: String(parsed?.clothing || '').slice(0, 90),
          colors: Array.isArray(parsed?.colors) ? parsed.colors.slice(0, 4) : [],
          lighting: String(parsed?.lighting || '').slice(0, 80),
          cameraAngle: String(parsed?.cameraAngle || '').slice(0, 60),
          preserveIdentity: parsed?.preserveIdentity !== false,
        });
      }

      const ocrTexts = [...new Set(analyses.flatMap((a) => a.ocrText || []))];
      return res.json({ ok: true, analyses, ocrTexts });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Upload analysis failed.' });
    }
  });

  // Backend Visual Quality Control Inspector (Groq Vision primary + Gemini fallback)
  app.post('/api/studio/inspect-render', express.json({ limit: '10mb' }), async (req: any, res: any) => {
    try {
      const { imageDataUrl = '', prompt = '', plan = {}, width = 1280, height = 720 } = req.body || {};
      if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Valid rendered imageDataUrl is required.' });
      }
      const qc = await inspectRenderedStudioDesign({
        imageDataUrl,
        prompt: String(prompt || ''),
        plan,
        width: Number(width) || 1280,
        height: Number(height) || 720,
        req,
      });
      return res.json({ ok: true, ...qc });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Quality inspection failed.' });
    }
  });

  // Backend Canva-style Image Element & Text Scanner using Groq Vision Secret Keys
  app.post('/api/studio/scan-image', express.json({ limit: '10mb' }), async (req: any, res: any) => {
    try {
      const { imageDataUrl = '', instruction = '' } = req.body || {};
      if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Valid base64 imageDataUrl is required.' });
      }

      const scanPrompt = `You are a Canva design element scanner. Inspect this image carefully and return JSON describing every visible text region, the main character/subject bounding box, and any visible brand logos as normalized percentage coordinates (0 to 100 of image width/height).
If the user gave an editing instruction ("${String(instruction || '').replace(/"/g, '\\"')}"), fill "replacementText" on any matching textBlock so the text immediately updates if requested.

Return ONLY strict valid JSON (no markdown):
{
  "textBlocks": [
    {
      "id": "txt_1",
      "text": "exact visible text",
      "replacementText": "updated text if user asked to change it, else same as text",
      "xPct": 8,
      "yPct": 15,
      "wPct": 50,
      "hPct": 14,
      "fontSizePct": 7,
      "fontWeight": 800,
      "color": "#ffffff",
      "bgSample": "#0f172a",
      "align": "left"
    }
  ],
  "subjectBox": {
    "found": true,
    "label": "short description of main person/object",
    "xPct": 52,
    "yPct": 10,
    "wPct": 45,
    "hPct": 88
  },
  "logos": [
    {
      "id": "logo_1",
      "label": "brand name if visible",
      "brandId": "google|google-flow|google-gemini|youtube|instagram|custom",
      "xPct": 5,
      "yPct": 5,
      "wPct": 14,
      "hPct": 8
    }
  ],
  "dominantColors": ["#0b1020", "#ffffff", "#00e5ff"]
}`;

      let parsed: any = null;
      let usedModel = 'heuristic-fallback';
      let visionError = '';

      try {
        const out = await callSecretGroqVision(scanPrompt, imageDataUrl, {
          temperature: 0.2,
          maxTokens: 1600,
          req,
        });
        parsed = extractJson(out.text) || {};
        usedModel = out.model;
      } catch (ve: any) {
        visionError = String(ve?.message || 'Vision model unavailable');
      }

      if (!parsed) {
        const instr = String(instruction || '').trim();
        const quoted = instr.match(/["“']([^"”']{2,60})["”']/)?.[1]
          || instr.match(/\bto\s+([A-Za-z0-9\u0900-\u097F\s!?%$.,-]{2,50})$/i)?.[1]
          || 'Edited Title';
        parsed = {
          textBlocks: instr
            ? [
                {
                  id: 'txt_1',
                  text: quoted.trim(),
                  replacementText: quoted.trim(),
                  xPct: 8,
                  yPct: 16,
                  wPct: 52,
                  hPct: 16,
                  fontSizePct: 8,
                  fontWeight: 800,
                  color: '#ffffff',
                  bgSample: '#0f172a',
                  align: 'left',
                },
              ]
            : [],
          subjectBox: { found: true, label: 'Main Subject', xPct: 45, yPct: 10, wPct: 50, hPct: 85 },
          logos: [],
          dominantColors: ['#0b1020', '#ffffff', '#00e5ff'],
        };
      }

      const clampPct = (v: any, min = 0, max = 100, def = 10) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
      };

      const textBlocks = (Array.isArray(parsed.textBlocks) ? parsed.textBlocks : [])
        .filter((tb: any) => tb && typeof tb.text === 'string' && tb.text.trim())
        .slice(0, 12)
        .map((tb: any, idx: number) => ({
          id: String(tb.id || `txt_${idx + 1}`),
          text: String(tb.text).trim(),
          replacementText: String(tb.replacementText || tb.text).trim(),
          xPct: clampPct(tb.xPct, 1, 92, 8),
          yPct: clampPct(tb.yPct, 1, 92, 12 + idx * 14),
          wPct: clampPct(tb.wPct, 8, 95, 48),
          hPct: clampPct(tb.hPct, 4, 55, 12),
          fontSizePct: clampPct(tb.fontSizePct, 2, 18, 6),
          fontWeight: Number(tb.fontWeight) >= 700 ? 800 : 600,
          color: typeof tb.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(tb.color) ? tb.color : '#ffffff',
          bgSample:
            typeof tb.bgSample === 'string' && /^#[0-9a-f]{3,8}$/i.test(tb.bgSample) ? tb.bgSample : '#0f172a',
          align: ['left', 'center', 'right'].includes(tb.align) ? tb.align : 'left',
        }));

      const subj =
        parsed.subjectBox && parsed.subjectBox.found
          ? {
              found: true,
              label: String(parsed.subjectBox.label || 'Main Subject').slice(0, 60),
              xPct: clampPct(parsed.subjectBox.xPct, 0, 90, 48),
              yPct: clampPct(parsed.subjectBox.yPct, 0, 90, 8),
              wPct: clampPct(parsed.subjectBox.wPct, 10, 95, 45),
              hPct: clampPct(parsed.subjectBox.hPct, 10, 98, 86),
            }
          : { found: false, label: '', xPct: 50, yPct: 10, wPct: 45, hPct: 85 };

      const logos = (Array.isArray(parsed.logos) ? parsed.logos : []).slice(0, 6).map((lg: any, idx: number) => ({
        id: String(lg.id || `scan_logo_${idx + 1}`),
        label: String(lg.label || 'Brand').slice(0, 40),
        brandId: String(lg.brandId || 'custom').toLowerCase(),
        xPct: clampPct(lg.xPct, 1, 92, 6),
        yPct: clampPct(lg.yPct, 1, 92, 6),
        wPct: clampPct(lg.wPct, 4, 45, 14),
        hPct: clampPct(lg.hPct, 4, 30, 8),
      }));

      return res.json({
        ok: true,
        model: usedModel,
        ...(visionError ? { fallbackNote: visionError } : {}),
        textBlocks,
        subjectBox: subj,
        logos,
        dominantColors: Array.isArray(parsed.dominantColors) ? parsed.dominantColors.slice(0, 5) : ['#0b1020', '#ffffff'],
      });
    } catch (err: any) {
      return res.status(502).json({ error: err?.message || 'Image scanner failed.' });
    }
  });

  // Expose non-sensitive studio configuration summary (zero secrets exposed)
  app.get('/api/studio/config', (_req: any, res: any) => {
    const groqPool = getAvailableGrokKeys({ providerFilter: 'groq', includeCooldownAsLastResort: true });
    res.json({
      ready: groqPool.length > 0,
      provider: 'groq',
      palettesCount: Object.keys(STUDIO_DATA.PALETTES).length,
      fontsCount: Object.keys(STUDIO_DATA.FONTS).length,
      sizesCount: Object.keys(STUDIO_DATA.SIZES).length,
    });
  });

  const studioRouter = createStudioRouter({
    express,
    library,
    keystore,
    adminToken,
    clientTaskTimeoutMs: 45000,
    searchImagesOverride: searchStudioWebImages,
    inspectDesignOverride: inspectRenderedStudioDesign,
    llmFactory: async (req: any) => {
      const hasPool = getAvailableGrokKeys({ includeCooldownAsLastResort: true }).length > 0;
      let userKey: string | undefined;
      let userModel: string | undefined;
      if (!hasPool) {
        try {
          const rec = await resolveProviderKeyForRequest(req, 'groq');
          if (rec?.apiKey) userKey = rec.apiKey;
          if (rec?.model) userModel = rec.model;
        } catch {}
      }
      if (!userKey && !hasPool) return null;
      return createStudioLlmAdapter(userKey, userModel);
    },
  });

  app.use(studioRouter);
}
