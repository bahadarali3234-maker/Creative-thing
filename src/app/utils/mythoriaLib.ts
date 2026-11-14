import {
  saveCustomTemplateToFirestore,
  deleteCustomTemplateFromFirestore,
} from '../firebase';

export interface StudioPalette {
  id: string;
  name: string;
  colors: string[];
}

export interface StudioFont {
  id: string;
  use: string;
  weights: number[];
}

export interface StudioVoiceSpec {
  id: string;
  geminiVoiceId: string;
  prebuiltVoice: 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';
  gender: 'female' | 'male';
  tone: string;
  best: string;
}

export interface StudioTemplateShape {
  type: 'circle' | 'bar' | 'rect';
  x: number;
  y: number;
  r?: number;
  w?: number;
  h?: number;
  color: string;
  opacity?: number;
  blur?: number;
}

export interface ThumbnailTemplate {
  id: string;
  kind: 'thumbnail';
  name: string;
  category: string[];
  aspect?: [number, number];
  size: [number, number];
  background: {
    type: 'gradient' | 'solid';
    angle?: number;
    colors: string[];
  };
  shapes?: StudioTemplateShape[];
  text?: {
    title?: {
      font: string;
      weight: number;
      size: number;
      color: string;
      stroke?: { color: string; width: number };
      align?: CanvasTextAlign;
      x: number;
      y: number;
      maxWidth?: number;
      uppercase?: boolean;
    };
    subtitle?: {
      font: string;
      weight: number;
      size: number;
      color: string;
      x: number;
      y: number;
    };
    badge?: {
      text: string;
      bg: string;
      color: string;
      x: number;
      y: number;
    };
  };
  image_slot?: {
    x: number;
    y: number;
    w: number;
    h: number;
    fit: string;
    outline?: string;
    shadow?: boolean;
  };
  custom?: boolean;
}

export interface ImageFormatTemplate {
  id: string;
  kind: 'image';
  name: string;
  category: string[];
  size: [number, number];
  note: string;
  custom?: boolean;
}

export interface VideoTemplate {
  id: string;
  kind: 'video';
  name: string;
  style: 'documentary' | 'motion-graphic';
  duration: number;
  aspect: string;
  palette: string;
  font: string;
  voice: string;
  transition: string;
  captions: boolean;
  scenes: Array<[string, number, string]>;
  custom?: boolean;
}

export type AnyStudioTemplate = ThumbnailTemplate | ImageFormatTemplate | VideoTemplate;

export interface VideoPlanScene {
  id: string;
  start: number;
  end: number;
  narration?: string;
  visual?: {
    type?: string;
    content?: Record<string, any>;
    animation?: string;
  };
  transition?: {
    type?: string;
    duration?: number;
  };
}

export interface VideoPlan {
  title: string;
  style: string;
  aspect: string;
  size: [number, number];
  fps: number;
  duration: number;
  palette: string[];
  font: string;
  captions: boolean;
  scenes: VideoPlanScene[];
  tts: {
    voice: string;
    language: string;
    style: string;
    speed: number;
    segments: Array<{ scene: string; text: string }>;
  };
}

export interface StudioToolCall {
  tool: 'remove_background' | 'save_template' | 'list_templates';
  upload_id?: string;
  edge_feather?: number;
  tolerance?: number;
  kind?: 'thumbnail' | 'image' | 'video';
  template?: any;
}

export interface StudioUploadEntry {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  width?: number;
  height?: number;
  has_transparency?: boolean;
}

export const PALETTES: StudioPalette[] = [
  { id: 'ink-gold', name: 'Ink & Gold', colors: ['#0b0d12', '#e8b04b', '#f4f1ea', '#7a5b1e'] },
  { id: 'neon-night', name: 'Neon Night', colors: ['#0b1020', '#6a2cff', '#00e5ff', '#ff2d55'] },
  { id: 'money-red', name: 'Money Red', colors: ['#0a0a0a', '#e10600', '#ffffff', '#ffcc00'] },
  { id: 'fresh-mint', name: 'Fresh Mint', colors: ['#0d3b36', '#2ec4b6', '#f7fff7', '#ff9f1c'] },
  { id: 'sunset-pop', name: 'Sunset Pop', colors: ['#2b1055', '#ff4d6d', '#ffb703', '#fff3e0'] },
  { id: 'chalk', name: 'Chalkboard', colors: ['#1f3a2e', '#f5f5f0', '#ffd166', '#8ecae6'] },
  { id: 'teal-orange', name: 'Cinematic', colors: ['#081c24', '#1b6f7a', '#ff8a3d', '#f5e9da'] },
  { id: 'mono-clean', name: 'Mono Clean', colors: ['#ffffff', '#111827', '#2f5bea', '#e5e7eb'] },
];

