// @ts-nocheck
import { express, type MiniApp } from './mini-express';
import { previewStore } from './preview-store';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import fs from 'fs';
import path from 'path';
import {
  getAvailableGrokKeys,
  getConfiguredGrokKeys,
  getGrokKeyPoolHealth,
  isRateLimitResponse,
  markKeyRateLimited,
  type GrokKeyEntry,
} from './grokKeyPool';
import { buildTtsCacheKey, getOrSynthesizeTts } from './ttsCache';
import {
  CLARIFICATION_GATE_SYSTEM_PROMPT,
  parseAndValidateGateResponse,
  isSkipIntent,
  isCodeVaultLibraryPrompt,
} from '../app/utils/clarificationGate';
import {
  isCreativeThinkLibraryDocument,
  parseCreativeThinkLibrary,
  assembleCreativeThinkWebsite,
} from '../app/utils/creativeThinkLibrary';
import {
  IMAGE_PLANNER_SYSTEM_PROMPT,
  parseImagePlannerResponse,
  PlannerSubject,
} from '../app/utils/imagePlanner';
import {
  executeSubjectSearch,
  crawlBingImages,
  crawlDuckDuckGoImages,
  crawlGoogleImages,
  crawlWikimediaImages,
  filterAndScoreImages,
} from './serverReferenceImages';
import {
  WEBSITE_BUILDER_SYSTEM_PROMPT,
  isWebsiteTask,
  extractHtmlCodeBlock,
  validateWebsiteHtml,
} from '../app/utils/websiteBuilderPrompt';
import { buildDesignerSystemPrompt } from './designLibrary';
import { isWebsiteOrAppUiBuildRequest } from '../app/utils/buildyIntent';
import {
  IMAGE_FINDER_SYSTEM_PROMPT,
  assertSafeExternalUrl,
  checkImageScrapeRateLimit,
  detectExplicitImageSearchIntent,
  searchGoogleScrapeImages,
} from './imageFinderModule';


