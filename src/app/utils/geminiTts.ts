/**
 * Gemini Text-to-Speech (TTS) Client Audio Manager
 * - Exclusively uses Gemini Studio TTS (/api/tts) with persistent backend WAV caching
 * - Progressive 50-word chunked synthesis + lookahead prefetching (Chunk N+1 preloads while Chunk N plays)
 * - Slightly slower 0.90x clear studio playback speed with pitch preservation
 * - Exact-spot Pause/Stop & Continue resume with zero duplicate generation
 */

export type AssistantPersona = 'Zara' | 'Daro';
export type PrebuiltStudioVoice = 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';

export const TTS_PLAYBACK_RATE = 0.90;
export const TTS_WORDS_PER_CHUNK = 50;

export interface GeminiVoiceInfo {
  id: string;
  name: string;
  gender: 'Female' | 'Male';
  persona: AssistantPersona;
  prebuiltVoice: PrebuiltStudioVoice;
  tone: string;
  style: string;
  description: string;
  previewSample: string;
}

export const GEMINI_TTS_VOICES: GeminiVoiceInfo[] = [
  // 7 Female Personas -> Zara
  {
    id: 'zara-classic',
    name: 'Zara Classic',
    gender: 'Female',
    persona: 'Zara',
    prebuiltVoice: 'Kore',
    tone: 'Warm & Studio Clear',
    style: 'Warm, crystal-clear studio narrator with natural human cadence and crisp articulation',
    description: 'Studio-grade natural warmth, smooth pacing, and crystal-clear pronunciation.',
    previewSample: 'Assalam-o-Alaikum! Main Zara Classic hoon, studio quality voice ke sath.',
  },
  {
    id: 'zara-silk',
    name: 'Zara Silk',
    gender: 'Female',
    persona: 'Zara',
    prebuiltVoice: 'Zephyr',
    tone: 'Calm & Soothing',
    style: 'Gentle, poised, silky studio storyteller with serene clarity and calm breath control',
    description: 'Serene, effortless, and balanced cadence designed for thoughtful replies.',
    previewSample: 'Hello! I am Zara Silk, bringing calm and crystal-clear studio narration.',
  },
  {
    id: 'zara-nova',
    name: 'Zara Nova',
    gender: 'Female',
    persona: 'Zara',
    prebuiltVoice: 'Kore',
    tone: 'Bright & Modern',
    style: 'Upbeat, crisp, modern female assistant with sparkling clarity and energetic rhythm',
    description: 'Fresh, articulate, and upbeat conversational pace for fast daily help.',
    previewSample: 'Hey there! This is Zara Nova, ready to help you brainstorm and explore.',
  },
  {
    id: 'zara-lumen',
    name: 'Zara Lumen',
    gender: 'Female',
    persona: 'Zara',
    prebuiltVoice: 'Zephyr',
    tone: 'Airy & Poised',
    style: 'Poised, airy, refined editorial speaker with soft warmth and intelligent emphasis',
    description: 'Refined editorial delivery ideal for summaries, reading, and learning.',
    previewSample: 'Greetings! Zara Lumen speaking with refined studio poise and warmth.',
  },
  {
    id: 'zara-aria',
    name: 'Zara Aria',
    gender: 'Female',
    persona: 'Zara',
    prebuiltVoice: 'Kore',
    tone: 'Melodic & Expressive',
    style: 'Expressive, melodic, friendly companion voice with natural conversational intonation',
    description: 'Natural storytelling inflection with engaging emotional warmth.',
    previewSample: 'Hi! I am Zara Aria, here to explain complex ideas simply and clearly.',
  },
  {
    id: 'zara-velvet',
    name: 'Zara Velvet',
    gender: 'Female',
    persona: 'Zara',
    prebuiltVoice: 'Zephyr',
    tone: 'Soft & Grounded',
    style: 'Low-pitched, velvet-smooth female voice with relaxed warmth and steady composure',
    description: 'Relaxed, comforting timbre great for long explanations and focus.',
    previewSample: 'Welcome back. This is Zara Velvet, steady, clear, and ready to assist.',
  },
  {
    id: 'zara-spark',
    name: 'Zara Spark',
    gender: 'Female',
    persona: 'Zara',
    prebuiltVoice: 'Kore',
    tone: 'Crisp & Concise',
    style: 'Quick, sharp, confident female host with punchy diction and high clarity',
    description: 'Punchy, confident, and snappy delivery for live voice and camera Q&A.',
    previewSample: 'Ready whenever you are! I am Zara Spark, sharp and concise.',
  },

  // 7 Male Personas -> Daro
  {
    id: 'daro-atlas',
    name: 'Daro Atlas',
    gender: 'Male',
    persona: 'Daro',
    prebuiltVoice: 'Charon',
    tone: 'Deep & Authoritative',
    style: 'Deep, calm, authoritative studio broadcaster with rich baritone resonance',
    description: 'Rich baritone depth, poised cadence, and studio resonance for detailed briefings.',
    previewSample: 'Greetings. I am Daro Atlas, delivering clear and authoritative audio.',
  },
  {
    id: 'daro-prime',
    name: 'Daro Prime',
    gender: 'Male',
    persona: 'Daro',
    prebuiltVoice: 'Fenrir',
    tone: 'Crisp & Executive',
    style: 'Confident, focused, dynamic executive speaker with sharp studio clarity',
    description: 'Focused, confident, and energetic studio diction tailored for insights.',
    previewSample: 'Hi, Daro Prime here. Let us break down your task with precision.',
  },
  {
    id: 'daro-pulse',
    name: 'Daro Pulse',
    gender: 'Male',
    persona: 'Daro',
    prebuiltVoice: 'Puck',
    tone: 'Expressive & Lively',
    style: 'Friendly, bright, natural conversational host with expressive vocal warmth',
    description: 'Articulate, lively, and natural conversational delivery for quick dialogue.',
    previewSample: 'Assalam-o-Alaikum! Main Daro Pulse hoon, ready to collaborate with you.',
  },
  {
    id: 'daro-sage',
    name: 'Daro Sage',
    gender: 'Male',
    persona: 'Daro',
    prebuiltVoice: 'Charon',
    tone: 'Calm & Mentor',
    style: 'Measured, patient, wise mentor voice with warm baritone grounding',
    description: 'Steady mentor tone ideal for step-by-step explanations and study guides.',
    previewSample: 'Hello. I am Daro Sage. Let us walk through every detail step by step.',
  },
  {
    id: 'daro-zenith',
    name: 'Daro Zenith',
    gender: 'Male',
    persona: 'Daro',
    prebuiltVoice: 'Fenrir',
    tone: 'Bold & Analytical',
    style: 'Commanding, analytical strategist voice with clean, deliberate articulation',
    description: 'Deliberate, structured clarity built for data, analysis, and strategy.',
    previewSample: 'This is Daro Zenith, delivering structured insights and clear analysis.',
  },
  {
    id: 'daro-echo',
    name: 'Daro Echo',
    gender: 'Male',
    persona: 'Daro',
    prebuiltVoice: 'Puck',
    tone: 'Warm & Casual',
    style: 'Easygoing, relatable everyday companion voice with natural cadence',
    description: 'Relaxed everyday speech flow designed for natural bilingual conversation.',
    previewSample: 'Hey! Daro Echo speaking — ask me anything by voice, text, or camera.',
  },
  {
    id: 'daro-titan',
    name: 'Daro Titan',
    gender: 'Male',
    persona: 'Daro',
    prebuiltVoice: 'Charon',
    tone: 'Resonant & Steady',
    style: 'Resonant, composed studio voice with powerful low-end clarity and zero rush',
    description: 'Composed studio power with balanced pacing and commanding tone.',
    previewSample: 'I am Daro Titan. Steady, clear, and focused on your request.',
  },
];