export const FONTS: StudioFont[] = [
  { id: 'Poppins', use: 'Bold headlines, Latin + good with Hindi pairing', weights: [600, 800, 900] },
  { id: 'Noto Sans Devanagari', use: 'Hindi / Devanagari text (always for Hindi)', weights: [600, 800] },
  { id: 'Playfair Display', use: 'Documentary / editorial titles (Latin)', weights: [700, 900] },
  { id: 'Bebas Neue', use: 'Tall condensed titles, gaming, news (Latin)', weights: [400] },
  { id: 'Space Grotesk', use: 'Tech / explainer UI text (Latin)', weights: [500, 700] },
];

export const STUDIO_VOICES: StudioVoiceSpec[] = [
  {
    id: 'Kore',
    geminiVoiceId: 'zara-classic',
    prebuiltVoice: 'Kore',
    gender: 'female',
    tone: 'calm, clear, authoritative',
    best: 'documentary, news',
  },
  {
    id: 'Aoede',
    geminiVoiceId: 'zara-nova',
    prebuiltVoice: 'Zephyr',
    gender: 'female',
    tone: 'bright, friendly',
    best: 'explainers, ads',
  },
  {
    id: 'Leda',
    geminiVoiceId: 'zara-silk',
    prebuiltVoice: 'Zephyr',
    gender: 'female',
    tone: 'soft, intimate',
    best: 'storytelling',
  },
  {
    id: 'Charon',
    geminiVoiceId: 'daro-atlas',
    prebuiltVoice: 'Charon',
    gender: 'male',
    tone: 'deep, steady',
    best: 'documentary, finance',
  },
  {
    id: 'Puck',
    geminiVoiceId: 'daro-pulse',
    prebuiltVoice: 'Puck',
    gender: 'male',
    tone: 'lively, youthful',
    best: 'tech, gaming, reels',
  },
  {
    id: 'Fenrir',
    geminiVoiceId: 'daro-prime',
    prebuiltVoice: 'Fenrir',
    gender: 'male',
    tone: 'powerful, dramatic',
    best: 'trailers, history',
  },
  {
    id: 'Orus',
    geminiVoiceId: 'daro-echo',
    prebuiltVoice: 'Puck',
    gender: 'male',
    tone: 'warm, conversational',
    best: 'tutorials',
  },
];

