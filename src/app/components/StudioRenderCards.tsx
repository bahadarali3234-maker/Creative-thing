import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Eye,
  Copy,
  CheckCircle2,
  Loader2,
  Film,
  Image as ImageIcon,
  RefreshCw,
  Wand2,
  Upload,
  Mic,
  Square,
  Trash2,
  Sliders,
  Plus,
  RotateCcw,
  Music,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Move,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Scissors,
  FileText,
  Sparkles,
  ArrowUp,
  ArrowDown,
  FlipHorizontal,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import {
  VideoPlan,
  StudioToolCall,
  resolveStudioPlaceholders,
  removeBackground,
  extractSubjectSlotQuery,
} from '../utils/mythoriaLib';

const GOOGLE_FONTS_LINK =
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;800&family=Noto+Sans+Devanagari:wght@600;800&family=Playfair+Display:wght@700;900&family=Poppins:wght@400;600;800;900&family=Space+Grotesk:wght@500;700&display=swap';

export type SynthMusicMood = 'ambient' | 'cinematic' | 'upbeat' | 'lofi' | 'off';

const MUSIC_MOOD_LABELS: Record<SynthMusicMood, string> = {
  ambient: 'Ambient Corporate',
  cinematic: 'Cinematic Pulse',
  upbeat: 'Upbeat Synth',
  lofi: 'Lo-Fi Focus',
  off: 'Music Off',
};

const CANVAS_BG_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Obsidian', value: '#0b1020' },
  { label: 'Deep Navy', value: 'linear-gradient(135deg, #09132c 0%, #173a7a 100%)' },
  { label: 'Crimson Noir', value: 'linear-gradient(135deg, #16060b 0%, #7f1d1d 100%)' },
  { label: 'Emerald Depth', value: 'linear-gradient(135deg, #052e2b 0%, #0369a1 100%)' },
  { label: 'Sunset Glow', value: 'linear-gradient(135deg, #1f102e 0%, #c2410c 100%)' },
  { label: 'Pure White', value: '#ffffff' },
];

const FONT_OPTIONS = [
  { label: 'Poppins', value: 'Poppins, sans-serif' },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'Bebas Neue', value: "'Bebas Neue', sans-serif" },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Georgia Serif', value: 'Georgia, serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, monospace' },
];

/**
 * Procedural Web Audio Synthesizer Engine for background motion-graphic soundtracks.
 * Generates zero-dependency music synchronized cleanly to playback and WebM export.
 */
class StudioSynthMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private timerId: number | null = null;
  private stepIdx = 0;
  private mood: SynthMusicMood = 'ambient';
  private volume = 0.35;
  private muted = false;
  private ownsContext = false;

  start(
    mood: SynthMusicMood,
    volume: number,
    muted: boolean,
    externalCtx?: AudioContext,
    extraDest?: AudioNode
  ) {
    this.stop();
    this.mood = mood;
    this.volume = volume;
    this.muted = muted;
    if (mood === 'off') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = externalCtx || new AudioCtx();
      this.ownsContext = !externalCtx;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = muted ? 0 : Math.max(0, Math.min(1, volume));
      this.masterGain.connect(this.ctx.destination);
      if (extraDest) {
        this.masterGain.connect(extraDest);
      }

      this.stepIdx = 0;
      const stepMs = mood === 'upbeat' ? 240 : mood === 'cinematic' ? 380 : mood === 'lofi' ? 420 : 460;
      this.triggerStep();
      this.timerId = window.setInterval(() => this.triggerStep(), stepMs);
    } catch {
      this.stop();
    }
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted || this.mood === 'off' ? 0 : Math.max(0, Math.min(1, volume)),
        this.ctx.currentTime,
        0.05
      );
    }
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType,
    level: number,
    cutoff = 1400,
    attack = 0.03
  ) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(level, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + durationSec + 0.05);
  }

  private triggerStep() {
    if (!this.ctx || !this.masterGain || this.mood === 'off') return;
    const s = this.stepIdx++;
    const bar = Math.floor(s / 8) % 4;

    if (this.mood === 'ambient') {
      const roots = [174.61, 196.0, 164.81, 220.0];
      const arp = [
        [349.23, 440.0, 523.25, 659.25],
        [392.0, 493.88, 587.33, 659.25],
        [329.63, 392.0, 493.88, 587.33],
        [220.0, 329.63, 440.0, 523.25],
      ];
      if (s % 8 === 0) {
        this.playTone(roots[bar], 3.4, 'sine', 0.24, 650, 0.25);
        this.playTone(roots[bar] * 1.5, 3.2, 'triangle', 0.12, 850, 0.3);
      }
      const note = arp[bar][s % 4];
      this.playTone(note, 0.75, 'sine', 0.11, 1600, 0.04);
    } else if (this.mood === 'cinematic') {
      const bass = [73.42, 58.27, 87.31, 65.41];
      const leads = [
        [293.66, 349.23, 440.0, 523.25],
        [233.08, 293.66, 349.23, 466.16],
        [261.63, 349.23, 440.0, 523.25],
        [261.63, 329.63, 392.0, 523.25],
      ];
      if (s % 2 === 0) {
        this.playTone(bass[bar], 0.48, 'sawtooth', 0.18, 360, 0.02);
      }
      if (s % 8 === 0) {
        this.playTone(bass[bar] * 2, 2.8, 'triangle', 0.15, 700, 0.2);
      }
      this.playTone(leads[bar][s % 4], 0.52, 'triangle', 0.1, 1500, 0.03);
    } else if (this.mood === 'upbeat') {
      const bass = [110.0, 87.31, 130.81, 98.0];
      const notes = [440, 523.25, 659.25, 587.33, 440, 659.25, 783.99, 659.25];
      this.playTone(bass[bar], 0.22, 'sawtooth', 0.14, 520, 0.01);
      this.playTone(notes[s % notes.length], 0.26, 'square', 0.06, 1700, 0.01);
      if (s % 4 === 0) {
        this.playTone(62, 0.14, 'sine', 0.28, 240, 0.005);
      }
    } else if (this.mood === 'lofi') {
      const chords = [
        [261.63, 329.63, 392.0, 493.88],
        [220.0, 261.63, 329.63, 392.0],
        [174.61, 220.0, 261.63, 329.63],
        [196.0, 246.94, 293.66, 349.23],
      ];
      if (s % 4 === 0) {
        for (const f of chords[bar]) {
          this.playTone(f, 1.5, 'sine', 0.07, 920, 0.06);
        }
      }
      if (s % 2 === 1) {
        const melody = chords[bar][(s + 1) % 4] * 2;
        this.playTone(melody, 0.35, 'triangle', 0.05, 1100, 0.02);
      }
    }
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {}
      this.masterGain = null;
    }
    if (this.ctx && this.ownsContext) {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.ownsContext = false;
  }
}

/**
 * Procedural Web Audio SFX Engine for Motion Graphic Text Appear / Disappear Transitions.
 * Syncs with scene & beat boundaries during both live playback and WebM video export.
 */
class StudioTextSfxEngine {
  private noiseBuffer: AudioBuffer | null = null;

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  playAppear(ctx: AudioContext, level = 0.28, extraDest?: AudioNode) {
    try {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = Math.max(0.02, Math.min(0.85, level));
      master.connect(ctx.destination);
      if (extraDest) master.connect(extraDest);

      // 1. Upward air whoosh for text entering frame
      const noise = ctx.createBufferSource();
      noise.buffer = this.ensureNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.6;
      bp.frequency.setValueAtTime(380, now);
      bp.frequency.exponentialRampToValueAtTime(1650, now + 0.13);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.32, now + 0.03);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(master);
      noise.start(now);
      noise.stop(now + 0.16);

      // 2. Crisp glass chime pop
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.08);
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.35, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);
      osc.connect(env);
      env.connect(master);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  playDisappear(ctx: AudioContext, level = 0.24, extraDest?: AudioNode) {
    try {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = Math.max(0.02, Math.min(0.85, level));
      master.connect(ctx.destination);
      if (extraDest) master.connect(extraDest);

      // 1. Downward soft air swoosh for text exiting frame
      const noise = ctx.createBufferSource();
      noise.buffer = this.ensureNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(1180, now);
      bp.frequency.exponentialRampToValueAtTime(250, now + 0.12);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.28, now + 0.02);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(master);
      noise.start(now);
      noise.stop(now + 0.15);

      // 2. Subtle downward soft tick
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(155, now + 0.11);
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.22, now + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.connect(env);
      env.connect(master);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }
}

interface SfxCue {
  id: string;
  time: number;
  kind: 'appear' | 'disappear';
}