const LEGACY_VOICE_ALIASES: Record<string, string> = {
  Kore: 'zara-classic',
  Zephyr: 'zara-silk',
  Charon: 'daro-atlas',
  Fenrir: 'daro-prime',
  Puck: 'daro-pulse',
};

const VALID_VOICE_IDS = new Set(GEMINI_TTS_VOICES.map((v) => v.id));
const STORAGE_KEY_VOICE = 'gemini_tts_active_voice_v1';
const STORAGE_KEY_AUTOREAD = 'gemini_tts_auto_read_v1';

interface TtsSession {
  key: string;
  messageId: string;
  voiceId: string;
  voiceMeta: GeminiVoiceInfo;
  chunks: string[];
  chunkUrls: Map<number, string>;
  chunkInFlight: Map<number, Promise<string | null>>;
  currentChunkIndex: number;
  pausedAtTime: number;
  status: 'loading' | 'playing' | 'paused' | 'idle';
  audio: HTMLAudioElement | null;
  callbacks: {
    onLoadingStart?: () => void;
    onStart?: () => void;
    onPause?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  };
}

let activeSession: TtsSession | null = null;
let pausedSessions = new Map<string, TtsSession>();
let playbackEpoch = 0;

// Persistent browser blob URL cache per voice + chunk text so replays never re-fetch if still open
const chunkBlobUrlCache = new Map<string, string>();