export const THUMBS: ThumbnailTemplate[] = [
  {
    id: 'neon-tech',
    kind: 'thumbnail',
    name: 'Neon Tech',
    category: ['tech', 'ai', 'coding'],
    size: [1280, 720],
    background: { type: 'gradient', angle: 135, colors: ['#0b1020', '#1b2a6b', '#6a2cff'] },
    shapes: [
      { type: 'circle', x: 0.86, y: 0.22, r: 0.26, color: '#00e5ff', opacity: 0.22 },
      { type: 'bar', x: 0, y: 0.92, w: 1, h: 0.08, color: '#00e5ff', opacity: 0.9 },
    ],
    text: {
      title: {
        font: 'Poppins',
        weight: 900,
        size: 0.13,
        color: '#ffffff',
        stroke: { color: '#000000', width: 8 },
        x: 0.06,
        y: 0.34,
        maxWidth: 0.6,
        uppercase: true,
      },
      subtitle: { font: 'Poppins', weight: 600, size: 0.05, color: '#00e5ff', x: 0.06, y: 0.8 },
      badge: { text: 'NEW', bg: '#ff2d55', color: '#ffffff', x: 0.06, y: 0.07 },
    },
  },
  {
    id: 'bold-money',
    kind: 'thumbnail',
    name: 'Bold Money',
    category: ['finance', 'business', 'earning'],
    size: [1280, 720],
    background: { type: 'gradient', angle: 160, colors: ['#0a0a0a', '#2a0000', '#e10600'] },
    shapes: [
      { type: 'circle', x: 0.82, y: 0.5, r: 0.34, color: '#ffcc00', opacity: 0.2 },
      { type: 'bar', x: 0, y: 0, w: 0.03, h: 1, color: '#ffcc00', opacity: 1 },
    ],
    text: {
      title: {
        font: 'Noto Sans Devanagari',
        weight: 800,
        size: 0.15,
        color: '#ffffff',
        stroke: { color: '#000000', width: 10 },
        x: 0.08,
        y: 0.3,
        maxWidth: 0.62,
      },
      subtitle: { font: 'Poppins', weight: 800, size: 0.055, color: '#ffcc00', x: 0.08, y: 0.78 },
      badge: { text: '2026 GUIDE', bg: '#ffcc00', color: '#000000', x: 0.08, y: 0.07 },
    },
  },
  {
    id: 'clean-corporate',
    kind: 'thumbnail',
    name: 'Clean Corporate',
    category: ['business', 'education', 'explainer'],
    size: [1280, 720],
    background: { type: 'solid', colors: ['#ffffff'] },
    shapes: [
      { type: 'bar', x: 0, y: 0, w: 1, h: 0.06, color: '#2f5bea', opacity: 1 },
      { type: 'circle', x: 0.9, y: 0.85, r: 0.3, color: '#2f5bea', opacity: 0.12 },
    ],
    text: {
      title: { font: 'Poppins', weight: 800, size: 0.12, color: '#111827', x: 0.07, y: 0.3, maxWidth: 0.65 },
      subtitle: { font: 'Space Grotesk', weight: 500, size: 0.05, color: '#2f5bea', x: 0.07, y: 0.78 },
      badge: { text: 'LEARN', bg: '#2f5bea', color: '#ffffff', x: 0.07, y: 0.12 },
    },
  },
  {
    id: 'glitch-arcade',
    kind: 'thumbnail',
    name: 'Glitch Arcade',
    category: ['gaming', 'fun'],
    size: [1280, 720],
    background: { type: 'gradient', angle: 45, colors: ['#120022', '#3b0a6e', '#ff2bd6'] },
    shapes: [
      { type: 'bar', x: 0, y: 0.2, w: 1, h: 0.03, color: '#00f0ff', opacity: 0.7 },
      { type: 'bar', x: 0, y: 0.62, w: 1, h: 0.02, color: '#ff2bd6', opacity: 0.8 },
    ],
    text: {
      title: {
        font: 'Bebas Neue',
        weight: 400,
        size: 0.22,
        color: '#ffffff',
        stroke: { color: '#00f0ff', width: 6 },
        x: 0.06,
        y: 0.32,
        maxWidth: 0.7,
        uppercase: true,
      },
      subtitle: { font: 'Poppins', weight: 800, size: 0.05, color: '#ffe600', x: 0.06, y: 0.82 },
      badge: { text: 'LIVE', bg: '#00f0ff', color: '#000000', x: 0.06, y: 0.07 },
    },
  },
  {
    id: 'chalk-board',
    kind: 'thumbnail',
    name: 'Chalk Board',
    category: ['education', 'explainer', 'school'],
    size: [1280, 720],
    background: { type: 'gradient', angle: 180, colors: ['#1f3a2e', '#274d3c'] },
    shapes: [{ type: 'circle', x: 0.88, y: 0.2, r: 0.14, color: '#ffd166', opacity: 0.35 }],
    text: {
      title: { font: 'Poppins', weight: 800, size: 0.12, color: '#f5f5f0', x: 0.07, y: 0.32, maxWidth: 0.7 },
      subtitle: { font: 'Space Grotesk', weight: 700, size: 0.05, color: '#ffd166', x: 0.07, y: 0.78 },
      badge: { text: 'EXPLAINED', bg: '#8ecae6', color: '#10303d', x: 0.07, y: 0.08 },
    },
  },
  {
    id: 'warm-magazine',
    kind: 'thumbnail',
    name: 'Warm Magazine',
    category: ['food', 'lifestyle', 'travel'],
    size: [1280, 720],
    background: { type: 'gradient', angle: 120, colors: ['#ff9f1c', '#ff4d6d'] },
    shapes: [{ type: 'circle', x: 0.8, y: 0.55, r: 0.38, color: '#fff3e0', opacity: 0.25 }],
    text: {
      title: {
        font: 'Playfair Display',
        weight: 900,
        size: 0.13,
        color: '#ffffff',
        stroke: { color: '#5a1730', width: 6 },
        x: 0.07,
        y: 0.3,
        maxWidth: 0.62,
      },
      subtitle: { font: 'Poppins', weight: 600, size: 0.05, color: '#fff3e0', x: 0.07, y: 0.78 },
      badge: { text: 'TRY THIS', bg: '#ffffff', color: '#ff4d6d', x: 0.07, y: 0.08 },
    },
  },
  {
    id: 'breaking-red',
    kind: 'thumbnail',
    name: 'Breaking Red',
    category: ['news', 'facts', 'shocking'],
    size: [1280, 720],
    background: { type: 'gradient', angle: 90, colors: ['#000000', '#1a0000'] },
    shapes: [
      { type: 'bar', x: 0, y: 0.78, w: 1, h: 0.14, color: '#e10600', opacity: 1 },
      { type: 'bar', x: 0, y: 0.76, w: 1, h: 0.012, color: '#ffffff', opacity: 1 },
    ],
    text: {
      title: {
        font: 'Bebas Neue',
        weight: 400,
        size: 0.2,
        color: '#ffffff',
        stroke: { color: '#000000', width: 4 },
        x: 0.05,
        y: 0.3,
        maxWidth: 0.85,
        uppercase: true,
      },
      subtitle: { font: 'Poppins', weight: 800, size: 0.06, color: '#ffffff', x: 0.05, y: 0.8 },
      badge: { text: 'BREAKING', bg: '#e10600', color: '#ffffff', x: 0.05, y: 0.07 },
    },
  },
  {
    id: 'cinematic-teal-orange',
    kind: 'thumbnail',
    name: 'Cinematic Teal/Orange',
    category: ['documentary', 'story', 'history'],
    size: [1280, 720],
    background: { type: 'gradient', angle: 200, colors: ['#081c24', '#1b6f7a', '#ff8a3d'] },
    shapes: [
      { type: 'bar', x: 0, y: 0, w: 1, h: 0.09, color: '#000000', opacity: 1 },
      { type: 'bar', x: 0, y: 0.91, w: 1, h: 0.09, color: '#000000', opacity: 1 },
    ],
    text: {
      title: { font: 'Playfair Display', weight: 900, size: 0.13, color: '#f5e9da', x: 0.08, y: 0.4, maxWidth: 0.8 },
      subtitle: { font: 'Poppins', weight: 600, size: 0.04, color: '#ff8a3d', x: 0.08, y: 0.74 },
      badge: { text: 'DOCUMENTARY', bg: '#ff8a3d', color: '#081c24', x: 0.08, y: 0.14 },
    },
  },
  {
    id: 'quote-gradient',
    kind: 'thumbnail',
    name: 'Quote Gradient',
    category: ['motivation', 'quotes', 'social'],
    size: [1080, 1080],
    background: { type: 'gradient', angle: 135, colors: ['#2b1055', '#ff4d6d', '#ffb703'] },
    shapes: [{ type: 'circle', x: 0.15, y: 0.15, r: 0.22, color: '#ffffff', opacity: 0.12 }],
    text: {
      title: { font: 'Playfair Display', weight: 900, size: 0.085, color: '#ffffff', x: 0.1, y: 0.3, maxWidth: 0.8 },
      subtitle: { font: 'Poppins', weight: 600, size: 0.035, color: '#fff3e0', x: 0.1, y: 0.85 },
      badge: { text: '“', bg: 'transparent', color: '#ffffff', x: 0.1, y: 0.1 },
    },
  },
  {
    id: 'split-hero',
    kind: 'thumbnail',
    name: 'Split Hero (cut-out friendly)',
    category: ['tech', 'creator', 'vlog'],
    size: [1280, 720],
    background: { type: 'gradient', angle: 90, colors: ['#111827', '#111827', '#2f5bea'] },
    shapes: [{ type: 'circle', x: 0.78, y: 0.5, r: 0.36, color: '#6f93ff', opacity: 0.35 }],
    text: {
      title: {
        font: 'Poppins',
        weight: 900,
        size: 0.12,
        color: '#ffffff',
        stroke: { color: '#000000', width: 6 },
        x: 0.05,
        y: 0.3,
        maxWidth: 0.5,
        uppercase: true,
      },
      subtitle: { font: 'Poppins', weight: 600, size: 0.045, color: '#9db6ff', x: 0.05, y: 0.8 },
      badge: { text: 'MUST WATCH', bg: '#ffcc00', color: '#000000', x: 0.05, y: 0.07 },
    },
    image_slot: { x: 0.55, y: 0.08, w: 0.42, h: 0.9, fit: 'cutout', outline: '#ffffff', shadow: true },
  },
];