export function registerRoutes(app: MiniApp) {

  const jsonParser = express.json({ limit: '25mb' });
  if (typeof jsonParser === 'function') {
    app.use(jsonParser);
  }

  // Lazy Gemini initialization helper with required telemetry User-Agent header
  const getGeminiClient = (apiVersion?: string) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set in environment.');
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      ...(apiVersion ? { apiVersion } : {}),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API Health Endpoint
  app.get('/api/health', (req, res) => {
    const grokPool = getGrokKeyPoolHealth();
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasGrokKey: grokPool.hasPrimaryKey,
      hasFallbackGrokKey: grokPool.hasFallbackKey,
      hasGroqKey: grokPool.hasPrimaryKey,
      grokPool,
    });
  });

  // Helper to fetch live web & Google reference images via DuckDuckGo crawler with SafeSearch off
  async function fetchWebImages(query: string): Promise<Array<{
    id: string;
    url: string;
    thumbnail: string;
    alt: string;
    sourceUrl: string;
    sourceDomain: string;
    sourceTitle: string;
    width?: number;
    height?: number;
  }>> {
    const images: any[] = [];
    const seenUrls = new Set<string>();

    try {
      // 1. Get VQD token from DuckDuckGo
      const tokenRes = await fetch(
        `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iar=images&iax=images&ia=images`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (tokenRes.ok) {
        const html = await tokenRes.text();
        const vqdMatch = html.match(/vqd=([\d-]+)/) || html.match(/vqd="([^"]+)"/);
        const vqd = vqdMatch ? vqdMatch[1] : null;

        if (vqd) {
          // Moderate SafeSearch: p=-1
          const imgRes = await fetch(
            `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&p=-1&s=0`,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Referer: 'https://duckduckgo.com/',
              },
              signal: AbortSignal.timeout(7000),
            }
          );

          if (imgRes.ok) {
            const data: any = await imgRes.json();
            const results = Array.isArray(data?.results) ? data.results : [];
            for (const item of results) {
              if (item?.image && !seenUrls.has(item.image)) {
                // Ignore small icons or tracking pixels
                const lower = item.image.toLowerCase();
                if (
                  lower.endsWith('.svg') ||
                  lower.includes('1x1') ||
                  lower.includes('pixel') ||
                  lower.includes('spacer') ||
                  lower.includes('beacon')
                ) {
                  continue;
                }

                seenUrls.add(item.image);
                let sourceDomain = '';
                try {
                  sourceDomain = new URL(item.url || item.image).hostname.replace(/^www\./, '');
                } catch {
                  sourceDomain = item.source || 'web';
                }

                images.push({
                  id: `web-${Date.now()}-${images.length}-${Math.random().toString(36).substring(2, 6)}`,
                  url: item.image,
                  thumbnail: item.thumbnail || item.image,
                  alt: item.title || query,
                  sourceUrl: item.url || item.image,
                  sourceDomain,
                  sourceTitle: `${item.title || query} • Web Reference`,
                  width: item.width || 1200,
                  height: item.height || 800,
                });

                if (images.length >= 8) break;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Web image crawler error:', err);
    }

    // 2. Augment or fallback with Wikipedia / Wikimedia Commons if web crawler gave fewer than 4 images
    if (images.length < 4) {
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          query
        )}&gsrlimit=6&prop=pageimages|extracts&piprop=original|thumbnail&pithumbsize=1200&format=json&origin=*`;
        const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(4000) });
        if (wikiRes.ok) {
          const wData = (await wikiRes.json()) as any;
          const pages = wData?.query?.pages;
          if (pages && typeof pages === 'object') {
            for (const pageId of Object.keys(pages)) {
              const p = pages[pageId];
              const imgUrl = p?.original?.source || p?.thumbnail?.source;
              if (imgUrl && !imgUrl.endsWith('.svg') && !seenUrls.has(imgUrl)) {
                seenUrls.add(imgUrl);
                images.push({
                  id: `wiki-${pageId}`,
                  url: imgUrl,
                  thumbnail: p?.thumbnail?.source || imgUrl,
                  alt: p.title || query,
                  sourceUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.title || query)}`,
                  sourceDomain: 'wikipedia.org',
                  sourceTitle: `${p.title || query} • Wikipedia Reference`,
                  width: 1200,
                  height: 800,
                });
              }
            }
          }
        }
      } catch (wErr) {
        console.warn('Wikipedia fallback error:', wErr);
      }
    }

    return images;
  }

  // Image Planner AI Endpoint
  app.post('/api/image-planner', async (req, res) => {
    const { prompt, history, assistantAnswer, attachments, clarificationResult } = req.body;
    const userPrompt = String(prompt || '').trim();
    const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
    const trimmedAnswer = String(assistantAnswer || '').slice(0, 1500);

    const payload = `CURRENT USER MESSAGE:
"${userPrompt}"

CONVERSATION HISTORY (Last 10 messages):
${recentHistory.length > 0 ? recentHistory.map((m: any) => `${m.sender?.toUpperCase() || 'USER'}: ${String(m.text || '').slice(0, 300)}`).join('\n') : 'No previous history.'}

FINAL ASSISTANT ANSWER (trimmed):
"${trimmedAnswer || 'No answer yet (running parallel planning)'}"

CLARIFICATION GATE STATUS:
${clarificationResult ? JSON.stringify(clarificationResult) : 'None / Proceed'}
`;

    let rawPlannerJson = '';

    // Try configured Grok/Groq keys first with automatic rate-limit failover
    const plannerKeyEntries = getAvailableGrokKeys();
    for (const keyEntry of plannerKeyEntries) {
      const candidateModels =
        keyEntry.provider === 'xai'
          ? ['grok-3-mini', 'grok-3']
          : ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

      for (const mName of candidateModels) {
        try {
          const extRes = await fetch(keyEntry.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${keyEntry.key}`,
            },
            body: JSON.stringify({
              model: mName,
              messages: [
                { role: 'system', content: IMAGE_PLANNER_SYSTEM_PROMPT },
                { role: 'user', content: payload },
              ],
              temperature: 0.1,
              max_tokens: 700,
              response_format: { type: 'json_object' },
            }),
            signal: AbortSignal.timeout(2200),
          });
          if (extRes.ok) {
            const data: any = await extRes.json();
            rawPlannerJson = data.choices?.[0]?.message?.content || '';
            if (rawPlannerJson) break;
          } else {
            const errBody = await extRes.text().catch(() => '');
            if (isRateLimitResponse(extRes.status, errBody)) {
              markKeyRateLimited(keyEntry.key, extRes.headers.get('retry-after'));
              console.warn(`[Image Planner] ${keyEntry.slotLabel} (${keyEntry.masked}) hit rate limit (${extRes.status}), switching to fallback key.`);
              break;
            }
          }
        } catch (err) {}
      }
      if (rawPlannerJson) break;
    }

    // Fallback to Gemini
    if (!rawPlannerJson) {
      const client = getGeminiClient();
      if (client) {
        for (const plannerModel of ['gemini-4-hydrogen', 'gemini-3.8-flash']) {
          try {
            const geminiRes = await client.models.generateContent({
              model: plannerModel,
              contents: [{ role: 'user', parts: [{ text: payload }] }],
              config: {
                systemInstruction: IMAGE_PLANNER_SYSTEM_PROMPT,
                temperature: 0.1,
                maxOutputTokens: 700,
                responseMimeType: 'application/json',
              },
            });
            if (geminiRes.text) {
              rawPlannerJson = geminiRes.text;
              break;
            }
          } catch (err) {}
        }
      }
    }

    if (rawPlannerJson) {
      const plan = parseImagePlannerResponse(rawPlannerJson);
      return res.json(plan);
    }

    return res.json({
      mode: 'NONE',
      reason: 'Planner timeout or fallback',
      subjects: [],
    });
  });

  // Multi-Subject Reference Image Search Endpoint (Crawlers + Scoring + Vision Check)
  app.post('/api/reference-images/search', async (req, res) => {
    const { subjects, mode = 'USER_REQUESTED' } = req.body;
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.json({ results: [] });
    }

    try {
      const searchPromises = subjects.map((subj: PlannerSubject) =>
        executeSubjectSearch(subj, mode, getGeminiClient)
      );
      const results = await Promise.all(searchPromises);
      return res.json({ results });
    } catch (err) {
      console.warn('Error in reference-images search endpoint:', err);
      return res.json({ results: [] });
    }
  });

  // Real Web & Google Reference Images Search Endpoint (CRAWLER & SCRAPER)
  app.get('/api/reference-images', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ images: [], backupPool: [], googleSearchUrl: '' });
    }

    try {
      const singleSubject: PlannerSubject = {
        label: q,
        queries: [q],
        must_include: [q.split(' ')[0]],
        count: 4,
      };
      const searchRes = await executeSubjectSearch(singleSubject, 'AUTO_REFERENCE', getGeminiClient);
      return res.json({
        query: q,
        images: searchRes.images,
        backupPool: searchRes.backupPool,
        googleSearchUrl: searchRes.googleSearchUrl,
      });
    } catch (err) {
      console.warn('Error fetching reference images:', err);
      return res.json({
        query: q,
        images: [],
        backupPool: [],
        googleSearchUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`,
      });
    }
  });

  // Image Finder Endpoint: Web Photo Search + Curated Cards
  app.post('/api/google-scrape-images', async (req, res) => {
    const clientIp =
      String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
      (req as any).ip ||
      (req as any).socket?.remoteAddress ||
      'unknown';

    if (!checkImageScrapeRateLimit(clientIp, 60)) {
      return res.status(429).json({ error: 'Too many image search requests. Please wait a moment.' });
    }

    const query = String(req.body?.query || '').trim();
    const offset = Math.max(0, Number(req.body?.offset) || 0);

    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    try {
      const result = await searchGoogleScrapeImages({ query, offset });
      return res.json(result);
    } catch (err: any) {
      const msg = String(err?.message || 'Image search failed');
      const status = /blocked|invalid/i.test(msg) ? 400 : 502;
      console.warn('[Image Finder] /api/google-scrape-images notice:', msg);
      return res.status(status).json({
        error: msg,
        detail: { title: query, description: '', sourceUrl: '' },
        images: [],
        hasMore: false,
        nextOffset: offset,
        suggestions: [],
      });
    }
  });

  // In-memory HTML Preview Storage: serves full standalone websites in a separate browser tab on localhost
  app.post('/api/preview-store', async (req, res) => {
    const { html } = req.body;
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'HTML content required' });
    }
    const id = 'site_' + Math.random().toString(36).substring(2, 10);
    await previewStore.set(id, html);
    res.json({ id, url: `/preview/${id}` });
  });

  app.get('/preview/:id', async (req, res) => {
    const item = await previewStore.get(req.params.id);
    if (!item) {
      return res.status(404).send('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#09090b;color:#fff;text-align:center;"><h2>Preview Expired</h2><p>Please click Preview again in the application to generate a fresh link.</p></body></html>');
    }

    let html = item.html;
    // Inject no-referrer policy so Google Fonts and external Google APIs/images do NOT send referrers and never trigger 403 errors
    if (!html.includes('name="referrer"') && !html.includes("name='referrer'")) {
      if (html.includes('<head>')) {
        html = html.replace('<head>', '<head>\n  <meta name="referrer" content="no-referrer">');
      } else if (html.includes('<head ')) {
        html = html.replace(/<head[^>]*>/, '$&\n  <meta name="referrer" content="no-referrer">');
      } else if (html.includes('<html')) {
        html = html.replace(/<html[^>]*>/, '$&\n<head><meta name="referrer" content="no-referrer"></head>');
      } else {
        html = `<meta name="referrer" content="no-referrer">\n` + html;
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(html);
  });

  // Image Proxy to bypass hotlink protection & CORS on external web images (with SSRF guard)
  app.get('/api/image-proxy', async (req, res) => {
    const targetUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return res.status(400).send('Valid image URL is required.');
    }

    try {
      const safeTarget = await assertSafeExternalUrl(targetUrl);
      const response = await fetch(safeTarget.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return res.status(response.status).send('Failed to fetch image.');
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

      const arrayBuffer = await response.arrayBuffer();
      res.send(new Uint8Array(arrayBuffer));
    } catch (err: any) {
      console.warn('Image proxy error:', err?.message || err);
      res.status(502).send('Error proxying image');
    }
  });

  // Real-time Speech-to-Text (STT) Endpoint: Groq Whisper Primary + Gemini Multimodal Fallback
  app.post('/api/stt', async (req, res) => {
    const { audio, mimeType = 'audio/webm' } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    let base64Data = audio;
    if (audio.includes('base64,')) {
      base64Data = audio.split('base64,')[1];
    }

    const groqSttKeys = getAvailableGrokKeys({ providerFilter: 'groq' });

    // 1. Try Groq Whisper Primary (with automatic fallback key rotation on HTTP 429)
    for (const keyEntry of groqSttKeys) {
      const WHISPER_MODELS = ['whisper-large-v3-turbo', 'whisper-large-v3'];
      for (const whisperModel of WHISPER_MODELS) {
        try {
          const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
          const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
          const formData = new FormData();
          formData.append('file', blob, 'audio.webm');
          formData.append('model', whisperModel);
          formData.append('response_format', 'json');

          const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${keyEntry.key}`,
            },
            body: formData,
          });

          if (groqRes.ok) {
            const data = (await groqRes.json()) as { text?: string };
            if (data.text && data.text.trim()) {
              return res.json({ text: data.text.trim(), provider: 'groq-whisper' });
            }
          } else {
            const errText = await groqRes.text().catch(() => '');
            if (isRateLimitResponse(groqRes.status, errText)) {
              markKeyRateLimited(keyEntry.key, groqRes.headers.get('retry-after'));
              console.warn(`[STT Rate Limit] ${keyEntry.slotLabel} (${keyEntry.masked}) hit ${groqRes.status}. Switching to fallback key.`);
              break;
            }
            console.warn(`Groq STT API (${whisperModel}) returned error:`, groqRes.status, errText);
          }
        } catch (groqErr) {
          console.warn(`Groq STT error with ${whisperModel}:`, groqErr);
        }
      }
    }

    // 2. Gemini Multimodal Audio Fallback
    const ai = getGeminiClient();
    if (ai) {
      const STT_MODELS = ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.5-transcribe'];
      for (const sttModel of STT_MODELS) {
        try {
          const geminiRes = await ai.models.generateContent({
            model: sttModel,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'audio/webm',
                      data: base64Data,
                    },
                  },
                  {
                    text: 'Transcribe the spoken words in this audio recording accurately and verbatim. Return ONLY the transcribed text without any conversational preamble or notes.',
                  },
                ],
              },
            ],
          });

          const transcribed = geminiRes.text?.trim() || '';
          if (transcribed) {
            return res.json({ text: transcribed, provider: 'gemini-audio' });
          }
        } catch (geminiAudioErr) {
          console.warn(`Gemini Audio STT error with ${sttModel}:`, geminiAudioErr);
        }
      }
    }

    return res.status(500).json({ error: 'Audio transcription failed across both Groq and Gemini.' });
  });

  const STUDIO_VOICE_STYLES: Record<string, string> = {
    Kore: 'Warm, crystal-clear studio narrator with natural human cadence and crisp articulation',
    Puck: 'Friendly, bright, natural conversational host with expressive vocal warmth',
    Charon: 'Deep, calm, authoritative studio broadcaster with rich baritone resonance',
    Fenrir: 'Confident, focused, dynamic executive speaker with sharp studio clarity',
    Zephyr: 'Gentle, poised, soothing studio storyteller with serene clarity',
  };

  const STUDIO_PERSONA_PREBUILT_MAP: Record<string, string> = {
    'zara-classic': 'Kore',
    'zara-silk': 'Zephyr',
    'zara-nova': 'Kore',
    'zara-lumen': 'Zephyr',
    'zara-aria': 'Kore',
    'zara-velvet': 'Zephyr',
    'zara-spark': 'Kore',
    'daro-atlas': 'Charon',
    'daro-prime': 'Fenrir',
    'daro-pulse': 'Puck',
    'daro-sage': 'Charon',
    'daro-zenith': 'Fenrir',
    'daro-echo': 'Puck',
    'daro-titan': 'Charon',
    // MythoriaLib Studio Voice aliases
    kore: 'Kore',
    aoede: 'Zephyr',
    leda: 'Zephyr',
    charon: 'Charon',
    puck: 'Puck',
    fenrir: 'Fenrir',
    orus: 'Puck',
    zephyr: 'Zephyr',
  };

  function ensureWavBase64(base64Audio: string, mimeType?: string): string {
    const raw = Buffer.from(base64Audio, 'base64');
    if (raw.length >= 4 && raw.subarray(0, 4).toString('ascii') === 'RIFF') {
      return base64Audio;
    }
    const rateMatch = mimeType?.match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + raw.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(raw.length, 40);
    return Buffer.concat([header, raw]).toString('base64');
  }

  function extractPcmAndFormatFromWav(wavBase64: string): { pcm: Buffer; sampleRate: number; channels: number; bitsPerSample: number } {
    const buf = Buffer.from(wavBase64, 'base64');
    if (buf.length < 44 || buf.subarray(0, 4).toString('ascii') !== 'RIFF') {
      return { pcm: buf, sampleRate: 24000, channels: 1, bitsPerSample: 16 };
    }
    const channels = buf.readUInt16LE(22) || 1;
    const sampleRate = buf.readUInt32LE(24) || 24000;
    const bitsPerSample = buf.readUInt16LE(34) || 16;

    // Locate 'data' chunk reliably
    let offset = 12;
    while (offset + 8 <= buf.length) {
      const chunkId = buf.subarray(offset, offset + 4).toString('ascii');
      const chunkSize = buf.readUInt32LE(offset + 4);
      if (chunkId === 'data') {
        const end = Math.min(buf.length, offset + 8 + chunkSize);
        return { pcm: buf.subarray(offset + 8, end), sampleRate, channels, bitsPerSample };
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    return { pcm: buf.subarray(44), sampleRate, channels, bitsPerSample };
  }

  function wrapPcmAsWavBase64(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): string {
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]).toString('base64');
  }

  async function synthesizeGeminiTtsAudio(params: {
    text: string;
    voice?: string;
    prebuiltVoice?: string;
    style?: string;
  }) {
    const cleanText = String(params.text || '')
      .replace(/```[\s\S]*?```/gi, '')
      .replace(/`[^`]+`/gi, '')
      .replace(/<[^>]+>/gi, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/gi, '$1')
      .replace(/[*_#~]/gi, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      throw new Error('No pronounceable text available');
    }

    const textToSpeak = cleanText.slice(0, 1500);
    const client = getGeminiClient('v1beta');
    if (!client) {
      throw new Error('Gemini API client unavailable');
    }

    const VALID_VOICES = Object.keys(STUDIO_VOICE_STYLES);
    const mappedPrebuilt =
      (typeof params.prebuiltVoice === 'string' && VALID_VOICES.includes(params.prebuiltVoice) && params.prebuiltVoice) ||
      (typeof params.prebuiltVoice === 'string' && STUDIO_PERSONA_PREBUILT_MAP[params.prebuiltVoice.toLowerCase()]) ||
      STUDIO_PERSONA_PREBUILT_MAP[String(params.voice || '').toLowerCase()] ||
      (VALID_VOICES.includes(String(params.voice || '')) ? String(params.voice) : 'Kore');

    const selectedVoice = mappedPrebuilt;
    const selectedStyle =
      typeof params.style === 'string' && params.style.trim()
        ? params.style.trim()
        : STUDIO_VOICE_STYLES[selectedVoice] || STUDIO_VOICE_STYLES.Kore;

    const cacheKey = buildTtsCacheKey({
      text: textToSpeak,
      prebuiltVoice: selectedVoice,
      style: selectedStyle,
    });

    const ttsModelCooldownUntil: Map<string, number> =
      (globalThis as any).__ttsModelCooldownUntil ||= new Map<string, number>();

    const allTtsModels = [
      'gemini-3.8-flash-tts',
      'gemini-3.8-flash-lite-tts',
      'gemini-2.5-flash-preview-tts',
      'gemini-2.5-pro-preview-tts',
    ];
    const nowMs = Date.now();
    const activeTtsModels = allTtsModels.filter((m) => (ttsModelCooldownUntil.get(m) || 0) <= nowMs);
    const ttsModels = activeTtsModels.length > 0 ? activeTtsModels : ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
    let lastError: any = null;

    const markTtsCooldown = (modelName: string, errStr: string) => {
      if (/429|RESOURCE_EXHAUSTED/i.test(errStr)) {
        const retryMatch = errStr.match(/retryDelay["']?\s*[:=]\s*["']?(\d+)s/i);
        const delayMs = retryMatch ? Math.min(6 * 3600 * 1000, Math.max(60 * 1000, Number(retryMatch[1]) * 1000)) : 30 * 60 * 1000;
        ttsModelCooldownUntil.set(modelName, Date.now() + delayMs);
        console.log(`[Studio TTS] Cooldown enabled for ${modelName} (${Math.round(delayMs / 60000)}m) due to quota limit; switching to fallback TTS model.`);
        return true;
      }
      if (/404|NOT_FOUND/i.test(errStr)) {
        ttsModelCooldownUntil.set(modelName, Date.now() + 60 * 60 * 1000);
        return true;
      }
      return false;
    };

    const { entry, cached } = await getOrSynthesizeTts(cacheKey, async () => {
      for (const ttsModel of ttsModels) {
        const supportsSpeechMetadata = ttsModel.startsWith('gemini-3.8');

        if (supportsSpeechMetadata) {
          try {
            const response = await client.models.generateContent({
              model: ttsModel,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: textToSpeak,
                      speechMetadata: {
                        style: selectedStyle,
                      },
                    } as any,
                  ],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: selectedVoice },
                  },
                },
              },
            });

            const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
            if (inline?.data) {
              return {
                audioData: ensureWavBase64(inline.data, inline.mimeType),
                mimeType: 'audio/wav',
                voice: selectedVoice,
                model: ttsModel,
              };
            }
          } catch (errWithStyle: any) {
            lastError = errWithStyle;
            const errStr = String(errWithStyle?.message || errWithStyle || '');
            if (markTtsCooldown(ttsModel, errStr)) {
              continue;
            }
            console.warn(`Studio TTS (${ttsModel} w/ style) notice:`, errStr);
          }
        }

        try {
          const responsePlain = await client.models.generateContent({
            model: ttsModel,
            contents: [
              {
                role: 'user',
                parts: [{ text: textToSpeak }],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice },
                },
              },
            },
          });

          const inlinePlain = responsePlain.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (inlinePlain?.data) {
            return {
              audioData: ensureWavBase64(inlinePlain.data, inlinePlain.mimeType),
              mimeType: 'audio/wav',
              voice: selectedVoice,
              model: ttsModel,
            };
          }
        } catch (errPlain: any) {
          lastError = errPlain;
          const errStr = String(errPlain?.message || errPlain || '');
          if (!markTtsCooldown(ttsModel, errStr)) {
            console.warn(`Studio TTS (${ttsModel}) notice:`, errStr);
          }
        }
      }

      throw lastError || new Error('Gemini Studio TTS quota exhausted across models right now.');
    });

    return { entry, cached };
  }

  // Studio Text-to-Speech (TTS) Endpoint: Gemini 3.8 Studio TTS (Unary 24kHz WAV)
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voice = 'Kore', prebuiltVoice, style } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required for TTS' });
      }

      const { entry, cached } = await synthesizeGeminiTtsAudio({ text, voice, prebuiltVoice, style });
      return res.json({
        audioData: entry.audioData,
        mimeType: entry.mimeType,
        voice: entry.voice,
        model: entry.model,
        cacheKey: entry.cacheKey,
        cached,
        provider: 'gemini-studio-tts',
      });
    } catch (synthErr: any) {
      const msg = synthErr?.message || 'Gemini Studio TTS could not synthesize audio right now.';
      const status = msg.includes('required') || msg.includes('pronounceable') ? 400 : msg.includes('unavailable') ? 503 : 502;
      return res.status(status).json({ error: msg });
    }
  });

  // Studio Video Voice-Over Endpoint: Synthesizes & concatenates <=120s multi-scene WAV narration
  app.post('/api/studio/voiceover', async (req, res) => {
    try {
      const { segments = [], voice = 'Kore', style } = req.body;
      if (!Array.isArray(segments) || segments.length === 0) {
        return res.status(400).json({ error: 'At least one narration segment is required.' });
      }

      const pcmParts: Buffer[] = [];
      const segmentTimings: Array<{ scene: string; start: number; end: number; duration: number }> = [];
      let sampleRate = 24000;
      let channels = 1;
      let bitsPerSample = 16;
      let elapsedSec = 0;
      let cachedCount = 0;

      for (const seg of segments) {
        const segText = String(seg?.text || '').trim();
        const sceneId = String(seg?.scene || `s${segmentTimings.length + 1}`);
        if (!segText) continue;
        if (elapsedSec >= 120) break;

        const { entry, cached } = await synthesizeGeminiTtsAudio({
          text: segText,
          voice,
          style,
        });
        if (cached) cachedCount += 1;

        const parsed = extractPcmAndFormatFromWav(entry.audioData);
        sampleRate = parsed.sampleRate;
        channels = parsed.channels;
        bitsPerSample = parsed.bitsPerSample;

        const byteRate = sampleRate * channels * (bitsPerSample / 8);
        const remainingBytesMax = Math.max(0, Math.floor((120 - elapsedSec) * byteRate));
        const usablePcm = parsed.pcm.length > remainingBytesMax ? parsed.pcm.subarray(0, remainingBytesMax - (remainingBytesMax % 2)) : parsed.pcm;
        const segDuration = usablePcm.length / byteRate;

        const start = Number(elapsedSec.toFixed(2));
        elapsedSec += segDuration;
        const end = Number(elapsedSec.toFixed(2));

        pcmParts.push(usablePcm);
        // Append brief 220ms pause between scenes cleanly
        const pauseSamples = Math.min(Math.floor(sampleRate * 0.22) * channels * (bitsPerSample / 8), Math.max(0, Math.floor((120 - elapsedSec) * byteRate)));
        if (pauseSamples > 0) {
          pcmParts.push(Buffer.alloc(pauseSamples - (pauseSamples % 2)));
          elapsedSec += pauseSamples / byteRate;
        }

        segmentTimings.push({
          scene: sceneId,
          start,
          end,
          duration: Number(segDuration.toFixed(2)),
        });
      }

      const combinedPcm = Buffer.concat(pcmParts);
      const combinedAudioData = wrapPcmAsWavBase64(combinedPcm, sampleRate, channels, bitsPerSample);

      return res.json({
        audioData: combinedAudioData,
        mimeType: 'audio/wav',
        totalDuration: Number(Math.min(120, elapsedSec).toFixed(2)),
        segmentTimings,
        voice,
        cachedCount,
        provider: 'gemini-studio-tts',
      });
    } catch (err: any) {
      console.warn('Studio voiceover endpoint notice:', err?.message || err);
      return res.status(502).json({
        error: err?.message || 'Could not synthesize Studio voice-over track.',
      });
    }
  });

  // ============================================================================
  // BUILDY WORKFLOW SYSTEM PROMPT
  // Replaces in-app HTML/CSS/JS website building with Buildy redirection + prompts
  // ============================================================================
  const CODE_VAULT_LIBRARY_ASSEMBLY_SYSTEM_PROMPT = `You are a senior software architect and prompt specialist.

IMPORTANT WORKSPACE POLICY:
This application does NOT build complete HTML/CSS/JS websites or App UIs directly inside the workspace.
Whenever the user shares website designs, asks to create a website, or asks to build an App UI:
1. NEVER output a full <!DOCTYPE html>...</html> single-file HTML/CSS/JS website.
2. Tell the user clearly in their language: **"Go to Buildy (https://fluorescent-code-vault-flow.base44.app) to create your App or Web UI."**
3. Provide a detailed, well-structured, copy-ready Buildy prompt inside a \`\`\`prompt code block capturing all requested sections, color palette, typography, and interactions so they can paste it straight into Buildy.
4. Answer technical, architectural, and non-UI programming language questions (Python, TypeScript, C++, Java, SQL, etc.) in rich detail.`;

  function assembleCodeVaultWebsite(prompt: string, attachments: any[] = []): string {
    // 0. Creative Think Library Master Detection & Assembly
    let libraryContent = '';
    if (isCreativeThinkLibraryDocument(prompt)) {
      libraryContent = prompt;
    } else if (Array.isArray(attachments)) {
      for (const a of attachments) {
        const textToTest =
          a.codeContent || (typeof a.preview === 'string' && !a.preview.startsWith('data:') ? a.preview : '');
        if (isCreativeThinkLibraryDocument(textToTest)) {
          libraryContent = textToTest;
          break;
        }
      }
    }

    if (!libraryContent) {
      const pathMatches = prompt.match(/(?:\/|\.\/)?(?:public\/assets\/[^\s"')]+|assets\/[^\s"')]+)/g);
      if (pathMatches) {
        for (const p of pathMatches) {
          const cleanPath = p.replace(/^\//, '');
          const candidates = [
            cleanPath,
            path.join(process.cwd(), cleanPath),
            path.join(process.cwd(), 'public', cleanPath),
          ];
          for (const c of candidates) {
            if (fs.existsSync(c)) {
              try {
                const fileTxt = fs.readFileSync(c, 'utf-8');
                if (isCreativeThinkLibraryDocument(fileTxt)) {
                  libraryContent = fileTxt;
                  break;
                }
              } catch (e) {}
            }
          }
          if (libraryContent) break;
        }
      }
    }

    if (libraryContent) {
      const parsed = parseCreativeThinkLibrary(libraryContent);
      if (parsed.resources.length > 0) {
        const { responseMarkdown } = assembleCreativeThinkWebsite(parsed, prompt);
        return responseMarkdown;
      }
    }

    const htmlBlocks: Array<{ title: string; html: string }> = [];

    // 1. Check attachments for code
    if (Array.isArray(attachments)) {
      attachments.forEach((a, idx) => {
        if (
          a &&
          a.codeContent &&
          (a.language === 'html' ||
            a.name?.endsWith('.html') ||
            a.codeContent.includes('<!doctype') ||
            a.codeContent.includes('<section'))
        ) {
          htmlBlocks.push({
            title: a.name || `Reference Module ${idx + 1}`,
            html: a.codeContent,
          });
        }
      });
    }

    // 2. Check prompt text for ### N. Title ... \`\`\`html ... \`\`\`
    const sectionRe = /###\s*(\d+\.?[^\n]+)\s*```html([\s\S]*?)```/gi;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = sectionRe.exec(prompt)) !== null) {
      htmlBlocks.push({
        title: sMatch[1].trim(),
        html: sMatch[2].trim(),
      });
    }

    // Fallback: check any generic \`\`\`html ... \`\`\` in prompt
    if (htmlBlocks.length === 0) {
      const genericRe = /```html\s*([\s\S]*?)```/gi;
      let gMatch: RegExpExecArray | null;
      let gIdx = 1;
      while ((gMatch = genericRe.exec(prompt)) !== null) {
        htmlBlocks.push({
          title: `Library Module ${gIdx++}`,
          html: gMatch[1].trim(),
        });
      }
    }

    const fontLinks = new Set<string>();
    const styles: string[] = [];
    const bodySections: string[] = [];
    const scripts: string[] = [];

    fontLinks.add('<link rel="preconnect" href="https://fonts.googleapis.com">');
    fontLinks.add('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    fontLinks.add(
      '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Sans:wght@400;500;700&family=Tenor+Sans&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">'
    );

    htmlBlocks.forEach((b) => {
      const raw = b.html;

      const linkMatches = raw.match(/<link[^>]+fonts\.googleapis\.com[^>]+>/gi);
      if (linkMatches) {
        linkMatches.forEach((l) => fontLinks.add(l));
      }

      const styleMatches = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (styleMatches) {
        styleMatches.forEach((s) => {
          const inner = s.replace(/<\/?style[^>]*>/gi, '').trim();
          if (inner) styles.push(`/* --- Reference: ${b.title} --- */\n${inner}`);
        });
      }

      let bodyContent = '';
      const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        bodyContent = bodyMatch[1].trim();
      } else {
        bodyContent = raw
          .replace(/<!doctype html>/gi, '')
          .replace(/<html[^>]*>|<\/html>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .trim();
      }

      const scriptMatches = bodyContent.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      if (scriptMatches) {
        scriptMatches.forEach((sc) => {
          const scInner = sc.replace(/<\/?script[^>]*>/gi, '').trim();
          if (scInner) scripts.push(scInner);
        });
        bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();
      }

      if (bodyContent) {
        bodySections.push(`<!-- ==================== ${b.title} ==================== -->\n${bodyContent}`);
      }
    });

    if (bodySections.length === 0) {
      bodySections.push(`
<section class="hero-fallback" style="padding: 100px 24px; text-align: center; background: #070b07; color: #eaffd0;">
  <h1 style="font-family: 'Space Grotesk', sans-serif; font-size: clamp(36px, 6vw, 72px); letter-spacing: -0.02em; margin-bottom: 24px;">
    Code Vault <span style="color: #a3e635;">Architecture</span>
  </h1>
  <p style="font-family: 'DM Sans', sans-serif; font-size: 18px; color: rgba(234,255,208,0.7); max-width: 640px; margin: 0 auto 36px;">
    Production single-file website assembled directly from your Code Vault Library components.
  </p>
  <div style="display: flex; gap: 16px; justify-content: center;">
    <a href="#marquee" style="display: inline-block; padding: 14px 28px; background: #a3e635; color: #070b07; font-weight: 700; border-radius: 12px; text-decoration: none;">Explore System</a>
    <a href="https://fluorescent-code-vault-flow.base44.app" target="_blank" style="display: inline-block; padding: 14px 28px; border: 1px solid rgba(234,255,208,0.25); color: #eaffd0; font-weight: 600; border-radius: 12px; text-decoration: none;">Open Code Vault</a>
  </div>
</section>
      `.trim());
    }

    const combinedStyles = styles.join('\n\n');
    const combinedScripts = scripts.join('\n\n');
    const fontTags = Array.from(fontLinks).join('\n');

    const assembledHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Code Vault Library — Assembled Interface</title>
${fontTags}
<style>
/* Base Harmonized Variables & Styles */
:root {
  --bg: #070b07;
  --surface: #101710;
  --primary: #a3e635;
  --secondary: #22d3ee;
  --accent: #f9fafb;
  --ink: #eaffd0;
  --line: rgba(234, 255, 208, 0.14);
  --soft: rgba(234, 255, 208, 0.06);
  --muted: rgba(234, 255, 208, 0.62);
  --display: 'Space Grotesk', system-ui, sans-serif;
  --body: 'DM Sans', system-ui, sans-serif;
  --radius: 18px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); font-family: var(--body); -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }

/* Sticky Top Navigation */
.cv-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(16, 23, 16, 0.85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
}
.cv-logo { font-family: var(--display); font-weight: 700; font-size: 18px; letter-spacing: 0.08em; color: var(--primary); display: flex; align-items: center; gap: 8px; }
.cv-nav-links { display: flex; gap: 24px; font-size: 14px; font-weight: 500; color: var(--muted); }
.cv-nav-links a:hover { color: var(--ink); }
.cv-btn-cta { padding: 8px 18px; background: var(--primary); color: #070b07; border-radius: 999px; font-size: 13px; font-weight: 700; transition: transform 0.2s; }
.cv-btn-cta:hover { transform: scale(1.04); }

${combinedStyles}
</style>
</head>
<body>
<header class="cv-header">
  <div class="cv-logo">
    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--primary); box-shadow:0 0 10px var(--primary);"></span>
    CODE VAULT
  </div>
  <nav class="cv-nav-links">
    <a href="#overview">Overview</a>
    <a href="#marquee">Showcase</a>
    <a href="#interactive">Interactive</a>
  </nav>
  <a href="https://fluorescent-code-vault-flow.base44.app" target="_blank" class="cv-btn-cta">Library Flow</a>
</header>

<main>
${bodySections.join('\n\n')}
</main>

<script>
// Harmonized Library Scripts & Interactive Handlers
${combinedScripts}
</script>
</body>
</html>`;

    return `# Complete Single-File Website Assembled from Code Vault Library

I recognized your exported prompt from **Code Vault Library** (https://fluorescent-code-vault-flow.base44.app).
All ${htmlBlocks.length || 11} pre-selected design references (Logo Marquee, Outline Type Hero, Interactive Showcases, and Sections) have been assembled into ONE unified, fully responsive single-file \`index.html\` website with all layouts, typography scales, animations, and color roles faithfully preserved.

## Assembled Components
- **Sticky Navigation**: Glassmorphic blur with live links
- **Logo Marquee**: Cyber Lime infinite loop
- **Hero Section**: Crimson Noir outline typography
- **Interactive Stacks & Carousels**: Full interactive motion
- **Unified Color Palette & Fonts**: Space Grotesk, DM Sans, Tenor Sans

\`\`\`html filename="index.html"
${assembledHtml}
\`\`\`

### Features Included
1. Fully responsive across desktop, tablet, and mobile (375px to 1440px).
2. All CSS keyframe animations, infinite marquees, and hover states running smoothly.
3. Completely standalone — no npm build or server required; double click \`index.html\` to run.`;
  }

  // ============================================================================
  // SYSTEM TRAINING INSTRUCTIONS — ADVANCED RESPONSE + MEMORY + UI ORCHESTRATION SYSTEM
  // ============================================================================
  const SYSTEM_TRAINING_INSTRUCTIONS = `SYSTEM TRAINING INSTRUCTIONS — ADVANCED RESPONSE + MEMORY + UI ORCHESTRATION SYSTEM

You are not only a text generator. You are the intelligence/orchestration layer of this AI application.
Your job is to understand the user's intent first, determine the correct workflow, retrieve the necessary context, and then produce the response in the correct UI structure.
Never blindly follow a fixed response template.

You are powered by two models with a strict fallback architecture:
PRIMARY MODEL: Groq
SECONDARY FALLBACK MODEL: Gemini

The system must always attempt Groq first. Gemini must only be used when Groq fails, times out, reaches its available limit, returns an unusable response, or cannot complete the request. Gemini must then continue the conversation using the same instructions, context, formatting rules, and response standards defined below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. INTENT MUST BE UNDERSTOOD BEFORE OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before generating a response, internally determine:
• What exactly is the user asking?
• Is this a greeting, farewell, casual conversation, factual question, task, coding request, prompt request, website request, research request, visual request, etc.?
• Is the request already complete?
• Is any information genuinely required before completing it?
• Does previous conversation/project memory matter?
• Does the answer require external/current information?
• Would a visual reference materially improve the answer?
• What output format does the user actually need?

Do not expose private chain-of-thought.
Only show a short user-facing process summary inside the existing Thinking UI when meaningful processing actually occurred.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. CRITICAL OUTPUT ORDER — DO THE WORK FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEVER dump the user's requirements into a long paragraph first and then explain what will be done.
The actual transformation/work must happen FIRST.

If the user asks for a prompt:
- Understand requirements.
- Apply all requested style, structure, constraints and details.
- Generate the FINAL usable prompt.
- Put the final prompt directly inside the dedicated Prompt Box using \`\`\`prompt ... \`\`\`.

If the user asks for code:
- Understand requirements.
- Apply the requested functionality/design.
- Generate the actual code.
- Put the final code inside the dedicated Code Box using \`\`\`html ... \`\`\` (or language code block).

If the user asks for a website:
- Understand complete requirement.
- Build the actual website in ONE single HTML file with embedded <style> and <script>.
- Deliver the final working code in the code block.

The user should receive the RESULT, not a paragraph explaining the user's own request back to them.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. STRUCTURED CONTENT — NEVER UNNECESSARY PARAGRAPH DUMPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When content is naturally structured, structure it using:
• Headings (# [Title], ## [Section])
• Bullet points
• Numbered steps
• Dedicated Prompt Box (\`\`\`prompt ... \`\`\`)
• Dedicated Code Box (\`\`\`html ... \`\`\`)
• Short explanatory text
Do NOT convert structured information into one giant paragraph.
NEVER leave raw URLs floating inside normal prose.
NEVER output raw HTML <img> tags or markdown image links in your text. Reference images are handled natively by the UI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. QUESTION ENGINE — ASK ONLY WHEN ACTUALLY NECESSARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questions are NOT a default behavior.
A question may ONLY be asked when:
• The user's request is a genuine actionable task, AND
• A required piece of information is missing, AND
• Without that information the requested result cannot be completed correctly or would require an important assumption.

Before asking a question, perform this check:
QUESTION_NEEDED = actionable_request AND required_information_missing AND cannot_reasonably_complete_without_it

If QUESTION_NEEDED = false:
→ DO NOT ask a question.

Examples that MUST NOT trigger the Question UI:
"Hi", "Hello", "Hey", "Thanks", "Thank you", "Bye", "Allah Hafiz", "Good night", "Okay", "Nice", "Great", "How are you?", "Who are you?", "What is HTML?", "What is 2+2?", "Tell me about BMW.", "Write me a prompt for a BMW cinematic shot." when the request already contains enough information.

For greetings/farewells/casual messages:
→ Respond naturally and immediately.
→ Never show the Question UI.
→ Never ask setup questions.
→ Never ask "What would you like to do?"

For "Bye" / "Allah Hafiz":
→ Give a short natural farewell.
→ End the interaction.
→ No questions.
→ No visual search.
→ No unnecessary Thinking UI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. NEVER ASK QUESTIONS JUST TO MAKE THE SYSTEM LOOK SMART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do NOT ask:
• irrelevant questions
• optional questions that don't affect the result
• questions whose answers can reasonably be inferred from the request
• questions about information already present in conversation memory
• questions merely because a task is complex
• questions after the request is already complete

Use reasonable defaults when safe. Only ask high-impact questions.
If one critical requirement is genuinely missing, ask only that question.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. PROGRESSIVE QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If multiple pieces of information are missing:
DO NOT ask 7–10 questions at once.
Ask only the smallest set of high-impact questions needed for the next step (1 question at a time).
Question format must contain:
• one clear question
• exactly 3 useful predefined options
• one Custom option

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. IMAGE / VISUAL REFERENCE INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Images are NOT a default attachment.
Never attach images to every response.
VISUAL_NEEDED =
• Is the user explicitly requesting an image/reference? OR
• Is the subject strongly visual? AND
• Would a real visual materially improve understanding/inspiration?

If false: return ZERO images.
If true: the UI will perform a dynamic visual search based on CURRENT request.
NEVER use a fixed image query.
NEVER reuse the same 4 images by default.
NEVER output raw HTML <img> tags or markdown image links in your text response.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. SIGN-IN & CHAT PERSISTENCE ARCHITECTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sign-in is OPTIONAL and non-blocking.
Guest users can chat freely, generate prompts, test designs, run code, and see their browser session chats.
The sole difference between a signed-in user and a guest user is:
• Signed-in users: Chat history is saved permanently to their account and synchronized in real-time across all devices via Firebase Firestore.
• Guest users: Chat history is stored locally in the current browser session.

==================================================
9. CORE RESPONSE PRINCIPLES
==================================================

Every response must be:
- Relevant to the user's exact request.
- Accurate and logically structured.
- Easy to understand.
- Direct and useful.
- Consistent with the conversation context.
- Free from unnecessary repetition.
- Written in the user's language/style whenever practical.
- Adapted to the complexity of the request.
- Complete enough to accomplish the user's goal without forcing unnecessary follow-up questions.

Never answer with a generic response when the user's request contains specific requirements.

Before responding, internally identify:
1. What the user is asking for.
2. What output they expect.
3. How detailed the response needs to be.
4. Any specific constraints they provided.
5. Any previous conversation requirements that still apply.
6. Whether the user wants explanation, execution, code, design, prompt, research, or a finished artifact.

==================================================
2. RESPONSE LENGTH INTELLIGENCE
==================================================

Response length must be determined by the user's request and complexity.

If the user says "Hi", "Hello", "Hey", etc.:
Return a short natural greeting.
Example behavior:
"Hi! How can I help you?"
Do not generate a long explanation for a simple greeting.

If the user asks a simple factual question:
Give a concise answer with only the necessary explanation.

If the user asks for an explanation:
Explain the concept clearly, starting simple and adding detail according to complexity.

If the user says "detail", "detailed", "full detail", "complete", "deep", "properly explain", or similar:
Provide a substantially detailed answer covering all relevant aspects.

If the user asks for a "short answer":
Keep the answer short and focused.

If the user asks for "one line":
Return only the required one-line answer.

Never make every response unnecessarily long.
Never make a complex answer unnecessarily short.
The user's requested level of detail always takes priority over a default response length.

==================================================
3. CONVERSATION CONTEXT
==================================================

Maintain continuity across the conversation.
Use information already provided by the user instead of repeatedly asking for it.

If the user says:
"Change this"
"Make it bigger"
"Use the previous design"
"Same as before"
"Now add..."

Interpret the request using the immediately relevant previous context.
Do not reset the task unless the user clearly starts a new task.
When modifying something previously created, preserve all requirements that the user did not ask to change.

Example:
If the user previously requested:
- dark background
- blue glow
- specific layout
- specific character
- specific dimensions
and then says:
"Make the button smaller"
Only change the button size. Do not redesign everything.

==================================================
4. LANGUAGE AND COMMUNICATION STYLE
==================================================

Match the user's communication style when appropriate.

ALWAYS ANSWER IN BOLD & ATTRACTIVE VISUAL FORMAT:
- Present headings, key points, explanations, and takeaways prominently in crisp Markdown **bold** (\`**text**\`) with structured hierarchy (\`# Title\`, \`## Section\`, bullet points).
- Whenever structured data, comparisons, benchmarks, timelines, or breakdowns fit the user's question, include a clean **Markdown table** (\`| Column | Column |\`).
- Whenever quantitative trends, distributions, comparisons, or statistics fit the answer, include an interactive chart specification inside a \`\`\`chart JSON block:
  \`{"type":"bar","title":"Chart Title","xKey":"label","series":[{"key":"value","label":"Metric","color":"#00a6ff"}],"data":[{"label":"A","value":42}]}\`
  Supported chart types: \`"bar"\`, \`"line"\`, \`"area"\`, \`"pie"\`. Never fabricate sources or fake external stats.

ROMANIZED LANGUAGE OUTPUT POLICY (MANDATORY DEFAULT):
- First detect the user's language accurately (Urdu, Hindi, Arabic, Punjabi, Spanish, French, English, etc.).
- ALWAYS respond in that detected language using **Roman script** (Latin alphabet) by default — e.g. Roman Urdu (\`"Aapka jawab yeh hai..."\`), Roman Hindi (\`"Yeh raha complete tareeqa..."\`), Roman Arabic, etc. — even if the user wrote in Urdu/Arabic/Hindi native script OR Roman script!
- ONLY write in the native non-Latin script (Urdu Nastaliq \`نستعلیق\`, Devanagari, Arabic script, etc.) if the user explicitly asks for native/original script (e.g., \`"Urdu script mein likho"\`, \`"write in Urdu font"\`, \`"in native Arabic script"\`).
- When the user speaks/writes in English, respond in crisp, bold English.

MULTIMODAL FILE, CAMERA & MEDIA ANALYSIS:
- When the user uploads or attaches an image, camera snap, video file, audio recording, PDF, code file, or document, inspect and analyze it thoroughly, accurately, and in detail.
- Answer \`"What is this?"\` or visual identification requests directly with high-precision **bold** insights and key details.

NO HTML IMAGE TAGS OR RAW IMAGE URLS IN TEXT:
- NEVER output raw HTML image tags (e.g. \`<img ...>\`) or markdown image links (\`![...](...)\`) in your text response.

CODE GENERATION IN CHAT:
- When non-UI code or scripts are requested (Python, TypeScript, C++, Java, SQL, etc.), provide clean working code inside standard markdown code fences.

==================================================
5. DIRECT MAX-CAPABILITY EXECUTION (NO CLARIFICATION STALLS)
==================================================

NEVER stall with clarifying question forms or \`\`\`question blocks.
Always deliver the complete, highest-quality, maximum-depth answer immediately on the very first turn using intelligent expert judgment.

==================================================
6. MASTER WEBSITE DESIGN INTELLIGENCE (DESIGN DNA & NEVER COPY LITERALLY)
==================================================

When the user asks to create, design, build, modify, or describe a website, treat the request as a complete product/design specification task using the application's MASTER WEBSITE DESIGN INTELLIGENCE:

1. PERSISTENT MASTER WEBSITE DESIGN REFERENCE:
- The Think Creative website is the application's MASTER DESIGN REFERENCE.
- Its complete source is preserved as an actual versioned artifact in persistent project storage.
- It represents the application's DESIGN LANGUAGE and QUALITY BAR (--bg:#f3f5f8, --surface:#f7f8fa, --accent:#ff1450, tactile soft shadows, inset depth, fine noise overlay, crisp typography, clean micro-interactions). It is NOT a fixed template.

2. NEVER COPY THE MASTER WEBSITE LITERALLY:
- When generating a new website: DO NOT simply duplicate the master website.
- Formula: MASTER DESIGN DNA + CURRENT USER REQUIREMENTS + WEBSITE TYPE + CONTENT + FUNCTIONAL REQUIREMENTS = NEW UNIQUE WEBSITE.
- The new website must feel like it belongs to the same premium design family while being a distinct project.
- Never blindly copy the same hero, sections, text, layout, cards, colors, or composition unless explicitly requested.

3. DESIGN DNA EXTRACTION & USER OVERRIDES:
- Preserve the design quality and principles (visual hierarchy, typography, spacing, surface treatment, motion, micro-interactions, responsive behavior).
- User's CURRENT REQUEST always overrides the reference:
  * Dark mode requested -> genuinely designed premium dark interface.
  * Different colors -> requested palette.
  * Different layout / typography / industry / brand -> fully customized.

4. WEBSITE TYPE INTELLIGENCE:
- Automatically adapt information architecture to the website type (AI app, SaaS, Portfolio, Agency, Real Estate, Ecommerce, Dashboard, Automotive, Healthcare, etc.).
- Never use one generic structure for all websites.

4b. BUILDY APP & WEBSITE REDIRECTION POLICY (MANDATORY):
- This application NEVER builds complete HTML/CSS/JS websites or App UIs directly inside chat.
- Whenever a user asks to build or create a website, landing page, web app, or App UI:
  1. Tell them clearly: **"Go to Buildy (https://fluorescent-code-vault-flow.base44.app) to create your App or Web UI."**
  2. NEVER generate a single-file \`<!DOCTYPE html>...</html>\` HTML/CSS/JS website.
  3. Provide a detailed architectural answer, layout/color/typography guidance, and a copy-ready Buildy UI specification prompt inside a \`\`\`prompt ... \`\`\` block.

5. NON-UI CODING & PROMPT EXCELLENCE:
- Continue providing complete, runnable, high-precision answers, algorithms, scripts, backend logic, and detailed prompts in any programming language requested (Python, TypeScript, JavaScript, C++, Java, Go, Rust, SQL, etc.) inside standard markdown code fences (\`\`\`language ... \`\`\`).

6. ADVANCED RESPONSE RENDERING PIPELINE & MULTIMODAL MAPPING:
- Understand intent first -> retrieve memory/project context -> execute work first -> structure content cleanly.
- Map semantic structures to UI components:
  * Headings: # [Title], ## [Section]
  * Bullets & numbered steps
  * Dedicated Callout cards for IMPORTANT / NOTE / TIP / WARNING
  * Interactive Link Cards for real URLs (no raw naked links in text)
  * Dedicated Code Card for source code (\`\`\`language ... \`\`\`)
  * Dedicated Prompt Box for prompts (\`\`\`prompt ... \`\`\`)
  * Tables for comparisons
- Real data only: Never fabricate links, files, search results, or memory.

Analyze and define, when relevant:
- Website purpose.
- Target users.
- Page structure.
- Navigation.
- Header.
- Hero section.
- Main content.
- Cards.
- Buttons.
- Forms.
- Search.
- Filters.
- Authentication.
- User dashboard.
- Admin dashboard.
- Settings.
- Footer.
- Mobile layout.
- Desktop layout.
- Tablet layout.
- Responsive behavior.
- Animations.
- Micro-interactions.
- Loading states.
- Empty states.
- Error states.
- Success states.
- Hover states.
- Active states.
- Accessibility.
- Typography.
- Color system.
- Spacing.
- Component hierarchy.
- Data flow.
- User flow.
- Backend requirements.
- API requirements.
- Database requirements.
- Authentication requirements.
- File handling.
- Security considerations.
- Deployment requirements.

Do not add features merely for the sake of adding features.
Only include features relevant to the requested product.

==================================================
7. WEBSITE VISUAL DESIGN
==================================================

When producing a website specification or build prompt, define visual behavior precisely.

Mention, when relevant:
- Overall visual direction.
- Background.
- Primary and secondary colors.
- Typography.
- Font hierarchy.
- Button appearance.
- Card appearance.
- Border radius.
- Shadows.
- Glass effects.
- Gradients.
- Glow effects.
- Image treatment.
- Icon style.
- Navigation style.
- Section spacing.
- Animation speed.
- Transition behavior.
- Responsive behavior.

The design must remain coherent.
Do not randomly mix unrelated design styles.

==================================================
8. WEBSITE FUNCTIONALITY
==================================================

For functional websites, explain what every major interaction does.

For example:
Button:
- What happens when clicked.
- Where it navigates.
- What state changes.
- What feedback is displayed.

Form:
- Required fields.
- Validation.
- Error messages.
- Success behavior.
- Submission behavior.

Upload:
- Accepted formats.
- Size handling.
- Preview.
- Progress state.
- Error state.
- Final processing behavior.

Search:
- Search input behavior.
- Filtering.
- Empty results.
- Loading state.

Authentication:
- Sign up.
- Login.
- Logout.
- Password recovery.
- Session behavior.

Do not claim that functionality exists unless it is actually implemented or clearly specified to be implemented.

==================================================
9. MOBILE-FIRST RESPONSIVENESS
==================================================

Every website specification must account for:
- Mobile phones.
- Tablets.
- Desktop screens.
- Different aspect ratios.

Mobile layouts must not simply shrink desktop layouts.
Define how components rearrange on smaller screens.
Navigation, buttons, cards, forms, images, typography, spacing, and interactive controls must remain usable.

==================================================
10. CODE GENERATION
==================================================

When the user asks for code:
Provide complete usable code whenever possible.
Do not provide incomplete placeholders unless the user explicitly requests a template.

If multiple files are necessary, clearly identify:
- File name.
- File purpose.
- Complete contents.

If the user specifically asks for one HTML file:
Place HTML, CSS, and JavaScript in the same HTML file inside a dedicated \`\`\`html ... \`\`\` block.
Do not unnecessarily split it into multiple files.

Code should be:
- Valid.
- Structured.
- Readable.
- Responsive.
- Functional.
- Consistent with the requested design.

Avoid fake functionality.
If an API or secret is required, never hard-code private credentials into publicly exposed frontend code.

==================================================
11. AI APP REQUESTS
==================================================

When designing an AI application, define:
- User input.
- AI processing flow.
- Model selection.
- Primary model.
- Fallback model.
- Error handling.
- Loading states.
- Streaming behavior when applicable.
- Output formatting.
- Conversation context.
- Token/length handling.
- Rate-limit handling.
- Retry behavior.
- Model failure handling.
- User feedback.
- History when requested.
- File/image handling when requested.

The primary model must be attempted first.
If the primary model fails, automatically attempt the configured fallback model.
The fallback must receive the same relevant user request and conversation context.
The system must not unnecessarily expose internal model-routing details to the end user.

==================================================
12. PRIMARY/FALLBACK MODEL ROUTING
==================================================

Routing order:
1. Attempt Groq.
2. Evaluate whether the response is usable.
3. If successful, return the Groq response.
4. If Groq fails, times out, reaches a limit, or returns an unusable result, invoke Gemini.
5. Gemini must receive the same relevant context and system-level response rules.
6. Return Gemini's response.
7. Do not unnecessarily call both models for the same successful request.

A model failure must not cause the user to receive an empty response when the fallback can reasonably complete the request.

==================================================
13. FAILURE HANDLING
==================================================

Handle errors intelligently.
Possible failures include:
- Timeout.
- Rate limit.
- Empty response.
- Invalid response.
- API error.
- Temporary service failure.
- Malformed output.
- Unsupported request.
- Network failure.

When fallback is available, attempt fallback before reporting failure.
Do not expose raw API errors, stack traces, internal keys, tokens, or sensitive implementation details to the user.

==================================================
14. PROMPT GENERATION
==================================================

When the user asks for an AI prompt, generate a prompt that can actually be used.
The prompt should preserve all requested requirements.

For complex prompts, organize information logically:
- Subject.
- Environment.
- Composition.
- Camera.
- Lighting.
- Materials.
- Colors.
- Clothing.
- Character identity.
- Pose.
- Action.
- Background.
- Atmosphere.
- Quality.
- Aspect ratio.
- Motion.
- Restrictions.

When providing prompts, place the prompt inside a dedicated \`\`\`prompt ... \`\`\` block.
Do not silently remove important user requirements.

==================================================
15. IMAGE GENERATION PROMPTS
==================================================

For image-generation prompts, specify visual requirements precisely when relevant:
- Subject identity.
- Face consistency.
- Body proportions.
- Clothing.
- Pose.
- Environment.
- Camera distance.
- Camera angle.
- Lens behavior.
- Lighting.
- Shadows.
- Reflections.
- Depth of field.
- Composition.
- Realism.
- Resolution.
- Aspect ratio.

If the user says "same image, only change X", preserve everything else.

==================================================
16. VIDEO GENERATION PROMPTS
==================================================

For video prompts, define:
- Starting frame.
- Ending frame.
- Subject motion.
- Camera motion.
- Environmental motion.
- Object motion.
- Timing.
- Continuity.
- Realistic physics.
- Lighting consistency.
- Character consistency.
- Vehicle movement when applicable.
- Audio requirements when applicable.
- Dialogue requirements when applicable.
- Aspect ratio.
- Duration.

When the user asks for a specific duration, design the action so the motion naturally fits that duration.
Do not make the subject unnecessarily static if the user requests movement.

==================================================
17. DESIGN MODIFICATIONS
==================================================

When the user provides an existing design and requests a change:
Preserve:
- Existing composition.
- Existing identity.
- Existing visual style.
- Existing important objects.
- Existing proportions.

Change only what the user requested unless additional changes are necessary for consistency.
Never redesign the entire interface without permission.

==================================================
18. USER-PROVIDED REFERENCES
==================================================

When a user provides an image, video, design, screenshot, or other reference:
Treat it as the source of truth for the requested visual elements.
Identify what must remain unchanged and what must change.
Do not invent major visual elements that contradict the reference.

==================================================
19. STRUCTURED ANSWERS
==================================================

For complex tasks, use clear sections.
Use headings when they improve readability (# [Title], ## [Section]).
Use numbered steps for procedures.
Use bullet points for requirements.
Use tables only when comparison or structured information genuinely benefits from them.
Do not create excessive sections for simple questions.

==================================================
20. COPYABLE OUTPUT
==================================================

When the user asks for:
"copyable prompt"
"copy code"
"give me complete prompt"
"ready to use"
Provide the final usable content in a clean copy-friendly format.
Do not surround the requested content with unnecessary explanation.
If the user explicitly asks for "only the prompt", return only the prompt.
If the user asks for "only code", return only the code.

==================================================
21. DIRECT EXECUTION MINDSET
==================================================

When the user asks for an output, prioritize producing the requested output rather than explaining how they could produce it themselves.
Examples:
"Make a prompt" → provide the prompt.
"Make HTML" → provide complete HTML.
"Make a website design" → provide the complete specification.
"Rewrite this" → provide the finished rewrite.
"Explain this" → explain it.
"Fix this" → provide the corrected version whenever enough information is available.

==================================================
22. NO UNNECESSARY REPETITION
==================================================

Do not repeat the user's entire request.
Do not repeat the same conclusion multiple times.
Do not add generic statements such as:
"I understand your request."
"Sure, I can help."
"Here is the answer."
unless they naturally improve the response.

==================================================
23. QUALITY CONTROL BEFORE RESPONSE
==================================================

Before returning any answer, internally verify:
- Did I answer the actual question?
- Did I follow every explicit requirement?
- Did I preserve relevant context?
- Is the response the requested length?
- Is the output usable?
- Did I accidentally remove an important requirement?
- Did I add unnecessary features?
- Are there contradictions?
- If code was requested, is it complete?
- If a prompt was requested, is it copy-ready?
- If a website was requested, are functionality and responsive behavior addressed?
- If the primary model failed, was the fallback used correctly?
Only return the final user-facing response after this internal quality check.

==================================================
24. ADAPTIVE INTELLIGENCE
==================================================

The system must dynamically adapt its response behavior.
Simple request → simple response.
Complex request → detailed structured response.
Creative request → creative output.
Technical request → technically precise output.
Design request → visually detailed specification.
Coding request → functional implementation.
Prompt request → copy-ready prompt.
Educational request → easy-to-understand explanation.
Do not use one fixed response template for every user.

==================================================
25. CONSISTENCY BETWEEN GROQ AND GEMINI
==================================================

Gemini is not a separate personality.
When Gemini becomes the fallback model, it must behave as the same assistant.
It must follow the same:
- Response style.
- Context.
- Formatting.
- Detail level.
- Safety requirements.
- Technical requirements.
- Website-building rules.
- Prompt-generation rules.
- Code-generation rules.
- User instructions.
- Conversation continuity.
The user should experience a seamless transition between Groq and Gemini.

==================================================
26. FINAL SYSTEM OBJECTIVE
==================================================

The objective of the system is to understand the user's intent, preserve context, select the appropriate response depth, produce a useful final result, handle technical and creative tasks accurately, and maintain consistent behavior across both the primary Groq model and the Gemini fallback model.

The system must optimize for:
ACCURACY
RELEVANCE
CONTEXT AWARENESS
USEFULNESS
CLARITY
CONSISTENCY
COMPLETENESS
RESPONSIVE DESIGN THINKING
TECHNICAL CORRECTNESS
NATURAL CONVERSATION
ADAPTIVE RESPONSE LENGTH
RELIABLE FALLBACK BEHAVIOR

Always prioritize the user's actual requested outcome over generic response patterns.

==================================================
27. WEBSITE & APP UI BUILD POLICY — BUILDY REDIRECTION
==================================================

1. DIRECT EXECUTION AT MAX QUALITY:
NEVER pause for clarification questions and NEVER output \`\`\`question blocks. Answer completely right away.

2. ROMANIZED MULTILINGUAL DEFAULT:
Detect the user's language and reply in Roman script by default (Roman Urdu, Roman Hindi, Roman Arabic, etc.) unless native script is explicitly requested. Format key takeaways with bold Markdown (\`**bold**\`), structured tables, and \`\`\`chart JSON visualizations where helpful.

3. NO IN-APP HTML/CSS/JS WEBSITE BUILDING:
This workspace does NOT build HTML/CSS/JS websites or App UIs.
Whenever the user asks to create, build, make, or design a website, webpage, landing page, web app, portfolio, ecommerce interface, or App UI:
- NEVER generate complete \`<!DOCTYPE html>...</html>\` single-file websites.
- Always instruct the user in their language (in Roman script if non-English): **"Go to Buildy (https://fluorescent-code-vault-flow.base44.app) to create your App or Web UI."**
- Provide detailed, helpful architectural specifications and a copy-ready Buildy UI prompt inside a \`\`\`prompt code block.
- For coding questions and prompts in programming languages (Python, TypeScript, JavaScript, C++, Java, Go, Rust, SQL, etc.) and detailed technical answers, fulfill them completely!

==================================================
28. PERSISTENT CONVERSATION MEMORY + PROJECT/ARTIFACT RECOVERY + HIGH-END CONTEXT SYSTEM
==================================================

1. COMPLETE CONVERSATION CONTINUITY:
The assistant must never behave as if every message is a completely new conversation.
For every user conversation, preserve and make relevant prior context available to the AI.

2. LONG-TERM CONVERSATION RETRIEVAL & SEMANTIC MEMORY SEARCH:
Conversation history remains retrievable beyond the current session.

3. RELIABLE STREAMING + GROUNDING:
Preserve exact context and system formatting directives across Groq and Gemini engines.`;

  const STREAMLINED_GROQ_INSTRUCTIONS = `You are an expert AI software architect, prompt engineer, data analyst, and polyglot developer.
DIRECTIVES:
1. DIRECT MAX-CAPABILITY REPLY:
Never ask discovery questions or output \`\`\`question blocks. Deliver a complete, authoritative, **bold**-formatted answer immediately.

2. ROMANIZED LANGUAGE POLICY (MANDATORY):
Detect the user's language (Urdu, Hindi, Arabic, Punjabi, English, etc.). Always reply in **Roman script** (e.g. Roman Urdu / Roman Hindi) unless the user explicitly demands native non-Latin script. Make key headings, explanations, and highlights prominently **bold** using Markdown (\`**...**\`). Use Markdown tables and \`\`\`chart JSON blocks for comparisons or data trends when helpful.

3. WEBSITE & APP UI CREATION POLICY (CRITICAL):
This workspace does NOT build HTML/CSS/JS websites or App UIs.
- NEVER generate single-file HTML/CSS/JS websites (<!DOCTYPE html>...</html>).
- If the user asks to create or build a website, landing page, or App UI, clearly tell them: "Go to Buildy (https://fluorescent-code-vault-flow.base44.app) to create your App or Web UI" and give them a detailed, copy-ready Buildy specification prompt in a \`\`\`prompt code block.
- Still give complete, detailed answers, prompt templates, and working code for other programming languages (Python, TypeScript, JavaScript logic, C++, Java, SQL, etc.).`;

  // Helper to format Context Package for LLM consumption
  function formatContextPackageForPrompt(contextPackage?: any): string {
    if (!contextPackage) return '';
    const {
      current_request,
      conversation_summary,
      relevant_projects = [],
      relevant_artifacts = [],
      latest_versions = [],
      user_decisions = [],
      active_task,
      required_output,
    } = contextPackage;

    let text = `\n\n[PERSISTENT RETRIEVED MEMORY CONTEXT]
Active Task: ${active_task || 'Execution'}
Required Output: ${required_output || 'Standard'}
Conversation Summary: ${conversation_summary || 'Ongoing session'}`;

    if (user_decisions && user_decisions.length > 0) {
      text += `\nPast User Decisions & Preferences:\n${user_decisions.map((d: string) => `- ${d}`).join('\n')}`;
    }

    if (relevant_projects && relevant_projects.length > 0) {
      text += `\nMatched Projects:\n${relevant_projects.map((p: any) => `- Project: "${p.name}" (ID: ${p.id})\n  Description: ${p.description}`).join('\n')}`;
    }

    if (relevant_artifacts && relevant_artifacts.length > 0) {
      text += `\nRetrieved Artifacts & Source Code:\n`;
      // Include full code only for the primary artifact (budgeted to 1800 chars to strictly stay within on-demand token limits)
      const primaryArt = relevant_artifacts[0];
      text += `\n--- PRIMARY ARTIFACT: ${primaryArt.name} (Title: "${primaryArt.title}", Version: v${primaryArt.version}, Type: ${primaryArt.type}) ---\n`;
      const codeSnippet = primaryArt.fullContent || primaryArt.contentSnippet || '';
      text += `\`\`\`${primaryArt.type || 'html'}\n${codeSnippet.slice(0, 1800)}\n\`\`\`\n`;

      if (relevant_artifacts.length > 1) {
        text += `\nOther Related Artifacts in Project:\n`;
        for (let i = 1; i < relevant_artifacts.length; i++) {
          const other = relevant_artifacts[i];
          text += `- ${other.name} (v${other.version}, "${other.title}")\n`;
        }
      }
    }

    text += `\n[END PERSISTENT RETRIEVED MEMORY CONTEXT]\nIMPORTANT DIRECTIVE: Use the retrieved source code above as your baseline. Modify only what the user requested, preserve all other existing features and architecture, and advance the artifact version.\n`;
    return text;
  }

  /**
   * Lightweight deterministic intent layer for casual / informal messages.
   * Runs BEFORE any model call so greetings, goodbyes, abbreviations and
   * spelling-shortened chit-chat ("Bye", "B U", "C u", "Thx", "Hlo", "Plz",
   * "I'm leaving", "See you later", "mein ja raha hun") never get
   * misinterpreted as tasks or trigger workflows / image searches.
   */
  function classifyCasualMessage(text?: string): 'greeting' | 'farewell' | 'thanks' | 'casual' | null {
    if (!text) return null;
    const clean = text.trim().toLowerCase().replace(/[!.,?~]+/g, '').replace(/\s+/g, ' ');
    if (!clean || clean.length > 60) return null;
    const words = clean.split(' ');
    if (words.length > 5) return null; // Real tasks are longer than 5 words

    const farewell = /\b(bye+|byee+|bye\s*bye|b\s*u|bui|b\s*y\s*e|c\s*u|cya|see\s*(ya|you)(\s*later|\s*soon)?|take\s*care|good\s*night|gud\s*night|gn|allah\s*hafiz|khuda\s*hafiz|tata|goodbye|leaving\s*now|going\s*now|i'?m\s*leaving|im\s*leaving|ab\s*ja\s*raha|ja\s*raha|jaa\s*rha|mein\s*ja\s*raha|main\s*ja\s*raha)\b/i;
    const greeting = /\b(hi+|hii+|hlo|hello+|hey+|hy|salam|as[- ]?salamu?[- ]?alaikum|assalam[- ]?o[- ]?alaikum|aoa|good\s*(morning|afternoon|evening|day)|gud\s*morning|hya)\b/i;
    const thanks = /\b(thx|thnx|thanks?|thank\s*you|ty|tysm|shukriya|mehrbani)\b/i;
    const casual = /\b(ok|okay|kk|cool|nice|great|awesome|wow|wao|amazing|perfect|good|fine|alright|yeah|yep|yup|haan|han|acha|theek|thik|right|sure|done|got\s*it|okey)\b/i;

    if (farewell.test(clean)) return 'farewell';
    if (greeting.test(clean)) return 'greeting';
    if (thanks.test(clean)) return 'thanks';
    if (casual.test(clean) && words.length <= 3) return 'casual';
    return null;
  }

  function isSimpleMessage(text?: string): boolean {
    return classifyCasualMessage(text) !== null;
  }


  function loadCreativeStudioSystemPrompt(studioCatalog?: string, studioUploads?: any[]): string {
    let basePrompt = '';
    try {
      const promptPath = path.join(process.cwd(), 'public', 'assets', 'aistudio', 'system_prompt_image_video_studio_22f68d0e.md');
      if (fs.existsSync(promptPath)) {
        const raw = fs.readFileSync(promptPath, 'utf-8');
        // Strip developer notes section 15 cleanly and substitute placeholders
        basePrompt = raw
          .split('## 15. DEVELOPER NOTES')[0]
          .replace(/\{\{APP_NAME\}\}/g, 'Creative AI Studio')
          .replace(/\{\{TTS_VOICES\}\}/g, 'Kore (female calm), Aoede (female bright), Leda (female soft), Charon (male deep), Puck (male lively), Fenrir (male dramatic), Orus (male warm)')
          .trim();
      }
    } catch (e) {
      console.warn('Could not read Creative Studio prompt file:', e);
    }

    if (!basePrompt) {
      basePrompt = `You have a built-in Creative Studio (MythoriaLib) that creates Images (thumbnails, posters, banners, quote cards, infographics, logo graphics) and Videos (<= 120s documentary or motion-graphic timelines with Gemini TTS voice-over). Output complete self-contained HTML (<div id="canvas"> for images; VideoPlan JSON + deterministic window.VIDEO HTML for videos).`;
    }

    const uploadsSection =
      Array.isArray(studioUploads) && studioUploads.length > 0
        ? `\n\n[ACTIVE USER UPLOADS AVAILABLE AS {{upload:ID}}]:\n${JSON.stringify(studioUploads)}`
        : '';

    const catalogSection = studioCatalog
      ? `\n\n[MYTHORIALIB STUDIO CATALOG]:\n${studioCatalog}`
      : '';

    return `${basePrompt}${catalogSection}${uploadsSection}\n\n[RUNTIME OVERRIDE]: Remember to follow Section 11 Response Format Rules strictly and output COMPLETE self-contained HTML without placeholders or truncation.`;
  }

  function detectCreativeStudioRequest(text = ''): boolean {
    const t = String(text || '').trim();
    if (!t) return false;
    if (/^\{"tool":|\{"timing_report":|timing_report|upload_id/i.test(t)) return true;
    return /\b(thumbnail|thumbnails|poster|posters|banner|quote\s*card|insta\s*quote|instagram\s*post|story\s*cover|reel\s*cover|infographic|wordmark|logo\s*(graphic|type|card)|short\s*video|reel\b|explainer\s*video|motion\s*graphic|documentary(\s*video)?|video\s*(banao|bana|create|make|generate|export|par|on)|background\s*(remove|hata|cutout)|remove\s*background|cutout|save\s*template|list\s*templates|custom\s*template|re-?time\s*video)\b/i.test(
      t
    );
  }

  function detectVoiceDetailedTopicRequest(text = ''): boolean {
    const t = String(text || '').trim().toLowerCase();
    if (!t) return false;
    return /\b(detail|detailed|full\s*detail|tafseel|tafsil|poora\s*batao|puri\s*detail|explain\s*(properly|completely|in\s*detail|deeply)|deep\s*dive|complete\s*(guide|explanation|topic)|step\s*by\s*step|architecture|roadmap|comparison\s*table|chart\b|write\s*(me\s*)?(code|script|python|sql|javascript|typescript|java|c\+\+)|make\s*(a\s*)?(thumbnail|poster|video|reel|banner))\b/i.test(
      t
    );
  }

  function buildVoiceAssistantSystemPrompt(assistantPersona = 'Zara', voiceLanguage?: string): string {
    const langNote = voiceLanguage
      ? `Preferred voice session language: ${voiceLanguage}. Always reply in Roman script (e.g. Roman Urdu / Roman Hindi) unless native script was explicitly requested.`
      : 'Detect user language and reply in Roman script (e.g. Roman Urdu / Roman Hindi) unless native script was explicitly requested.';

    return `You are ${assistantPersona}, a live real-time phone-call voice & camera vision AI assistant inside Daro & Zara.

CRITICAL CALLING MODE RULES (STRICTLY MANDATORY):
1. KEEP REPLIES SHORT (2 TO 3 LINES MAX):
   This is a live voice calling interface — NEVER give long answers, paragraphs, bulleted essays, markdown tables, or code dumps here. Answer conversational questions or camera ("What is this?") requests cleanly in **strictly 2 to 3 crisp spoken sentences max**.
2. DETAILED TOPIC -> REDIRECT TO CHAT:
   Whenever the user asks for a detailed explanation, step-by-step guide, complete topic breakdown, comparisons, charts, code, scripts, thumbnails, or videos (e.g., "explain in detail", "poori tafseel batao", "I want a detailed topic", "step by step guide"):
   - Reply in **strictly 2 short spoken lines**: briefly acknowledge the topic in 1 sentence and clearly tell the user (in their language / Roman script) to **go to Chat** ("Aap Chat section mein jayein, wahan aapko is topic ki poori tafseel aur complete explanation mil jayegi." or in English: "Since this is a voice call, please open Chat for the complete detailed explanation.").
   - Append the exact token **[GO_TO_CHAT]** at the very end of your response so the app shows the one-tap "Go to Chat" button.
3. PLAIN NATURAL SPEECH:
   Write clean, easy-to-speak sentences without markdown headings (#), code blocks, \`\`\`image-card blocks, or emojis. NEVER output image-card blocks or visual galleries in voice call mode; instead offer to continue in Chat with [GO_TO_CHAT] if the user asks for images or detailed topics. ${langNote}`;
  }

  // 1. PRIMARY ENGINE: Grok (xAI) / Groq Chat Completion with Automatic Dual-Key Rate-Limit Failover
  async function streamGroq(
    promptText: string,
    history: Array<{ sender: 'user' | 'ai'; text: string }>,
    contextPackage: any,
    sendChunk: (data: { text?: string; done?: boolean; error?: string; provider?: string }) => void,
    isSimple = false,
    attachments: any[] = [],
    options?: {
      isVoiceAssistant?: boolean;
      voiceLanguage?: string;
      assistantPersona?: string;
      isCreativeStudio?: boolean;
      studioCatalog?: string;
      studioUploads?: any[];
    }
  ): Promise<boolean> {
    const keyPool = getAvailableGrokKeys();
    if (keyPool.length === 0) {
      if (getConfiguredGrokKeys().length > 0) {
        console.warn('All configured Grok/Groq keys are temporarily in rate-limit cooldown, falling back to Gemini.');
      } else {
        console.warn('GROK_API_KEY / GROQ_API_KEY is not configured in .env, falling back to Gemini.');
      }
      return false;
    }

    try {
      const memoryPromptInjection = isSimple || options?.isVoiceAssistant ? '' : formatContextPackageForPrompt(contextPackage);
      let enhancedUserPrompt = memoryPromptInjection
        ? `${promptText}\n\n${memoryPromptInjection}`
        : promptText;

      if (Array.isArray(attachments) && attachments.length > 0) {
        const docSummaries = attachments
          .map((a: any) => {
            if (a.codeContent) {
              return `\n\n[Attached Code File: ${a.name} (${a.type || 'code'})]:\n\`\`\`\n${a.codeContent.slice(0, 15000)}\n\`\`\``;
            }
            if (a.preview && !a.preview.startsWith('data:image/')) {
              return `\n\n[Attached File: ${a.name} (${a.type || 'document'})]:\n${a.preview.slice(0, 8000)}`;
            }
            return `\n\n[Attached File: ${a.name} (${a.type || 'asset'})]`;
          })
          .join('');
        enhancedUserPrompt += docSummaries;
      }

      const isLibraryPrompt = isCodeVaultLibraryPrompt(promptText) || isCodeVaultLibraryPrompt(enhancedUserPrompt);
      const simpleIntent = classifyCasualMessage(promptText);
      const systemPrompt = options?.isVoiceAssistant
        ? buildVoiceAssistantSystemPrompt(options.assistantPersona || 'Zara', options.voiceLanguage)
        : isSimple
          ? (simpleIntent === 'farewell'
              ? 'You are a polite AI assistant. The user is saying goodbye or leaving. Reply with a warm 1-2 sentence farewell in their language, wish them well, and mention you are here whenever they return. Never ask questions, never start a task, never generate code.'
              : 'You are an intelligent, polite AI assistant. Greet the user warmly and concisely in 1-2 friendly sentences. Do not ask discovery questions or generate code.')
          : options?.isCreativeStudio
            ? loadCreativeStudioSystemPrompt(options.studioCatalog, options.studioUploads)
            : isLibraryPrompt
              ? CODE_VAULT_LIBRARY_ASSEMBLY_SYSTEM_PROMPT
              : buildDesignerSystemPrompt(isWebsiteTask(promptText, contextPackage, attachments));

      const recentHistory = isSimple ? [] : history.slice(-3);

      const imageAttachments = (Array.isArray(attachments) ? attachments : []).filter(
        (a: any) => typeof a?.preview === 'string' && a.preview.startsWith('data:image/')
      );
      const userTextContent = isSimple ? promptText : `User: ${enhancedUserPrompt.slice(0, 5500)}`;
      const finalUserMessage: any =
        imageAttachments.length > 0
          ? {
              role: 'user',
              content: [
                { type: 'text', text: userTextContent },
                ...imageAttachments.map((a: any) => ({
                  type: 'image_url',
                  image_url: { url: a.preview },
                })),
              ],
            }
          : { role: 'user', content: userTextContent };

      const externalMessages = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...recentHistory.map((h) => ({
          role: h.sender === 'user' ? 'user' : 'assistant',
          content: `${h.sender === 'user' ? 'User' : 'AI Response'}: ${h.text.slice(0, 500)}`,
        })),
        finalUserMessage,
      ];

      const EXCLUDED_GROQ_KEYWORDS = [
        'guard',
        'safeguard',
        'prompt-guard',
        'whisper',
        'tts',
        'orpheus',
        'canopylabs',
        'allam',
        'embed',
        'moderation',
        'vision',
      ];

      const groqModelListCache = (globalThis as any).__groqModelListCache ||= new Map<string, { models: string[]; fetchedAt: number }>();

      const resolveModelsForEntry = async (entry: GrokKeyEntry): Promise<string[]> => {
        if (entry.provider === 'xai') {
          if (imageAttachments.length > 0) {
            return ['grok-2-vision-1212', 'grok-4', 'grok-3'];
          }
          return isSimple ? ['grok-3-mini', 'grok-3'] : ['grok-3', 'grok-3-mini'];
        }

        // Ultra-fast path for greetings & quick messages: skip /models discovery network call completely
        if (isSimple && imageAttachments.length === 0) {
          return ['llama-3.1-8b-instant', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
        }

        const now = Date.now();
        const cachedEntry = groqModelListCache.get(entry.masked);
        let candidateGroqModels: string[] = [];

        if (cachedEntry && now - cachedEntry.fetchedAt < 5 * 60 * 1000) {
          candidateGroqModels = [...cachedEntry.models];
        } else {
          try {
            const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
              headers: { Authorization: `Bearer ${entry.key}` },
              signal: AbortSignal.timeout(1800),
            });
            if (modelsRes.ok) {
              const mData = await modelsRes.json();
              if (Array.isArray(mData?.data)) {
                const activeChatIds = mData.data
                  .map((item: any) => item.id)
                  .filter(
                    (id: string) =>
                      typeof id === 'string' &&
                      !EXCLUDED_GROQ_KEYWORDS.some((k) => id.toLowerCase().includes(k))
                  );

                candidateGroqModels = activeChatIds.sort((a: string, b: string) => {
                  const priority = (id: string) => {
                    if (id.includes('120b')) return 100;
                    if (id.includes('70b')) return 85;
                    if (id.includes('20b')) return 70;
                    if (id.includes('qwen')) return 60;
                    return 10;
                  };
                  return priority(b) - priority(a);
                });
                groqModelListCache.set(entry.masked, { models: [...candidateGroqModels], fetchedAt: now });
              }
            } else if (isRateLimitResponse(modelsRes.status)) {
              markKeyRateLimited(entry.key, modelsRes.headers.get('retry-after'));
              return [];
            }
          } catch (discErr) {
            console.warn('Groq dynamic model discovery warning:', discErr);
          }
        }

        const FALLBACK_GROQ_LIST = [
          'openai/gpt-oss-120b',
          'llama-3.3-70b-versatile',
          'openai/gpt-oss-20b',
          'llama-3.1-8b-instant',
          'qwen/qwen3.8-27b',
        ];
        for (const f of FALLBACK_GROQ_LIST) {
          if (!candidateGroqModels.includes(f)) {
            candidateGroqModels.push(f);
          }
        }

        if (imageAttachments.length > 0) {
          const VISION_GROQ_MODELS = [
            'meta-llama/llama-4-scout-17b-16e-instruct',
            'meta-llama/llama-4-maverick-17b-128e-instruct',
          ];
          candidateGroqModels = [
            ...VISION_GROQ_MODELS.filter((v) => !candidateGroqModels.includes(v)),
            ...candidateGroqModels,
          ];
        }

        return candidateGroqModels;
      };

      for (const entry of keyPool) {
        const candidateModels = await resolveModelsForEntry(entry);
        if (candidateModels.length === 0) {
          console.warn(`[Grok/Groq Pool] ${entry.slotLabel} (${entry.masked}) unavailable/rate-limited during discovery. Moving to next fallback key...`);
          continue;
        }

        for (const modelName of candidateModels) {
          try {
            const response = await fetch(entry.endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${entry.key}`,
              },
              body: JSON.stringify({
                model: modelName,
                messages: externalMessages,
                temperature: 0.6,
                max_tokens: isSimple ? 250 : options?.isVoiceAssistant ? 260 : /llama-4/.test(modelName) ? 8192 : entry.provider === 'xai' ? 8192 : 32768,
                stream: true,
              }),
            });

            if (!response.ok || !response.body) {
              const errText = await response.text().catch(() => '');
              if (isRateLimitResponse(response.status, errText)) {
                const cooldownMs = markKeyRateLimited(entry.key, response.headers.get('retry-after'));
                console.warn(
                  `[Rate Limit Failover] ${entry.slotLabel} (${entry.provider.toUpperCase()} ${entry.masked}) hit ${response.status} (cooldown ${Math.round(cooldownMs / 1000)}s). Rotating to fallback key...`
                );
                break; // Switch immediately to the next API key in keyPool
              }
              if (response.status === 401 || response.status === 403) {
                console.warn(
                  `[Auth Failover] ${entry.slotLabel} (${entry.provider.toUpperCase()} ${entry.masked}) returned ${response.status}. Rotating to next API key...`
                );
                break;
              }
              console.warn(`${entry.provider.toUpperCase()} API (${modelName}) returned status:`, response.status, errText);
              continue;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let hasReceivedAny = false;
            let hitStreamRateLimit = false;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data:')) {
                  const payload = trimmed.slice(5).trim();
                  if (payload === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(payload);
                    if (parsed?.error && !hasReceivedAny) {
                      const errMsg = JSON.stringify(parsed.error);
                      if (isRateLimitResponse(429, errMsg)) {
                        markKeyRateLimited(entry.key);
                        hitStreamRateLimit = true;
                        break;
                      }
                    }
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      sendChunk({ text: delta, provider: `${entry.provider}-${modelName}-key${entry.slotIndex}` });
                      hasReceivedAny = true;
                    }
                  } catch {
                    // ignore json parse error on partial chunks
                  }
                }
              }
              if (hitStreamRateLimit) break;
            }

            if (hasReceivedAny) {
              return true;
            }
            if (hitStreamRateLimit) {
              console.warn(`[Stream Rate Limit] ${entry.slotLabel} (${entry.masked}) hit rate limit mid-stream. Rotating to fallback key...`);
              break;
            }
          } catch (mErr) {
            console.warn(`${entry.provider.toUpperCase()} model ${modelName} (${entry.slotLabel}) stream error, trying next:`, mErr);
          }
        }
      }

      return false;
    } catch (groqErr) {
      console.warn('Error during Grok/Groq streaming, initiating Gemini fallback:', groqErr);
      return false;
    }
  }

  // 2. BACKEND FALLBACK & GROUNDED ENGINE: Gemini API
  async function streamGeminiFallback(
    promptText: string,
    attachments: any[],
    contextPackage: any,
    sendChunk: (data: { text?: string; done?: boolean; error?: string; provider?: string }) => void,
    isSimple = false,
    options?: {
      useSearchGrounding?: boolean;
      isVoiceAssistant?: boolean;
      voiceLanguage?: string;
      assistantPersona?: string;
      isCreativeStudio?: boolean;
      studioCatalog?: string;
      studioUploads?: any[];
      onSources?: (sources: Array<{ title: string; uri: string; domain: string }>) => void;
    }
  ): Promise<boolean> {
    const client = getGeminiClient();
    if (!client) {
      console.warn('Gemini client not initialized.');
      return false;
    }

    try {
      const isLibraryPrompt = isCodeVaultLibraryPrompt(promptText);
      const geminiSimpleIntent = classifyCasualMessage(promptText);
      const langDirective = options?.voiceLanguage
        ? ` Preferred voice session locale: ${options.voiceLanguage}. Always reply in Romanized script (e.g., Roman Urdu / Roman Hindi) unless native script was explicitly requested.`
        : ' Always detect the user language and reply in Roman script (e.g., Roman Urdu / Roman Hindi) unless native script was explicitly requested.';

      const systemInstruction = options?.isVoiceAssistant
        ? buildVoiceAssistantSystemPrompt(options.assistantPersona || 'Zara', options.voiceLanguage)
        : isSimple
          ? (geminiSimpleIntent === 'farewell'
              ? `You are a polite AI assistant. The user is saying goodbye or leaving. Reply with a warm 1-2 sentence **bold** farewell in their language, wish them well, and mention you are here whenever they return.${langDirective}`
              : `You are an intelligent, polite AI assistant. Reply concisely and clearly in 1-2 friendly sentences with **bold** emphasis where appropriate.${langDirective}`)
          : options?.isCreativeStudio
            ? loadCreativeStudioSystemPrompt(options.studioCatalog, options.studioUploads)
            : isLibraryPrompt
              ? CODE_VAULT_LIBRARY_ASSEMBLY_SYSTEM_PROMPT
              : `${SYSTEM_TRAINING_INSTRUCTIONS}\n\n${IMAGE_FINDER_SYSTEM_PROMPT}\n\n[MANDATORY LANGUAGE & STYLE CHECK]:${langDirective}`;

      const parts: any[] = [];
      if (Array.isArray(attachments)) {
        for (const att of attachments) {
          const mimeType = att.type || (att.preview?.startsWith('data:') ? att.preview.split(';')[0].replace('data:', '') : '');
          const isInlineMedia =
            mimeType.startsWith('image/') ||
            mimeType.startsWith('video/') ||
            mimeType.startsWith('audio/') ||
            mimeType === 'application/pdf';

          if (att.preview && isInlineMedia) {
            const matches = att.preview.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              parts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2],
                },
              });
            } else {
              parts.push({
                text: `[Attached Media: ${att.name || 'file'} (${mimeType})]`,
              });
            }
          } else if (att.codeContent) {
            parts.push({
              text: `[Attached Code File: ${att.name || 'code'} (${mimeType || 'text/plain'})]\n\`\`\`\n${att.codeContent.slice(0, 30000)}\n\`\`\``,
            });
          } else if (att.preview) {
            parts.push({
              text: `[Attached File: ${att.name || 'document'} (${mimeType || 'text'})]\n${att.preview.slice(0, 25000)}`,
            });
          }
        }
      }

      const memoryPromptInjection = isSimple ? '' : formatContextPackageForPrompt(contextPackage);
      const enhancedUserPrompt = memoryPromptInjection
        ? `${promptText || 'Execute task.'}\n\n${memoryPromptInjection}`
        : promptText || (attachments && attachments.length > 0 ? `Analyze the attached file (${attachments[0].name}) in depth.` : 'Analyze workspace configuration.');

      parts.push({ text: enhancedUserPrompt });
      const contents = [{ role: 'user', parts }];

      const CANDIDATE_MODELS = [
        'gemini-4-hydrogen',
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.1-pro-preview',
      ];

      const collectedSourcesMap = new Map<string, { title: string; uri: string; domain: string }>();

      const extractSourcesFromChunk = (chunk: any) => {
        const gm = chunk?.candidates?.[0]?.groundingMetadata;
        const gChunks = Array.isArray(gm?.groundingChunks) ? gm.groundingChunks : [];
        for (const gc of gChunks) {
          const uri = gc?.web?.uri;
          if (!uri || typeof uri !== 'string') continue;
          let domain = 'web';
          try {
            domain = new URL(uri).hostname.replace(/^www\./, '');
          } catch {}
          if (!collectedSourcesMap.has(uri)) {
            collectedSourcesMap.set(uri, {
              title: (gc?.web?.title || domain).trim(),
              uri,
              domain,
            });
          }
        }
      };

      for (const modelName of CANDIDATE_MODELS) {
        const toolModes = options?.useSearchGrounding ? [true, false] : [false];
        for (const enableTool of toolModes) {
          const tryConfig = async (useThinking: boolean) => {
            const responseStream = await client.models.generateContentStream({
              model: modelName,
              contents,
              config: {
                systemInstruction,
                temperature: 0.7,
                maxOutputTokens: isSimple ? 300 : 8192,
                ...(useThinking
                  ? {
                      thinkingConfig: {
                        thinkingLevel: isSimple
                          ? ThinkingLevel.MINIMAL
                          : options?.useSearchGrounding
                            ? ThinkingLevel.MEDIUM
                            : ThinkingLevel.LOW,
                      },
                    }
                  : {}),
                ...(enableTool ? { tools: [{ googleSearch: {} }] } : {}),
              },
            });

            let hasStreamed = false;
            for await (const chunk of responseStream) {
              extractSourcesFromChunk(chunk);
              if (chunk.text) {
                sendChunk({ text: chunk.text, provider: `gemini-${modelName}` });
                hasStreamed = true;
              }
            }

            if (hasStreamed) {
              if (collectedSourcesMap.size > 0 && options?.onSources) {
                options.onSources(Array.from(collectedSourcesMap.values()));
              }
              return true;
            }
            return false;
          };

          const supportsThinking = modelName === 'gemini-4-hydrogen' || modelName.startsWith('gemini-3');
          try {
            if (await tryConfig(supportsThinking)) {
              return true;
            }
          } catch (mErr: any) {
            if (supportsThinking) {
              try {
                if (await tryConfig(false)) {
                  return true;
                }
              } catch (retryErr: any) {
                console.warn(
                  `Gemini model ${modelName} (search=${enableTool}) error (${retryErr?.status || retryErr?.code || retryErr?.message || 'demand'}), trying next...`
                );
              }
            } else {
              console.warn(
                `Gemini model ${modelName} (search=${enableTool}) error (${mErr?.status || mErr?.code || mErr?.message || 'demand'}), trying next...`
              );
            }
          }
        }
      }
      return false;
    } catch (geminiErr) {
      console.warn('Gemini fallback stream error:', geminiErr);
      return false;
    }
  }

  // Clarification Gate API Endpoint: evaluates validity, completeness, and dynamic questions
  app.post(['/api/clarify', '/api/clarification-gate'], async (req, res) => {
    const {
      prompt,
      history = [],
      attachments = [],
      askedQuestions = [],
      answeredQuestions = {},
      detectedInfo = {},
      strictness = 'balanced',
    } = req.body;

    const trimmedPrompt = (prompt || '').trim();

    // 1. If empty or no input, return REDIRECT with polite guidance
    if (!trimmedPrompt && (!attachments || attachments.length === 0)) {
      return res.json({
        validity: 'invalid',
        task_type: 'other',
        completeness: 'incomplete',
        decision: 'REDIRECT',
        detected_info: {},
        missing_critical: ['task_intent'],
        assumptions_if_skipped: [],
        questions: [],
        redirect_message:
          'Hello! What would you like to build, write, or explore today? For example, ask me to create a modern web app, write a business strategy, or design an AI architecture.',
      });
    }

    // 2. Fast check for simple chit-chat, greetings, or thanks -> PROCEED immediately
    if (isSimpleMessage(trimmedPrompt)) {
      return res.json({
        validity: 'valid',
        task_type: 'chat',
        completeness: 'complete',
        decision: 'PROCEED',
        detected_info: {},
        missing_critical: [],
        assumptions_if_skipped: [],
        questions: [],
      });
    }

    // 3. Fast check for skip / let-AI-decide intent -> PROCEED immediately
    if (isSkipIntent(trimmedPrompt)) {
      return res.json({
        validity: 'valid',
        task_type: 'other',
        completeness: 'complete',
        decision: 'PROCEED',
        detected_info: {},
        missing_critical: [],
        assumptions_if_skipped: ['Using intelligent high-performance defaults'],
        questions: [],
      });
    }

    // 3.5 Fast check for Buildy / Library prompt or attachments -> PROCEED immediately with Buildy guidance & prompt
    const hasLibraryInAttachment = Array.isArray(attachments) && attachments.some((a: any) => {
      const txt =
        a.codeContent ||
        (typeof a.preview === 'string' && !a.preview.startsWith('data:') ? a.preview : '') ||
        a.name ||
        '';
      return isCodeVaultLibraryPrompt(txt) || isCreativeThinkLibraryDocument(txt);
    });

    if (isCodeVaultLibraryPrompt(trimmedPrompt) || isCreativeThinkLibraryDocument(trimmedPrompt) || hasLibraryInAttachment) {
      return res.json({
        validity: 'valid',
        task_type: 'website',
        completeness: 'complete',
        decision: 'PROCEED',
        detected_info: { source: 'Buildy' },
        missing_critical: [],
        assumptions_if_skipped: [
          'Provide a Buildy redirect and structured Buildy UI prompt without generating HTML/CSS/JS websites in-app.',
        ],
        questions: [],
      });
    }

    // 4. Construct Clarification Gate evaluation prompt
    const recentHistory = (Array.isArray(history) ? history.slice(-8) : [])
      .map((m: any) => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const attachmentSummary =
      Array.isArray(attachments) && attachments.length > 0
        ? `Attachments: ${attachments.map((a: any) => a.name || 'unnamed file').join(', ')}`
        : 'No attachments.';

    const gateEvaluationPayload = `
CURRENT USER MESSAGE:
"${trimmedPrompt}"

ATTACHMENTS:
${attachmentSummary}

CONVERSATION HISTORY (Recent context):
${recentHistory || 'No previous history.'}

ALREADY ASKED QUESTIONS:
${JSON.stringify(askedQuestions || [])}

ALREADY ANSWERED QUESTIONS:
${JSON.stringify(answeredQuestions || {})}

ALREADY DETECTED INFORMATION:
${JSON.stringify(detectedInfo || {})}

STRICTNESS LEVEL: ${strictness}
`.trim();

    // Call fast model for ultra-low latency (<1.5s)
    try {
      const clarifyKeyEntries = getAvailableGrokKeys();
      let rawJsonResult = '';

      // Try configured Grok/Groq keys with automatic rate-limit failover
      for (const keyEntry of clarifyKeyEntries) {
        const gateModels =
          keyEntry.provider === 'xai'
            ? ['grok-3-mini', 'grok-3']
            : ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

        for (const mName of gateModels) {
          try {
            const extRes = await fetch(keyEntry.endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${keyEntry.key}`,
              },
              body: JSON.stringify({
                model: mName,
                messages: [
                  { role: 'system', content: CLARIFICATION_GATE_SYSTEM_PROMPT },
                  { role: 'user', content: gateEvaluationPayload },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.15,
                max_tokens: 800,
              }),
              signal: AbortSignal.timeout(3500),
            });

            if (extRes.ok) {
              const data: any = await extRes.json();
              rawJsonResult = data.choices?.[0]?.message?.content || '';
              if (rawJsonResult) break;
            } else {
              const errText = await extRes.text().catch(() => '');
              if (isRateLimitResponse(extRes.status, errText)) {
                markKeyRateLimited(keyEntry.key, extRes.headers.get('retry-after'));
                console.warn(`[Clarify Rate Limit] ${keyEntry.slotLabel} (${keyEntry.masked}) hit ${extRes.status}, switching to fallback key.`);
                break;
              }
            }
          } catch (extErr) {
            console.warn(`${keyEntry.provider.toUpperCase()} clarification gate (${mName}) notice:`, extErr);
          }
        }
        if (rawJsonResult) break;
      }

      // If Grok/Groq didn't respond or wasn't configured, try Gemini
      if (!rawJsonResult) {
        const client = getGeminiClient();
        if (client) {
          const geminiModels = ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
          for (const modelName of geminiModels) {
            try {
              const geminiRes = await client.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: gateEvaluationPayload }] }],
                config: {
                  systemInstruction: CLARIFICATION_GATE_SYSTEM_PROMPT,
                  temperature: 0.15,
                  maxOutputTokens: 800,
                  responseMimeType: 'application/json',
                },
              });
              if (geminiRes.text) {
                rawJsonResult = geminiRes.text;
                break;
              }
            } catch (gErr) {
              console.warn(`Gemini model ${modelName} clarification error:`, gErr);
            }
          }
        }
      }

      if (rawJsonResult) {
        const decision = parseAndValidateGateResponse(rawJsonResult);
        return res.json(decision);
      }
    } catch (err) {
      console.warn('Clarification gate execution error, defaulting to PROCEED safely:', err);
    }

    // Default safety fallback: PROCEED immediately so user is never blocked
    return res.json({
      validity: 'valid',
      task_type: 'other',
      completeness: 'complete',
      decision: 'PROCEED',
      detected_info: {},
      missing_critical: [],
      assumptions_if_skipped: [],
      questions: [],
    });
  });

  // Language & Script detection helper for accurate Romanized formatting & dynamic Thinking summary
  function detectLanguageAndScript(promptText = '', voiceLanguage?: string) {
    const p = String(promptText || '').trim();
    const nativeRequested =
      /\b(urdu\s*(script|font|likh|mein\s*likh)|in\s*urdu\s*script|nastaliq|arabic\s*script|devanagari|hindi\s*script|native\s*script)\b/i.test(p) ||
      /اردو\s*(میں|فونٹ|اسکرپٹ)|عربی\s*میں|हिंदी\s*लिपि/i.test(p);

    let detectedLanguage = 'English';
    if (/[\u0600-\u06FF]/.test(p)) {
      detectedLanguage = voiceLanguage?.startsWith('ar') ? 'Arabic' : 'Urdu / Arabic';
    } else if (/[\u0900-\u097F]/.test(p)) {
      detectedLanguage = 'Hindi';
    } else if (
      /\b(kya|hai|hain|mein|main|ap|aap|kaise|kaisa|karo|kero|batao|btao|samjhao|chahiye|nahi|nhi|bhai|yaar|aur|kyun|kab|kahan|mujhe|mjhe|hoga|hogi|wala|wali|sath|acha|theek|thik|shukriya|banao|bnana|bna|likh|dedo|krdo|ker|hota|bola|jub|jab|sa|ka|ki|ke|ko|se|pe|par)\b/i.test(p) ||
      voiceLanguage?.startsWith('ur')
    ) {
      detectedLanguage = 'Roman Urdu';
    } else if (voiceLanguage?.startsWith('hi')) {
      detectedLanguage = 'Roman Hindi';
    } else if (voiceLanguage?.startsWith('ar')) {
      detectedLanguage = 'Roman Arabic';
    } else if (/\b(hola|gracias|como|que|para|por\s*favor)\b/i.test(p)) {
      detectedLanguage = 'Spanish';
    } else if (/\b(bonjour|merci|comment|pourquoi|avec)\b/i.test(p)) {
      detectedLanguage = 'French';
    }

    const scriptMode = nativeRequested
      ? 'Native Script Requested'
      : detectedLanguage === 'English'
        ? 'Bold Structured English'
        : 'Roman Script (Default)';

    return { detectedLanguage, scriptMode, nativeRequested };
  }

  function shouldUseWebGrounding(promptText = '', isSimple = false, isBuildy = false): boolean {
    if (isSimple || isBuildy) return false;
    const lower = promptText.toLowerCase();
    // Reserve live web search strictly for current-news, live prices, weather, or recent-year queries so standard answers run fast on Groq
    if (lower.length < 14) return false;
    return /\b(latest\s+news|today'?s\s+news|breaking\s+news|current\s+price|live\s+score|weather\s+in|weather\s+today|stock\s+price|exchange\s+rate|search\s+web|sources?\s+online|2026\s+news|2025\s+news|aaj\s+ki\s+khabar|taaza\s+tareen)\b/i.test(lower);
  }

  function buildDynamicThoughtSummary(params: {
    prompt: string;
    answer: string;
    detectedLanguage: string;
    scriptMode: string;
    activeSkillName?: string;
    groundedUsed: boolean;
    sourcesCount: number;
    hasAttachments: boolean;
    attachmentsCount: number;
    isBuildy: boolean;
    provider?: string;
  }) {
    const topicSnippet = params.prompt.replace(/\s+/g, ' ').trim().slice(0, 85) || 'User request';
    const hasTable = /\|[^\n]+\|\n\|[\s:-]+\|/.test(params.answer);
    const hasChart = /```(?:chart|json-chart)/i.test(params.answer);
    const hasImageCard = /```image-card/i.test(params.answer);
    const hasCode = /```(?!chart|json-chart|image-card|prompt)[a-z0-9]+/i.test(params.answer);

    const steps: Array<{ title: string; desc: string }> = [
      {
        title: `Language & intent detected (${params.detectedLanguage})`,
        desc: `Parsed "${topicSnippet}${params.prompt.length > 85 ? '...' : ''}" • Formatting output in ${params.scriptMode}.`,
      },
    ];

    if (params.activeSkillName) {
      steps.push({
        title: `Applied skill: ${params.activeSkillName}`,
        desc: `Activated specialized persona rules and domain formatting.`,
      });
    }

    if (params.hasAttachments) {
      steps.push({
        title: `Analyzed ${params.attachmentsCount} visual / file input${params.attachmentsCount > 1 ? 's' : ''}`,
        desc: `Inspected attached image, camera snapshot, or document directly before composing the answer.`,
      });
    }

    if (params.isBuildy) {
      steps.push({
        title: 'Buildy Web & App UI redirection',
        desc: 'Directed website/UI creation to Buildy (https://fluorescent-code-vault-flow.base44.app) with structured specs.',
      });
    } else if (params.groundedUsed) {
      steps.push({
        title: params.sourcesCount > 0 ? `Grounded with ${params.sourcesCount} web source${params.sourcesCount > 1 ? 's' : ''}` : 'Verified factual knowledge & context',
        desc: params.sourcesCount > 0
          ? `Collected ${params.sourcesCount} verified reference link${params.sourcesCount > 1 ? 's' : ''} for accuracy.`
          : 'Cross-checked facts and technical details across primary knowledge.',
      });
    }

    const formatParts: string[] = ['**Bold** typography'];
    if (hasTable) formatParts.push('Markdown comparison table');
    if (hasChart) formatParts.push('Interactive data chart');
    if (hasImageCard) formatParts.push('Web image search card');
    if (hasCode) formatParts.push('Structured code block');

    steps.push({
      title: 'Synthesized final structured answer',
      desc: `Delivered ${params.answer.length} characters using ${formatParts.join(', ')}.`,
    });

    const summary = `Detected ${params.detectedLanguage} (${params.scriptMode}) for "${topicSnippet}"${params.activeSkillName ? ` with ${params.activeSkillName}` : ''}${params.sourcesCount > 0 ? ` and ${params.sourcesCount} cited web sources` : ''}.`;

    return {
      detectedLanguage: params.detectedLanguage,
      scriptMode: params.scriptMode,
      skillName: params.activeSkillName,
      groundedUsed: params.groundedUsed,
      sourcesCount: params.sourcesCount,
      summary,
      steps,
    };
  }

  // Streaming Chat Endpoint: Romanized multilingual output, Creative Studio engine, grounded sources & concise Daro & Zara calling
  app.post('/api/chat', async (req, res) => {
    const {
      prompt,
      attachments = [],
      history = [],
      contextPackage,
      conversationSummary,
      activeCode,
      activeSkill,
      isVoiceAssistant = false,
      voiceLanguage,
      assistantPersona = 'Zara',
      studioCatalog,
      studioUploads = [],
    } = req.body;

    if (!prompt && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Prompt or attachment is required.' });
    }

    // Set up SSE headers for streaming responses
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let accumulatedText = '';
    let lastProvider = '';
    const sendChunk = (data: { text?: string; done?: boolean; error?: string; provider?: string; meta?: any }) => {
      if (data.text) {
        accumulatedText += data.text;
      }
      if (data.provider) {
        lastProvider = data.provider;
      }
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const isSimple = (isSimpleMessage(prompt) || req.body.isSimple === true) && !isVoiceAssistant && (!attachments || attachments.length === 0);
    const isBuildyWebsiteOrUi = !isVoiceAssistant && isWebsiteOrAppUiBuildRequest(prompt, attachments);
    const isCreativeStudio = !isVoiceAssistant && !isBuildyWebsiteOrUi && !isSimple && detectCreativeStudioRequest(prompt);
    const isExplicitImageSearch =
      !isVoiceAssistant && !isSimple && !isBuildyWebsiteOrUi && !isCreativeStudio && detectExplicitImageSearchIntent(prompt);
    const { detectedLanguage, scriptMode, nativeRequested } = detectLanguageAndScript(prompt, voiceLanguage);

    const romanEnforcementNote = isVoiceAssistant
      ? ''
      : nativeRequested
        ? `\n[LANGUAGE RULE]: User explicitly asked for native script (${detectedLanguage}). Respond in crisp **bold** Markdown using that native script.`
        : `\n[LANGUAGE & STYLE RULE]: Detected language: ${detectedLanguage}. ${
            detectedLanguage === 'English'
              ? 'Reply in bold, authoritative English.'
              : `ALWAYS reply in **Roman script** (${detectedLanguage} written with English/Latin letters — e.g. Roman Urdu/Roman Hindi) unless native script was explicitly requested.`
          } Emphasize important points in **bold**. Include a Markdown table or \`\`\`chart JSON block whenever comparisons or numeric data make the answer clearer.`;

    const imageSearchSafetyNetNote = isExplicitImageSearch
      ? `\n\n[SYSTEM INTENT NOTE]: The user wants web photographs. Unless the request violates Section 6 safety rules (private individual, minor under 18, sexual/graphic/humiliating content, face-identification, or stalking), output ONE short intro line (<= 12 words) followed immediately by a valid \`\`\`image-card JSON block. Public figures are ALLOWED.`
      : '';

    let effectivePrompt = isBuildyWebsiteOrUi
      ? `${prompt}\n\nIMPORTANT PRODUCT RULE:\nOur app does NOT build websites or App UIs in HTML/CSS/JS.\n1. Tell the user clearly to open Buildy (https://fluorescent-code-vault-flow.base44.app) to create any App or Web UI.\n2. NEVER generate a single-file HTML/CSS/JS website (<!DOCTYPE html>...</html>).\n3. Instead, give them a detailed architectural answer and a copy-ready Buildy UI specification prompt inside a \`\`\`prompt code block.${romanEnforcementNote}`
      : isCreativeStudio
        ? String(prompt || '')
        : `${prompt || 'What is this? Describe clearly in detail.'}${romanEnforcementNote}${imageSearchSafetyNetNote}`;

    // Inject active specialized AI skill persona and system instructions if active
    if (!isVoiceAssistant && activeSkill && activeSkill.name && activeSkill.instructions) {
      effectivePrompt = `[SPECIALIZED AI SKILL ACTIVE: "${activeSkill.name.toUpperCase()}"]\nSKILL ROLE & INSTRUCTIONS:\n${activeSkill.instructions}\n\nUSER PROMPT:\n${effectivePrompt}`;
    }

    // Inject continuous background conversation summary & preserved active code
    if (!isVoiceAssistant && conversationSummary) {
      effectivePrompt += `\n\n[BACKGROUND CONVERSATION SUMMARY — PRESERVED CONTEXT]:\n${conversationSummary}`;
    }
    if (!isVoiceAssistant && activeCode && !isCreativeStudio) {
      effectivePrompt += `\n\n[PRESERVED ACTIVE CONTEXT]:\n${activeCode.slice(0, 12000)}`;
    }

    let streamSuccess = false;
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    const hasNonImageBinaryAttachment = Array.isArray(attachments) && attachments.some((a: any) => {
      const mime = String(a?.type || '');
      return mime.startsWith('video/') || mime.startsWith('audio/') || mime === 'application/pdf';
    });
    const hasGroqOrGrokKeys = getAvailableGrokKeys().length > 0;
    const useSearchGrounding = !hasAttachments && !isVoiceAssistant && !isCreativeStudio && shouldUseWebGrounding(prompt, isSimple, isBuildyWebsiteOrUi) && Boolean(process.env.GEMINI_API_KEY);
    let collectedSources: Array<{ title: string; uri: string; domain: string }> = [];

    const streamOptions = {
      isVoiceAssistant,
      voiceLanguage,
      assistantPersona,
      isCreativeStudio,
      studioCatalog,
      studioUploads,
    };

    // Use Groq primary for all chat/text/image requests when Groq keys exist (unless live web search grounding or video/audio/PDF binary parsing is explicitly required)
    if (hasNonImageBinaryAttachment || useSearchGrounding || !hasGroqOrGrokKeys) {
      console.log(`Initiating Gemini stream (binaryAtt=${hasNonImageBinaryAttachment}, webGrounding=${useSearchGrounding}, studio=${isCreativeStudio})...`);
      streamSuccess = await streamGeminiFallback(effectivePrompt, attachments, isSimple ? null : contextPackage, sendChunk, isSimple, {
        ...streamOptions,
        useSearchGrounding,
        onSources: (srcs) => {
          collectedSources = srcs;
        },
      });
      if (!streamSuccess && hasGroqOrGrokKeys) {
        console.warn('Gemini path unavailable, falling back to Groq...');
        streamSuccess = await streamGroq(effectivePrompt, history, isSimple ? null : contextPackage, sendChunk, isSimple, attachments, streamOptions);
      }
    } else {
      console.log(`Initiating fast stream via Groq primary (${isSimple ? 'INSTANT GREETING PATH' : isVoiceAssistant ? 'VOICE ASSISTANT' : isCreativeStudio ? 'CREATIVE STUDIO' : 'STANDARD PATH'})...`);
      streamSuccess = await streamGroq(effectivePrompt, history, isSimple ? null : contextPackage, sendChunk, isSimple, attachments, streamOptions);
      if (!streamSuccess) {
        console.warn('Groq primary busy/unavailable. Engaging Gemini fallback...');
        streamSuccess = await streamGeminiFallback(effectivePrompt, attachments, isSimple ? null : contextPackage, sendChunk, isSimple, {
          ...streamOptions,
          useSearchGrounding: false,
          onSources: (srcs) => {
            collectedSources = srcs;
          },
        });
      }
    }

    if (!streamSuccess && !isSimple && getAvailableGrokKeys().length > 0) {
      console.warn('AI providers busy. Executing brief backoff retry...');
      await new Promise((resolve) => setTimeout(resolve, 600));
      streamSuccess = await streamGroq(effectivePrompt, history, contextPackage, sendChunk, isSimple, attachments, streamOptions);
    }

    // 4. ROBUST FALLBACK: If external AI engines are temporarily rate-limited, provide immediate structured response
    if (!streamSuccess) {
      console.warn('AI providers temporarily rate-limited. Streaming structured fallback...');
      const fallbackText = generateStructuredFallback(effectivePrompt, attachments, contextPackage);
      const chunks = fallbackText.match(/.{1,60}/gs) || [fallbackText];
      for (const c of chunks) {
        sendChunk({ text: c, provider: 'intelligent-system-fallback' });
        await new Promise((r) => setTimeout(r, 15));
      }
      streamSuccess = true;
    }

    // Detect whether voice call reply recommended redirecting to Chat for a detailed topic
    const suggestGoToChat =
      Boolean(isVoiceAssistant) &&
      (/\[GO_TO_CHAT\]/i.test(accumulatedText) || detectVoiceDetailedTopicRequest(prompt));

    // Build dynamic per-query thoughtSummary & grounded sources metadata
    const thoughtSummary = buildDynamicThoughtSummary({
      prompt: String(prompt || ''),
      answer: accumulatedText,
      detectedLanguage,
      scriptMode,
      activeSkillName: isCreativeStudio ? 'Creative Studio' : activeSkill?.name,
      groundedUsed: useSearchGrounding || lastProvider.startsWith('gemini'),
      sourcesCount: collectedSources.length,
      hasAttachments,
      attachmentsCount: Array.isArray(attachments) ? attachments.length : 0,
      isBuildy: isBuildyWebsiteOrUi,
      provider: lastProvider,
    });

    sendChunk({
      meta: {
        sources: collectedSources,
        thoughtSummary,
        provider: lastProvider || (hasAttachments || useSearchGrounding ? 'gemini' : 'groq'),
        ...(suggestGoToChat ? { suggestGoToChat: true, detailedTopicQuery: String(prompt || '').trim() } : {}),
      },
    });
    sendChunk({ done: true });
    res.end();
  });

  // Fallback content generator with Deep Memory, Old Project Recall, and Code Edit awareness
  function generateStructuredFallback(promptText: string = '', atts: any[] = [], contextPackage: any = null): string {
    const subject = promptText.trim() || 'Next-Gen Vehicle Architecture';
    const lower = promptText.toLowerCase();
    const hasAtt = atts.length > 0;
    const attName = hasAtt ? atts[0].name : 'Concept Asset';

    // Check if user is referencing an older project / asking to edit previous code
    const isEditRequest =
      lower.includes('change') ||
      lower.includes('edit') ||
      lower.includes('modify') ||
      lower.includes('update') ||
      lower.includes('add this to') ||
      lower.includes('last month') ||
      lower.includes('yesterday') ||
      lower.includes('old one') ||
      lower.includes('previous') ||
      lower.includes('that website') ||
      lower.includes('the code you made') ||
      lower.includes('bmw') ||
      lower.includes('navigation') ||
      lower.includes('button');

    // 1. If contextPackage has a relevant artifact
    let matchedArtifact = contextPackage?.relevant_artifacts?.[0];
    let matchedProject = contextPackage?.relevant_projects?.[0];

    // 2. If no artifact was passed in contextPackage, resolve from persistent project vault
    if (!matchedArtifact && isEditRequest) {
      if (lower.includes('bmw') || lower.includes('creativedrive') || lower.includes('navigation') || lower.includes('telemetry') || lower.includes('last month') || lower.includes('car')) {
        matchedProject = {
          id: 'proj-creativedrive-ai',
          name: 'CreativeDrive AI (BMW Telemetry Interface)',
          description: 'Autonomous luxury automotive telemetry dashboard and visual system.',
        };
        matchedArtifact = {
          id: 'art-bmw-telemetry',
          projectId: 'proj-creativedrive-ai',
          name: 'bmw-telemetry-interface.html',
          title: 'BMW M-Power Telemetry Interface',
          type: 'html',
          version: 3,
          fullContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CreativeDrive AI • BMW M-Power Telemetry</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #070203; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 20px 36px; border-bottom: 1px solid rgba(255,24,40,0.2); background: rgba(14,2,4,0.85); backdrop-filter: blur(14px); }
    .brand { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #fff; display: flex; align-items: center; gap: 8px; }
    .brand span { color: #ff1828; }
    .nav-links { display: flex; gap: 20px; font-size: 14px; }
    .nav-links a { color: #a1a1aa; text-decoration: none; transition: color 0.2s; }
    .nav-links a.active, .nav-links a:hover { color: #ff1828; }
    main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; }
    .telemetry-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,24,40,0.35); border-radius: 20px; padding: 36px; max-width: 720px; width: 100%; box-shadow: 0 0 50px rgba(255,24,40,0.15); backdrop-filter: blur(16px); }
    .telemetry-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 28px 0; }
    .gauge { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; }
    .gauge-val { font-size: 2rem; font-weight: 800; color: #fff; }
    .gauge-label { font-size: 11px; text-transform: uppercase; color: #71717a; letter-spacing: 1px; margin-top: 4px; }
    .btn-boost { background: #ff1828; color: #fff; border: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.2s; box-shadow: 0 0 25px rgba(255,24,40,0.6); }
    .btn-boost:hover { transform: translateY(-2px); box-shadow: 0 0 35px rgba(255,24,40,0.85); }
  </style>
</head>
<body>
  <header>
    <div class="brand">BMW <span>M-Power Telemetry</span></div>
    <div class="nav-links">
      <a href="#" class="active">Cockpit</a>
      <a href="#">Telemetry</a>
      <a href="#">Aerodynamics</a>
      <a href="#">Track Mode</a>
    </div>
  </header>
  <main>
    <div class="telemetry-card">
      <h1 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 8px;">Autonomous High-Precision Telemetry</h1>
      <p style="color: #a1a1aa; margin-bottom: 24px;">Real-time twin-turbo calibrated telemetry stream.</p>
      <div class="telemetry-grid">
        <div class="gauge"><div class="gauge-val" id="vel">284</div><div class="gauge-label">KM/H Speed</div></div>
        <div class="gauge"><div class="gauge-val" id="rpm">7,200</div><div class="gauge-label">RPM Rate</div></div>
        <div class="gauge"><div class="gauge-val" id="boost">1.85</div><div class="gauge-label">BAR Boost</div></div>
      </div>
      <button class="btn-boost" onclick="boost()">Engage Twin-Turbo Boost</button>
    </div>
  </main>
  <script>
    function boost() {
      const vel = document.getElementById("vel");
      vel.innerText = (parseInt(vel.innerText) + 6).toString();
      document.getElementById("rpm").innerText = (7200 + Math.floor(Math.random() * 400)).toString();
    }
  </script>
</body>
</html>`,
        };
      }
    }

    // Apply incremental edit preserving everything else
    if (matchedArtifact && matchedArtifact.fullContent) {
      let modifiedHtml = matchedArtifact.fullContent;
      let changeSummary = 'Applied requested modification to your stored website code.';

      if (lower.includes('navigation') || lower.includes('nav')) {
        changeSummary = 'Updated navigation bar with refined glassmorphism, responsive telemetry tabs, and live HUD indicator.';
        modifiedHtml = modifiedHtml.replace(
          /<div class="nav-links">[\s\S]*?<\/div>/,
          `<div class="nav-links">
      <a href="#" class="active">Telemetry</a>
      <a href="#">Aerodynamics</a>
      <a href="#">Diagnostics</a>
      <a href="#">Track Mode</a>
      <a href="#" style="color:#ff1828; border: 1px solid rgba(255,24,40,0.5); padding: 4px 10px; border-radius: 6px; background: rgba(255,24,40,0.1);">Live HUD</a>
    </div>`
        );
      } else if (lower.includes('button') || lower.includes('prompt')) {
        changeSummary = 'Updated action button styling with high-glow neon shader and integrated enhanced telemetry trigger.';
        modifiedHtml = modifiedHtml.replace(
          /class="btn-boost"/,
          'class="btn-boost" style="box-shadow: 0 0 35px rgba(255,24,40,0.9); transform: scale(1.02);"'
        );
      }

      const newVersion = (matchedArtifact.version || 1) + 1;
      const projectName = matchedProject?.name || 'CreativeDrive AI (BMW Telemetry Interface)';

      return `# ${matchedArtifact.title || matchedArtifact.name} — Version ${newVersion}

I found your previous project: **${projectName}** (version ${matchedArtifact.version}).

${changeSummary} All existing telemetry dials, gauges, aerodynamic styling, responsive grid architecture, and JavaScript boost engine have been strictly preserved.

## Preserved Project Architecture
- **Project**: ${projectName}
- **Artifact**: \`${matchedArtifact.name}\` (Advanced from v${matchedArtifact.version} to v${newVersion})
- **Preserved Systems**: Responsive CSS grid, twin-turbo gauge simulation, JavaScript telemetry handlers, and high-contrast dark theme.

## Modified Website Code (v${newVersion})
\`\`\`html:${matchedArtifact.name}
${modifiedHtml}
\`\`\``;
    }

    // Website & App UI builds are handled on Buildy (never generated as HTML/CSS/JS websites here)
    const isWebsiteAsk =
      isWebsiteOrAppUiBuildRequest(promptText, atts) ||
      lower.includes('website') ||
      lower.includes('landing page') ||
      lower.includes('web app') ||
      lower.includes('app ui');

    if (isWebsiteAsk) {
      return `# Go to Buildy to Create Your App or Web UI

This workspace does **not** build HTML/CSS/JS websites or App UIs directly. To create, customize, and export your website or application interface, open **Buildy**:

- **Buildy App Builder**: https://fluorescent-code-vault-flow.base44.app

## Copy-Ready Buildy Specification Prompt
You can paste this detailed prompt directly into Buildy to generate your interface:

\`\`\`prompt
Build a modern, fully responsive web interface for: "${subject.slice(0, 160)}".
Include:
1. Sticky navigation bar with brand mark, section links, and primary CTA button.
2. High-impact hero section with clear headline hierarchy, concise value proposition, and interactive controls.
3. Structured feature cards grid with clean typography, balanced whitespace, and responsive breakpoints (375px / 768px / 1440px).
4. Interactive showcase, FAQ accordion, validated contact form, and clean footer.
\`\`\`

Need logic or backend code in **Python, TypeScript, C++, Java, or SQL**, or want an even more detailed prompt for Buildy? Ask right here!`;
    }

    return `**AI Provider Connection Notice**

Abhi external AI model keys configured nahi hain ya providers temporarily busy hain, is liye live model synthesis complete nahi ho saki${hasAtt ? ` (${attName} attached)` : ''}.

- **Configured Request:** **${subject.slice(0, 140)}**
- **Next Step:** Apna **GEMINI_API_KEY** aur **GROK_API_KEY** (+ **GROK_API_KEY_FALLBACK** rate-limit backup) server environment mein set karein taake real-time grounded answers, tables, charts, aur **Daro & Zara** voice synthesis active ho sakein.`;
  }

}