export function normalizeVoiceId(voiceId?: string | null): string {
  if (!voiceId) return 'zara-classic';
  if (VALID_VOICE_IDS.has(voiceId)) return voiceId;
  if (LEGACY_VOICE_ALIASES[voiceId]) return LEGACY_VOICE_ALIASES[voiceId];
  return 'zara-classic';
}

export function getVoiceInfo(voiceId?: string | null): GeminiVoiceInfo {
  const normalized = normalizeVoiceId(voiceId || getStoredVoice());
  return GEMINI_TTS_VOICES.find((v) => v.id === normalized) || GEMINI_TTS_VOICES[0];
}

export function getActiveAssistantPersona(voiceId?: string | null): AssistantPersona {
  return getVoiceInfo(voiceId).persona;
}

export function getStoredVoice(): string {
  if (typeof window === 'undefined') return 'zara-classic';
  const stored = localStorage.getItem(STORAGE_KEY_VOICE) || 'zara-classic';
  return normalizeVoiceId(stored);
}

export function setStoredVoice(voiceId: string): void {
  if (typeof window === 'undefined') return;
  const safeId = normalizeVoiceId(voiceId);
  localStorage.setItem(STORAGE_KEY_VOICE, safeId);
}

export function getAutoReadAloud(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_AUTOREAD) === 'true';
}

export function setAutoReadAloud(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_AUTOREAD, enabled ? 'true' : 'false');
}

/**
 * Clean text to remove raw markdown syntax, code fences, and URLs
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';
  const withImageCardSpoken = raw.replace(/```image-card\s*([\s\S]*?)```/gi, (_m, jsonBody) => {
    try {
      const cleaned = String(jsonBody || '').trim().replace(/,\s*([}\]])/g, '$1');
      const parsed = JSON.parse(cleaned);
      const parts = [parsed?.title, parsed?.description].filter(Boolean).map((v) => String(v).trim());
      return parts.length > 0 ? ` ${parts.join('. ')}. ` : ' ';
    } catch {
      return ' ';
    }
  });
  return withImageCardSpoken
    .replace(/```[\s\S]*?```/gi, ' [Code or chart block omitted] ')
    .replace(/`[^`]+`/gi, '')
    .replace(/<[^>]+>/gi, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/gi, '$1')
    .replace(/[*_#~|]/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits clean text into progressive ~50-word chunks, snapping near natural sentence/clause endings
 * so Chunk 0 starts playing quickly while Chunk 1..N synthesize in the background.
 */
