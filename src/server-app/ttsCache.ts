import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface TtsCacheEntry {
  cacheKey: string;
  audioData: string;
  mimeType: string;
  voice: string;
  model: string;
  createdAt: number;
}

const MAX_MEMORY_ENTRIES = 160;
const memoryCache = new Map<string, TtsCacheEntry>();
const inFlightSynthesis = new Map<string, Promise<TtsCacheEntry>>();

const permanentPreviewMemoryCache = new Map<string, TtsCacheEntry>();
const inFlightPreviewSynthesis = new Map<string, Promise<TtsCacheEntry>>();

const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'tts-audio');
const PREVIEW_CACHE_DIR = path.resolve(process.cwd(), '.cache', 'voice-previews');

function ensureCacheDir(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('TTS cache directory setup warning:', err);
  }
}

function ensurePreviewCacheDir(): void {
  try {
    if (!fs.existsSync(PREVIEW_CACHE_DIR)) {
      fs.mkdirSync(PREVIEW_CACHE_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Voice preview cache directory setup warning:', err);
  }
}

function sanitizeVoiceId(voiceId: string): string {
  return String(voiceId || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 64);
}

export function buildTtsCacheKey(params: {
  text: string;
  prebuiltVoice: string;
  style?: string;
}): string {
  const normalizedText = params.text.replace(/\s+/g, ' ').trim();
  const raw = `${params.prebuiltVoice}|${(params.style || '').trim()}|${normalizedText}`;
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 32);
}

function touchMemoryEntry(key: string, entry: TtsCacheEntry): void {
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  } else if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, entry);
}

export function getCachedTtsAudio(cacheKey: string): TtsCacheEntry | null {
  const mem = memoryCache.get(cacheKey);
  if (mem) {
    touchMemoryEntry(cacheKey, mem);
    return mem;
  }

  try {
    const jsonPath = path.join(CACHE_DIR, `${cacheKey}.json`);
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const parsed = JSON.parse(raw) as TtsCacheEntry;
      if (parsed && parsed.audioData) {
        touchMemoryEntry(cacheKey, parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('TTS disk cache read warning:', err);
  }

  return null;
}

export function saveCachedTtsAudio(entry: TtsCacheEntry): void {
  touchMemoryEntry(entry.cacheKey, entry);
  try {
    ensureCacheDir();
    const jsonPath = path.join(CACHE_DIR, `${entry.cacheKey}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(entry), 'utf8');
  } catch (err) {
    console.warn('TTS disk cache write warning:', err);
  }
}

export async function getOrSynthesizeTts(
  cacheKey: string,
  synthesizer: () => Promise<Omit<TtsCacheEntry, 'cacheKey' | 'createdAt'>>
): Promise<{ entry: TtsCacheEntry; cached: boolean }> {
  const existing = getCachedTtsAudio(cacheKey);
  if (existing) {
    return { entry: existing, cached: true };
  }

  const inflight = inFlightSynthesis.get(cacheKey);
  if (inflight) {
    const entry = await inflight;
    return { entry, cached: true };
  }

  const promise = (async () => {
    const result = await synthesizer();
    const entry: TtsCacheEntry = {
      cacheKey,
      ...result,
      createdAt: Date.now(),
    };
    saveCachedTtsAudio(entry);
    return entry;
  })();

  inFlightSynthesis.set(cacheKey, promise);
  try {
    const entry = await promise;
    return { entry, cached: false };
  } finally {
    inFlightSynthesis.delete(cacheKey);
  }
}

export function getPermanentVoicePreview(voiceId: string): TtsCacheEntry | null {
  const safeId = sanitizeVoiceId(voiceId);
  const mem = permanentPreviewMemoryCache.get(safeId);
  if (mem) return mem;

  try {
    const jsonPath = path.join(PREVIEW_CACHE_DIR, `${safeId}.json`);
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const parsed = JSON.parse(raw) as TtsCacheEntry;
      if (parsed && parsed.audioData) {
        permanentPreviewMemoryCache.set(safeId, parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Voice preview disk cache read warning:', err);
  }

  return null;
}

export function savePermanentVoicePreview(voiceId: string, entry: TtsCacheEntry): void {
  const safeId = sanitizeVoiceId(voiceId);
  permanentPreviewMemoryCache.set(safeId, entry);
  try {
    ensurePreviewCacheDir();
    const jsonPath = path.join(PREVIEW_CACHE_DIR, `${safeId}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(entry), 'utf8');
  } catch (err) {
    console.warn('Voice preview disk cache write warning:', err);
  }
}

export async function getOrSynthesizePermanentPreview(
  voiceId: string,
  synthesizer: () => Promise<Omit<TtsCacheEntry, 'cacheKey' | 'createdAt'>>
): Promise<{ entry: TtsCacheEntry; cached: boolean }> {
  const safeId = sanitizeVoiceId(voiceId);
  const existing = getPermanentVoicePreview(safeId);
  if (existing) {
    return { entry: existing, cached: true };
  }

  const inflight = inFlightPreviewSynthesis.get(safeId);
  if (inflight) {
    const entry = await inflight;
    return { entry, cached: true };
  }

  const promise = (async () => {
    const result = await synthesizer();
    const entry: TtsCacheEntry = {
      cacheKey: `preview-${safeId}`,
      ...result,
      createdAt: Date.now(),
    };
    savePermanentVoicePreview(safeId, entry);
    return entry;
  })();

  inFlightPreviewSynthesis.set(safeId, promise);
  try {
    const entry = await promise;
    return { entry, cached: false };
  } finally {
    inFlightPreviewSynthesis.delete(safeId);
  }
}