function buildTextSfxCues(videoPlan: VideoPlan, effectiveDuration: number): SfxCue[] {
  const cues: SfxCue[] = [];
  const scenes = Array.isArray(videoPlan.scenes) ? videoPlan.scenes : [];
  if (scenes.length === 0) {
    cues.push({ id: 'intro-appear', time: 0.05, kind: 'appear' });
    cues.push({ id: 'outro-disappear', time: Math.max(0.5, effectiveDuration - 0.25), kind: 'disappear' });
    return cues;
  }

  const lastSceneOrigEnd = Math.max(1, Number(scenes[scenes.length - 1]?.end) || videoPlan.duration || effectiveDuration);
  const ratio = effectiveDuration / lastSceneOrigEnd;

  scenes.forEach((sc, idx) => {
    const start = Math.max(0, Number(sc.start || 0) * ratio);
    const end = Math.min(effectiveDuration, Number(sc.end || start + 4) * ratio);
    const dur = Math.max(0.5, end - start);

    cues.push({ id: `s-${idx}-in`, time: start + 0.04, kind: 'appear' });

    // If a scene is long enough to hold stacked bullets or secondary kinetic callouts, add mid-scene pop
    if (dur >= 4.2) {
      cues.push({ id: `s-${idx}-mid-in`, time: start + dur * 0.42, kind: 'appear' });
    }

    cues.push({
      id: `s-${idx}-out`,
      time: Math.max(start + 0.25, end - 0.18),
      kind: 'disappear',
    });
  });

  return cues.sort((a, b) => a.time - b.time);
}

interface ScrapedSubjectCandidate {
  id?: string;
  title: string;
  url: string;
  thumbnail: string;
}