export function splitTextIntoWordChunks(cleanText: string, targetWords = TTS_WORDS_PER_CHUNK): string[] {
  const words = cleanText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= targetWords + 8) return [words.join(' ')];

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < words.length) {
    const remaining = words.length - cursor;
    if (remaining <= targetWords + 8) {
      chunks.push(words.slice(cursor).join(' '));
      break;
    }

    const minEnd = cursor + Math.max(25, targetWords - 14);
    const idealEnd = cursor + targetWords;
    const maxEnd = Math.min(words.length, cursor + targetWords + 10);

    let chosenEnd = idealEnd;
    // Prefer sentence-ending punctuation close to targetWords
    let foundSentenceBoundary = false;
    for (let idx = Math.min(maxEnd - 1, idealEnd + 6); idx >= minEnd; idx--) {
      if (/[.!?؟۔]$/.test(words[idx])) {
        chosenEnd = idx + 1;
        foundSentenceBoundary = true;
        break;
      }
    }
    if (!foundSentenceBoundary) {
      for (let idx = Math.min(maxEnd - 1, idealEnd + 5); idx >= minEnd; idx--) {
        if (/[,;:—–-]$/.test(words[idx])) {
          chosenEnd = idx + 1;
          break;
        }
      }
    }

    chunks.push(words.slice(cursor, chosenEnd).join(' '));
    cursor = chosenEnd;
  }

  return chunks;
}

function base64ToWavBlobUrl(base64Data: string, mimeType = 'audio/wav'): string {
  const binaryStr = atob(base64Data);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function makeSessionKey(messageId: string | undefined, cleanText: string, voiceId: string): string {
  if (messageId) return `msg:${messageId}:${voiceId}`;
  return `txt:${voiceId}:${cleanText.slice(0, 80)}:${cleanText.length}`;
}

function applyStudioPlaybackRate(audio: HTMLAudioElement) {
  try {
    audio.defaultPlaybackRate = TTS_PLAYBACK_RATE;
    audio.playbackRate = TTS_PLAYBACK_RATE;
    if ('preservesPitch' in audio) {
      (audio as any).preservesPitch = true;
    }
    if ('webkitPreservesPitch' in audio) {
      (audio as any).webkitPreservesPitch = true;
    }
  } catch {}
}

async function fetchChunkBlobUrl(session: TtsSession, chunkIndex: number): Promise<string | null> {
  if (chunkIndex < 0 || chunkIndex >= session.chunks.length) return null;

  const sessionHit = session.chunkUrls.get(chunkIndex);
  if (sessionHit) return sessionHit;

  const chunkText = session.chunks[chunkIndex];
  const memKey = `${session.voiceMeta.prebuiltVoice}|${session.voiceMeta.style}|${chunkText}`;
  const cachedBlob = chunkBlobUrlCache.get(memKey);
  if (cachedBlob) {
    session.chunkUrls.set(chunkIndex, cachedBlob);
    return cachedBlob;
  }

  const existingFlight = session.chunkInFlight.get(chunkIndex);
  if (existingFlight) return existingFlight;

  const flight = (async () => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunkText,
          voice: session.voiceMeta.id,
          prebuiltVoice: session.voiceMeta.prebuiltVoice,
          style: session.voiceMeta.style,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `Gemini TTS unavailable (status ${res.status})`);
      }

      const data = await res.json();
      if (!data?.audioData) {
        throw new Error('Gemini TTS returned empty audio');
      }

      const objectUrl = base64ToWavBlobUrl(data.audioData, data.mimeType || 'audio/wav');
      chunkBlobUrlCache.set(memKey, objectUrl);
      session.chunkUrls.set(chunkIndex, objectUrl);
      return objectUrl;
    } finally {
      session.chunkInFlight.delete(chunkIndex);
    }
  })();

  session.chunkInFlight.set(chunkIndex, flight);
  return flight;
}

function prefetchNextChunk(session: TtsSession, nextIndex: number) {
  if (nextIndex >= session.chunks.length) return;
  if (session.chunkUrls.has(nextIndex) || session.chunkInFlight.has(nextIndex)) return;
  fetchChunkBlobUrl(session, nextIndex).catch((err) => {
    console.warn(`Background TTS prefetch chunk ${nextIndex} notice:`, err?.message || err);
  });
}

