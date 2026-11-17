// @ts-nocheck
import express from 'express';
import path from 'path';
import os from 'os';
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

export function mountStudioRoutes(app: any) {
  if (typeof app?.use !== 'function') {
    console.warn('[Studio Bridge] App does not support .use() middleware mounting.');
    return;
  }

  const library = getStudioLibrary();
  const keystore = getStudioKeystore();
  const adminToken = process.env.ADMIN_TOKEN || 'studio-admin-disabled';

  const studioRouter = createStudioRouter({
    express,
    library,
    keystore,
    adminToken,
    clientTaskTimeoutMs: 45000,
    searchImagesOverride: searchStudioWebImages,
    inspectDesignOverride: inspectRenderedStudioDesign,
    llmFactory: async (req: any) => {
      let userKey: string | undefined;
      let userModel: string | undefined;
      try {
        const rec = await resolveProviderKeyForRequest(req, 'groq');
        if (rec?.apiKey) userKey = rec.apiKey;
        if (rec?.model) userModel = rec.model;
      } catch {}
      const hasPool = getAvailableGrokKeys({ includeCooldownAsLastResort: true }).length > 0;
      if (!userKey && !hasPool) return null;
      return createStudioLlmAdapter(userKey, userModel);
    },
  });

  app.use(studioRouter);
}