export const IMAGES: ImageFormatTemplate[] = [
  { id: 'poster-bold', kind: 'image', name: 'Bold Poster', category: ['poster', 'event'], size: [1080, 1350], note: 'Huge 2-line headline, one accent shape, date/venue footer.' },
  { id: 'insta-quote', kind: 'image', name: 'Instagram Quote Card', category: ['social', 'quotes'], size: [1080, 1080], note: 'Centered quote, author line, soft gradient.' },
  { id: 'yt-banner', kind: 'image', name: 'YouTube Channel Banner', category: ['banner', 'creator'], size: [2560, 1440], note: 'Keep content in the central 1546×423 safe area.' },
  { id: 'story-9x16', kind: 'image', name: 'Story / Reel Cover', category: ['social', 'reel'], size: [1080, 1920], note: 'Headline in the middle third; keep top 250px and bottom 340px free.' },
  { id: 'infographic-3', kind: 'image', name: '3-Step Infographic', category: ['infographic', 'education'], size: [1080, 1350], note: 'Three numbered blocks with icon, title, one-line explanation.' },
  { id: 'logo-type', kind: 'image', name: 'Wordmark Logo Graphic', category: ['logo', 'brand'], size: [1000, 1000], note: 'Type-only mark with a simple geometric symbol.' },
];