async function playSessionChunk(session: TtsSession, chunkIndex: number, startTimeSec: number, epoch: number): Promise<void> {
  if (playbackEpoch !== epoch) return;

  if (chunkIndex >= session.chunks.length) {
    session.status = 'idle';
    session.currentChunkIndex = 0;
    session.pausedAtTime = 0;
    session.audio = null;
    pausedSessions.delete(session.key);
    if (activeSession?.key === session.key) {
      activeSession = null;
    }
    session.callbacks.onEnd?.();
    return;
  }

  session.currentChunkIndex = chunkIndex;
  const hasReadyUrl = session.chunkUrls.has(chunkIndex);
  if (!hasReadyUrl) {
    session.status = 'loading';
    session.callbacks.onLoadingStart?.();
  }

  let objectUrl: string | null = null;
  try {
    objectUrl = await fetchChunkBlobUrl(session, chunkIndex);
  } catch (err: any) {
    if (playbackEpoch !== epoch) return;
    session.status = 'idle';
    session.audio = null;
    if (activeSession?.key === session.key) activeSession = null;
    session.callbacks.onError?.(err?.message || 'Gemini TTS unavailable');
    session.callbacks.onEnd?.();
    return;
  }

  if (playbackEpoch !== epoch || !objectUrl) return;

  const audio = new Audio(objectUrl);
  session.audio = audio;
  applyStudioPlaybackRate(audio);

  audio.onloadedmetadata = () => {
    applyStudioPlaybackRate(audio);
    if (startTimeSec > 0 && Number.isFinite(audio.duration) && startTimeSec < audio.duration - 0.08) {
      try {
        audio.currentTime = startTimeSec;
      } catch {}
    }
  };

  audio.onplay = () => {
    if (playbackEpoch !== epoch) return;
    applyStudioPlaybackRate(audio);
    session.status = 'playing';
    session.callbacks.onStart?.();
    // Immediately prepare next 50-word chunk on backend while current 50 words speak!
    prefetchNextChunk(session, chunkIndex + 1);
  };

  audio.onended = () => {
    if (playbackEpoch !== epoch) return;
    session.pausedAtTime = 0;
    session.audio = null;
    playSessionChunk(session, chunkIndex + 1, 0, epoch);
  };

  audio.onerror = (e) => {
    if (playbackEpoch !== epoch) return;
    console.warn('Gemini Studio audio playback error:', e);
    session.status = 'idle';
    session.audio = null;
    if (activeSession?.key === session.key) activeSession = null;
    session.callbacks.onError?.('Audio playback failed');
    session.callbacks.onEnd?.();
  };

  try {
    if (startTimeSec > 0) {
      try {
        audio.currentTime = startTimeSec;
      } catch {}
    }
    await audio.play();
    applyStudioPlaybackRate(audio);
  } catch (playErr: any) {
    if (playbackEpoch !== epoch) return;
    session.status = 'idle';
    session.audio = null;
    if (activeSession?.key === session.key) activeSession = null;
    session.callbacks.onError?.(playErr?.message || 'Audio playback failed');
    session.callbacks.onEnd?.();
  }
}

/**
 * Pauses active Gemini TTS playback at the exact second without losing chunk buffers or resume position.
 */
export function pauseGeminiTts(): boolean {
  if (!activeSession) return false;
  playbackEpoch++;
  const session = activeSession;
  if (session.audio) {
    try {
      session.pausedAtTime = session.audio.currentTime || session.pausedAtTime || 0;
      session.audio.pause();
    } catch {}
  }
  session.status = 'paused';
  pausedSessions.set(session.key, session);
  activeSession = null;
  session.callbacks.onPause?.();
  return true;
}

/**
 * Stops active TTS playback completely (preserving backend & chunk blob cache for future instant replay).
 */
export function stopGeminiTts(): void {
  playbackEpoch++;
  if (activeSession?.audio) {
    try {
      activeSession.audio.onended = null;
      activeSession.audio.onerror = null;
      activeSession.audio.pause();
      activeSession.audio.currentTime = 0;
    } catch {}
    activeSession.audio = null;
  }
  if (activeSession) {
    activeSession.status = 'idle';
    activeSession.currentChunkIndex = 0;
    activeSession.pausedAtTime = 0;
    activeSession = null;
  }
}

export function clearPausedSession(messageId?: string): void {
  if (!messageId) {
    pausedSessions.clear();
    return;
  }
  for (const key of Array.from(pausedSessions.keys())) {
    if (key.startsWith(`msg:${messageId}:`)) {
      pausedSessions.delete(key);
    }
  }
}

