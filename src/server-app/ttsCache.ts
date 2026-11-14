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

const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'tts-audio');

function ensureCacheDir(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('TTS cache directory setup warning:', err);
  }
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