export const VIDEOS: VideoTemplate[] = [
  {
    id: 'doc-60',
    kind: 'video',
    name: 'Documentary 60s',
    style: 'documentary',
    duration: 60,
    aspect: '16:9',
    palette: 'teal-orange',
    font: 'Playfair Display',
    voice: 'Kore',
    transition: 'fade',
    captions: true,
    scenes: [['Title', 5, '#1b6f7a'], ['Hook', 8, '#0f4c57'], ['Context', 10, '#2b6f77'], ['Key fact 1', 10, '#ff8a3d'], ['Key fact 2', 10, '#d96b24'], ['Impact', 10, '#0f4c57'], ['Closing', 7, '#081c24']],
  },
  {
    id: 'doc-120',
    kind: 'video',
    name: 'Documentary 2 min',
    style: 'documentary',
    duration: 120,
    aspect: '16:9',
    palette: 'ink-gold',
    font: 'Playfair Display',
    voice: 'Charon',
    transition: 'fade',
    captions: true,
    scenes: [['Title', 5, '#7a5b1e'], ['Hook', 10, '#0b0d12'], ['Origin', 15, '#3b2d10'], ['Rise', 20, '#7a5b1e'], ['Turning point', 20, '#e8b04b'], ['Today', 20, '#3b2d10'], ['Future', 15, '#0b0d12'], ['Closing', 15, '#7a5b1e']],
  },
  {
    id: 'explainer-90',
    kind: 'video',
    name: 'Motion Explainer 90s',
    style: 'motion-graphic',
    duration: 90,
    aspect: '16:9',
    palette: 'neon-night',
    font: 'Space Grotesk',
    voice: 'Aoede',
    transition: 'slide-left',
    captions: false,
    scenes: [['Title', 4, '#6a2cff'], ['Problem', 12, '#ff2d55'], ['Idea', 12, '#00a6c0'], ['How it works 1', 14, '#6a2cff'], ['How it works 2', 14, '#4a1fb5'], ['Numbers chart', 14, '#00a6c0'], ['Benefits', 10, '#ff2d55'], ['CTA', 10, '#6a2cff']],
  },
  {
    id: 'reel-30',
    kind: 'video',
    name: 'Vertical Reel 30s',
    style: 'motion-graphic',
    duration: 30,
    aspect: '9:16',
    palette: 'sunset-pop',
    font: 'Poppins',
    voice: 'Puck',
    transition: 'zoom',
    captions: true,
    scenes: [['Hook', 4, '#ff4d6d'], ['Point 1', 7, '#ffb703'], ['Point 2', 7, '#2b1055'], ['Point 3', 7, '#ff4d6d'], ['CTA', 5, '#ffb703']],
  },
  {
    id: 'news-45',
    kind: 'video',
    name: 'News Facts 45s',
    style: 'motion-graphic',
    duration: 45,
    aspect: '16:9',
    palette: 'money-red',
    font: 'Bebas Neue',
    voice: 'Fenrir',
    transition: 'wipe',
    captions: true,
    scenes: [['Headline', 5, '#e10600'], ['Fact 1', 10, '#222222'], ['Fact 2', 10, '#b00500'], ['Fact 3', 10, '#222222'], ['Takeaway', 10, '#e10600']],
  },
  {
    id: 'tutorial-75',
    kind: 'video',
    name: 'Tutorial Steps 75s',
    style: 'motion-graphic',
    duration: 75,
    aspect: '16:9',
    palette: 'fresh-mint',
    font: 'Poppins',
    voice: 'Orus',
    transition: 'slide-up',
    captions: true,
    scenes: [['Title', 4, '#2ec4b6'], ['What you need', 10, '#0d3b36'], ['Step 1', 14, '#2ec4b6'], ['Step 2', 14, '#1f9d91'], ['Step 3', 14, '#0d3b36'], ['Common mistake', 10, '#ff9f1c'], ['Recap + CTA', 9, '#2ec4b6']],
  },
];

const CUSTOM_STORAGE_KEY = 'mythoria_custom_templates_v1';
let memoryCustomTemplates: AnyStudioTemplate[] = [];

export function loadCustomTemplates(): AnyStudioTemplate[] {
  if (typeof window === 'undefined') return memoryCustomTemplates;
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((t) => ({ ...t, custom: true })) : [];
  } catch {
    return memoryCustomTemplates;
  }
}

export function saveAllCustomTemplatesLocal(arr: AnyStudioTemplate[]): void {
  const marked = arr.map((t) => ({ ...t, custom: true }));
  memoryCustomTemplates = marked;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(marked));
    window.dispatchEvent(new CustomEvent('mythoria-templates-updated'));
  } catch {
    // Fallback already stored in memory
  }
}

export function saveTemplate(t: any): AnyStudioTemplate {
  if (!t || !t.id) {
    throw new Error('Template needs an id');
  }
  const normalized: AnyStudioTemplate = {
    ...t,
    id: String(t.id),
    kind: (t.kind === 'image' || t.kind === 'video' ? t.kind : 'thumbnail') as any,
    name: String(t.name || t.id),
    custom: true,
  };
  const next = loadCustomTemplates().filter((x) => x.id !== normalized.id);
  next.push(normalized);
  saveAllCustomTemplatesLocal(next);
  // Async background Firestore sync when user is signed in
  saveCustomTemplateToFirestore(normalized).catch(() => {});
  return normalized;
}