export interface SpeakOptions {
  text: string;
  messageId?: string;
  voice?: string;
  onLoadingStart?: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

/**
 * Speaks text strictly using high-definition Studio Gemini TTS (/api/tts WAV output):
 * - Progressive 50-word chunking with background prefetching
 * - Slightly slower 0.90x natural studio pace
 * - Resumes from exact paused spot if paused earlier on the same message & voice
 */
export async function speakWithGeminiTts(
  textOrOptions: string | SpeakOptions,
  voiceName?: string,
  onStartCallback?: () => void,
  onEndCallback?: () => void,
  onErrorCallback?: (err: any) => void
): Promise<void> {
  const isObj = typeof textOrOptions === 'object' && textOrOptions !== null;
  const rawText = isObj ? textOrOptions.text : textOrOptions;
  const messageId = isObj ? textOrOptions.messageId : undefined;
  const requestedVoice = (isObj ? textOrOptions.voice : voiceName) || getStoredVoice();
  const voiceMeta = getVoiceInfo(requestedVoice);
  const onLoadingStart = isObj ? textOrOptions.onLoadingStart : undefined;
  const onStart = isObj ? textOrOptions.onStart : onStartCallback;
  const onPause = isObj ? textOrOptions.onPause : undefined;
  const onEnd = isObj ? textOrOptions.onEnd : onEndCallback;
  const onError = isObj ? textOrOptions.onError : onErrorCallback;

  const cleanText = cleanTextForSpeech(rawText);
  if (!cleanText) {
    onEnd?.();
    return;
  }

  const sessionKey = makeSessionKey(messageId, cleanText, voiceMeta.id);

  // Stop any *other* currently active playback cleanly
  if (activeSession && activeSession.key !== sessionKey) {
    // If another message was actively playing, pause it cleanly so user could even return to it, or stop its audio
    pauseGeminiTts();
  }

  const myEpoch = ++playbackEpoch;

  // Check if we have an exact paused session to resume from exact second
  const resumable = pausedSessions.get(sessionKey);
  if (resumable && resumable.status === 'paused') {
    pausedSessions.delete(sessionKey);
    resumable.callbacks = { onLoadingStart, onStart, onPause, onEnd, onError };
    activeSession = resumable;

    if (resumable.audio) {
      applyStudioPlaybackRate(resumable.audio);
      resumable.status = 'playing';
      // Ensure callbacks reflect active epoch
      const resumedChunk = resumable.currentChunkIndex;
      resumable.audio.onplay = () => {
        if (playbackEpoch !== myEpoch) return;
        applyStudioPlaybackRate(resumable.audio!);
        resumable.status = 'playing';
        resumable.callbacks.onStart?.();
        prefetchNextChunk(resumable, resumedChunk + 1);
      };
      resumable.audio.onended = () => {
        if (playbackEpoch !== myEpoch) return;
        resumable.pausedAtTime = 0;
        resumable.audio = null;
        playSessionChunk(resumable, resumedChunk + 1, 0, myEpoch);
      };
      try {
        await resumable.audio.play();
        return;
      } catch {
        // Fallback to recreating Audio element at exact offset
      }
    }

    await playSessionChunk(resumable, resumable.currentChunkIndex, resumable.pausedAtTime, myEpoch);
    return;
  }

  const chunks = splitTextIntoWordChunks(cleanText, TTS_WORDS_PER_CHUNK);
  if (chunks.length === 0) {
    onEnd?.();
    return;
  }

  const session: TtsSession = {
    key: sessionKey,
    messageId: messageId || sessionKey,
    voiceId: voiceMeta.id,
    voiceMeta,
    chunks,
    chunkUrls: new Map(),
    chunkInFlight: new Map(),
    currentChunkIndex: 0,
    pausedAtTime: 0,
    status: 'loading',
    audio: null,
    callbacks: { onLoadingStart, onStart, onPause, onEnd, onError },
  };

  activeSession = session;
  await playSessionChunk(session, 0, 0, myEpoch);
}