function parseCanvasSize(html: string, fallback: [number, number] = [1280, 720]): [number, number] {
  if (!html) return fallback;
  const wMatch =
    html.match(/#canvas[\s\S]{0,400}?width:\s*(\d{3,4})px/i) ||
    html.match(/id=["']canvas["'][^>]*style=["'][^"']*width:\s*(\d{3,4})px/i);
  const hMatch =
    html.match(/#canvas[\s\S]{0,400}?height:\s*(\d{3,4})px/i) ||
    html.match(/id=["']canvas["'][^>]*style=["'][^"']*height:\s*(\d{3,4})px/i);
  const w = wMatch ? Math.max(320, Math.min(3000, Number(wMatch[1]))) : fallback[0];
  const h = hMatch ? Math.max(320, Math.min(3000, Number(hMatch[1]))) : fallback[1];
  return [w, h];
}

function prepareStudioSrcDoc(rawHtml: string, width: number, height: number): string {
  const html = (rawHtml || '').trim();
  if (!html) return '';
  const hasDoc = /<!DOCTYPE|<html/i.test(html);
  const extraHead = `<link rel="stylesheet" href="${GOOGLE_FONTS_LINK}" crossorigin="anonymous"><style>html,body{margin:0!important;padding:0!important;width:${width}px!important;height:${height}px!important;overflow:hidden!important;background:#0b1020;}#canvas,#stage{margin:0!important;}img[data-studio-subject-img]:not([src]),img[data-studio-subject-img][src=""]{opacity:0!important;}</style>`;
  if (!hasDoc) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${extraHead}</head><body>${html}</body></html>`;
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${extraHead}</head>`);
  }
  return html.replace(/<body/i, `<head>${extraHead}</head><body`);
}

function rgbToHex(colorStr: string): string {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return '#ffffff';
  if (colorStr.startsWith('#')) return colorStr.slice(0, 7);
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return '#ffffff';
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(Number(m[1]))}${toHex(Number(m[2]))}${toHex(Number(m[3]))}`;
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

interface SelectedElementMeta {
  tagName: string;
  isSubjectOrMedia: boolean;
  text: string;
  hasText: boolean;
  fontSize: number;
  fontFamily: string;
  color: string;
  bgColor: string;
  hasBg: boolean;
  textAlign: 'left' | 'center' | 'right';
  isBold: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  flipped: boolean;
  zIndex: number;
}

export interface StudioImageCardProps {
  htmlCode: string;
  uploadsMap?: Record<string, string>;
  fileName?: string;
  isStreaming?: boolean;
  onOpenFullScreenEditor?: (code: string, fileName?: string, lang?: string) => void;
}

export const StudioImageCard: React.FC<StudioImageCardProps> = ({
  htmlCode,
  uploadsMap = {},
  fileName = 'design.html',
  isStreaming = false,
}) => {
  const [tab, setTab] = useState<'preview' | 'edit'>('preview');
  const [editedHtml, setEditedHtml] = useState<string>(htmlCode);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportNotice, setExportNotice] = useState<string>('');
  const [containerWidth, setContainerWidth] = useState(640);
  const [selectedMeta, setSelectedMeta] = useState<SelectedElementMeta | null>(null);
  const [canvasBg, setCanvasBg] = useState<string>('#0b1020');

  // Auto Subject Lookup + In-Browser Background Cutout State
  const [subjectCandidates, setSubjectCandidates] = useState<ScrapedSubjectCandidate[]>([]);
  const [activeSubjectIdx, setActiveSubjectIdx] = useState<number>(0);
  const [cutoutEnabled, setCutoutEnabled] = useState<boolean>(true);
  const [subjectLoading, setSubjectLoading] = useState<boolean>(false);
  const [subjectStatusText, setSubjectStatusText] = useState<string>('');
  const [activeSubjectDataUrl, setActiveSubjectDataUrl] = useState<string>('');

  const subjectCacheRef = useRef<
    Record<number, { originalDataUrl: string; cutoutDataUrl?: string; method?: string }>
  >({});
  const fetchedQueryRef = useRef<string>('');

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const selectedElRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{
    el: HTMLElement;
    startClientX: number;
    startClientY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
  } | null>(null);
  const prevStreamPropRef = useRef<string>(htmlCode);

  useEffect(() => {
    if (htmlCode !== prevStreamPropRef.current) {
      prevStreamPropRef.current = htmlCode;
      setEditedHtml(htmlCode);
      setSelectedMeta(null);
      selectedElRef.current = null;
      subjectCacheRef.current = {};
      fetchedQueryRef.current = '';
      setSubjectCandidates([]);
      setActiveSubjectIdx(0);
      setActiveSubjectDataUrl('');
    }
  }, [htmlCode]);

  const activeSourceHtml = isStreaming ? htmlCode : editedHtml;
  const [canvasW, canvasH] = useMemo(
    () => parseCanvasSize(activeSourceHtml, [1280, 720]),
    [activeSourceHtml]
  );

  const subjectSlotMeta = useMemo(
    () => extractSubjectSlotQuery(activeSourceHtml),
    [activeSourceHtml]
  );

  // Inject active subject dataURL cleanly into any [data-studio-subject-img] slot in resolvedHtml
  const resolvedHtml = useMemo(() => {
    let base = resolveStudioPlaceholders(activeSourceHtml, uploadsMap);
    if (activeSubjectDataUrl) {
      if (/data-studio-subject-img/i.test(base)) {
        base = base.replace(/<img([^>]*data-studio-subject-img[^>]*)>/gi, (full, attrs) => {
          const cleanedAttrs = String(attrs || '').replace(/\ssrc\s*=\s*("[^"]*"|'[^']*')/gi, '');
          return `<img${cleanedAttrs} src="${activeSubjectDataUrl}">`;
        });
      }
    }
    return base;
  }, [activeSourceHtml, uploadsMap, activeSubjectDataUrl]);

  const srcDoc = useMemo(
    () => prepareStudioSrcDoc(resolvedHtml, canvasW, canvasH),
    [resolvedHtml, canvasW, canvasH]
  );

  // Step 1: Automatically search web photos when canvas defines a [data-studio-subject-slot]
  useEffect(() => {
    if (isStreaming || !subjectSlotMeta?.query) return;
    if (fetchedQueryRef.current === subjectSlotMeta.query) return;
    fetchedQueryRef.current = subjectSlotMeta.query;
    setCutoutEnabled(subjectSlotMeta.cutout);

    let cancelled = false;
    (async () => {
      setSubjectLoading(true);
      setSubjectStatusText(`Finding photo for "${subjectSlotMeta.query}"...`);
      try {
        const res = await fetch('/api/google-scrape-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: subjectSlotMeta.query, offset: 0 }),
        });
        if (!res.ok) throw new Error(`Image search status ${res.status}`);
        const data = await res.json();
        const list: ScrapedSubjectCandidate[] = (Array.isArray(data?.images) ? data.images : [])
          .filter((im: any) => im && (im.url || im.thumbnail))
          .slice(0, 6);
        if (!cancelled) {
          setSubjectCandidates(list);
          setActiveSubjectIdx(0);
          if (list.length === 0) {
            setSubjectLoading(false);
            setSubjectStatusText('No photo matched query');
          }
        }
      } catch {
        if (!cancelled) {
          setSubjectLoading(false);
          setSubjectStatusText('Photo search unavailable right now');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isStreaming, subjectSlotMeta]);

  // Step 2: Load active photo candidate via same-origin proxy + apply browser cutout when enabled
  useEffect(() => {
    if (isStreaming || subjectCandidates.length === 0) return;
    const candidate = subjectCandidates[activeSubjectIdx];
    if (!candidate) return;

    let cancelled = false;
    const cached = subjectCacheRef.current[activeSubjectIdx];

    if (cached && (!cutoutEnabled || cached.cutoutDataUrl)) {
      setActiveSubjectDataUrl(cutoutEnabled && cached.cutoutDataUrl ? cached.cutoutDataUrl : cached.originalDataUrl);
      setSubjectLoading(false);
      setSubjectStatusText(cutoutEnabled ? 'Cutout applied' : 'Original photo');
      return;
    }

    (async () => {
      setSubjectLoading(true);
      try {
        let originalDataUrl = cached?.originalDataUrl || '';
        if (!originalDataUrl) {
          setSubjectStatusText('Loading subject photo...');
          const urlsToTry = [candidate.url, candidate.thumbnail].filter(Boolean);
          let fetchedBlob: Blob | null = null;
          for (const rawUrl of urlsToTry) {
            try {
              const proxyRes = await fetch(`/api/image-proxy?url=${encodeURIComponent(rawUrl)}`);
              if (proxyRes.ok) {
                const b = await proxyRes.blob();
                if (b.size > 500 && b.type.startsWith('image/')) {
                  fetchedBlob = b;
                  break;
                }
              }
            } catch {}
          }
          if (!fetchedBlob) {
            throw new Error('Could not proxy photo');
          }
          originalDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(fetchedBlob!);
          });
          subjectCacheRef.current[activeSubjectIdx] = { originalDataUrl };
        }

        if (cancelled) return;

        if (!cutoutEnabled) {
          setActiveSubjectDataUrl(originalDataUrl);
          setSubjectLoading(false);
          setSubjectStatusText('Original photo');
          return;
        }

        // Show original briefly while browser removes background, or immediately compute cutout
        setSubjectStatusText('Removing background in browser...');
        const cutoutRes = await removeBackground(originalDataUrl, { edge_feather: 2, tolerance: 54 });
        if (cancelled) return;
        subjectCacheRef.current[activeSubjectIdx] = {
          originalDataUrl,
          cutoutDataUrl: cutoutRes.dataURL,
          method: cutoutRes.method,
        };
        setActiveSubjectDataUrl(cutoutRes.dataURL);
        setSubjectStatusText('Background removed');
      } catch {
        if (!cancelled) {
          const fallbackOrig = subjectCacheRef.current[activeSubjectIdx]?.originalDataUrl;
          if (fallbackOrig) {
            setActiveSubjectDataUrl(fallbackOrig);
            setSubjectStatusText('Using original photo');
          } else {
            setSubjectStatusText('Try next photo ->');
          }
        }
      } finally {
        if (!cancelled) {
          setSubjectLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isStreaming, subjectCandidates, activeSubjectIdx, cutoutEnabled]);

  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 60) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);

  const scale = Math.min(1, containerWidth / canvasW);
  const scaledHeight = Math.max(180, Math.round(canvasH * scale));

  const serializeIframeBackToHtml = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !doc.body) return;
    const active = selectedElRef.current;
    let prevOutline = '';
    let prevCursor = '';
    if (active) {
      prevOutline = active.style.outline;
      prevCursor = active.style.cursor;
      active.style.outline = '';
      active.style.cursor = '';
    }
    try {
      const cloneDoc = doc.documentElement.cloneNode(true) as HTMLElement;
      cloneDoc.querySelectorAll('[data-studio-editor-injected]').forEach((n) => n.remove());
      cloneDoc.querySelectorAll('[style]').forEach((el) => {
        (el as HTMLElement).style.outline = '';
      });
      setEditedHtml(`<!DOCTYPE html>\n${cloneDoc.outerHTML}`);
    } finally {
      if (active) {
        active.style.outline = prevOutline;
        active.style.cursor = prevCursor;
      }
    }
  }, []);

  /**
   * Normalize element coordinates into clean `position:absolute; left: Xpx; top: Ypx;`
   * relative to `#canvas` so dragging elements anchored with `right`/`bottom` or flexbox works effortlessly.
   */
  const normalizeElementPositionToLeftTop = useCallback((el: HTMLElement) => {
    const doc = iframeRef.current?.contentDocument;
    const canvasRoot = (doc?.getElementById('canvas') || doc?.body) as HTMLElement | null;
    if (!canvasRoot) return { left: 0, top: 0 };

    const elRect = el.getBoundingClientRect();
    const canvasRect = canvasRoot.getBoundingClientRect();
    const win = iframeRef.current?.contentWindow;
    const cs = win ? win.getComputedStyle(el) : window.getComputedStyle(el);

    if (cs.position !== 'absolute' || el.style.right || el.style.bottom || !el.style.left || !el.style.top) {
      const computedLeft = Math.round(elRect.left - canvasRect.left);
      const computedTop = Math.round(elRect.top - canvasRect.top);
      const computedW = Math.round(elRect.width);
      const computedH = Math.round(elRect.height);

      el.style.position = 'absolute';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.margin = '0';
      el.style.left = `${computedLeft}px`;
      el.style.top = `${computedTop}px`;
      if (computedW > 10 && !el.style.width) el.style.width = `${computedW}px`;
      if (computedH > 10 && !el.style.height && (el.dataset.studioSubjectSlot || el.tagName === 'IMG')) {
        el.style.height = `${computedH}px`;
      }
      return { left: computedLeft, top: computedTop };
    }

    return {
      left: Math.round(parseFloat(el.style.left || '0') || 0),
      top: Math.round(parseFloat(el.style.top || '0') || 0),
    };
  }, []);

  const readElementMeta = (el: HTMLElement): SelectedElementMeta => {
    const win = iframeRef.current?.contentWindow;
    const cs = win ? win.getComputedStyle(el) : window.getComputedStyle(el);
    const hasBg = Boolean(
      cs.backgroundColor &&
        cs.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        cs.backgroundColor !== 'transparent'
    );
    const alignRaw = cs.textAlign || 'left';
    const textAlign: 'left' | 'center' | 'right' =
      alignRaw === 'center' ? 'center' : alignRaw === 'right' || alignRaw === 'end' ? 'right' : 'left';
    const weightNum = parseInt(cs.fontWeight || '400', 10);
    const rect = el.getBoundingClientRect();
    const doc = iframeRef.current?.contentDocument;
    const canvasRoot = (doc?.getElementById('canvas') || doc?.body) as HTMLElement | null;
    const canvasRect = canvasRoot?.getBoundingClientRect();

    const leftVal = el.style.left
      ? parseFloat(el.style.left) || 0
      : canvasRect
        ? rect.left - canvasRect.left
        : 0;
    const topVal = el.style.top
      ? parseFloat(el.style.top) || 0
      : canvasRect
        ? rect.top - canvasRect.top
        : 0;

    const isSubjectOrMedia =
      el.tagName.toLowerCase() === 'img' ||
      el.tagName.toLowerCase() === 'svg' ||
      el.dataset.studioSubjectSlot === 'true' ||
      Boolean(el.querySelector('img[data-studio-subject-img]'));

    const hasText =
      !isSubjectOrMedia &&
      (el.children.length === 0 || Boolean(el.innerText && el.innerText.trim().length > 0 && el.children.length <= 2));

    const zParsed = parseInt(el.style.zIndex || cs.zIndex || '10', 10);

    return {
      tagName: el.dataset.studioSubjectSlot ? 'subject-photo' : el.tagName.toLowerCase(),
      isSubjectOrMedia,
      text: hasText ? el.innerText || '' : '',
      hasText,
      fontSize: Math.round(parseFloat(cs.fontSize || '24') || 24),
      fontFamily: cs.fontFamily || 'Poppins, sans-serif',
      color: rgbToHex(cs.color || '#ffffff'),
      bgColor: rgbToHex(cs.backgroundColor || '#000000'),
      hasBg,
      textAlign,
      isBold: Number.isFinite(weightNum) ? weightNum >= 600 : cs.fontWeight === 'bold',
      x: Math.round(leftVal),
      y: Math.round(topVal),
      width: Math.round(parseFloat(el.style.width || '') || rect.width || 240),
      height: Math.round(parseFloat(el.style.height || '') || rect.height || 240),
      flipped: (el.style.transform || '').includes('scaleX(-1)'),
      zIndex: Number.isFinite(zParsed) ? zParsed : 10,
    };
  };

  const selectEditorElement = useCallback((el: HTMLElement | null) => {
    if (selectedElRef.current && selectedElRef.current !== el) {
      selectedElRef.current.style.outline = '';
    }
    selectedElRef.current = el;
    if (!el) {
      setSelectedMeta(null);
      return;
    }
    el.style.outline = '2px dashed #00A6FF';
    el.style.outlineOffset = '4px';
    el.style.cursor = 'move';
    setSelectedMeta(readElementMeta(el));
  }, []);

  const attachInteractiveEditorHandlers = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || tab !== 'edit') return;

    const canvasRoot = (doc.getElementById('canvas') || doc.body) as HTMLElement | null;
    if (canvasRoot) {
      const cs = iframeRef.current?.contentWindow?.getComputedStyle(canvasRoot);
      if (cs?.backgroundColor) {
        setCanvasBg(rgbToHex(cs.backgroundColor));
      }
    }

    const pickEditableTarget = (rawTarget: EventTarget | null): HTMLElement | null => {
      let cur = rawTarget as HTMLElement | null;
      while (cur && cur !== doc.body && cur !== doc.documentElement) {
        if (cur.id === 'canvas') return null;
        const subjectSlot = cur.closest('[data-studio-subject-slot="true"]') as HTMLElement | null;
        if (subjectSlot) return subjectSlot;
        const tag = cur.tagName.toLowerCase();
        if (['svg', 'path', 'circle', 'rect', 'line', 'polygon'].includes(tag)) {
          const parentSvg = cur.closest('svg') as HTMLElement | null;
          return parentSvg || cur;
        }
        return cur;
      }
      return null;
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (tab !== 'edit') return;
      ev.preventDefault();
      const target = pickEditableTarget(ev.target);
      if (!target) {
        selectEditorElement(null);
        return;
      }
      const { left, top } = normalizeElementPositionToLeftTop(target);
      selectEditorElement(target);
      dragStateRef.current = {
        el: target,
        startClientX: ev.clientX,
        startClientY: ev.clientY,
        origLeft: left,
        origTop: top,
        moved: false,
      };
    };

    const onPointerMove = (ev: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      const dx = (ev.clientX - ds.startClientX) / Math.max(0.15, scale);
      const dy = (ev.clientY - ds.startClientY) / Math.max(0.15, scale);
      if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) {
        ds.moved = true;
      }
      const nextX = Math.round(ds.origLeft + dx);
      const nextY = Math.round(ds.origTop + dy);
      ds.el.style.left = `${nextX}px`;
      ds.el.style.top = `${nextY}px`;
      setSelectedMeta((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
    };

    const onPointerUp = () => {
      if (dragStateRef.current) {
        const moved = dragStateRef.current.moved;
        dragStateRef.current = null;
        if (moved) {
          serializeIframeBackToHtml();
        }
      }
    };

    doc.addEventListener('pointerdown', onPointerDown);
    doc.addEventListener('pointermove', onPointerMove);
    doc.addEventListener('pointerup', onPointerUp);

    return () => {
      doc.removeEventListener('pointerdown', onPointerDown);
      doc.removeEventListener('pointermove', onPointerMove);
      doc.removeEventListener('pointerup', onPointerUp);
    };
  }, [tab, scale, normalizeElementPositionToLeftTop, selectEditorElement, serializeIframeBackToHtml]);

  useEffect(() => {
    if (tab !== 'edit') {
      if (selectedElRef.current) {
        selectedElRef.current.style.outline = '';
      }
      selectedElRef.current = null;
      setSelectedMeta(null);
      return;
    }
    const cleanup = attachInteractiveEditorHandlers();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [tab, attachInteractiveEditorHandlers, srcDoc]);

  const updateSelectedElement = (patch: Partial<SelectedElementMeta>) => {
    const el = selectedElRef.current;
    if (!el || !selectedMeta) return;
    normalizeElementPositionToLeftTop(el);

    if (patch.text !== undefined) {
      el.innerText = patch.text;
    }
    if (patch.fontSize !== undefined) {
      el.style.fontSize = `${Math.max(10, Math.min(260, patch.fontSize))}px`;
    }
    if (patch.fontFamily !== undefined) {
      el.style.fontFamily = patch.fontFamily;
    }
    if (patch.color !== undefined) {
      el.style.color = patch.color;
    }
    if (patch.hasBg === false) {
      el.style.backgroundColor = 'transparent';
    } else if (patch.bgColor !== undefined) {
      el.style.backgroundColor = patch.bgColor;
    }
    if (patch.textAlign !== undefined) {
      el.style.textAlign = patch.textAlign;
    }
    if (patch.isBold !== undefined) {
      el.style.fontWeight = patch.isBold ? '800' : '500';
    }
    if (patch.x !== undefined) {
      el.style.left = `${patch.x}px`;
    }
    if (patch.y !== undefined) {
      el.style.top = `${patch.y}px`;
    }
    if (patch.width !== undefined) {
      el.style.width = `${Math.max(40, Math.min(2400, patch.width))}px`;
    }
    if (patch.height !== undefined) {
      el.style.height = `${Math.max(40, Math.min(2400, patch.height))}px`;
    }
    if (patch.flipped !== undefined) {
      el.style.transform = patch.flipped ? 'scaleX(-1)' : '';
    }
    if (patch.zIndex !== undefined) {
      el.style.zIndex = String(Math.max(1, Math.min(999, patch.zIndex)));
    }

    setSelectedMeta((prev) => (prev ? { ...prev, ...patch } : prev));
    serializeIframeBackToHtml();
  };

  const handleApplyCanvasBackground = (bgValue: string) => {
    setCanvasBg(bgValue);
    const doc = iframeRef.current?.contentDocument;
    const canvasRoot = (doc?.getElementById('canvas') || doc?.body) as HTMLElement | null;
    if (!canvasRoot) return;
    canvasRoot.style.background = bgValue;
    serializeIframeBackToHtml();
  };

  const handleAddTextLayer = () => {
    const doc = iframeRef.current?.contentDocument;
    const canvasRoot = (doc?.getElementById('canvas') || doc?.body) as HTMLElement | null;
    if (!doc || !canvasRoot) return;
    const node = doc.createElement('div');
    node.innerText = 'Editable Text Layer';
    node.style.position = 'absolute';
    node.style.left = `${Math.round(canvasW * 0.12)}px`;
    node.style.top = `${Math.round(canvasH * 0.14)}px`;
    node.style.fontFamily = 'Poppins, sans-serif';
    node.style.fontWeight = '800';
    node.style.fontSize = `${Math.round(Math.max(36, canvasW * 0.045))}px`;
    node.style.color = '#ffffff';
    node.style.padding = '8px 16px';
    node.style.borderRadius = '10px';
    node.style.zIndex = '50';
    canvasRoot.appendChild(node);
    selectEditorElement(node);
    serializeIframeBackToHtml();
  };

  const handleDeleteSelectedLayer = () => {
    const el = selectedElRef.current;
    if (!el || el.id === 'canvas') return;
    el.remove();
    selectedElRef.current = null;
    setSelectedMeta(null);
    serializeIframeBackToHtml();
  };

  const handleResetDesign = () => {
    selectedElRef.current = null;
    setSelectedMeta(null);
    setEditedHtml(htmlCode);
  };

  const handleDownloadPng = async () => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) {
      setExportNotice('Canvas is still loading. Please wait a second and try again.');
      return;
    }
    const targetEl = (iframeDoc.getElementById('canvas') || iframeDoc.body) as HTMLElement;
    if (!targetEl) return;

    setExportingPng(true);
    setExportNotice('');

    const prevOutline = selectedElRef.current?.style.outline || '';
    if (selectedElRef.current) {
      selectedElRef.current.style.outline = '';
    }

    const restoredImgs: Array<{ img: HTMLImageElement; origSrc: string }> = [];
    try {
      const imgs = Array.from(targetEl.querySelectorAll('img'));
      await Promise.all(
        imgs.map(async (img) => {
          const origSrc = img.getAttribute('src') || '';
          if (/^https?:\/\//i.test(origSrc)) {
            restoredImgs.push({ img, origSrc });
            await new Promise<void>((resolve) => {
              const cleanup = () => resolve();
              img.addEventListener('load', cleanup, { once: true });
              img.addEventListener('error', cleanup, { once: true });
              img.crossOrigin = 'anonymous';
              img.src = `/api/image-proxy?url=${encodeURIComponent(origSrc)}`;
              setTimeout(cleanup, 2500);
            });
          }
        })
      );

      if (iframeDoc.fonts?.ready) {
        await Promise.race([iframeDoc.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
      }

      const renderedCanvas = await html2canvas(targetEl, {
        width: canvasW,
        height: canvasH,
        scale: 1,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        windowWidth: canvasW,
        windowHeight: canvasH,
        logging: false,
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        renderedCanvas.toBlob((b) => resolve(b), 'image/png')
      );
      const outName = `${fileName.replace(/\.html?$/i, '') || 'studio-design'}_${canvasW}x${canvasH}.png`;

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = outName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else {
        const dataUrl = renderedCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = outName;
        a.click();
      }
    } catch (err) {
      console.warn('PNG export notice:', err);
      setExportNotice('Could not export PNG from cross-origin assets. Try switching photo or Reset.');
    } finally {
      for (const { img, origSrc } of restoredImgs) {
        img.src = origSrc;
      }
      if (selectedElRef.current) {
        selectedElRef.current.style.outline = prevOutline;
      }
      setExportingPng(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-white border border-zinc-200 overflow-hidden text-zinc-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 bg-[#F4F8FC]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0A2A66] text-white flex items-center justify-center shrink-0">
            <ImageIcon size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-[#0A2A66] truncate">
              Creative Studio Image
            </div>
            <div className="text-[11px] font-semibold text-zinc-500 tabular-nums">
              {canvasW} × {canvasH} px · PNG Ready
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {!isStreaming && (
            <>
              <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 mr-1">
                <button
                  type="button"
                  onClick={() => setTab('preview')}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    tab === 'preview' ? 'bg-[#0A2A66] text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Eye size={12} />
                  <span>Canvas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('edit')}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    tab === 'edit' ? 'bg-[#0A2A66] text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Sliders size={12} />
                  <span>Edit &amp; Drag</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={exportingPng || subjectLoading}
                className="min-h-[36px] px-3 rounded-lg bg-[#0A2A66] hover:bg-[#1450C8] disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {exportingPng ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                <span>Download PNG</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Auto Subject Photo Switcher & Cutout Toggle Bar */}
      {!isStreaming && (subjectSlotMeta || subjectCandidates.length > 0 || subjectLoading) && (
        <div className="px-4 py-2 border-b border-zinc-200 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-zinc-700 font-semibold min-w-0">
            {subjectLoading ? (
              <Loader2 size={14} className="animate-spin text-[#00A6FF] shrink-0" />
            ) : (
              <Scissors size={14} className="text-[#0A2A66] shrink-0" />
            )}
            <span className="truncate">
              Subject: <strong className="text-[#0A2A66]">{subjectSlotMeta?.query}</strong>
              {subjectStatusText ? ` · ${subjectStatusText}` : ''}
            </span>
          </div>

          {subjectCandidates.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center rounded-lg border border-zinc-200 bg-[#F4F8FC] overflow-hidden">
                <button
                  type="button"
                  disabled={subjectLoading}
                  onClick={() =>
                    setActiveSubjectIdx(
                      (prev) => (prev - 1 + subjectCandidates.length) % subjectCandidates.length
                    )
                  }
                  className="px-2 py-1 hover:bg-zinc-200/70 disabled:opacity-40 text-zinc-700 cursor-pointer"
                  title="Previous Photo"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 text-[11px] font-bold text-[#0A2A66] tabular-nums">
                  Photo {activeSubjectIdx + 1} / {subjectCandidates.length}
                </span>
                <button
                  type="button"
                  disabled={subjectLoading}
                  onClick={() => setActiveSubjectIdx((prev) => (prev + 1) % subjectCandidates.length)}
                  className="px-2 py-1 hover:bg-zinc-200/70 disabled:opacity-40 text-zinc-700 cursor-pointer"
                  title="Next Photo"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <button
                type="button"
                disabled={subjectLoading}
                onClick={() => setCutoutEnabled((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  cutoutEnabled
                    ? 'bg-[#0A2A66] text-white border-[#0A2A66]'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:border-[#00A6FF]'
                }`}
              >
                <Scissors size={11} />
                <span>{cutoutEnabled ? 'Cutout On' : 'Original Photo'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {isStreaming ? (
        <div className="p-5 flex items-center gap-2.5 text-xs font-bold text-[#0A2A66] bg-white">
          <Loader2 size={15} className="animate-spin text-[#00A6FF]" />
          <span>Composing studio artwork ({canvasW}×{canvasH})...</span>
        </div>
      ) : (
        <div className="bg-[#F4F8FC]">
          <div className="p-3 sm:p-4 flex justify-center">
            <div
              ref={stageWrapRef}
              className={`w-full max-w-full overflow-hidden rounded-xl border bg-zinc-950 relative ${
                tab === 'edit' ? 'border-[#00A6FF] ring-2 ring-[#00A6FF]/20' : 'border-zinc-200'
              }`}
              style={{ height: `${scaledHeight}px` }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={srcDoc}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => attachInteractiveEditorHandlers()}
                title="Creative Studio Image Canvas"
                style={{
                  width: `${canvasW}px`,
                  height: `${canvasH}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  border: '0',
                  display: 'block',
                  pointerEvents: tab === 'edit' ? 'auto' : 'none',
                }}
              />
            </div>
          </div>

          {exportNotice && (
            <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
              {exportNotice}
            </div>
          )}

          {/* Interactive Canvas Style, Drag, Resize & Element Inspector */}
          {tab === 'edit' && (
            <div className="mx-3 sm:mx-4 mb-4 p-3.5 rounded-xl bg-white border border-zinc-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-extrabold text-[#0A2A66] uppercase tracking-wide">
                    Canvas Style
                  </span>
                  <div className="flex items-center gap-1">
                    {CANVAS_BG_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleApplyCanvasBackground(preset.value)}
                        title={preset.label}
                        className="w-6 h-6 rounded-md border border-zinc-300 cursor-pointer hover:scale-110 transition-transform"
                        style={{ background: preset.value }}
                      />
                    ))}
                    <input
                      type="color"
                      value={canvasBg.startsWith('#') ? canvasBg : '#0b1020'}
                      onChange={(e) => handleApplyCanvasBackground(e.target.value)}
                      className="w-6 h-6 p-0 border border-zinc-300 rounded cursor-pointer"
                      title="Custom Canvas Color"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddTextLayer}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:border-[#00A6FF] text-[11px] font-bold text-[#0A2A66] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDesign}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:border-zinc-400 text-[11px] font-bold text-zinc-700 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {selectedMeta ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {selectedMeta.hasText && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                          Selected Text ({selectedMeta.tagName})
                        </label>
                        <input
                          type="text"
                          value={selectedMeta.text}
                          onChange={(e) => updateSelectedElement({ text: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-none focus:border-[#00A6FF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                          Font Family
                        </label>
                        <select
                          value={
                            FONT_OPTIONS.find((f) =>
                              selectedMeta.fontFamily.toLowerCase().includes(f.label.split(' ')[0].toLowerCase())
                            )?.value || FONT_OPTIONS[0].value
                          }
                          onChange={(e) => updateSelectedElement({ fontFamily: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-900 bg-white focus:outline-none focus:border-[#00A6FF]"
                        >
                          {FONT_OPTIONS.map((f) => (
                            <option key={f.label} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                          Size &amp; Weight
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={10}
                            max={260}
                            value={selectedMeta.fontSize}
                            onChange={(e) =>
                              updateSelectedElement({ fontSize: parseInt(e.target.value || '24', 10) })
                            }
                            className="w-16 px-2 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => updateSelectedElement({ isBold: !selectedMeta.isBold })}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold cursor-pointer ${
                              selectedMeta.isBold
                                ? 'bg-[#0A2A66] text-white border-[#0A2A66]'
                                : 'bg-white text-zinc-700 border-zinc-200'
                            }`}
                          >
                            B
                          </button>
                          <div className="flex items-center rounded-lg border border-zinc-200 overflow-hidden">
                            {(['left', 'center', 'right'] as const).map((al) => (
                              <button
                                key={al}
                                type="button"
                                onClick={() => updateSelectedElement({ textAlign: al })}
                                className={`p-1.5 cursor-pointer ${
                                  selectedMeta.textAlign === al
                                    ? 'bg-[#0A2A66] text-white'
                                    : 'bg-white text-zinc-600'
                                }`}
                              >
                                {al === 'left' ? (
                                  <AlignLeft size={12} />
                                ) : al === 'center' ? (
                                  <AlignCenter size={12} />
                                ) : (
                                  <AlignRight size={12} />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                          Colors (Text / Fill)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={selectedMeta.color}
                            onChange={(e) => updateSelectedElement({ color: e.target.value })}
                            className="w-8 h-8 p-0 border border-zinc-200 rounded cursor-pointer"
                            title="Text Color"
                          />
                          <input
                            type="color"
                            value={selectedMeta.bgColor}
                            onChange={(e) =>
                              updateSelectedElement({ bgColor: e.target.value, hasBg: true })
                            }
                            className="w-8 h-8 p-0 border border-zinc-200 rounded cursor-pointer"
                            title="Fill Background Color"
                          />
                          {selectedMeta.hasBg && (
                            <button
                              type="button"
                              onClick={() => updateSelectedElement({ hasBg: false })}
                              className="px-2 py-1 rounded border border-zinc-200 text-[10px] font-bold text-zinc-600 cursor-pointer"
                            >
                              No Fill
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {selectedMeta.isSubjectOrMedia && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                          Element Size (Width × Height px)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={40}
                            max={2000}
                            value={selectedMeta.width}
                            onChange={(e) =>
                              updateSelectedElement({ width: parseInt(e.target.value || '240', 10) })
                            }
                            className="w-20 px-2 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold tabular-nums"
                            aria-label="Width"
                          />
                          <span className="text-xs text-zinc-400">×</span>
                          <input
                            type="number"
                            min={40}
                            max={2000}
                            value={selectedMeta.height}
                            onChange={(e) =>
                              updateSelectedElement({ height: parseInt(e.target.value || '240', 10) })
                            }
                            className="w-20 px-2 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold tabular-nums"
                            aria-label="Height"
                          />
                          <button
                            type="button"
                            onClick={() => updateSelectedElement({ flipped: !selectedMeta.flipped })}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                              selectedMeta.flipped
                                ? 'bg-[#0A2A66] text-white border-[#0A2A66]'
                                : 'bg-white text-zinc-700 border-zinc-200'
                            }`}
                            title="Flip Horizontally"
                          >
                            <FlipHorizontal size={12} />
                            <span>Flip</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                      Position &amp; Layer Order (Drag or X / Y px)
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <input
                        type="number"
                        value={selectedMeta.x}
                        onChange={(e) =>
                          updateSelectedElement({ x: parseInt(e.target.value || '0', 10) })
                        }
                        className="w-16 px-2 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold tabular-nums"
                        aria-label="X offset"
                      />
                      <input
                        type="number"
                        value={selectedMeta.y}
                        onChange={(e) =>
                          updateSelectedElement({ y: parseInt(e.target.value || '0', 10) })
                        }
                        className="w-16 px-2 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold tabular-nums"
                        aria-label="Y offset"
                      />
                      <button
                        type="button"
                        onClick={() => updateSelectedElement({ zIndex: selectedMeta.zIndex + 5 })}
                        className="px-2 py-1.5 rounded-lg border border-zinc-200 hover:border-[#00A6FF] text-[11px] font-bold text-zinc-700 flex items-center gap-1 cursor-pointer"
                        title="Bring Forward"
                      >
                        <ArrowUp size={12} />
                        <span>Front</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedElement({ zIndex: Math.max(1, selectedMeta.zIndex - 5) })}
                        className="px-2 py-1.5 rounded-lg border border-zinc-200 hover:border-[#00A6FF] text-[11px] font-bold text-zinc-700 flex items-center gap-1 cursor-pointer"
                        title="Send Backward"
                      >
                        <ArrowDown size={12} />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelectedLayer}
                        className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Delete Element"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 py-1">
                  <Move size={14} className="text-[#00A6FF] shrink-0" />
                  <span>
                    Click any photo cutout, text headline, or shape on the canvas above to drag, resize, layer, or customize style &amp; colors.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export interface StudioVideoPlayerCardProps {
  htmlCode: string;
  videoPlan: VideoPlan;
  uploadsMap?: Record<string, string>;
  userVoiceover?: { url: string; name: string } | null;
  isStreaming?: boolean;
  onOpenFullScreenEditor?: (code: string, fileName?: string, lang?: string) => void;
  onTimingDriftReport?: (reportJson: string) => void;
}

export const StudioVideoPlayerCard: React.FC<StudioVideoPlayerCardProps> = ({
  htmlCode,
  videoPlan,
  uploadsMap = {},
  userVoiceover = null,
  isStreaming = false,
  onTimingDriftReport,
}) => {
  const [containerWidth, setContainerWidth] = useState(640);
  const [voBlobUrl, setVoBlobUrl] = useState<string>(userVoiceover?.url || '');
  const [voLabel, setVoLabel] = useState<string>(userVoiceover?.name || '');
  const [isRecordingVo, setIsRecordingVo] = useState<boolean>(false);
  const [musicMood, setMusicMood] = useState<SynthMusicMood>('ambient');
  const [musicVolume, setMusicVolume] = useState<number>(0.36);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(true);
  const [isScriptOpen, setIsScriptOpen] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const [segmentTimings, setSegmentTimings] = useState<
    Array<{ scene: string; start: number; end: number; actual: number }>
  >([]);
  const [actualTotalDuration, setActualTotalDuration] = useState<number>(videoPlan.duration || 20);
  const [driftDetected, setDriftDetected] = useState<boolean>(false);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voUploadInputRef = useRef<HTMLInputElement | null>(null);
  const voRecorderRef = useRef<MediaRecorder | null>(null);
  const voChunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const playStartPerfRef = useRef<number>(0);
  const playOffsetRef = useRef<number>(0);
  const playingRef = useRef<boolean>(false);

  const musicEngineRef = useRef<StudioSynthMusicEngine>(new StudioSynthMusicEngine());
  const textSfxEngineRef = useRef<StudioTextSfxEngine>(new StudioTextSfxEngine());
  const liveSfxCtxRef = useRef<AudioContext | null>(null);
  const firedCueIdsRef = useRef<Set<string>>(new Set());
  const prevTickTimeRef = useRef<number>(0);

  const [canvasW, canvasH] = useMemo(() => {
    if (Array.isArray(videoPlan.size) && videoPlan.size.length === 2) {
      return [Number(videoPlan.size[0]) || 1280, Number(videoPlan.size[1]) || 720];
    }
    return videoPlan.aspect === '9:16' ? [1080, 1920] : [1280, 720];
  }, [videoPlan]);

  const effectiveDuration = Math.min(120, Math.max(3, actualTotalDuration || videoPlan.duration || 20));
  const duckedMusicGain = voBlobUrl ? musicVolume * 0.42 : musicVolume;

  const sfxCues = useMemo(
    () => buildTextSfxCues(videoPlan, effectiveDuration),
    [videoPlan, effectiveDuration]
  );

  const formattedScriptText = useMemo(() => {
    const scenes = Array.isArray(videoPlan.scenes) ? videoPlan.scenes : [];
    const lines = scenes
      .map((sc, i) => {
        const nar = (sc.narration || '').trim();
        if (!nar) return '';
        return `[${formatClock(sc.start)} - ${formatClock(sc.end)}] Scene ${i + 1}: ${nar}`;
      })
      .filter(Boolean);
    return lines.join('\n\n') || `Title: ${videoPlan.title || 'Motion Graphic Video'}`;
  }, [videoPlan]);

  useEffect(() => {
    if (userVoiceover?.url && !voBlobUrl) {
      setVoBlobUrl(userVoiceover.url);
      setVoLabel(userVoiceover.name || 'User Voiceover');
    }
  }, [userVoiceover?.url, userVoiceover?.name]);

  useEffect(() => {
    musicEngineRef.current.setVolume(duckedMusicGain, isMuted);
  }, [duckedMusicGain, isMuted]);

  const syncDurationFromUserAudio = (audioDur: number) => {
    if (!Number.isFinite(audioDur) || audioDur <= 0.5) return;
    const clampedDur = Math.min(120, Number(audioDur.toFixed(2)));
    setActualTotalDuration(clampedDur);
    const plannedTotal = Math.max(1, Number(videoPlan.duration) || 20);
    if (
      Math.abs(clampedDur - plannedTotal) > 1.5 &&
      Array.isArray(videoPlan.scenes) &&
      videoPlan.scenes.length > 0
    ) {
      const ratio = clampedDur / plannedTotal;
      const computedTimings = videoPlan.scenes.map((sc) => {
        const start = Number((sc.start * ratio).toFixed(2));
        const end = Number((sc.end * ratio).toFixed(2));
        return {
          scene: sc.id,
          start,
          end,
          actual: Number(Math.max(0.5, end - start).toFixed(2)),
        };
      });
      setSegmentTimings(computedTimings);
      setDriftDetected(true);
    } else {
      setDriftDetected(false);
    }
  };

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    musicEngineRef.current.stop();
    if (liveSfxCtxRef.current) {
      liveSfxCtxRef.current.close().catch(() => {});
      liveSfxCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) audioRef.current.pause();
      musicEngineRef.current.stop();
      if (liveSfxCtxRef.current) liveSfxCtxRef.current.close().catch(() => {});
    };
  }, []);

  const handleUploadUserVoiceover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stopPlayback();
    const url = URL.createObjectURL(file);
    setVoBlobUrl(url);
    setVoLabel(file.name);
    setCurrentTime(0);
  };

  const handleToggleRecordVoiceover = async () => {
    if (isRecordingVo && voRecorderRef.current) {
      try {
        voRecorderRef.current.stop();
      } catch {}
      setIsRecordingVo(false);
      return;
    }
    try {
      stopPlayback();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      voChunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) voChunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(voChunksRef.current, { type: 'audio/webm' });
        if (blob.size > 200) {
          const url = URL.createObjectURL(blob);
          setVoBlobUrl(url);
          setVoLabel('Recorded Voiceover');
          setCurrentTime(0);
        }
        setIsRecordingVo(false);
      };
      rec.start(200);
      voRecorderRef.current = rec;
      setIsRecordingVo(true);
    } catch {
      setIsRecordingVo(false);
    }
  };

  const handleClearVoiceover = () => {
    stopPlayback();
    setVoBlobUrl('');
    setVoLabel('');
    setActualTotalDuration(videoPlan.duration || 20);
    setDriftDetected(false);
    setSegmentTimings([]);
    setCurrentTime(0);
  };

  const resolvedHtml = useMemo(
    () => resolveStudioPlaceholders(htmlCode, uploadsMap, voBlobUrl || ''),
    [htmlCode, uploadsMap, voBlobUrl]
  );

  const srcDoc = useMemo(
    () => prepareStudioSrcDoc(resolvedHtml, canvasW, canvasH),
    [resolvedHtml, canvasW, canvasH]
  );

  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 60) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(1, containerWidth / canvasW);
  const scaledHeight = Math.max(200, Math.round(canvasH * scale));

  const seekIframeTo = async (t: number) => {
    const win = iframeRef.current?.contentWindow as any;
    if (!win) return;
    try {
      const voInIframe = iframeRef.current?.contentDocument?.getElementById('vo') as HTMLAudioElement | null;
      if (voInIframe) {
        voInIframe.muted = true;
      }
      if (win.VIDEO) {
        if (win.VIDEO.ready && typeof win.VIDEO.ready.then === 'function') {
          await win.VIDEO.ready;
        }
        if (typeof win.VIDEO.seek === 'function') {
          win.VIDEO.seek(t);
        }
      }
    } catch {}
  };

  const triggerCuesBetween = (
    prevT: number,
    currT: number,
    firedSet: Set<string>,
    ctx: AudioContext | null,
    dest?: AudioNode
  ) => {
    if (!ctx || isMuted || !sfxEnabled) return;
    for (const cue of sfxCues) {
      if (!firedSet.has(cue.id) && cue.time >= prevT - 0.04 && cue.time <= currT + 0.04) {
        firedSet.add(cue.id);
        if (cue.kind === 'appear') {
          textSfxEngineRef.current.playAppear(ctx, 0.28, dest);
        } else {
          textSfxEngineRef.current.playDisappear(ctx, 0.22, dest);
        }
      }
    }
  };

  const handleTogglePlay = async () => {
    if (playingRef.current) {
      stopPlayback();
      return;
    }

    const startOffset = currentTime >= effectiveDuration - 0.15 ? 0 : currentTime;
    playOffsetRef.current = startOffset;
    playStartPerfRef.current = performance.now();
    playingRef.current = true;
    setIsPlaying(true);

    firedCueIdsRef.current.clear();
    prevTickTimeRef.current = Math.max(0, startOffset - 0.05);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const sharedCtx = new AudioCtx();
      if (sharedCtx.state === 'suspended') {
        await sharedCtx.resume().catch(() => {});
      }
      liveSfxCtxRef.current = sharedCtx;
      musicEngineRef.current.start(musicMood, duckedMusicGain, isMuted, sharedCtx);
    } catch {
      musicEngineRef.current.start(musicMood, duckedMusicGain, isMuted);
    }

    if (audioRef.current && voBlobUrl) {
      try {
        audioRef.current.muted = isMuted;
        audioRef.current.currentTime = Math.min(startOffset, audioRef.current.duration || startOffset);
        await audioRef.current.play();
      } catch {}
    }

    const tick = () => {
      if (!playingRef.current) return;
      const elapsed =
        audioRef.current && voBlobUrl && !audioRef.current.paused && Number.isFinite(audioRef.current.currentTime)
          ? audioRef.current.currentTime
          : playOffsetRef.current + (performance.now() - playStartPerfRef.current) / 1000;

      triggerCuesBetween(
        prevTickTimeRef.current,
        elapsed,
        firedCueIdsRef.current,
        liveSfxCtxRef.current
      );
      prevTickTimeRef.current = elapsed;

      if (elapsed >= effectiveDuration) {
        setCurrentTime(effectiveDuration);
        seekIframeTo(effectiveDuration);
        stopPlayback();
        return;
      }

      setCurrentTime(elapsed);
      seekIframeTo(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const handleScrub = (nextTime: number) => {
    setCurrentTime(nextTime);
    playOffsetRef.current = nextTime;
    playStartPerfRef.current = performance.now();
    prevTickTimeRef.current = nextTime;
    firedCueIdsRef.current.clear();
    if (audioRef.current && voBlobUrl && Number.isFinite(audioRef.current.duration)) {
      try {
        audioRef.current.currentTime = Math.min(nextTime, audioRef.current.duration);
      } catch {}
    }
    seekIframeTo(nextTime);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
    musicEngineRef.current.setVolume(duckedMusicGain, next);
  };

  const handleChangeMusicMood = (nextMood: SynthMusicMood) => {
    setMusicMood(nextMood);
    if (playingRef.current) {
      musicEngineRef.current.start(
        nextMood,
        duckedMusicGain,
        isMuted,
        liveSfxCtxRef.current || undefined
      );
    }
  };

  const handleExportWebM = async () => {
    const iframeDoc = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow as any;
    const stageCanvas = iframeDoc?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!stageCanvas || typeof stageCanvas.captureStream !== 'function') {
      return;
    }

    stopPlayback();
    setExportProgress(1);

    const exportMusic = new StudioSynthMusicEngine();
    const exportFiredCues = new Set<string>();
    let exportAudio: HTMLAudioElement | null = null;
    let audioCtx: AudioContext | null = null;

    try {
      if (win?.VIDEO?.ready) await win.VIDEO.ready;
      const videoStream = stageCanvas.captureStream(videoPlan.fps || 30);
      const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      const shouldMixAudio = musicMood !== 'off' || sfxEnabled || Boolean(voBlobUrl);
      let destNode: MediaStreamAudioDestinationNode | undefined = undefined;

      if (shouldMixAudio) {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          audioCtx = new AudioCtx();
          destNode = audioCtx.createMediaStreamDestination();

          if (musicMood !== 'off') {
            exportMusic.start(musicMood, duckedMusicGain, false, audioCtx, destNode);
          }

          if (voBlobUrl) {
            exportAudio = new Audio(voBlobUrl);
            const srcNode = audioCtx.createMediaElementSource(exportAudio);
            srcNode.connect(destNode);
            srcNode.connect(audioCtx.destination);
          }

          destNode.stream.getAudioTracks().forEach((tr) => tracks.push(tr));
        } catch {}
      }

      const mixed = new MediaStream(tracks);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(mixed, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const donePromise = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start(250);
      if (exportAudio) {
        exportAudio.currentTime = 0;
        exportAudio.play().catch(() => {});
      }

      const startMs = performance.now();
      let prevExportT = -0.05;
      while (true) {
        const elapsed = (performance.now() - startMs) / 1000;
        if (elapsed >= effectiveDuration) break;

        if (audioCtx && destNode && sfxEnabled) {
          for (const cue of sfxCues) {
            if (!exportFiredCues.has(cue.id) && cue.time >= prevExportT - 0.04 && cue.time <= elapsed + 0.04) {
              exportFiredCues.add(cue.id);
              if (cue.kind === 'appear') {
                textSfxEngineRef.current.playAppear(audioCtx, 0.28, destNode);
              } else {
                textSfxEngineRef.current.playDisappear(audioCtx, 0.22, destNode);
              }
            }
          }
        }
        prevExportT = elapsed;

        if (win?.VIDEO?.seek) win.VIDEO.seek(elapsed);
        setCurrentTime(elapsed);
        setExportProgress(Math.min(99, Math.round((elapsed / effectiveDuration) * 100)));
        await new Promise((r) => setTimeout(r, 33));
      }

      recorder.stop();
      await donePromise;

      const webmBlob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(webmBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(videoPlan.title || 'studio-video').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.warn('WebM export failed:', err);
    } finally {
      exportMusic.stop();
      if (exportAudio) exportAudio.pause();
      if (audioCtx) audioCtx.close().catch(() => {});
      setExportProgress(null);
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-white border border-zinc-200 overflow-hidden text-zinc-900">
      {voBlobUrl && (
        <audio
          ref={audioRef}
          src={voBlobUrl}
          preload="auto"
          className="hidden"
          onLoadedMetadata={(e) => {
            syncDurationFromUserAudio((e.currentTarget as HTMLAudioElement).duration);
          }}
          onEnded={() => {
            stopPlayback();
            setCurrentTime(effectiveDuration);
          }}
        />
      )}

      <input
        ref={voUploadInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
        onChange={handleUploadUserVoiceover}
        className="hidden"
      />

      {/* Clean Video-Only Header (Zero Scenes/Code clutter) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 bg-[#F4F8FC]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0A2A66] text-white flex items-center justify-center shrink-0">
            <Film size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-[#0A2A66] truncate">
              {videoPlan.title || 'Motion Graphic Video'}
            </div>
            <div className="text-[11px] font-semibold text-zinc-500 tabular-nums">
              {videoPlan.style} · {videoPlan.aspect} · {formatClock(effectiveDuration)} ·{' '}
              {musicMood !== 'off' ? MUSIC_MOOD_LABELS[musicMood] : 'Music Off'}
              {sfxEnabled ? ' + Text SFX' : ''}
              {voBlobUrl ? ` + ${voLabel || 'Voiceover'}` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {!isStreaming && (
            <button
              type="button"
              onClick={handleExportWebM}
              disabled={exportProgress !== null}
              className="min-h-[36px] px-3.5 rounded-lg bg-[#0A2A66] hover:bg-[#1450C8] disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors tabular-nums"
            >
              {exportProgress !== null ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Rendering {exportProgress}%</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>Download Video (.webm)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Drift Warning Bar */}
      {driftDetected && onTimingDriftReport && segmentTimings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-amber-900">
            Voiceover duration ({actualTotalDuration.toFixed(1)}s) differs slightly from video timing.
          </span>
          <button
            type="button"
            onClick={() =>
              onTimingDriftReport(
                JSON.stringify({
                  timing_report: {
                    segments: segmentTimings,
                    total: actualTotalDuration,
                  },
                })
              )
            }
            className="px-2.5 py-1 rounded-md bg-amber-900 text-white font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RefreshCw size={11} />
            <span>Re-sync Timing</span>
          </button>
        </div>
      )}

      {/* Body */}
      {isStreaming ? (
        <div className="p-5 flex items-center gap-2.5 text-xs font-bold text-[#0A2A66] bg-white">
          <Loader2 size={15} className="animate-spin text-[#00A6FF]" />
          <span>Generating downloadable video &amp; script ({videoPlan.scenes.length} scenes)...</span>
        </div>
      ) : (
        <div className="p-3 sm:p-4 bg-[#F4F8FC] space-y-3">
          <div className="flex justify-center">
            <div
              ref={stageWrapRef}
              className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 relative"
              style={{
                maxWidth: videoPlan.aspect === '9:16' ? '340px' : '100%',
                height: `${scaledHeight}px`,
              }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={srcDoc}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => seekIframeTo(0)}
                title="Creative Studio Video Stage"
                style={{
                  width: `${canvasW}px`,
                  height: `${canvasH}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  border: '0',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-zinc-200">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-[#0A2A66] hover:bg-[#1450C8] text-white flex items-center justify-center cursor-pointer shrink-0"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="fill-current ml-0.5" />}
            </button>

            <input
              type="range"
              min={0}
              max={effectiveDuration}
              step={0.05}
              value={Math.min(currentTime, effectiveDuration)}
              onChange={(e) => handleScrub(parseFloat(e.target.value))}
              className="flex-1 accent-[#00A6FF] cursor-pointer"
              aria-label="Video timeline"
            />

            <span className="text-xs font-bold text-[#0A2A66] tabular-nums shrink-0">
              {formatClock(currentTime)} / {formatClock(effectiveDuration)}
            </span>

            <button
              type="button"
              onClick={handleToggleMute}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-zinc-200 hover:border-[#00A6FF] text-zinc-700 flex items-center justify-center cursor-pointer shrink-0"
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>

          {/* Built-in Web Audio Synth Music + Text SFX + Optional User Voiceover Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-zinc-200">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0A2A66]">
                <Music size={14} className="text-[#00A6FF]" />
                <span>Audio:</span>
              </div>
              <select
                value={musicMood}
                onChange={(e) => handleChangeMusicMood(e.target.value as SynthMusicMood)}
                className="px-2 py-1 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-800 focus:outline-none focus:border-[#00A6FF] cursor-pointer"
              >
                {(Object.keys(MUSIC_MOOD_LABELS) as SynthMusicMood[]).map((m) => (
                  <option key={m} value={m}>
                    {MUSIC_MOOD_LABELS[m]}
                  </option>
                ))}
              </select>

              {musicMood !== 'off' && (
                <input
                  type="range"
                  min={0.05}
                  max={0.85}
                  step={0.05}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  className="w-16 accent-[#0A2A66] cursor-pointer"
                  title="Music Volume"
                  aria-label="Synth music volume"
                />
              )}

              <button
                type="button"
                onClick={() => setSfxEnabled((s) => !s)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  sfxEnabled
                    ? 'bg-[#0A2A66] text-white border-[#0A2A66]'
                    : 'bg-white text-zinc-600 border-zinc-200'
                }`}
                title="Toggle sound effects when text appears and disappears"
              >
                <Sparkles size={11} />
                <span>{sfxEnabled ? 'Text SFX On' : 'Text SFX Off'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => voUploadInputRef.current?.click()}
                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-zinc-200 hover:border-[#00A6FF] bg-white text-[#0A2A66] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload size={12} />
                <span>{voBlobUrl ? `VO: ${voLabel || 'Loaded'}` : 'Upload Voiceover'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleRecordVoiceover}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isRecordingVo
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'border border-zinc-200 hover:border-[#00A6FF] bg-white text-[#0A2A66]'
                }`}
              >
                {isRecordingVo ? <Square size={11} className="fill-current" /> : <Mic size={12} />}
                <span>{isRecordingVo ? 'Stop Rec' : 'Record VO'}</span>
              </button>

              {voBlobUrl && (
                <button
                  type="button"
                  onClick={handleClearVoiceover}
                  className="min-h-[34px] px-2 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Remove voiceover"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Expandable Spoken Script Panel Right Below Video Player */}
          <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-white">
              <button
                type="button"
                onClick={() => setIsScriptOpen((o) => !o)}
                className="flex items-center gap-2 text-xs font-extrabold text-[#0A2A66] cursor-pointer"
              >
                <FileText size={14} className="text-[#00A6FF]" />
                <span>Spoken Voiceover Script ({videoPlan.scenes.length} lines)</span>
                {isScriptOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(formattedScriptText);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 1800);
                }}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 hover:border-[#00A6FF] text-[11px] font-bold text-[#0A2A66] flex items-center gap-1 cursor-pointer"
              >
                {copiedScript ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>Copied Script</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Script</span>
                  </>
                )}
              </button>
            </div>

            {isScriptOpen && (
              <div className="px-3.5 pb-3.5 pt-1 border-t border-zinc-100 space-y-2 max-h-64 overflow-y-auto">
                <p className="text-[11px] font-medium text-zinc-500">
                  Read along with timestamps using Record VO above or paste into your voiceover workflow. Click any line to preview that moment.
                </p>
                {videoPlan.scenes.map((sc, idx) => (
                  <div
                    key={sc.id || idx}
                    onClick={() => handleScrub(sc.start)}
                    className="p-2.5 rounded-lg border border-zinc-200 hover:border-[#00A6FF] bg-[#F4F8FC]/60 cursor-pointer flex items-start gap-2.5 transition-colors"
                  >
                    <span className="px-2 py-0.5 rounded bg-[#0A2A66] text-white text-[10px] font-bold tabular-nums shrink-0 mt-0.5">
                      {formatClock(sc.start)}–{formatClock(sc.end)}
                    </span>
                    <p className="text-xs font-semibold text-zinc-800 leading-relaxed select-text">
                      {sc.narration || `Scene ${idx + 1} visual transition`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const StudioToolBadge: React.FC<{ toolCall: StudioToolCall; statusText?: string }> = ({
  toolCall,
  statusText,
}) => {
  const label =
    toolCall.tool === 'remove_background'
      ? `Background Cutout (${toolCall.upload_id || 'image'})`
      : toolCall.tool === 'save_template'
      ? `Saving Custom Template (${toolCall.template?.name || toolCall.template?.id || 'template'})`
      : 'Listing Studio Templates';

  return (
    <div className="my-2 px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] border border-[#00A6FF]/35 text-xs font-bold text-[#0A2A66] flex items-center gap-2.5">
      <Wand2 size={15} className="text-[#00A6FF] shrink-0" />
      <span>{statusText || label}</span>
    </div>
  );
};