export function deleteTemplate(id: string): void {
  const next = loadCustomTemplates().filter((x) => x.id !== id);
  saveAllCustomTemplatesLocal(next);
  deleteCustomTemplateFromFirestore(id).catch(() => {});
}

export function mergeFirestoreCustomTemplates(remoteItems: AnyStudioTemplate[]): AnyStudioTemplate[] {
  const local = loadCustomTemplates();
  const mergedMap = new Map<string, AnyStudioTemplate>();
  for (const l of local) mergedMap.set(l.id, { ...l, custom: true });
  for (const r of remoteItems) mergedMap.set(r.id, { ...r, custom: true });
  const merged = Array.from(mergedMap.values());
  saveAllCustomTemplatesLocal(merged);
  return merged;
}

export function allTemplates(kind: 'thumbnail' | 'image' | 'video'): AnyStudioTemplate[] {
  const base: AnyStudioTemplate[] =
    kind === 'thumbnail' ? THUMBS : kind === 'image' ? IMAGES : kind === 'video' ? VIDEOS : [];
  return [...base, ...loadCustomTemplates().filter((t) => t.kind === kind)];
}

export function getTemplateById(id: string): AnyStudioTemplate | undefined {
  const combined: AnyStudioTemplate[] = [...THUMBS, ...IMAGES, ...VIDEOS, ...loadCustomTemplates()];
  return combined.find((t) => t.id === id);
}

export function suggestTemplate(topic: string, kind: 'thumbnail' | 'image' | 'video' = 'thumbnail'): AnyStudioTemplate | null {
  const w = (topic || '').toLowerCase().split(/\W+/).filter(Boolean);
  const scored = allTemplates(kind)
    .map((t: any) => {
      const hay = ([] as string[]).concat(t.category || [], [t.name || '', t.style || '']).join(' ').toLowerCase();
      return { t, s: w.reduce((n, x) => n + (hay.includes(x) ? 1 : 0), 0) };
    })
    .sort((a, b) => b.s - a.s);
  return scored[0]?.t || null;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function renderThumbnail(
  canvas: HTMLCanvasElement,
  tplOrId: ThumbnailTemplate | string,
  content?: { title?: string; subtitle?: string; badge?: string; image?: HTMLImageElement | null }
): Promise<HTMLCanvasElement> {
  const tpl = (typeof tplOrId === 'string' ? getTemplateById(tplOrId) : tplOrId) as ThumbnailTemplate | undefined;
  if (!tpl || !tpl.size) return canvas;

  const opts = content || {};
  const [W, H] = tpl.size;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  try {
    await document.fonts.ready;
  } catch {}

  const bg = tpl.background || { type: 'solid', colors: ['#0b1020'] };
  if (bg.type === 'gradient') {
    const a = ((bg.angle || 135) - 90) * (Math.PI / 180);
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.hypot(W, H) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    (bg.colors || ['#0b1020', '#6a2cff']).forEach((c, i, arr) => g.addColorStop(i / (arr.length - 1 || 1), c));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = bg.colors?.[0] || '#111827';
  }
  ctx.fillRect(0, 0, W, H);

  for (const s of tpl.shapes || []) {
    ctx.save();
    ctx.globalAlpha = s.opacity == null ? 1 : s.opacity;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    if (s.type === 'circle') {
      ctx.arc(s.x * W, s.y * H, (s.r || 0.2) * W, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(s.x * W, s.y * H, (s.w || 0.2) * W, (s.h || 0.1) * H);
    }
    ctx.restore();
  }

  if (opts.image && tpl.image_slot) {
    const s = tpl.image_slot;
    const img = opts.image;
    const bx = s.x * W;
    const by = s.y * H;
    const bw = s.w * W;
    const bh = s.h * H;
    const k = Math.min(bw / (img.width || 1), bh / (img.height || 1));
    const dw = img.width * k;
    const dh = img.height * k;
    const dx = bx + (bw - dw) / 2;
    const dy = by + bh - dh;
    ctx.save();
    if (s.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  const tx = tpl.text || {};
  const title = opts.title || 'Your headline';
  if (tx.title) {
    const t = tx.title;
    const fs = t.size * W;
    ctx.font = `${t.weight} ${fs}px "${t.font}", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = t.align || 'left';
    const str = t.uppercase ? title.toUpperCase() : title;
    const lines = wrapCanvasText(ctx, str, (t.maxWidth || 0.8) * W);
    lines.forEach((ln, i) => {
      const x = t.x * W;
      const y = t.y * H + i * fs * 1.08;
      if (t.stroke) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = t.stroke.width;
        ctx.strokeStyle = t.stroke.color;
        ctx.strokeText(ln, x, y);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(ln, x, y);
    });
  }

  if (tx.subtitle && (opts.subtitle || '') !== '') {
    const t = tx.subtitle;
    ctx.font = `${t.weight} ${t.size * W}px "${t.font}", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = t.color;
    ctx.fillText(opts.subtitle || '', t.x * W, t.y * H);
  }

  if (tx.badge) {
    const b = tx.badge;
    const label = opts.badge || b.text;
    const fs = 0.035 * W;
    ctx.font = `800 ${fs}px "Poppins", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const pw = ctx.measureText(label).width + fs * 1.2;
    const ph = fs * 1.7;
    if (b.bg !== 'transparent') {
      ctx.fillStyle = b.bg;
      ctx.fillRect(b.x * W, b.y * H, pw, ph);
    }
    ctx.fillStyle = b.color;
    ctx.fillText(label, b.x * W + fs * 0.6, b.y * H + ph / 2);
  }

  return canvas;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

export function fileToDataURL(f: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ''));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export async function removeBackgroundSimple(
  src: string,
  { tolerance = 48, feather = 2 }: { tolerance?: number; feather?: number } = {}
): Promise<HTMLCanvasElement> {
  const img = await loadImageElement(src);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return c;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const W = c.width;
  const H = c.height;

  const px = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return [p[i], p[i + 1], p[i + 2]];
  };
  const corners = [px(0, 0), px(W - 1, 0), px(0, H - 1), px(W - 1, H - 1)];
  const bgc = corners.reduce((a, cur) => [a[0] + cur[0] / 4, a[1] + cur[1] / 4, a[2] + cur[2] / 4], [0, 0, 0]);
  const dist = (r: number, g: number, b: number) => Math.hypot(r - bgc[0], g - bgc[1], b - bgc[2]);
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];

  for (let x = 0; x < W; x++) {
    stack.push(x, 0, x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    stack.push(0, y, W - 1, y);
  }

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const k = y * W + x;
    if (seen[k]) continue;
    const i = k * 4;
    if (dist(p[i], p[i + 1], p[i + 2]) > tolerance) continue;
    seen[k] = 1;
    p[i + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  ctx.putImageData(d, 0, 0);
  if (feather > 0) {
    const t = document.createElement('canvas');
    t.width = W;
    t.height = H;
    const tc = t.getContext('2d');
    if (tc) {
      tc.filter = `blur(${feather * 0.5}px)`;
      tc.drawImage(c, 0, 0);
      return t;
    }
  }
  return c;
}

export async function removeBackground(
  fileOrDataURL: File | Blob | string,
  opts: { edge_feather?: number; tolerance?: number } = {}
): Promise<{ method: 'ai' | 'simple'; dataURL: string }> {
  const blob = typeof fileOrDataURL === 'string' ? await (await fetch(fileOrDataURL)).blob() : fileOrDataURL;
  try {
    const cdnUrl = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm';
    const mod: any = await import(/* @vite-ignore */ cdnUrl);
    const out: Blob = await mod.removeBackground(blob);
    return { method: 'ai', dataURL: await fileToDataURL(out) };
  } catch {
    const src = await fileToDataURL(blob);
    const cv = await removeBackgroundSimple(src, {
      feather: opts.edge_feather ?? 2,
      tolerance: opts.tolerance ?? 48,
    });
    return { method: 'simple', dataURL: cv.toDataURL('image/png') };
  }
}

export function catalogForPrompt(): string {
  return JSON.stringify({
    thumbnails: allTemplates('thumbnail').map((t: any) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      size: t.size,
    })),
    images: allTemplates('image').map((t: any) => ({
      id: t.id,
      name: t.name,
      size: t.size,
    })),
    videos: allTemplates('video').map((t: any) => ({
      id: t.id,
      name: t.name,
      style: t.style,
      duration: t.duration,
      aspect: t.aspect,
      voice: t.voice,
    })),
    voices: STUDIO_VOICES.map((v) => ({ id: v.id, gender: v.gender, tone: v.tone })),
    fonts: FONTS.map((f) => f.id),
    palettes: PALETTES.map((p) => p.id),
  });
}

export async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  try {
    const img = await loadImageElement(dataUrl);
    return { width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

/**
 * Replaces {{upload:ID}} and optional {{AUDIO_URL}} in generated studio HTML cleanly.
 */
export function resolveStudioPlaceholders(
  html: string,
  uploadsMap: Record<string, string>,
  audioUrl?: string
): string {
  let out = html || '';
  out = out.replace(/\{\{upload:([a-zA-Z0-9_-]+)\}\}/gi, (full, id) => {
    const hit = uploadsMap[id] || uploadsMap[id.toLowerCase()];
    return hit || full;
  });
  if (audioUrl) {
    out = out.replace(/\{\{AUDIO_URL\}\}/g, audioUrl);
  }
  return out;
}

/**
 * Detects if a fenced JSON block contains a MythoriaLib tool command.
 */
export function extractStudioToolCall(rawText: string): StudioToolCall | null {
  if (!rawText) return null;
  const jsonFences = rawText.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const m of jsonFences) {
    const body = (m[1] || '').trim();
    if (!body.startsWith('{') || !body.includes('"tool"')) continue;
    try {
      const parsed = JSON.parse(body);
      if (
        parsed &&
        typeof parsed.tool === 'string' &&
        (parsed.tool === 'remove_background' || parsed.tool === 'save_template' || parsed.tool === 'list_templates')
      ) {
        return parsed as StudioToolCall;
      }
    } catch {}
  }

  // Fallback check if raw JSON object with "tool" was emitted without fences
  const nakedMatch = rawText.match(/\{\s*"tool"\s*:\s*"(remove_background|save_template|list_templates)"[\s\S]*?\}/);
  if (nakedMatch) {
    try {
      return JSON.parse(nakedMatch[0]) as StudioToolCall;
    } catch {}
  }
  return null;
}

/**
 * Extracts VideoPlan JSON from a message when present.
 */
export function extractVideoPlan(rawText: string): VideoPlan | null {
  if (!rawText) return null;
  const jsonFences = rawText.matchAll(/```json\s*([\s\S]*?)```/gi);
  for (const m of jsonFences) {
    const body = (m[1] || '').trim();
    if (!body.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(body);
      if (parsed && Array.isArray(parsed.scenes) && parsed.tts && Array.isArray(parsed.tts.segments)) {
        const cappedDuration = Math.min(120, Math.max(5, Number(parsed.duration) || 60));
        return {
          title: String(parsed.title || 'Creative Video'),
          style: String(parsed.style || 'motion-graphic'),
          aspect: String(parsed.aspect || '16:9'),
          size: Array.isArray(parsed.size) && parsed.size.length === 2 ? [Number(parsed.size[0]), Number(parsed.size[1])] : [1280, 720],
          fps: Number(parsed.fps) || 30,
          duration: cappedDuration,
          palette: Array.isArray(parsed.palette) ? parsed.palette : ['#0b1020', '#00e5ff', '#ffffff'],
          font: String(parsed.font || 'Poppins'),
          captions: parsed.captions !== false,
          scenes: parsed.scenes,
          tts: {
            voice: String(parsed.tts.voice || 'Kore'),
            language: String(parsed.tts.language || 'en-US'),
            style: String(parsed.tts.style || 'Clear studio narrator'),
            speed: Number(parsed.tts.speed) || 1.0,
            segments: parsed.tts.segments,
          },
        };
      }
    } catch {}
  }
  return null;
}

/**
 * Determines whether an HTML block is a Studio Video Renderer (`window.VIDEO`) or Studio Image Canvas (`#canvas`).
 */
export function classifyStudioHtmlBlock(html: string): 'video' | 'image' | null {
  if (!html) return null;
  if (/window\.VIDEO\s*=|id=["']vo["']|seek\s*\(\s*[a-zA-Z_]/i.test(html)) {
    return 'video';
  }
  if (/id=["']canvas["']/i.test(html)) {
    return 'image';
  }
  return null;
}

export function initMythoriaWindowBridge() {
  if (typeof window === 'undefined') return;
  (window as any).MythoriaLib = {
    PALETTES,
    FONTS,
    VOICES: STUDIO_VOICES,
    all: allTemplates,
    get: getTemplateById,
    suggest: suggestTemplate,
    renderThumbnail,
    saveTemplate,
    deleteTemplate,
    loadCustom: loadCustomTemplates,
    removeBackground,
    removeBackgroundSimple,
    catalogForPrompt,
    async handleTool(msg: StudioToolCall, uploads?: Record<string, string>) {
      if (msg.tool === 'save_template' && msg.template) {
        return { ok: true, saved: saveTemplate(msg.template).id };
      }
      if (msg.tool === 'list_templates') {
        const list = msg.kind
          ? allTemplates(msg.kind)
          : [...allTemplates('thumbnail'), ...allTemplates('image'), ...allTemplates('video')];
        return { ok: true, templates: list.map((t: any) => ({ id: t.id, name: t.name, kind: t.kind })) };
      }
      if (msg.tool === 'remove_background' && msg.upload_id) {
        const src = (uploads || {})[msg.upload_id];
        if (!src) return { ok: false, error: 'upload not found' };
        const res = await removeBackground(src, { edge_feather: msg.edge_feather, tolerance: msg.tolerance });
        return { ok: true, upload_id: `${msg.upload_id}_cutout`, ...res };
      }
      return { ok: false, error: 'unknown tool' };
    },
  };
}
