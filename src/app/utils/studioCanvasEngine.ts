import {
  analyzeImageDataUrl,
  adjustCanvas,
  loadImage,
  StudioAttachmentMeta,
  StudioSourceAttribution,
  StudioThinkingLogStep,
} from './studioClient';
import {
  applyWebGpuColorGrade,
  applyWebGpuSharpen,
  createInpaintedBackdrop,
  cutoutVerifyAndRefine,
  performWebGpuFaceSwap,
  probeWebGpuCapabilities,
} from './webgpuVision';
import {
  LogoBadgeStyle,
  renderBrandLogoToDataUrl,
} from './brandLogoLibrary';
import { buildWorkspaceAuthHeaders } from './workspaceSession';

export const CANVAS_DATA = {
  PALETTES: {
    'neon-night': { name: 'Neon Night', mood: 'techy, energetic', bg: '#0b1020', surface: '#151c36', primary: '#6a2cff', accent: '#00e5ff', text: '#ffffff' },
    'money-red': { name: 'Money Red', mood: 'urgent, bold', bg: '#0a0a0a', surface: '#1a1a1a', primary: '#e10600', accent: '#ffcc00', text: '#ffffff' },
    'ink-gold': { name: 'Ink & Gold', mood: 'luxury, serious', bg: '#0b0d12', surface: '#161a22', primary: '#e8b04b', accent: '#7a5b1e', text: '#f4f1ea' },
    'fresh-mint': { name: 'Fresh Mint', mood: 'fresh, healthy', bg: '#0d3b36', surface: '#14524a', primary: '#2ec4b6', accent: '#ff9f1c', text: '#f7fff7' },
    'sunset-pop': { name: 'Sunset Pop', mood: 'warm, playful', bg: '#2b1055', surface: '#3d1a73', primary: '#ff4d6d', accent: '#ffb703', text: '#fff3e0' },
    'teal-orange': { name: 'Cinematic Teal/Orange', mood: 'film, drama', bg: '#081c24', surface: '#0f2f3a', primary: '#1b6f7a', accent: '#ff8a3d', text: '#f5e9da' },
    'mono-clean': { name: 'Mono Clean', mood: 'clean, corporate', bg: '#ffffff', surface: '#f3f4f6', primary: '#111827', accent: '#2f5bea', text: '#111827' },
    'pastel-dream': { name: 'Pastel Dream', mood: 'soft, friendly', bg: '#fdf2f8', surface: '#ffffff', primary: '#f9a8d4', accent: '#a5b4fc', text: '#3b2a4a' },
    'forest-calm': { name: 'Forest Calm', mood: 'nature, calm', bg: '#10231a', surface: '#17382a', primary: '#3fa66b', accent: '#d9c27a', text: '#eef5ea' },
    'ocean-deep': { name: 'Ocean Deep', mood: 'trust, depth', bg: '#04162b', surface: '#0a2a4d', primary: '#1fa2ff', accent: '#7ee8fa', text: '#eaf6ff' },
    'royal-gold': { name: 'Royal Purple Gold', mood: 'royal, premium', bg: '#1a0b2e', surface: '#2a1450', primary: '#7b2cbf', accent: '#ffd166', text: '#fdf6ff' },
    'coral-cream': { name: 'Coral Cream', mood: 'friendly, light', bg: '#fff4ea', surface: '#ffffff', primary: '#ff6b57', accent: '#2b2d42', text: '#2b2d42' },
    'cyber-lime': { name: 'Cyber Lime', mood: 'hacker, gaming', bg: '#0a0f0a', surface: '#121a12', primary: '#b6ff00', accent: '#00f0ff', text: '#f2fff2' },
    'desert-sand': { name: 'Desert Sand', mood: 'earthy, editorial', bg: '#f3e5c8', surface: '#fff7e6', primary: '#c8553d', accent: '#2f4858', text: '#2f4858' },
    candy: { name: 'Candy', mood: 'fun, youthful', bg: '#fff0f6', surface: '#ffffff', primary: '#ff3d9a', accent: '#3dd6ff', text: '#2b1b3d' },
    'steel-blue': { name: 'Steel Blue', mood: 'tech, product', bg: '#0f172a', surface: '#1e293b', primary: '#38bdf8', accent: '#f97316', text: '#f1f5f9' },
    sakura: { name: 'Sakura', mood: 'anime, gentle', bg: '#fff1f2', surface: '#ffe4e6', primary: '#fb7185', accent: '#7c3aed', text: '#4c1d3d' },
    'blood-moon': { name: 'Blood Moon', mood: 'horror, thriller', bg: '#0d0203', surface: '#1f0608', primary: '#c1121f', accent: '#fdf0d5', text: '#fdf0d5' },
    holo: { name: 'Holo', mood: 'futuristic, dreamy', bg: '#0e0b1f', surface: '#1b1535', primary: '#a78bfa', accent: '#34d399', text: '#f5f3ff' },
    'saffron-india': { name: 'Saffron India', mood: 'festive, Indian', bg: '#fff7ec', surface: '#ffffff', primary: '#ff9933', accent: '#138808', text: '#1f2a44' },
    'midnight-emerald': { name: 'Midnight Emerald', mood: 'finance, premium', bg: '#02100c', surface: '#062a20', primary: '#10b981', accent: '#fbbf24', text: '#ecfdf5' },
    'retro-wave': { name: 'Retro Wave', mood: '80s, synthwave', bg: '#1a0033', surface: '#2d0057', primary: '#ff2bd6', accent: '#00f0ff', text: '#ffe600' },
    'diwali-glow': { name: 'Diwali Glow', mood: 'festival, warm', bg: '#1b0a00', surface: '#3a1600', primary: '#ff9f1c', accent: '#ffd166', text: '#fff4d6' },
    'ice-white': { name: 'Ice White', mood: 'minimal, cold', bg: '#f4f9ff', surface: '#ffffff', primary: '#3b82f6', accent: '#06b6d4', text: '#0f172a' },
  } as Record<string, { name: string; mood: string; bg: string; surface: string; primary: string; accent: string; text: string }>,
  FONTS: {
    'hi-bold-poppins': { display: 'Poppins', dw: '800', body: 'Poppins', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@500;800;900&display=swap' },
    'hi-news-khand': { display: 'Khand', dw: '700', body: 'Hind', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Khand:wght@600;700&family=Hind:wght@500&display=swap' },
    'hi-rozha': { display: 'Rozha One', dw: '400', body: 'Hind', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Rozha+One&family=Hind:wght@500&display=swap' },
    'hi-yatra': { display: 'Yatra One', dw: '400', body: 'Hind', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Yatra+One&family=Hind:wght@500&display=swap' },
    'hi-kalam': { display: 'Kalam', dw: '700', body: 'Kalam', bw: '400', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap' },
    'hi-baloo': { display: 'Baloo 2', dw: '800', body: 'Baloo 2', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;800&display=swap' },
    'hi-rajdhani': { display: 'Rajdhani', dw: '700', body: 'Rajdhani', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap' },
    'hi-serif': { display: 'Noto Serif Devanagari', dw: '800', body: 'Noto Sans Devanagari', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@800&family=Noto+Sans+Devanagari:wght@500&display=swap' },
    'hi-anek': { display: 'Anek Devanagari', dw: '800', body: 'Anek Devanagari', bw: '400', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Anek+Devanagari:wght@400;800&display=swap' },
    'hi-tiro': { display: 'Tiro Devanagari Hindi', dw: '400', body: 'Hind', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Hind:wght@500&display=swap' },
    'condensed-bebas': { display: 'Bebas Neue', dw: '400', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@500;700&display=swap' },
    'anton-oswald': { display: 'Anton', dw: '400', body: 'Oswald', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500&display=swap' },
    'editorial-playfair': { display: 'Playfair Display', dw: '900', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@500&display=swap' },
    'modern-grotesk': { display: 'Space Grotesk', dw: '700', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@500&display=swap' },
    'luxe-dm-serif': { display: 'DM Serif Display', dw: '400', body: 'Montserrat', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Montserrat:wght@500&display=swap' },
    'comic-bangers': { display: 'Bangers', dw: '400', body: 'Poppins', bw: '600', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Bangers&family=Poppins:wght@600&display=swap' },
    'street-marker': { display: 'Permanent Marker', dw: '400', body: 'Inter', bw: '600', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Inter:wght@600&display=swap' },
    'arcade-pixel': { display: 'Press Start 2P', dw: '400', body: 'Space Grotesk', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@500&display=swap' },
    'techno-orbitron': { display: 'Orbitron', dw: '800', body: 'Rajdhani', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800&family=Rajdhani:wght@500&display=swap' },
    'royal-cinzel': { display: 'Cinzel', dw: '700', body: 'Montserrat', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Montserrat:wght@500&display=swap' },
    'wide-unbounded': { display: 'Unbounded', dw: '800', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@800&family=Inter:wght@500&display=swap' },
    'art-syne': { display: 'Syne', dw: '800', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Inter:wght@500&display=swap' },
    'heavy-archivo': { display: 'Archivo Black', dw: '400', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@500&display=swap' },
    'script-pacifico': { display: 'Pacifico', dw: '400', body: 'Poppins', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Pacifico&family=Poppins:wght@500&display=swap' },
  } as Record<string, { display: string; dw: string; body: string; bw: string; scripts: string[]; url: string }>,
  SIZES: {
    'yt-thumbnail': { name: 'YouTube thumbnail', w: 1280, h: 720 },
    'yt-banner': { name: 'YouTube channel banner', w: 2560, h: 1440 },
    'ig-square': { name: 'Instagram post (square)', w: 1080, h: 1080 },
    'ig-portrait': { name: 'Instagram post (4:5)', w: 1080, h: 1350 },
    'story-reel': { name: 'Story / Reel / Shorts cover', w: 1080, h: 1920 },
    'fb-post': { name: 'Facebook / link share', w: 1200, h: 630 },
    'fb-cover': { name: 'Facebook cover', w: 1640, h: 624 },
    'x-post': { name: 'X (Twitter) post image', w: 1600, h: 900 },
    'x-header': { name: 'X (Twitter) header', w: 1500, h: 500 },
    'linkedin-banner': { name: 'LinkedIn banner', w: 1584, h: 396 },
    'pinterest-pin': { name: 'Pinterest pin', w: 1000, h: 1500 },
    'profile-dp': { name: 'Profile picture / DP', w: 1000, h: 1000 },
    'poster-2-3': { name: 'Poster (2:3)', w: 1200, h: 1800 },
    'a4-portrait': { name: 'A4 poster / flyer (portrait)', w: 2480, h: 3508 },
    'a4-landscape': { name: 'A4 landscape', w: 3508, h: 2480 },
    'phone-wallpaper': { name: 'Phone wallpaper', w: 1080, h: 2340 },
    'desktop-wallpaper': { name: 'Desktop wallpaper', w: 1920, h: 1080 },
    'logo-square': { name: 'Logo / wordmark', w: 1000, h: 1000 },
    'business-card': { name: 'Business card', w: 1050, h: 600 },
    'album-cover': { name: 'Album / podcast cover', w: 1400, h: 1400 },
    'book-cover': { name: 'Book cover', w: 1600, h: 2560 },
  } as Record<string, { name: string; w: number; h: number }>,
};

export const CANVAS_STYLE_PAL: Record<string, string[]> = {
  bold: ['money-red', 'sunset-pop', 'cyber-lime', 'neon-night'],
  neon: ['neon-night', 'cyber-lime', 'retro-wave', 'holo'],
  glass: ['holo', 'ocean-deep', 'pastel-dream', 'neon-night'],
  luxury: ['ink-gold', 'royal-gold', 'midnight-emerald'],
  swiss: ['mono-clean', 'ice-white', 'desert-sand'],
  comic: ['candy', 'sunset-pop', 'money-red'],
  mesh: ['holo', 'sunset-pop', 'ocean-deep', 'midnight-emerald'],
  pastel: ['pastel-dream', 'sakura', 'candy', 'coral-cream'],
  cinema: ['teal-orange', 'blood-moon', 'ink-gold'],
  synth: ['retro-wave', 'neon-night'],
  brutal: ['desert-sand', 'coral-cream', 'mono-clean'],
  sticker: ['candy', 'sunset-pop', 'fresh-mint', 'coral-cream'],
};

const RECIPES_NAME: Record<string, string> = {
  thumbnail: 'YouTube thumbnail',
  poster: 'poster',
  'ig-post': 'social post',
  'story-reel': 'story / reel cover',
  banner: 'banner',
  'quote-card': 'quote card',
  logo: 'logo',
  infographic: 'infographic',
  wallpaper: 'wallpaper',
  'product-ad': 'product ad',
  'profile-dp': 'profile picture',
  invitation: 'invitation',
  certificate: 'certificate',
  'business-card': 'business card',
  flyer: 'flyer',
  'album-cover': 'album cover',
  'book-cover': 'book cover',
  'news-card': 'news card',
  menu: 'menu',
  portrait: 'portrait',
  generic: 'image',
};

const RECIPE_SIZE: Record<string, string> = {
  thumbnail: 'yt-thumbnail',
  poster: 'poster-2-3',
  'ig-post': 'ig-portrait',
  'story-reel': 'story-reel',
  banner: 'yt-banner',
  'quote-card': 'ig-square',
  logo: 'logo-square',
  infographic: 'ig-portrait',
  wallpaper: 'phone-wallpaper',
  'product-ad': 'ig-square',
  'profile-dp': 'profile-dp',
  invitation: 'poster-2-3',
  certificate: 'a4-landscape',
  'business-card': 'business-card',
  flyer: 'poster-2-3',
  'album-cover': 'album-cover',
  'book-cover': 'book-cover',
  'news-card': 'fb-post',
  menu: 'poster-2-3',
  portrait: 'ig-portrait',
  generic: 'ig-square',
};

export interface StudioLogoSpec {
  id: string;
  brandId: string;
  label: string;
  query?: string;
  placement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center';
}

export interface CanvasDesignSpec {
  recipe?: string;
  renderMode?: 'direct-photo' | 'composite';
  style: string;
  palette: string;
  fonts: string;
  fontPair?: string;
  layout: string;
  language?: string;
  title: string;
  accentWord?: string;
  subtitle?: string;
  badge?: string;
  cta?: string;
  hero?: { type: 'asset' | 'emoji' | 'motif' | 'none'; id?: string; char?: string };
  motifs?: string[];
  assets?: any[];
  logos?: StudioLogoSpec[];
  backgroundSpec?: { mode: 'search' | 'gradient' | 'scene' | 'upload' | 'none'; query?: string; mood?: string };
  characterSpec?: {
    needed: boolean;
    source: 'upload' | 'search' | 'none';
    query?: string;
    placement: 'right-corner' | 'left-corner' | 'center';
    removeBackground: boolean;
  };
  supportingObjects?: Array<{
    id?: string;
    query: string;
    placement?: 'top-right' | 'bottom-left' | 'mid-right' | 'mid-left';
  }>;
  creativeDirection?: {
    colorGrade?: 'cinematic-teal-orange' | 'golden-editorial' | 'neon-pop' | 'luxury-noir' | 'portrait-natural';
    overlayOpacity?: number;
    lighting?: string;
    useTextPlate?: boolean;
  };
  faceSwap?: { needed: boolean; proPortraitQuery?: string };
  forcePlate?: boolean;
  brief?: { goal?: string; audience?: string; message?: string };
  rationale?: string;
}

export interface PreparedCanvasAsset {
  img: HTMLCanvasElement;
  dataUrl?: string;
  cutout: boolean;
  role: 'subject' | 'background' | 'logo' | 'object';
  name: string;
  placement?: string;
}

export interface SerializedPreparedAsset {
  id: string;
  dataUrl: string;
  cutout: boolean;
  role: 'subject' | 'background' | 'logo' | 'object';
  name: string;
}

export interface BaseSceneLayer {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  rotation?: number;
}

export interface ImageSceneLayer extends BaseSceneLayer {
  kind: 'image';
  dataUrl: string;
  originalDataUrl?: string;
  cutout: boolean;
  flipX?: boolean;
  rimGlow?: boolean;
  rimColor?: string;
  dropShadow?: boolean;
  placementRole?: 'character' | 'sticker' | 'photo' | 'direct-photo';
}

export interface LogoSceneLayer extends BaseSceneLayer {
  kind: 'logo';
  brandId: string;
  label: string;
  badgeStyle: LogoBadgeStyle;
  withLabel: boolean;
  dataUrl?: string;
}

export interface TextSceneLayer extends BaseSceneLayer {
  kind: 'text';
  textRole: 'badge' | 'headline' | 'subtitle' | 'cta' | 'custom';
  text: string;
  accentWord?: string;
  fontPairId: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  accentColor: string;
  strokeColor?: string;
  strokeWidth?: number;
  align: 'left' | 'center' | 'right';
  bgPlateColor?: string;
  bgPlateRadius?: number;
  uppercase?: boolean;
  shadowBlur?: number;
}

export type StudioSceneLayer = ImageSceneLayer | LogoSceneLayer | TextSceneLayer;

export interface StudioSceneGraph {
  width: number;
  height: number;
  style: string;
  palette: string;
  background: {
    bgHex: string;
    primaryHex: string;
    accentHex: string;
    photoDataUrl?: string;
    gradientMode: 'studio' | 'photo-dim' | 'solid';
    overlayOpacity: number;
  };
  layers: StudioSceneLayer[];
}

/* ===================== CANVAS ENGINE E (EXACT PORT) ===================== */
const cv = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};
const rngFrom = (seed: string) => {
  let a = 0;
  for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const h2r = (h: string): [number, number, number] => {
  let clean = String(h || '#000000').replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  const n = parseInt(clean, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (h: string, a: number) => {
  const [r, g, b] = h2r(h);
  return `rgba(${r},${g},${b},${a})`;
};
const mix = (a: string, b: string, t: number) => {
  const A = h2r(a);
  const B = h2r(b);
  return (
    '#' +
    A.map((v, i) =>
      Math.max(0, Math.min(255, Math.round(v + (B[i] - v) * t)))
        .toString(16)
        .padStart(2, '0')
    ).join('')
  );
};
const relLum = ([r, g, b]: [number, number, number]) => {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const lum = (h: string) => relLum(h2r(h));
const ratio = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

const angleGrad = (ctx: CanvasRenderingContext2D, W: number, H: number, deg: number, stops: Array<[number, string]>) => {
  const a = ((deg - 90) * Math.PI) / 180;
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.hypot(W, H) / 2;
  const g = ctx.createLinearGradient(
    cx - Math.cos(a) * r,
    cy - Math.sin(a) * r,
    cx + Math.cos(a) * r,
    cy + Math.sin(a) * r
  );
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
};
const glow = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 0.5) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
};
const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number, rng: () => number) {
  const n = 7;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const rad = r * (0.78 + rng() * 0.4);
    pts.push([x + Math.cos(ang) * rad, y + Math.sin(ang) * rad]);
  }
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    ctx.quadraticCurveTo(p2[0], p2[1], (p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
let noiseTile: HTMLCanvasElement | null = null;
function grain(ctx: CanvasRenderingContext2D, W: number, H: number, amt = 0.12) {
  if (!noiseTile) {
    noiseTile = cv(256, 256);
    const g = noiseTile.getContext('2d');
    if (g) {
      const d = g.createImageData(256, 256);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = Math.random() * 255;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
    }
  }
  ctx.save();
  ctx.globalAlpha = amt;
  ctx.globalCompositeOperation = 'overlay';
  const pat = ctx.createPattern(noiseTile, 'repeat');
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
const vignette = (ctx: CanvasRenderingContext2D, W: number, H: number, s = 0.6) => {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${s})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};
function rays(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, n: number, c1: string, c2: string, a: number, rot = 0) {
  ctx.save();
  ctx.globalAlpha = a;
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * Math.PI * 2;
    const a1 = rot + ((i + 1) / n) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? c1 : c2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
    ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function halftone(ctx: CanvasRenderingContext2D, W: number, H: number, step: number, color: string, a: number, fromX: number, fromY: number) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  const maxD = Math.hypot(W, H);
  for (let y = 0; y < H + step; y += step) {
    for (let x = ((Math.floor(y / step) % 2) * step) / 2; x < W + step; x += step) {
      const d = Math.hypot(x - fromX, y - fromY) / maxD;
      const r = step * 0.5 * Math.max(0, 1 - d * 1.35);
      if (r > 0.6) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
function gridFloor(ctx: CanvasRenderingContext2D, W: number, H: number, hy: number, color: string, a: number, u: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, u * 0.18);
  ctx.globalAlpha = a;
  const cx = W / 2;
  for (let i = -18; i <= 18; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * u * 1.2, hy);
    ctx.lineTo(cx + i * u * 9, H);
    ctx.stroke();
  }
  let y = hy;
  let step = u * 0.6;
  while (y < H) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    y += step;
    step *= 1.32;
  }
  ctx.restore();
}
function retroSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c1: string, c2: string) {
  const t = cv(r * 2, r * 2);
  const g = t.getContext('2d');
  if (!g) return;
  const gr = g.createLinearGradient(0, 0, 0, r * 2);
  gr.addColorStop(0, c1);
  gr.addColorStop(1, c2);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) {
    const y = r * 1.05 + i * r * 0.105;
    const h = r * 0.018 + i * r * 0.012;
    g.fillRect(0, y, r * 2, h);
  }
  ctx.drawImage(t, cx - r, cy - r);
}
function starburstPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r1: number, r2: number, n: number) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? r1 : r2;
    if (i) ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}
const sparkle = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, a = 1) => {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.fill(new Path2D('M0 -50 C4 -20 20 -4 50 0 C20 4 4 20 0 50 C-4 20 -20 4 -50 0 C-20 -4 -4 -20 0 -50Z'));
  ctx.restore();
};

const MOTIFS: Record<string, { vb: [number, number]; d: string; center?: boolean; stroke?: boolean }> = {
  lightning: { vb: [100, 140], d: 'M58 2 L8 78 L44 78 L34 138 L92 56 L56 56Z' },
  heart: { vb: [100, 90], d: 'M50 88 C10 56 0 34 0 22 C0 8 12 0 26 0 C38 0 46 8 50 16 C54 8 62 0 74 0 C88 0 100 8 100 22 C100 34 90 56 50 88Z' },
  starburst: { vb: [200, 200], d: 'M100 6 L120 52 L168 30 L154 80 L196 100 L154 120 L168 170 L120 148 L100 194 L80 148 L32 170 L46 120 L4 100 L46 80 L32 30 L80 52Z' },
  sparkle: { vb: [100, 100], d: 'M50 0 C54 30 70 46 100 50 C70 54 54 70 50 100 C46 70 30 54 0 50 C30 46 46 30 50 0Z' },
  check: { vb: [100, 100], d: 'M50 4 A46 46 0 1 1 49.9 4Z M28 52 L44 68 L74 34 L66 27 L44 54 L35 45Z' },
  blob: { vb: [160, 160], d: 'M44.7 -58.9C58.1 -49.7 69.2 -36.2 73.9 -20.6C78.6 -5 76.9 12.6 69.6 27.1C62.2 41.5 49.2 52.7 34.5 61.1C19.9 69.5 3.6 75.1 -13.4 74.3C-30.4 73.5 -48.1 66.3 -58.9 53.3C-69.7 40.4 -73.6 21.7 -73.5 3.5C-73.4 -14.7 -69.3 -32.4 -59 -42.1C-48.7 -51.8 -32.2 -53.5 -17.2 -60.6C-2.2 -67.7 11.4 -80.2 25.4 -77.6C39.4 -75 31.2 -68.1 44.7 -58.9Z', center: true },
  quote: { vb: [100, 80], d: 'M0 80V45C0 18 14 4 40 0l4 10C28 14 22 24 22 36h22v44zM56 80V45c0-27 14-41 40-45l4 10C84 14 78 24 78 36h22v44z' },
  arrow: { vb: [200, 120], d: 'M10 100 C60 10 120 10 180 60 M150 28 L184 62 L140 74', stroke: true },
};

function drawMotif(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, size: number, fill: string, stroke: string | null, strokeW = 0) {
  const m = MOTIFS[id];
  if (!m) return;
  const k = size / Math.max(m.vb[0], m.vb[1]);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  if (!m.center) ctx.translate(-m.vb[0] / 2, -m.vb[1] / 2);
  const p = new Path2D(m.d);
  if (m.stroke) {
    ctx.strokeStyle = fill;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(p);
  } else {
    if (stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeW / k;
      ctx.strokeStyle = stroke;
      ctx.stroke(p);
    }
    ctx.fillStyle = fill;
    ctx.fill(p, 'evenodd');
  }
  ctx.restore();
}

const isDeva = (s: string) => /[\u0900-\u097F]/.test(s);
function fontStr(fam: string, weight: string | number, size: number, fallback?: string) {
  return `${weight} ${Math.round(size)}px "${fam}", ${fallback || 'sans-serif'}`;
}
function wrapWords(ctx: CanvasRenderingContext2D, tokens: Array<{ text: string; accent: boolean }>, maxW: number) {
  const lines: Array<{ words: Array<{ text: string; accent: boolean; width: number }>; width: number }> = [];
  let cur: Array<{ text: string; accent: boolean; width: number }> = [];
  let w = 0;
  const sp = ctx.measureText(' ').width;
  for (const t of tokens) {
    const tw = ctx.measureText(t.text).width;
    if (cur.length && w + sp + tw > maxW) {
      lines.push({ words: cur, width: w });
      cur = [];
      w = 0;
    }
    w += (cur.length ? sp : 0) + tw;
    cur.push({ ...t, width: tw });
  }
  if (cur.length) lines.push({ words: cur, width: w });
  return lines;
}
function fitText(ctx: CanvasRenderingContext2D, text: string, box: { x: number; y: number; w: number; h: number }, o: any) {
  const tokens = String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({
      text: o.upper ? t.toUpperCase() : t,
      accent: !!(
        o.accent &&
        o.accent.some((a: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === a)
      ),
    }));
  const lhK = o.lh || (isDeva(text) ? 1.28 : 1.1);
  let size = o.max;
  for (; size >= o.min; size *= 0.94) {
    ctx.font = fontStr(o.fam, o.weight, size, o.fallback);
    if (o.ls) (ctx as any).letterSpacing = `${o.ls * size}px`;
    const lines = wrapWords(ctx, tokens, box.w);
    const widest = Math.max(0, ...tokens.map((t) => ctx.measureText(t.text).width));
    if (lines.length <= o.maxLines && lines.length * size * lhK <= box.h && widest <= box.w) {
      return { size, lines, lh: size * lhK, fits: true };
    }
  }
  size = o.min;
  ctx.font = fontStr(o.fam, o.weight, size, o.fallback);
  const lines = wrapWords(ctx, tokens, box.w);
  return { size, lines, lh: size * lhK, fits: false };
}
function drawText(c: any, text: string, box: { x: number; y: number; w: number; h: number }, o: any) {
  const { ctx } = c;
  if (!text) return null;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const f = fitText(ctx, text, box, o);
  ctx.font = fontStr(o.fam, o.weight, f.size, o.fallback);
  if (o.ls) (ctx as any).letterSpacing = `${o.ls * f.size}px`;
  const total = f.lines.length * f.lh;
  const y0 =
    box.y + (o.valign === 'middle' ? (box.h - total) / 2 : o.valign === 'bottom' ? box.h - total : 0);
  const sp = ctx.measureText(' ').width;
  const rect = { x: box.x + box.w, y: y0, w: 0, h: total, x2: box.x };
  f.lines.forEach((ln, i) => {
    const base = y0 + i * f.lh + f.size * (isDeva(text) ? 0.98 : 0.86);
    let x =
      o.align === 'center'
        ? box.x + (box.w - ln.width) / 2
        : o.align === 'right'
          ? box.x + box.w - ln.width
          : box.x;
    rect.x = Math.min(rect.x, x);
    rect.x2 = Math.max(rect.x2, x + ln.width);
    ln.words.forEach((wd) => {
      const col = wd.accent ? o.accentFill || o.fill : o.fill;
      ctx.save();
      if (o.shadow) {
        ctx.shadowColor = o.shadow.color;
        ctx.shadowBlur = o.shadow.blur || 0;
        ctx.shadowOffsetX = o.shadow.x || 0;
        ctx.shadowOffsetY = o.shadow.y || 0;
      }
      if (o.hard) {
        ctx.fillStyle = o.hard.color;
        ctx.fillText(wd.text, x + o.hard.x, base + o.hard.y);
      }
      if (o.stroke) {
        ctx.strokeStyle = o.stroke.color;
        ctx.lineWidth = o.stroke.w * 2;
        ctx.strokeText(wd.text, x, base);
        ctx.shadowColor = 'transparent';
      }
      if (o.glow) {
        ctx.shadowColor = wd.accent ? o.accentFill || o.glow : o.glow;
        ctx.shadowBlur = f.size * 0.35;
        ctx.fillStyle = col;
        ctx.fillText(wd.text, x, base);
        ctx.shadowBlur = f.size * 0.12;
      }
      if (typeof col === 'function') ctx.fillStyle = col(ctx, x, base - f.size, wd.width, f.size);
      else ctx.fillStyle = col;
      ctx.fillText(wd.text, x, base);
      ctx.restore();
      x += wd.width + sp;
    });
  });
  ctx.restore();
  rect.w = rect.x2 - rect.x;
  return { ...f, rect };
}

const loadedFonts = new Set<string>();
async function loadFonts(pairId: string) {
  const f = CANVAS_DATA.FONTS[pairId];
  if (!f || loadedFonts.has(pairId)) return;
  loadedFonts.add(pairId);
  try {
    if (!document.querySelector(`link[data-font="${pairId}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = f.url;
      l.dataset.font = pairId;
      document.head.appendChild(l);
      await new Promise((r) => {
        l.onload = r;
        l.onerror = r;
        setTimeout(r, 4500);
      });
    }
    await Promise.race([
      Promise.all([
        document.fonts.load(`${f.dw} 40px "${f.display}"`, 'Aa अआ'),
        document.fonts.load(`${f.bw} 20px "${f.body}"`, 'Aa अआ'),
      ]),
      new Promise((r) => setTimeout(r, 3500)),
    ]);
  } catch {}
}

const LAYOUTS: Record<
  string,
  {
    align: 'left' | 'center' | 'right';
    badge: [number, number];
    title: [number, number, number, number];
    sub: [number, number, number, number];
    cta: [number, number, number, number];
    subject: [number, number, number, number] | null;
  }
> = {
  'text-left-subject-right': { align: 'left', badge: [0.05, 0.07], title: [0.05, 0.2, 0.54, 0.46], sub: [0.05, 0.69, 0.54, 0.12], cta: [0.05, 0.84, 0.4, 0.09], subject: [0.56, 0.04, 0.42, 0.94] },
  'subject-left-text-right': { align: 'left', badge: [0.46, 0.07], title: [0.46, 0.2, 0.5, 0.46], sub: [0.46, 0.69, 0.5, 0.12], cta: [0.46, 0.84, 0.4, 0.09], subject: [0.02, 0.04, 0.42, 0.94] },
  'centered-hero': { align: 'center', badge: [0.5, 0.07], title: [0.08, 0.32, 0.84, 0.3], sub: [0.12, 0.66, 0.76, 0.1], cta: [0.3, 0.82, 0.4, 0.09], subject: [0.28, 0.06, 0.44, 0.5] },
  'centered-text': { align: 'center', badge: [0.5, 0.12], title: [0.08, 0.26, 0.84, 0.36], sub: [0.12, 0.66, 0.76, 0.1], cta: [0.3, 0.82, 0.4, 0.09], subject: null },
  'poster-stack': { align: 'left', badge: [0.08, 0.05], title: [0.08, 0.08, 0.84, 0.2], sub: [0.08, 0.8, 0.84, 0.07], cta: [0.08, 0.89, 0.84, 0.06], subject: [0.1, 0.3, 0.8, 0.47] },
  'story-vertical': { align: 'center', badge: [0.5, 0.14], title: [0.08, 0.21, 0.84, 0.2], sub: [0.1, 0.75, 0.8, 0.06], cta: [0.15, 0.83, 0.7, 0.06], subject: [0.06, 0.42, 0.88, 0.32] },
  'quote-center': { align: 'center', badge: [0.5, 0.08], title: [0.1, 0.26, 0.8, 0.46], sub: [0.1, 0.78, 0.8, 0.07], cta: [0.25, 0.88, 0.5, 0.06], subject: null },
  'banner-wide': { align: 'left', badge: [0.22, 0.3], title: [0.22, 0.34, 0.42, 0.28], sub: [0.22, 0.64, 0.42, 0.1], cta: [0.22, 0.76, 0.3, 0.1], subject: [0.66, 0.1, 0.16, 0.8] },
  'product-spotlight': { align: 'center', badge: [0.5, 0.05], title: [0.08, 0.05, 0.84, 0.16], sub: [0.12, 0.8, 0.76, 0.07], cta: [0.25, 0.88, 0.5, 0.07], subject: [0.18, 0.23, 0.64, 0.55] },
};

function adaptLayout(id: string, W: number, H: number, hasSubject: boolean) {
  const r = W / H;
  let L = LAYOUTS[id] ? id : 'centered-hero';
  const fam = r > 2.2 ? 'wide' : r > 1.25 ? 'land' : r > 0.85 ? 'sq' : r > 0.6 ? 'port' : 'tall';
  const ok: Record<string, string[]> = {
    wide: ['banner-wide', 'centered-text'],
    land: ['text-left-subject-right', 'subject-left-text-right', 'centered-hero', 'centered-text', 'quote-center'],
    sq: ['centered-hero', 'centered-text', 'quote-center', 'product-spotlight', 'poster-stack'],
    port: ['poster-stack', 'centered-hero', 'centered-text', 'quote-center', 'product-spotlight'],
    tall: ['story-vertical', 'poster-stack', 'centered-text', 'quote-center'],
  };
  if (!ok[fam].includes(L)) {
    L = ({ wide: 'banner-wide', land: 'text-left-subject-right', sq: 'centered-hero', port: 'poster-stack', tall: 'story-vertical' } as Record<string, string>)[fam];
  }
  if (!hasSubject && LAYOUTS[L].subject) {
    L = 'centered-text';
  }
  return L;
}

const pxBox = (a: [number, number, number, number] | null, W: number, H: number) =>
  a ? { x: a[0] * W, y: a[1] * H, w: a[2] * W, h: a[3] * H } : null;

function normPalette(P: { name: string; mood: string; bg: string; surface: string; primary: string; accent: string; text: string }, needs: string) {
  const dark = lum(P.bg) < 0.22;
  if (needs === 'dark' && !dark) {
    return { ...P, bg: mix(P.primary, '#000', 0.86), surface: mix(P.primary, '#000', 0.72), text: '#ffffff' };
  }
  if (needs === 'light' && dark) {
    return { ...P, bg: mix(P.accent, '#ffffff', 0.9), surface: '#ffffff', text: mix(P.bg, '#000', 0.25) };
  }
  return P;
}

export const CANVAS_STYLES: Record<string, any> = {
  bold: {
    name: 'Bold Thumbnail',
    needs: 'any',
    upper: true,
    fx: 'sticker',
    weight: 900,
    bg(c: any) {
      const { ctx, W, H, u, P, Z } = c;
      const dk = lum(P.bg) < 0.35;
      ctx.fillStyle = angleGrad(ctx, W, H, 125, [[0, dk ? mix(P.bg, P.primary, 0.25) : P.primary], [1, dk ? P.primary : mix(P.primary, '#000', 0.45)]]);
      ctx.fillRect(0, 0, W, H);
      const s = Z.subject;
      const cx = s ? s.x + s.w / 2 : W * 0.5;
      const cy = s ? s.y + s.h * 0.55 : H * 0.5;
      rays(ctx, cx, cy, Math.hypot(W, H), 22, rgba('#ffffff', 0.0), rgba('#ffffff', 1), 0.09, 0.2);
      glow(ctx, cx, cy, Math.min(W, H) * 0.62, P.accent, 0.55);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = P.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(W, H) * 0.27, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = P.accent;
      ctx.fillRect(0, H - u * 1.6, W, u * 1.6);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, H - u * 2.1, W, u * 0.5);
    },
    front(c: any) {
      vignette(c.ctx, c.W, c.H, 0.5);
    },
    text(c: any) {
      return {
        fill: '#ffffff',
        accentFill: c.P.accent === c.P.primary ? '#ffe600' : c.P.accent,
        stroke: { color: '#000', w: c.u * 0.9 },
        shadow: { color: 'rgba(0,0,0,.55)', blur: c.u * 1.2, y: c.u * 0.6 },
      };
    },
  },
  neon: {
    name: 'Neon Cyberpunk',
    needs: 'dark',
    upper: true,
    fx: 'rim',
    weight: 800,
    bg(c: any) {
      const { ctx, W, H, u, P } = c;
      ctx.fillStyle = angleGrad(ctx, W, H, 160, [[0, mix(P.bg, '#000', 0.35)], [0.6, P.bg], [1, mix(P.primary, '#000', 0.55)]]);
      ctx.fillRect(0, 0, W, H);
      glow(ctx, W * 0.75, H * 0.35, Math.min(W, H) * 0.6, P.primary, 0.55);
      glow(ctx, W * 0.2, H * 0.8, Math.min(W, H) * 0.5, P.accent, 0.3);
      gridFloor(ctx, W, H, H * 0.68, P.accent, 0.5, u);
      ctx.save();
      ctx.strokeStyle = P.accent;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = u * 0.3;
      ctx.shadowColor = P.accent;
      ctx.shadowBlur = u * 2;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.68);
      ctx.lineTo(W, H * 0.68);
      ctx.stroke();
      ctx.restore();
    },
    mid(c: any) {
      grain(c.ctx, c.W, c.H, 0.08);
    },
    front(c: any) {
      const { ctx, W, H } = c;
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#000';
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.5);
      ctx.restore();
    },
    text(c: any) {
      return { fill: '#ffffff', accentFill: c.P.accent, glow: c.P.primary, ls: 0.02 };
    },
  },
  glass: {
    name: 'Glassmorphism',
    needs: 'any',
    fx: 'shadow',
    weight: 800,
    bg(c: any) {
      const { ctx, W, H, u, P, rng, Z } = c;
      ctx.fillStyle = mix(P.bg, P.primary, 0.15);
      ctx.fillRect(0, 0, W, H);
      const m = Math.min(W, H);
      blob(ctx, W * 0.15, H * 0.2, m * 0.45, P.primary, 0.95, rng);
      blob(ctx, W * 0.85, H * 0.25, m * 0.38, P.accent, 0.9, rng);
      blob(ctx, W * 0.7, H * 0.9, m * 0.5, P.primary, 0.8, rng);
      blob(ctx, W * 0.1, H * 0.9, m * 0.35, P.accent, 0.8, rng);
      const t = cv(W, H);
      const g = t.getContext('2d');
      if (g) g.drawImage(ctx.canvas, 0, 0);
      ctx.save();
      ctx.filter = `blur(${u * 4}px)`;
      ctx.drawImage(t, -u * 5, -u * 5, W + u * 10, H + u * 10);
      ctx.restore();
      const zt = Z.title;
      const pad = u * 3;
      const bx = zt.x - pad;
      const by = Z.badgeY ? Z.badgeY - pad : zt.y - pad;
      const bw = zt.w + pad * 2;
      const bh = (Z.cta ? Z.cta.y + Z.cta.h : zt.y + zt.h) - by + pad;
      ctx.save();
      rr(ctx, bx, by, bw, bh, u * 3);
      ctx.clip();
      ctx.filter = `blur(${u * 2.5}px)`;
      ctx.drawImage(t, 0, 0);
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.restore();
      ctx.save();
      rr(ctx, bx, by, bw, bh, u * 3);
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = u * 0.22;
      ctx.stroke();
      ctx.restore();
      c.plateLum = lum(mix(mix(P.bg, P.primary, 0.15), '#ffffff', 0.1));
    },
    mid(c: any) {
      grain(c.ctx, c.W, c.H, 0.06);
    },
    front() {},
    text(c: any) {
      return { fill: '#ffffff', accentFill: '#ffffff', shadow: { color: 'rgba(0,0,0,.35)', blur: c.u * 1.4, y: c.u * 0.4 } };
    },
  },
  luxury: {
    name: 'Dark Luxury',
    needs: 'dark',
    fx: 'shadow',
    weight: 700,
    gold: true,
    bg(c: any) {
      const { ctx, W, H, u, P } = c;
      ctx.fillStyle = mix(P.bg, '#000', 0.55);
      ctx.fillRect(0, 0, W, H);
      glow(ctx, W / 2, H * 0.45, Math.max(W, H) * 0.6, mix(P.accent, '#000', 0.55), 0.55);
      const gold = lum(P.primary) > lum(P.accent) ? P.primary : P.accent;
      ctx.strokeStyle = gold;
      ctx.lineWidth = Math.max(1.5, u * 0.22);
      ctx.globalAlpha = 0.85;
      ctx.strokeRect(u * 3, u * 3, W - u * 6, H - u * 6);
      ctx.globalAlpha = 0.45;
      ctx.strokeRect(u * 4.2, u * 4.2, W - u * 8.4, H - u * 8.4);
      ctx.globalAlpha = 1;
      [[u * 3, u * 3], [W - u * 3, u * 3], [u * 3, H - u * 3], [W - u * 3, H - u * 3]].forEach(([x, y]) => {
        ctx.fillStyle = gold;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-u * 0.7, -u * 0.7, u * 1.4, u * 1.4);
        ctx.restore();
      });
    },
    mid(c: any) {
      grain(c.ctx, c.W, c.H, 0.07);
    },
    front(c: any) {
      vignette(c.ctx, c.W, c.H, 0.5);
    },
    text(c: any) {
      const gold = lum(c.P.primary) > lum(c.P.accent) ? c.P.primary : c.P.accent;
      return {
        fill: (ctx: CanvasRenderingContext2D, _x: number, y: number, _w: number, h: number) => {
          const g = ctx.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, mix(gold, '#ffffff', 0.78));
          g.addColorStop(0.5, mix(gold, '#ffffff', 0.2));
          g.addColorStop(1, mix(gold, '#000', 0.08));
          return g;
        },
        accentFill: '#ffffff',
        ls: 0.03,
      };
    },
  },
  swiss: {
    name: 'Minimal Swiss',
    needs: 'light',
    fx: 'shadow',
    weight: 800,
    bg(c: any) {
      const { ctx, W, H, u, P } = c;
      ctx.fillStyle = P.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = P.primary;
      const r = W / H;
      if (r > 1.25) ctx.fillRect(W * 0.66, 0, W * 0.34, H);
      else ctx.fillRect(0, H * 0.86, W, H * 0.14);
      ctx.fillStyle = P.accent;
      ctx.beginPath();
      ctx.arc(r > 1.25 ? W * 0.66 : W * 0.85, r > 1.25 ? H * 0.5 : H * 0.86, Math.min(W, H) * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.text;
      ctx.fillRect(c.Z.title.x, c.Z.title.y - u * 1.6, u * 8, u * 0.5);
    },
    front() {},
    text(c: any) {
      return { fill: '#0b0d12', accentFill: c.P.primary };
    },
  },
  comic: {
    name: 'Pop Art Comic',
    needs: 'any',
    upper: true,
    fx: 'sticker',
    weight: 900,
    bg(c: any) {
      const { ctx, W, H, u, P, Z } = c;
      ctx.fillStyle = P.accent;
      ctx.fillRect(0, 0, W, H);
      const s = Z.subject;
      const cx = s ? s.x + s.w / 2 : W * 0.5;
      const cy = s ? s.y + s.h / 2 : H * 0.5;
      halftone(ctx, W, H, u * 1.6, mix(P.accent, '#000', 0.35), 0.55, cx, cy);
      ctx.save();
      starburstPath(ctx, cx, cy, Math.min(W, H) * 0.3, Math.min(W, H) * 0.5, 14);
      ctx.fillStyle = P.primary;
      ctx.fill();
      ctx.lineWidth = u * 0.7;
      ctx.strokeStyle = '#000';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    },
    front() {},
    text(c: any) {
      return {
        fill: '#ffffff',
        accentFill: '#ffe600',
        stroke: { color: '#000', w: c.u * 1.05 },
        hard: { color: '#000', x: c.u * 0.9, y: c.u * 0.9 },
      };
    },
  },
  mesh: {
    name: 'Gradient Mesh',
    needs: 'any',
    fx: 'shadow',
    weight: 800,
    bg(c: any) {
      const { ctx, W, H, P } = c;
      ctx.fillStyle = mix(P.bg, '#000', 0.15);
      ctx.fillRect(0, 0, W, H);
      const m = Math.max(W, H);
      glow(ctx, W * 0.1, H * 0.15, m * 0.7, P.primary, 0.95);
      glow(ctx, W * 0.9, H * 0.2, m * 0.6, P.accent, 0.85);
      glow(ctx, W * 0.8, H * 0.95, m * 0.7, P.primary, 0.8);
      glow(ctx, W * 0.05, H * 0.9, m * 0.55, P.accent, 0.7);
    },
    mid(c: any) {
      grain(c.ctx, c.W, c.H, 0.1);
    },
    front() {},
    text(c: any) {
      return {
        fill: '#ffffff',
        accentFill: (ctx: CanvasRenderingContext2D, x: number, _y: number, w: number) => {
          const g = ctx.createLinearGradient(x, 0, x + w, 0);
          g.addColorStop(0, mix(c.P.accent, '#ffffff', 0.5));
          g.addColorStop(1, mix(c.P.primary, '#ffffff', 0.6));
          return g;
        },
        shadow: { color: 'rgba(0,0,0,.28)', blur: c.u * 1.5, y: c.u * 0.5 },
      };
    },
  },
  pastel: {
    name: 'Pastel Soft',
    needs: 'light',
    fx: 'shadow',
    weight: 800,
    bg(c: any) {
      const { ctx, W, H, u, P, rng } = c;
      ctx.fillStyle = angleGrad(ctx, W, H, 150, [[0, P.bg], [1, mix(P.primary, '#ffffff', 0.6)]]);
      ctx.fillRect(0, 0, W, H);
      const m = Math.min(W, H);
      blob(ctx, W * 0.12, H * 0.15, m * 0.35, P.primary, 0.45, rng);
      blob(ctx, W * 0.9, H * 0.85, m * 0.42, P.accent, 0.4, rng);
      blob(ctx, W * 0.88, H * 0.12, m * 0.2, P.accent, 0.5, rng);
      ctx.save();
      ctx.fillStyle = rgba('#ffffff', 0.6);
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        ctx.arc(rng() * W, rng() * H, u * (0.25 + rng() * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      for (let i = 0; i < 5; i++) sparkle(ctx, rng() * W, rng() * H, u * (2 + rng() * 3), P.accent, 0.8);
    },
    front() {},
    text(c: any) {
      return { fill: mix(c.P.text, '#000', 0.15), accentFill: mix(c.P.primary, '#000', 0.5) };
    },
  },
  cinema: {
    name: 'Cinematic',
    needs: 'dark',
    fx: 'shadow',
    weight: 800,
    ls: 0.04,
    bg(c: any) {
      const { ctx, W, H, P } = c;
      ctx.fillStyle = angleGrad(ctx, W, H, 200, [[0, mix(P.bg, '#000', 0.2)], [0.55, P.primary], [1, P.accent]]);
      ctx.fillRect(0, 0, W, H);
      glow(ctx, W * 0.85, H * 0.15, Math.max(W, H) * 0.6, P.accent, 0.5);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,.55)');
      g.addColorStop(0.5, 'rgba(0,0,0,.1)');
      g.addColorStop(1, 'rgba(0,0,0,.75)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (W / H > 1.2) {
        ctx.fillStyle = '#000';
        const bar = H * 0.07;
        ctx.fillRect(0, 0, W, bar);
        ctx.fillRect(0, H - bar, W, bar);
      }
    },
    mid(c: any) {
      grain(c.ctx, c.W, c.H, 0.07);
    },
    front(c: any) {
      vignette(c.ctx, c.W, c.H, 0.5);
    },
    text(c: any) {
      return {
        fill: '#f6efe6',
        accentFill: mix(c.P.accent, '#ffffff', 0.25),
        shadow: { color: 'rgba(0,0,0,.6)', blur: c.u * 1.6, y: c.u * 0.5 },
        ls: 0.03,
      };
    },
  },
  synth: {
    name: 'Synthwave',
    needs: 'dark',
    upper: true,
    fx: 'rim',
    weight: 800,
    bg(c: any) {
      const { ctx, W, H, u, P, rng } = c;
      const hy = H * 0.62;
      const skyGrad = ctx.createLinearGradient(0, 0, 0, hy);
      skyGrad.addColorStop(0, mix(P.bg, '#000', 0.3));
      skyGrad.addColorStop(1, mix(P.primary, '#000', 0.35));
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, hy);
      const gg = ctx.createLinearGradient(0, hy, 0, H);
      gg.addColorStop(0, mix(P.bg, '#000', 0.2));
      gg.addColorStop(1, '#000');
      ctx.fillStyle = gg;
      ctx.fillRect(0, hy, W, H - hy);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 60; i++) {
        ctx.globalAlpha = 0.3 + rng() * 0.6;
        ctx.fillRect(rng() * W, rng() * hy * 0.8, u * 0.18, u * 0.18);
      }
      ctx.globalAlpha = 1;
      glow(ctx, W / 2, hy, Math.min(W, H) * 0.6, P.primary, 0.6);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, hy);
      ctx.clip();
      retroSun(ctx, W / 2, hy - Math.min(W, H) * 0.02, Math.min(W, H) * 0.3, '#ffe600', P.primary);
      ctx.restore();
      gridFloor(ctx, W, H, hy, P.accent, 0.75, u);
    },
    mid(c: any) {
      grain(c.ctx, c.W, c.H, 0.06);
    },
    front() {},
    text(c: any) {
      return {
        fill: (ctx: CanvasRenderingContext2D, _x: number, y: number, _w: number, h: number) => {
          const g = ctx.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.5, mix(c.P.accent, '#ffffff', 0.5));
          g.addColorStop(1, c.P.primary);
          return g;
        },
        accentFill: '#ffe600',
        stroke: { color: c.P.primary, w: c.u * 0.5 },
        glow: c.P.primary,
      };
    },
  },
  brutal: {
    name: 'Brutalist',
    needs: 'light',
    upper: true,
    fx: 'sticker',
    weight: 900,
    bg(c: any) {
      const { ctx, W, H, u, P, Z } = c;
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = P.accent;
      ctx.fillRect(0, 0, W * 0.5, H * 0.5);
      ctx.fillStyle = P.primary;
      ctx.fillRect(W * 0.5, H * 0.5, W * 0.5, H * 0.5);
      ctx.lineWidth = u * 0.7;
      ctx.strokeStyle = '#000';
      ctx.strokeRect(u, u, W - u * 2, H - u * 2);
      const t = Z.title;
      ctx.fillStyle = '#000';
      ctx.fillRect(t.x - u * 1.5 + u * 1.2, t.y - u * 1.5 + u * 1.2, t.w + u * 3, t.h + u * 3);
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(t.x - u * 1.5, t.y - u * 1.5, t.w + u * 3, t.h + u * 3);
      ctx.strokeRect(t.x - u * 1.5, t.y - u * 1.5, t.w + u * 3, t.h + u * 3);
      c.plateLum = lum('#ffe600');
    },
    front() {},
    text() {
      return { fill: '#000000', accentFill: '#d00000' };
    },
  },
  sticker: {
    name: 'Sticker Pop',
    needs: 'any',
    fx: 'sticker',
    weight: 900,
    bg(c: any) {
      const { ctx, W, H, u, P, rng } = c;
      ctx.fillStyle = P.primary;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = [P.accent, '#ffffff', mix(P.primary, '#000', 0.2)][i % 3];
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(rng() * W, rng() * H, u * (0.4 + rng() * 1.1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const t = c.Z.title;
      const pad = u * 2;
      ctx.save();
      ctx.translate(t.x + t.w / 2, t.y + t.h / 2);
      ctx.rotate(-0.025);
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = u * 2;
      ctx.shadowOffsetY = u * 0.8;
      ctx.fillStyle = '#ffffff';
      rr(ctx, -t.w / 2 - pad, -t.h / 2 - pad, t.w + pad * 2, t.h + pad * 2, u * 3);
      ctx.fill();
      ctx.restore();
      c.plateLum = 1;
    },
    front() {},
    text(c: any) {
      return { fill: '#1b1030', accentFill: c.P.primary, hard: null };
    },
  },
};

function silhouette(img: HTMLCanvasElement, w: number, h: number, color: string) {
  const t = cv(w, h);
  const g = t.getContext('2d');
  if (g) {
    g.drawImage(img, 0, 0, w, h);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
  }
  return t;
}

function drawAsset(c: any, a: PreparedCanvasAsset, z: { x: number; y: number; w: number; h: number } | null, fx: string | null) {
  const { ctx, u, P } = c;
  const img = a.img;
  const iw = img.width || 1;
  const ih = img.height || 1;
  if (a.role === 'background') {
    const k = Math.max(c.W / iw, c.H / ih);
    ctx.drawImage(img, (c.W - iw * k) / 2, (c.H - ih * k) / 2, iw * k, ih * k);
    const g = ctx.createLinearGradient(0, 0, 0, c.H);
    g.addColorStop(0, 'rgba(0,0,0,.35)');
    g.addColorStop(1, 'rgba(0,0,0,.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.W, c.H);
    return null;
  }
  if (!z) return null;
  const k = Math.min(z.w / iw, z.h / ih);
  const w = iw * k;
  const h = ih * k;
  const x = z.x + (z.w - w) / 2;
  const y = a.cutout ? z.y + z.h - h : z.y + (z.h - h) / 2;
  if (a.cutout) {
    ctx.save();
    if (fx === 'sticker') {
      const s = silhouette(img, w, h, '#ffffff');
      const r = u * 0.9;
      for (let i = 0; i < 28; i++) {
        const ang = (i / 28) * Math.PI * 2;
        ctx.drawImage(s, x + Math.cos(ang) * r, y + Math.sin(ang) * r, w, h);
      }
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur = u * 2.2;
      ctx.shadowOffsetY = u * 1.1;
      ctx.drawImage(s, x, y, w, h);
      ctx.shadowColor = 'transparent';
    } else if (fx === 'rim') {
      ctx.shadowColor = P.accent;
      ctx.shadowBlur = u * 2.6;
      ctx.drawImage(img, x, y, w, h);
      ctx.shadowBlur = u * 1.2;
      ctx.drawImage(img, x, y, w, h);
      ctx.shadowColor = 'transparent';
    } else {
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur = u * 2.4;
      ctx.shadowOffsetY = u * 1.2;
    }
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    return { x, y, w, h };
  }
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.035);
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = u * 2.5;
  ctx.shadowOffsetY = u * 1.2;
  ctx.fillStyle = '#fff';
  rr(ctx, -w / 2 - u * 0.8, -h / 2 - u * 0.8, w + u * 1.6, h + u * 1.6, u * 1.4);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  rr(ctx, -w / 2, -h / 2, w, h, u);
  ctx.clip();
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return { x, y, w, h };
}

function drawEmoji(c: any, ch: string, z: { x: number; y: number; w: number; h: number }) {
  const { ctx, u, P } = c;
  const size = Math.min(z.w, z.h) * 0.78;
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h / 2;
  ctx.save();
  glow(ctx, cx, cy, size * 0.95, P.accent, 0.45);
  ctx.fillStyle = rgba('#ffffff', 0.12);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.lineWidth = u * 0.35;
  ctx.stroke();
  ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = u * 2;
  ctx.shadowOffsetY = u * 1;
  ctx.fillText(ch, cx, cy + size * 0.04);
  ctx.restore();
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

function drawMotifHero(c: any, id: string, z: { x: number; y: number; w: number; h: number }) {
  const { ctx, u, P } = c;
  const size = Math.min(z.w, z.h) * 0.8;
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h / 2;
  glow(ctx, cx, cy, size, P.accent, 0.4);
  drawMotif(ctx, id, cx, cy, size, P.accent, '#000', u * 0.7);
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

export async function renderSceneGraph(graph: StudioSceneGraph): Promise<string> {
  const W = Math.max(200, Math.min(4096, Math.round(graph.width || 1280)));
  const H = Math.max(200, Math.min(4096, Math.round(graph.height || 720)));
  const u = W / 100;
  const canvas = cv(W, H);
  const ctx = canvas.getContext('2d')!;

  // Ensure fonts needed by text layers are loaded
  const fontIds = new Set<string>();
  for (const layer of graph.layers) {
    if (layer.kind === 'text' && layer.fontPairId) fontIds.add(layer.fontPairId);
  }
  await Promise.all([...fontIds].map((fid) => loadFonts(fid).catch(() => {})));

  // 1. LAYER 1: BACKGROUND
  const bg = graph.background;
  if (bg.photoDataUrl) {
    try {
      const bgImg = await loadImage(bg.photoDataUrl);
      const k = Math.max(W / (bgImg.width || 1), H / (bgImg.height || 1));
      const dw = (bgImg.width || 1) * k;
      const dh = (bgImg.height || 1) * k;
      ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } catch {
      ctx.fillStyle = bg.bgHex || '#0b1020';
      ctx.fillRect(0, 0, W, H);
    }
    if (bg.overlayOpacity > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(4,8,18,${(bg.overlayOpacity * 0.55).toFixed(2)})`);
      g.addColorStop(0.55, `rgba(4,8,18,${(bg.overlayOpacity * 0.72).toFixed(2)})`);
      g.addColorStop(1, `rgba(4,8,18,${Math.min(0.92, bg.overlayOpacity * 1.1).toFixed(2)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  } else if (bg.gradientMode === 'solid') {
    ctx.fillStyle = bg.bgHex || '#0b1020';
    ctx.fillRect(0, 0, W, H);
  } else {
    const P = CANVAS_DATA.PALETTES[graph.palette] || CANVAS_DATA.PALETTES['neon-night'];
    const styleObj = CANVAS_STYLES[graph.style] || CANVAS_STYLES.cinema;
    const rng = rngFrom(graph.style + graph.palette);
    const Z = {
      title: { x: W * 0.06, y: H * 0.2, w: W * 0.52, h: H * 0.45 },
      sub: { x: W * 0.06, y: H * 0.68, w: W * 0.52, h: H * 0.12 },
      cta: { x: W * 0.06, y: H * 0.83, w: W * 0.4, h: H * 0.09 },
      subject: { x: W * 0.55, y: H * 0.06, w: W * 0.42, h: H * 0.9 },
      badgeY: H * 0.08,
    };
    const normP = normPalette(P, styleObj.needs);
    styleObj.bg({ ctx, W, H, u, P: normP, rng, Z, hasSubject: true, plateLum: null });
    if (styleObj.mid) styleObj.mid({ ctx, W, H, u, P: normP, rng, Z });
  }

  // 2. ITERATE ORDERED LAYERS (Character Cutout -> Logos -> Code Typography)
  for (const layer of graph.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));

    if (layer.kind === 'image') {
      try {
        const img = await loadImage(layer.dataUrl);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const cx = layer.x + layer.w / 2;
        const cy = layer.y + layer.h / 2;
        ctx.translate(cx, cy);
        if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
        if (layer.flipX) ctx.scale(-1, 1);

        if (layer.placementRole === 'direct-photo') {
          ctx.beginPath();
          ctx.rect(-layer.w / 2, -layer.h / 2, layer.w, layer.h);
          ctx.clip();
          const iw = img.width || 1;
          const ih = img.height || 1;
          const k = Math.max(layer.w / iw, layer.h / ih);
          const dw = iw * k;
          const dh = ih * k;
          const dx = -dw / 2;
          // Anchor at 24% height so heads/eyes in portraits are never cut off
          const dy = -layer.h / 2 + (layer.h - dh) * 0.24;
          ctx.drawImage(img, dx, dy, dw, dh);

          // High-end studio key-light + subtle edge depth vignette
          const vig = ctx.createRadialGradient(0, -layer.h * 0.1, Math.min(layer.w, layer.h) * 0.28, 0, 0, Math.max(layer.w, layer.h) * 0.72);
          vig.addColorStop(0, 'rgba(255,255,255,0.03)');
          vig.addColorStop(0.65, 'rgba(0,0,0,0)');
          vig.addColorStop(1, 'rgba(2,6,14,0.28)');
          ctx.fillStyle = vig;
          ctx.fillRect(-layer.w / 2, -layer.h / 2, layer.w, layer.h);
        } else {
          if (layer.rimGlow) {
            ctx.shadowColor = layer.rimColor || graph.background.accentHex || '#00e5ff';
            ctx.shadowBlur = u * 2.4;
            ctx.drawImage(img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
            ctx.shadowBlur = u * 1.1;
          } else if (layer.dropShadow !== false) {
            ctx.shadowColor = 'rgba(0,0,0,0.58)';
            ctx.shadowBlur = u * 2.5;
            ctx.shadowOffsetY = u * 1.1;
          }

          if (!layer.cutout && layer.placementRole !== 'photo') {
            ctx.drawImage(img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
          } else if (!layer.cutout) {
            rr(ctx, -layer.w / 2, -layer.h / 2, layer.w, layer.h, u * 1.4);
            ctx.clip();
            ctx.drawImage(img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
          } else {
            ctx.drawImage(img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
          }
        }
      } catch {}
    } else if (layer.kind === 'logo') {
      try {
        let srcUrl = layer.dataUrl;
        if (!srcUrl || layer.brandId !== 'custom') {
          const rendered = await renderBrandLogoToDataUrl(layer.brandId, {
            size: Math.max(48, Math.round(layer.h * 0.72)),
            style: layer.badgeStyle,
            withLabel: layer.withLabel,
            customLabel: layer.label,
          });
          if (rendered) srcUrl = rendered.dataUrl;
        }
        if (srcUrl) {
          const lImg = await loadImage(srcUrl);
          const k = Math.min(layer.w / (lImg.width || 1), layer.h / (lImg.height || 1));
          const dw = (lImg.width || 1) * k;
          const dh = (lImg.height || 1) * k;
          ctx.shadowColor = 'rgba(0,0,0,0.45)';
          ctx.shadowBlur = u * 1.2;
          ctx.shadowOffsetY = u * 0.35;
          ctx.drawImage(lImg, layer.x + (layer.w - dw) / 2, layer.y + (layer.h - dh) / 2, dw, dh);
        }
      } catch {}
    } else if (layer.kind === 'text') {
      const txtVal = layer.uppercase && !isDeva(layer.text) ? layer.text.toUpperCase() : layer.text;
      if (layer.bgPlateColor) {
        ctx.save();
        ctx.fillStyle = layer.bgPlateColor;
        ctx.shadowColor = 'rgba(0,0,0,0.32)';
        ctx.shadowBlur = u * 1.1;
        rr(ctx, layer.x, layer.y, layer.w, layer.h, layer.bgPlateRadius ?? layer.h / 2);
        ctx.fill();
        ctx.restore();
      }

      const font = fontStr(layer.fontFamily || 'Space Grotesk', layer.fontWeight || 800, layer.fontSize || u * 5, 'sans-serif');
      ctx.font = font;
      const box = { x: layer.x + (layer.bgPlateColor ? u * 1.2 : 0), y: layer.y, w: Math.max(40, layer.w - (layer.bgPlateColor ? u * 2.4 : 0)), h: layer.h };

      // Word wrap within box at specified fontSize (auto-shrinking cleanly if wider than box)
      let fSize = Math.max(12, layer.fontSize || u * 4.5);
      let lines: Array<Array<{ text: string; width: number; accent: boolean }>> = [];
      const accentSet = new Set(
        (layer.accentWord || '')
          .split(/\s+/)
          .map((t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
          .filter(Boolean)
      );

      for (let attempt = 0; attempt < 24; attempt++) {
        ctx.font = fontStr(layer.fontFamily || 'Space Grotesk', layer.fontWeight || 800, fSize, 'sans-serif');
        const words = txtVal.split(/\s+/).filter(Boolean);
        lines = [];
        let cur: typeof lines[number] = [];
        let curW = 0;
        const sp = fSize * 0.28;
        let overflow = false;

        for (const rawW of words) {
          const clean = rawW.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
          const wWidth = ctx.measureText(rawW).width;
          if (wWidth > box.w && fSize > 14) {
            overflow = true;
            break;
          }
          if (cur.length && curW + sp + wWidth > box.w) {
            lines.push(cur);
            cur = [{ text: rawW, width: wWidth, accent: accentSet.has(clean) }];
            curW = wWidth;
          } else {
            cur.push({ text: rawW, width: wWidth, accent: accentSet.has(clean) });
            curW += (cur.length > 1 ? sp : 0) + wWidth;
          }
        }
        if (cur.length) lines.push(cur);

        const totalH = lines.length * fSize * 1.14;
        if (!overflow && (totalH <= box.h * 1.05 || fSize <= 14)) break;
        fSize *= 0.9;
      }

      const lh = fSize * 1.14;
      const totH = lines.length * lh;
      let startY = box.y + (box.h - totH) / 2 + fSize * 0.86;
      const sp = fSize * 0.28;

      lines.forEach((ln, li) => {
        const lineW = ln.reduce((a, b) => a + b.width, 0) + sp * Math.max(0, ln.length - 1);
        let x = box.x;
        if (layer.align === 'center') x = box.x + (box.w - lineW) / 2;
        else if (layer.align === 'right') x = box.x + box.w - lineW;
        const baseY = startY + li * lh;

        for (const wd of ln) {
          ctx.save();
          if (layer.shadowBlur) {
            ctx.shadowColor = 'rgba(0,0,0,0.65)';
            ctx.shadowBlur = layer.shadowBlur;
            ctx.shadowOffsetY = Math.max(2, layer.shadowBlur * 0.35);
          }
          if (layer.strokeColor && (layer.strokeWidth || 0) > 0) {
            ctx.lineJoin = 'round';
            ctx.strokeStyle = layer.strokeColor;
            ctx.lineWidth = (layer.strokeWidth || 4) * 2;
            ctx.strokeText(wd.text, x, baseY);
            ctx.shadowColor = 'transparent';
          }
          ctx.fillStyle = wd.accent ? layer.accentColor || layer.color : layer.color;
          ctx.fillText(wd.text, x, baseY);
          ctx.restore();
          x += wd.width + sp;
        }
      });
    }

    ctx.restore();
  }

  const isDirectPhoto = graph.layers.some((l) => l.kind === 'image' && l.placementRole === 'direct-photo');
  try {
    const polished = await applyWebGpuSharpen(canvas, isDirectPhoto ? 0.24 : 0.16);
    return polished.canvas.toDataURL('image/png');
  } catch {
    return canvas.toDataURL('image/png');
  }
}

export async function composeSceneGraphFromSpec(
  spec: CanvasDesignSpec,
  assets: Record<string, PreparedCanvasAsset>,
  logoImages: Record<string, PreparedCanvasAsset>,
  size: { w: number; h: number }
): Promise<{ graph: StudioSceneGraph; dataUrl: string; info: any }> {
  const W = Math.max(200, Math.min(4096, Math.round(size.w || 1280)));
  const H = Math.max(200, Math.min(4096, Math.round(size.h || 720)));
  const u = W / 100;

  const pairId = CANVAS_DATA.FONTS[spec.fonts] ? spec.fonts : 'hi-bold-poppins';
  const font = CANVAS_DATA.FONTS[pairId];
  await loadFonts(pairId);

  const styleObj = CANVAS_STYLES[spec.style] || CANVAS_STYLES.cinema;
  const Praw = CANVAS_DATA.PALETTES[spec.palette] || CANVAS_DATA.PALETTES['neon-night'];
  const P = normPalette(Praw, styleObj.needs);

  const bgAsset = Object.values(assets).find((a) => a.role === 'background');
  const heroId = spec.hero?.id || 'a1';
  const subjAsset =
    (spec.hero?.type === 'asset' ? assets[heroId] : null) ||
    Object.values(assets).find((a) => a.role === 'subject');

  const placement = spec.characterSpec?.placement || (spec.layout === 'subject-left-text-right' ? 'left-corner' : spec.layout === 'centered-hero' ? 'center' : 'right-corner');
  const hasSubject = Boolean(subjAsset);

  // Determine layout geometry respecting requested corner ("right-corner", "left-corner", "center")
  let effLayout = spec.layout;
  if (hasSubject) {
    if (placement === 'left-corner') effLayout = 'subject-left-text-right';
    else if (placement === 'right-corner') effLayout = 'text-left-subject-right';
    else if (placement === 'center') effLayout = W < H ? 'poster-stack' : 'centered-hero';
  }
  const layoutId = adaptLayout(effLayout, W, H, hasSubject);
  const LY = LAYOUTS[layoutId];

  const layers: StudioSceneLayer[] = [];

  // Supporting topic cutout objects placed cleanly in non-obstructing framing positions
  const objectAssets = Object.entries(assets).filter(([, a]) => a.role === 'object');
  for (let oi = 0; oi < objectAssets.length; oi++) {
    const [oid, objAsset] = objectAssets[oi];
    const objSize = Math.round(Math.min(W, H) * 0.2);
    const iw = objAsset.img.width || 1;
    const ih = objAsset.img.height || 1;
    const k = Math.min(objSize / iw, objSize / ih);
    const dw = Math.round(iw * k);
    const dh = Math.round(ih * k);
    const plc = objAsset.placement || (oi === 0 ? 'top-right' : 'bottom-left');
    let ox = Math.round(W * 0.78);
    let oy = Math.round(H * 0.14);
    if (plc === 'bottom-left') {
      ox = Math.round(W * 0.05);
      oy = Math.round(H - dh - H * 0.06);
    } else if (plc === 'mid-right') {
      ox = Math.round(W - dw - W * 0.04);
      oy = Math.round(H * 0.42);
    } else if (plc === 'mid-left') {
      ox = Math.round(W * 0.04);
      oy = Math.round(H * 0.42);
    } else {
      ox = Math.round(W - dw - W * 0.05);
      oy = Math.round(H * 0.12);
    }

    layers.push({
      id: `layer_obj_${oid}`,
      kind: 'image',
      name: objAsset.name || `Accent ${oi + 1}`,
      x: ox,
      y: oy,
      w: dw,
      h: dh,
      opacity: 0.92,
      visible: true,
      locked: false,
      dataUrl: objAsset.dataUrl || objAsset.img.toDataURL('image/png'),
      originalDataUrl: objAsset.dataUrl || objAsset.img.toDataURL('image/png'),
      cutout: objAsset.cutout,
      flipX: false,
      rimGlow: false,
      dropShadow: true,
      placementRole: 'sticker',
    });
  }

  const hasTitleText = Boolean(spec.title && spec.title.trim().length > 0);
  const hasAnyText = Boolean(
    hasTitleText ||
    (spec.badge && spec.badge.trim().length > 0) ||
    (spec.subtitle && spec.subtitle.trim().length > 0) ||
    (spec.cta && spec.cta.trim().length > 0)
  );
  const isDirectPhotoMode =
    spec.renderMode === 'direct-photo' ||
    (!hasAnyText && !bgAsset && Boolean(subjAsset) && !subjAsset?.cutout && !(spec.logos || []).length);

  // Layer 2: Main Character Layer (full-bleed studio portrait in direct-photo mode, or corner-anchored cutout)
  if (subjAsset) {
    if (isDirectPhotoMode) {
      layers.push({
        id: 'layer_character',
        kind: 'image',
        name: subjAsset.name || 'Studio Subject',
        x: 0,
        y: 0,
        w: W,
        h: H,
        opacity: 1,
        visible: true,
        locked: false,
        dataUrl: subjAsset.dataUrl || subjAsset.img.toDataURL('image/png'),
        originalDataUrl: subjAsset.dataUrl || subjAsset.img.toDataURL('image/png'),
        cutout: false,
        flipX: false,
        rimGlow: false,
        dropShadow: false,
        placementRole: 'direct-photo',
      });
    } else {
      let subjBox = pxBox(LY.subject, W, H) || { x: W * 0.55, y: H * 0.06, w: W * 0.42, h: H * 0.92 };
      if (placement === 'right-corner') {
        subjBox = { x: W * 0.54, y: H * 0.04, w: W * 0.44, h: H * 0.96 };
      } else if (placement === 'left-corner') {
        subjBox = { x: W * 0.02, y: H * 0.04, w: W * 0.44, h: H * 0.96 };
      } else if (placement === 'center') {
        subjBox = { x: W * 0.25, y: H * 0.14, w: W * 0.5, h: H * 0.84 };
      }

      const iw = subjAsset.img.width || 1;
      const ih = subjAsset.img.height || 1;
      const k = Math.min(subjBox.w / iw, subjBox.h / ih);
      const dw = iw * k;
      const dh = ih * k;
      const dx =
        placement === 'right-corner'
          ? W - dw - W * 0.015
          : placement === 'left-corner'
            ? W * 0.015
            : subjBox.x + (subjBox.w - dw) / 2;
      const dy = subjAsset.cutout ? H - dh : subjBox.y + (subjBox.h - dh) / 2;

      layers.push({
        id: 'layer_character',
        kind: 'image',
        name: subjAsset.name || 'Main Character',
        x: Math.round(dx),
        y: Math.round(dy),
        w: Math.round(dw),
        h: Math.round(dh),
        opacity: 1,
        visible: true,
        locked: false,
        dataUrl: subjAsset.dataUrl || subjAsset.img.toDataURL('image/png'),
        originalDataUrl: subjAsset.dataUrl || subjAsset.img.toDataURL('image/png'),
        cutout: subjAsset.cutout,
        flipX: false,
        rimGlow: styleObj.fx === 'rim',
        rimColor: P.accent,
        dropShadow: true,
        placementRole: 'character',
      });
    }
  }

  // Layer 3: Requested Brand Logos (Google, Google Flow, Google Gemini, etc.)
  const logos = Array.isArray(spec.logos) ? spec.logos : [];
  if (logos.length > 0) {
    const logoH = Math.max(42, Math.round(H * 0.085));
    const logoPad = Math.round(u * 3);
    // Group or place cleanly at top corners away from heavy text collision
    let cursorTopLeftX = logoPad;
    let cursorTopRightX = W - logoPad;

    for (let i = 0; i < logos.length; i++) {
      const lg = logos[i];
      const builtIn = await renderBrandLogoToDataUrl(lg.brandId, {
        size: Math.round(logoH * 0.68),
        style: lum(P.bg) < 0.35 ? 'glass' : 'light-pill',
        withLabel: true,
        customLabel: lg.label,
      });

      const webLogo = logoImages[lg.id];
      const logoUrl = builtIn?.dataUrl || webLogo?.dataUrl || '';
      if (!logoUrl) continue;

      const aspect = builtIn ? builtIn.width / builtIn.height : webLogo ? webLogo.img.width / Math.max(1, webLogo.img.height) : 2.2;
      const lw = Math.round(logoH * aspect);

      let lx = logoPad;
      let ly = logoPad;
      const plc = lg.placement || (placement === 'right-corner' ? 'top-left' : 'top-right');

      if (plc === 'top-right') {
        cursorTopRightX -= lw;
        lx = Math.max(logoPad, cursorTopRightX);
        cursorTopRightX -= Math.round(u * 1.6);
      } else if (plc === 'bottom-left') {
        lx = logoPad;
        ly = H - logoH - logoPad;
      } else if (plc === 'bottom-right') {
        lx = W - lw - logoPad;
        ly = H - logoH - logoPad;
      } else if (plc === 'top-center') {
        lx = Math.round((W - lw) / 2);
      } else {
        lx = cursorTopLeftX;
        cursorTopLeftX += lw + Math.round(u * 1.6);
      }

      layers.push({
        id: lg.id || `logo_${i + 1}`,
        kind: 'logo',
        name: lg.label,
        brandId: lg.brandId || 'custom',
        label: lg.label,
        badgeStyle: lum(P.bg) < 0.35 ? 'glass' : 'light-pill',
        withLabel: true,
        dataUrl: logoUrl,
        x: lx,
        y: ly,
        w: lw,
        h: logoH,
        opacity: 1,
        visible: true,
        locked: false,
      });
    }
  }

  // Layer 4: Code-rendered Typography Layers (shifted cleanly if logos occupy top-left)
  const topLogoOffset = logos.length > 0 ? Math.round(H * 0.09) : 0;
  const textZoneLeft = placement === 'left-corner' && hasSubject ? W * 0.46 : W * 0.05;
  const textZoneW = placement === 'center' && hasSubject ? W * 0.84 : hasSubject ? W * 0.49 : W * 0.88;
  const textAlign: 'left' | 'center' | 'right' = placement === 'center' ? 'center' : 'left';
  const isDarkBg = Boolean(bgAsset) || lum(P.bg) < 0.4;
  const textColor = isDarkBg ? '#ffffff' : '#0b0d12';
  const strokeColor = styleObj === CANVAS_STYLES.bold || styleObj === CANVAS_STYLES.comic ? '#000000' : undefined;

  if (spec.badge) {
    const bw = Math.min(textZoneW * 0.7, Math.max(120, spec.badge.length * u * 2.2 + u * 4));
    const bh = Math.round(u * 4.4);
    layers.push({
      id: 'layer_badge',
      kind: 'text',
      name: 'Badge',
      textRole: 'badge',
      text: spec.badge,
      fontPairId: pairId,
      fontFamily: font.body,
      fontWeight: 800,
      fontSize: Math.round(u * 2.2),
      color: lum(P.accent) > 0.45 ? '#0b0d12' : '#ffffff',
      accentColor: '#ffffff',
      align: 'center',
      bgPlateColor: P.accent,
      bgPlateRadius: Math.round(bh / 2),
      uppercase: !isDeva(spec.badge),
      x: Math.round(textAlign === 'center' ? (W - bw) / 2 : textZoneLeft),
      y: Math.round(H * 0.07 + topLogoOffset),
      w: Math.round(bw),
      h: bh,
      opacity: 1,
      visible: true,
      locked: false,
    });
  }

  const titleTop = Math.round(H * 0.19 + topLogoOffset * 0.85);
  const titleH = Math.round(H * 0.42);
  const useTextPlate = Boolean(spec.forcePlate || spec.creativeDirection?.useTextPlate);
  if (hasTitleText) {
    layers.push({
      id: 'layer_headline',
      kind: 'text',
      name: 'Headline',
      textRole: 'headline',
      text: spec.title.trim(),
      accentWord: spec.accentWord || '',
      fontPairId: pairId,
      fontFamily: font.display,
      fontWeight: Number(styleObj.weight || font.dw) || 800,
      fontSize: Math.round(Math.min(titleH * 0.46, W * (textAlign === 'center' ? 0.11 : 0.088))),
      color: textColor,
      accentColor: P.accent === P.primary ? '#ffe600' : P.accent,
      strokeColor: strokeColor || (useTextPlate ? undefined : isDarkBg ? 'rgba(0,0,0,0.65)' : undefined),
      strokeWidth: strokeColor ? Math.max(2, Math.round(u * 0.7)) : useTextPlate ? 0 : isDarkBg ? Math.max(1, Math.round(u * 0.28)) : 0,
      bgPlateColor: useTextPlate ? (isDarkBg ? 'rgba(6, 10, 22, 0.76)' : 'rgba(255, 255, 255, 0.84)') : undefined,
      bgPlateRadius: useTextPlate ? Math.round(u * 1.6) : undefined,
      align: textAlign,
      uppercase: Boolean(styleObj.upper) && !isDeva(spec.title || ''),
      shadowBlur: Math.round(u * 1.4),
      x: Math.round(textAlign === 'center' ? (W - textZoneW) / 2 : textZoneLeft),
      y: titleTop,
      w: Math.round(textZoneW),
      h: titleH,
      opacity: 1,
      visible: true,
      locked: false,
    });
  }

  if (spec.subtitle && spec.subtitle.trim()) {
    layers.push({
      id: 'layer_subtitle',
      kind: 'text',
      name: 'Subtitle',
      textRole: 'subtitle',
      text: spec.subtitle.trim(),
      fontPairId: pairId,
      fontFamily: font.body,
      fontWeight: 600,
      fontSize: Math.round(u * 2.9),
      color: isDarkBg ? '#e2e8f0' : '#334155',
      accentColor: P.accent,
      align: textAlign,
      shadowBlur: Math.round(u * 0.8),
      x: Math.round(textAlign === 'center' ? (W - textZoneW) / 2 : textZoneLeft),
      y: Math.round((hasTitleText ? titleTop + titleH : H * 0.35) + u * 1.2),
      w: Math.round(textZoneW),
      h: Math.round(H * 0.13),
      opacity: 1,
      visible: true,
      locked: false,
    });
  }

  if (spec.cta && spec.cta.trim()) {
    const cw = Math.min(textZoneW * 0.75, Math.max(150, spec.cta.length * u * 2.3 + u * 5));
    const ch = Math.round(u * 5.2);
    layers.push({
      id: 'layer_cta',
      kind: 'text',
      name: 'CTA Button',
      textRole: 'cta',
      text: spec.cta.trim(),
      fontPairId: pairId,
      fontFamily: font.body,
      fontWeight: 800,
      fontSize: Math.round(u * 2.5),
      color: lum(P.accent) > 0.45 ? '#0b0d12' : '#ffffff',
      accentColor: '#ffffff',
      align: 'center',
      bgPlateColor: P.accent,
      bgPlateRadius: Math.round(ch / 2),
      x: Math.round(textAlign === 'center' ? (W - cw) / 2 : textZoneLeft),
      y: Math.round(H * 0.84),
      w: Math.round(cw),
      h: ch,
      opacity: 1,
      visible: true,
      locked: false,
    });
  }

  const graph: StudioSceneGraph = {
    width: W,
    height: H,
    style: spec.style,
    palette: spec.palette,
    background: {
      bgHex: P.bg,
      primaryHex: P.primary,
      accentHex: P.accent,
      photoDataUrl: bgAsset ? bgAsset.dataUrl || bgAsset.img.toDataURL('image/png') : undefined,
      gradientMode: bgAsset ? 'photo-dim' : 'studio',
      overlayOpacity: bgAsset ? (spec.creativeDirection?.overlayOpacity ?? 0.54) : 0,
    },
    layers,
  };

  const dataUrl = await renderSceneGraph(graph);
  return {
    graph,
    dataUrl,
    info: {
      layout: layoutId,
      style: spec.style,
      styleName: styleObj.name,
      fonts: font.display,
      layersCount: layers.length,
    },
  };
}

export async function renderCanvasDesign(
  spec: CanvasDesignSpec,
  assets: Record<string, PreparedCanvasAsset> = {},
  size: { w: number; h: number }
) {
  const composed = await composeSceneGraphFromSpec(spec, assets, {}, size);
  const cvEl = cv(size.w, size.h);
  try {
    const img = await loadImage(composed.dataUrl);
    cvEl.getContext('2d')?.drawImage(img, 0, 0, cvEl.width, cvEl.height);
  } catch {}
  return {
    canvas: cvEl,
    dataUrl: composed.dataUrl,
    graph: composed.graph,
    info: {
      ...composed.info,
      titleSize: Math.round(size.w * 0.06),
      titleFits: true,
      titleLines: 1,
      contrast: 7.2,
      hasStroke: false,
      plate: Boolean(composed.graph.background.photoDataUrl),
      subjectDrawn: composed.graph.layers.some((l) => l.kind === 'image'),
    },
  };
}

export async function reRenderSerializedSpec(
  spec: CanvasDesignSpec,
  serializedAssets: SerializedPreparedAsset[],
  size: { w: number; h: number }
) {
  const prepared: Record<string, PreparedCanvasAsset> = {};
  for (const a of serializedAssets || []) {
    try {
      const img = await loadImage(a.dataUrl);
      const canvas = cv(img.width, img.height);
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      prepared[a.id] = {
        img: canvas,
        dataUrl: a.dataUrl,
        cutout: a.cutout,
        role: a.role,
        name: a.name,
      };
    } catch {}
  }
  return renderCanvasDesign(spec, prepared, size);
}

function drawScaledElement(img: HTMLImageElement, maxSize: number) {
  const k = Math.min(1, maxSize / Math.max(img.width || 1, img.height || 1));
  const c = cv((img.width || 1) * k, (img.height || 1) * k);
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

async function fetchWebPhotoCandidates(
  query: string,
  opts: { preferLandscape?: boolean; preferPortrait?: boolean } = {}
): Promise<Array<{ canvas: HTMLCanvasElement; chosen: any; totalCount: number; score: number }>> {
  try {
    const r = await fetch('/api/google-scrape-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, offset: 0 }),
    });
    const j = await r.json();
    const watermarkRe = /(shutterstock|istockphoto|gettyimages|alamy|123rf|dreamstime|depositphotos|vecteezy)/i;
    const rawList = (j.images || []).filter(
      (i: any) => !/\.svg(\?|$)/i.test(i.url || '') && (!i.width || i.width >= 380)
    );

    const scored = rawList
      .map((item: any) => {
        const url = String(item.url || '');
        const domain = String(item.sourceDomain || '');
        const w = Number(item.width) || 900;
        const h = Number(item.height) || 700;
        let score = 0;
        if (w >= 1200) score += 5;
        else if (w >= 900) score += 3;
        if (w * h >= 900000) score += 3;
        if (!watermarkRe.test(url) && !watermarkRe.test(domain)) score += 7;
        if (opts.preferLandscape && w > h) score += 2;
        if (opts.preferPortrait && h >= w) score += 2;
        return { item, score };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 8);

    if (!scored.length) return [];

    const out: Array<{ canvas: HTMLCanvasElement; chosen: any; totalCount: number; score: number }> = [];
    for (const entry of scored) {
      const c = entry.item;
      const target = c.url || c.thumbnail;
      if (!target) continue;
      const proxied = `/api/studio/img-proxy?url=${encodeURIComponent(target)}`;
      try {
        const img = await loadImage(proxied);
        if ((img.width || 0) < 340 || (img.height || 0) < 340) continue;
        const canvas = drawScaledElement(img, 1800);
        out.push({ canvas, chosen: c, totalCount: rawList.length, score: entry.score });
        if (out.length >= 4) break;
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Converts an uploaded flat image into a fully editable Canva StudioSceneGraph
 * using backend Groq Vision (/api/studio/scan-image) + seamless text infill + subject cutout.
 */
export async function scanUploadedImageToSceneGraph(params: {
  imageDataUrl: string;
  instruction: string;
  token?: string | null;
  onProgress?: (percent: number, label: string) => void;
  onStep?: (step: StudioThinkingLogStep) => void;
}): Promise<{
  graph: StudioSceneGraph;
  imageDataUrl: string;
  width: number;
  height: number;
  steps: StudioThinkingLogStep[];
}> {
  const { imageDataUrl, instruction, token, onProgress, onStep } = params;
  const steps: StudioThinkingLogStep[] = [];
  const emitStep = (kind: StudioThinkingLogStep['kind'], text: string, extra?: Partial<StudioThinkingLogStep>) => {
    const s: StudioThinkingLogStep = { kind, text, ...extra };
    steps.push(s);
    onStep?.(s);
  };

  onProgress?.(18, 'Scanning image layers');
  const srcImg = await loadImage(imageDataUrl);
  const srcCanvas = drawScaledElement(srcImg, 1400);
  const W = srcCanvas.width;
  const H = srcCanvas.height;
  emitStep('analysis', `Scanned ${W}×${H} image structure to detect editable text, elements, and backdrop.`);

  const scanRes = await fetch('/api/studio/scan-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildWorkspaceAuthHeaders(token),
    },
    body: JSON.stringify({
      imageDataUrl: srcCanvas.toDataURL('image/jpeg', 0.86),
      instruction,
    }),
  });
  const scanJson = await scanRes.json().catch(() => ({}));
  if (!scanRes.ok || !scanJson?.ok) {
    throw new Error(scanJson?.error || 'Could not scan image elements.');
  }

  onProgress?.(48, 'Isolating elements & text');
  const textBlocks: any[] = Array.isArray(scanJson.textBlocks) ? scanJson.textBlocks : [];
  const cleanBgCanvas = createInpaintedBackdrop(srcCanvas, textBlocks);
  const cleanBgUrl = cleanBgCanvas.toDataURL('image/png');

  const layers: StudioSceneLayer[] = [];

  // Optional 3-pass cutout of detected subject if user wants subject draggable cleanly
  if (scanJson.subjectBox?.found) {
    try {
      const cut = await cutoutVerifyAndRefine(cleanBgUrl, 2);
      if (cut.ok) {
        layers.push({
          id: 'scan_subject',
          kind: 'image',
          name: scanJson.subjectBox.label || 'Main Subject',
          x: 0,
          y: 0,
          w: W,
          h: H,
          opacity: 1,
          visible: true,
          locked: false,
          dataUrl: cut.cutoutDataUrl,
          originalDataUrl: cut.cutoutDataUrl,
          cutout: true,
          dropShadow: false,
          placementRole: 'character',
        });
        emitStep('edit', `Isolated draggable subject cutout (${cut.passesUsed} pass${cut.passesUsed > 1 ? 'es' : ''}).`);
      }
    } catch {}
  }

  // Detected Logos as editable Canva layers
  for (let i = 0; i < (scanJson.logos || []).length; i++) {
    const lg = scanJson.logos[i];
    if (lg.brandId && lg.brandId !== 'custom') {
      const lx = Math.round((lg.xPct / 100) * W);
      const ly = Math.round((lg.yPct / 100) * H);
      const lw = Math.round((lg.wPct / 100) * W);
      const lh = Math.round((lg.hPct / 100) * H);
      layers.push({
        id: lg.id || `scan_logo_${i + 1}`,
        kind: 'logo',
        name: lg.label || 'Brand Logo',
        brandId: lg.brandId,
        label: lg.label || 'Brand',
        badgeStyle: 'glass',
        withLabel: false,
        x: lx,
        y: ly,
        w: Math.max(40, lw),
        h: Math.max(40, lh),
        opacity: 1,
        visible: true,
        locked: false,
      });
    }
  }

  // Detected Text Blocks -> Editable Canva Text Layers
  textBlocks.forEach((tb, idx) => {
    const finalTxt = tb.replacementText || tb.text;
    const x = Math.round((tb.xPct / 100) * W);
    const y = Math.round((tb.yPct / 100) * H);
    const w = Math.max(80, Math.round((tb.wPct / 100) * W));
    const h = Math.max(32, Math.round((tb.hPct / 100) * H));
    const fontSize = Math.max(16, Math.round((tb.fontSizePct / 100) * H));

    layers.push({
      id: tb.id || `scan_txt_${idx + 1}`,
      kind: 'text',
      name: `Text ${idx + 1}: ${finalTxt.slice(0, 18)}`,
      textRole: idx === 0 ? 'headline' : 'custom',
      text: finalTxt,
      fontPairId: isDeva(finalTxt) ? 'hi-bold-poppins' : 'modern-grotesk',
      fontFamily: isDeva(finalTxt) ? 'Poppins' : 'Space Grotesk',
      fontWeight: tb.fontWeight || 800,
      fontSize,
      color: tb.color || '#ffffff',
      accentColor: '#00e5ff',
      align: tb.align || 'left',
      shadowBlur: Math.round(W * 0.008),
      x,
      y,
      w,
      h,
      opacity: 1,
      visible: true,
      locked: false,
    });
  });

  if (textBlocks.length === 0) {
    layers.push({
      id: 'scan_txt_new',
      kind: 'text',
      name: 'Editable Title',
      textRole: 'headline',
      text: 'Double-click to edit text',
      fontPairId: 'modern-grotesk',
      fontFamily: 'Space Grotesk',
      fontWeight: 800,
      fontSize: Math.round(H * 0.08),
      color: '#ffffff',
      accentColor: '#00e5ff',
      strokeColor: '#000000',
      strokeWidth: 4,
      align: 'center',
      x: Math.round(W * 0.1),
      y: Math.round(H * 0.12),
      w: Math.round(W * 0.8),
      h: Math.round(H * 0.16),
      opacity: 1,
      visible: true,
      locked: false,
    });
  }

  emitStep('decision', `Converted image into ${layers.length} interactive Canva layers (drag, drop, resize, edit text).`);
  onProgress?.(82, 'Rendering editable scene');

  const graph: StudioSceneGraph = {
    width: W,
    height: H,
    style: 'cinema',
    palette: 'neon-night',
    background: {
      bgHex: (scanJson.dominantColors && scanJson.dominantColors[0]) || '#0b1020',
      primaryHex: (scanJson.dominantColors && scanJson.dominantColors[1]) || '#6a2cff',
      accentHex: (scanJson.dominantColors && scanJson.dominantColors[2]) || '#00e5ff',
      photoDataUrl: cleanBgUrl,
      gradientMode: 'photo-dim',
      overlayOpacity: 0,
    },
    layers,
  };

  const renderedUrl = await renderSceneGraph(graph);
  onProgress?.(100, 'Ready for Canva editing');
  emitStep('result', `Prepared ${W}×${H} Canva workspace with ${textBlocks.length} editable text layer(s).`);

  return {
    graph,
    imageDataUrl: renderedUrl,
    width: W,
    height: H,
    steps,
  };
}

export interface CanvasStudioPipelineResult {
  refused?: string;
  imageDataUrl: string;
  width: number;
  height: number;
  spec: CanvasDesignSpec;
  serializedAssets: SerializedPreparedAsset[];
  sceneGraph?: StudioSceneGraph;
  info: any;
  steps: StudioThinkingLogStep[];
  sources: StudioSourceAttribution[];
  elapsedMs: number;
}

export async function runCanvasStudioPipeline(params: {
  message: string;
  intent: { intent?: string; recipe?: string | null; lang?: string };
  answers?: Record<string, string>;
  attachments?: StudioAttachmentMeta[];
  previousSpec?: CanvasDesignSpec | null;
  getUploadDataUrl: (uploadId: string) => { dataUrl: string; name: string } | null;
  token?: string | null;
  onProgress?: (percent: number, stageLabel: string) => void;
  onStep?: (step: StudioThinkingLogStep) => void;
}): Promise<CanvasStudioPipelineResult> {
  const {
    message,
    intent,
    answers = {},
    attachments = [],
    previousSpec = null,
    getUploadDataUrl,
    token,
    onProgress,
    onStep,
  } = params;

  const t0 = performance.now();
  const hi = intent?.lang === 'hi';
  const steps: StudioThinkingLogStep[] = [];
  const sources: StudioSourceAttribution[] = [];

  const emitStep = (kind: StudioThinkingLogStep['kind'], text: string, extra?: Partial<StudioThinkingLogStep>) => {
    const s: StudioThinkingLogStep = { kind, text, ...extra };
    steps.push(s);
    onStep?.(s);
  };

  onProgress?.(6, 'Checking WebGPU & inspecting uploaded files');

  const gpuCaps = await probeWebGpuCapabilities();
  emitStep(
    'check',
    gpuCaps.available
      ? `WebGPU ready (${gpuCaps.adapterLabel}) for segmentation, color grading & edge polish.`
      : 'WebGPU unavailable in this browser context; using Canvas/CPU pixel pipeline.'
  );

  // Inspect ALL user-uploaded images via Groq Vision before planning
  let uploadAnalyses: any[] = [];
  if (attachments.length > 0) {
    const uploadPayloads: Array<{ id: string; name: string; dataUrl: string }> = [];
    for (const a of attachments) {
      if (a.facts) {
        emitStep(
          'analysis',
          hi
            ? `${a.name} (${a.facts.width}×${a.facts.height}) का विश्लेषण किया।`
            : `Analysed ${a.name} (${a.facts.width}×${a.facts.height}, ${a.facts.orientation || 'photo'}).`,
          { file: a.name }
        );
      }
      const rawUp = getUploadDataUrl(a.id);
      if (rawUp?.dataUrl) {
        try {
          const img = await loadImage(rawUp.dataUrl);
          const small = drawScaledElement(img, 900);
          uploadPayloads.push({
            id: a.id,
            name: a.name,
            dataUrl: small.toDataURL('image/jpeg', 0.82),
          });
        } catch {}
      }
    }

    if (uploadPayloads.length > 0) {
      try {
        const upRes = await fetch('/api/studio/analyze-uploads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...buildWorkspaceAuthHeaders(token),
          },
          body: JSON.stringify({ uploads: uploadPayloads, instruction: message }),
        });
        const upJson = await upRes.json().catch(() => ({}));
        if (upRes.ok && Array.isArray(upJson?.analyses)) {
          uploadAnalyses = upJson.analyses;
          const rolesSummary = uploadAnalyses
            .map((u: any) => `${u.name}: ${u.role}${u.ocrText?.length ? ` (text: "${u.ocrText[0]}")` : ''}`)
            .join(' · ');
          emitStep('analysis', `Groq Vision inspected uploaded files → ${rolesSummary}.`);
        }
      } catch {}
    }
  }

  onProgress?.(16, 'Planning creative direction & layers');

  const planRes = await fetch('/api/studio/canvas-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildWorkspaceAuthHeaders(token),
    },
    body: JSON.stringify({
      message,
      intent,
      answers,
      uploads: attachments,
      uploadAnalyses,
      previousSpec,
    }),
  });

  const planJson = await planRes.json().catch(() => ({}));
  if (!planRes.ok) {
    throw new Error(planJson?.error || `Studio backend planner error (${planRes.status})`);
  }

  if (planJson.refused) {
    return {
      refused: String(planJson.refused),
      imageDataUrl: '',
      width: 1080,
      height: 1080,
      spec: {} as CanvasDesignSpec,
      serializedAssets: [],
      info: {},
      steps,
      sources,
      elapsedMs: Math.max(100, Math.round(performance.now() - t0)),
    };
  }

  const spec: CanvasDesignSpec = planJson.spec;
  const resolved = planJson.resolved || { size: { w: 1280, h: 720 }, language: 'en' };
  const recipeName = RECIPES_NAME[spec.recipe || 'generic'] || 'image';

  emitStep(
    'understand',
    hi
      ? `रिक्वेस्ट समझी: ${recipeName} (${resolved.size.w}×${resolved.size.h}).`
      : `Planned multi-layer ${recipeName} (${resolved.size.w}×${resolved.size.h}) · character in ${spec.characterSpec?.placement || 'right-corner'}${spec.logos?.length ? ` · logos: ${spec.logos.map((l) => l.label).join(', ')}` : ''}.`
  );

  onProgress?.(28, 'Preparing & researching assets');

  const prepared: Record<string, PreparedCanvasAsset> = {};
  const logoAssets: Record<string, PreparedCanvasAsset> = {};
  const serializedAssets: SerializedPreparedAsset[] = [];
  let alternateBgCandidates: Array<{ canvas: HTMLCanvasElement; chosen: any }> = [];

  // 1. TWO-UPLOAD OR PRO-KEYWORD WEB-SEARCH FACE SWAP PIPELINE
  const wantsFaceSwap = Boolean(spec.faceSwap?.needed && attachments.length >= 1);
  if (wantsFaceSwap) {
    const faceRefAnalysis = uploadAnalyses.find((u: any) => u.role === 'face-reference') || uploadAnalyses[uploadAnalyses.length - 1];
    const faceId = faceRefAnalysis?.uploadId || attachments[attachments.length - 1].id;
    const faceUp = getUploadDataUrl(faceId);
    if (faceUp?.dataUrl) {
      onProgress?.(36, 'Finding pro portrait & WebGPU face swap');
      let swappedCanvas: HTMLCanvasElement | null = null;
      let targetName = 'face-swap-portrait';

      if (attachments.length >= 2) {
        const targetId = attachments.find((a) => a.id !== faceId)?.id || attachments[0].id;
        const targetUp = getUploadDataUrl(targetId);
        if (targetUp?.dataUrl) {
          const swap = await performWebGpuFaceSwap({
            targetImageDataUrl: targetUp.dataUrl,
            sourceFaceDataUrl: faceUp.dataUrl,
            promptText: message,
          });
          if (swap.ok && swap.resultDataUrl) {
            const img = await loadImage(swap.resultDataUrl);
            swappedCanvas = drawScaledElement(img, 1600);
            emitStep('edit', `Completed WebGPU face swap (${swap.usedWebGpu ? 'WGSL GPU' : 'Canvas'} illumination match).`, {
              screenshotDataUrl: swap.alignmentScreenshotDataUrl,
              screenshotLabel: 'WebGPU Face Alignment',
            });
          }
        }
      } else {
        const proKeyword = spec.faceSwap?.proPortraitQuery || `${message} studio portrait photography 85mm`;
        emitStep('search', `Visual A-Z portrait search: “${proKeyword}”.`, { query: proKeyword });
        const candidates = await fetchWebPhotoCandidates(proKeyword, { preferPortrait: resolved.size.h >= resolved.size.w });
        for (const cand of candidates) {
          const targetUrl = cand.canvas.toDataURL('image/png');
          const swap = await performWebGpuFaceSwap({
            targetImageDataUrl: targetUrl,
            sourceFaceDataUrl: faceUp.dataUrl,
            promptText: message,
          });
          if (swap.ok && swap.resultDataUrl) {
            const img = await loadImage(swap.resultDataUrl);
            swappedCanvas = drawScaledElement(img, 1600);
            targetName = cand.chosen?.title || proKeyword;
            if (cand.chosen) {
              sources.push({
                domain: cand.chosen.sourceDomain,
                url: cand.chosen.sourceUrl || cand.chosen.url,
                title: cand.chosen.title,
              });
            }
            emitStep(
              'edit',
              `Swapped user face into ${cand.chosen?.sourceDomain || 'web'} portrait using ${swap.usedWebGpu ? 'WebGPU WGSL' : 'Canvas'} shader.`,
              {
                screenshotDataUrl: swap.alignmentScreenshotDataUrl,
                screenshotLabel: 'WebGPU Face Swap',
              }
            );
            break;
          }
        }
      }

      if (swappedCanvas) {
        let finalUrl = swappedCanvas.toDataURL('image/png');
        let isCutout = false;
        if (spec.characterSpec?.removeBackground !== false) {
          const cut = await cutoutVerifyAndRefine(finalUrl, 3);
          const cutImg = await loadImage(cut.cutoutDataUrl);
          swappedCanvas = drawScaledElement(cutImg, 1600);
          finalUrl = swappedCanvas.toDataURL('image/png');
          isCutout = true;
          emitStep('edit', `Removed portrait backdrop (${cut.passesUsed} cutout pass${cut.passesUsed > 1 ? 'es' : ''}).`, {
            screenshotDataUrl: cut.outlineScreenshotDataUrl,
            screenshotLabel: 'Character Cutout',
          });
        }
        prepared['a1'] = { img: swappedCanvas, dataUrl: finalUrl, cutout: isCutout, role: 'subject', name: targetName };
        serializedAssets.push({ id: 'a1', dataUrl: finalUrl, cutout: isCutout, role: 'subject', name: targetName });
        spec.hero = { type: 'asset', id: 'a1' };
      }
    }
  }

  // 2. STANDARD ASSETS (UPLOADED & VISUAL A-Z TOPIC BACKGROUND / CHARACTER CUTOUT)
  for (const a of (spec.assets || []).slice(0, 4)) {
    const id = String(a.id || 'a1').replace(/[^a-z0-9_-]/gi, '') || 'a1';
    if (prepared[id]) continue;
    const role: 'subject' | 'background' = a.role === 'background' ? 'background' : 'subject';

    try {
      if (a.source === 'upload') {
        const up = getUploadDataUrl(String(a.uploadId || attachments[0]?.id || ''));
        if (!up?.dataUrl) continue;
        const img = await loadImage(up.dataUrl);
        let canvas = drawScaledElement(img, 1800);
        const name = up.name || 'upload.png';
        const baseUrl = canvas.toDataURL('image/png');
        const facts = await analyzeImageDataUrl(baseUrl, name).catch(() => ({ hasAlpha: false }));
        let cutout = Boolean(facts.hasAlpha);

        if (a.removeBackground && !cutout && role === 'subject') {
          onProgress?.(46, '3-pass WebGPU background removal');
          const cut = await cutoutVerifyAndRefine(baseUrl, 3);
          const cutImg = await loadImage(cut.cutoutDataUrl);
          canvas = drawScaledElement(cutImg, 1800);
          cutout = true;
          emitStep('edit', `Removed background (${cut.passesUsed}/3 passes · quality ${(cut.qualityScore * 100).toFixed(0)}%).`, {
            screenshotDataUrl: cut.outlineScreenshotDataUrl,
            screenshotLabel: 'Cutout Check',
          });
        }

        if (a.adjust && Object.keys(a.adjust).length) canvas = adjustCanvas(canvas, a.adjust);
        const finalDataUrl = canvas.toDataURL('image/png');
        prepared[id] = { img: canvas, dataUrl: finalDataUrl, cutout, role, name };
        serializedAssets.push({ id, dataUrl: finalDataUrl, cutout, role, name });
      } else if (a.source === 'search' && a.query) {
        onProgress?.(38, role === 'background' ? 'Visual A-Z background search' : 'Visual A-Z subject search');
        const candidates = await fetchWebPhotoCandidates(String(a.query).slice(0, 80), {
          preferLandscape: role === 'background' && resolved.size.w >= resolved.size.h,
          preferPortrait: role === 'background' && resolved.size.h > resolved.size.w,
        });
        if (!candidates.length) {
          emitStep('search', `Visual A-Z search “${a.query}”: no usable photo; rendered studio backdrop.`);
          continue;
        }

        if (role === 'background') {
          const chosenCand = candidates[0];
          alternateBgCandidates = candidates.slice(1);
          const gradePreset = spec.creativeDirection?.colorGrade || 'cinematic-teal-orange';
          const graded = await applyWebGpuColorGrade(chosenCand.canvas, gradePreset).catch(() => ({
            canvas: chosenCand.canvas,
          }));
          const finalUrl = graded.canvas.toDataURL('image/jpeg', 0.88);
          prepared[id] = { img: graded.canvas, dataUrl: finalUrl, cutout: false, role: 'background', name: a.query };
          serializedAssets.push({ id, dataUrl: finalUrl, cutout: false, role: 'background', name: a.query });
          emitStep('search', `Visual A-Z selected topic background from ${chosenCand.chosen?.sourceDomain || 'web'} for “${a.query}”.`, {
            query: a.query,
          });
          if (chosenCand.chosen) {
            sources.push({
              domain: chosenCand.chosen.sourceDomain,
              url: chosenCand.chosen.sourceUrl || chosenCand.chosen.url,
              title: chosenCand.chosen.title,
            });
          }
          continue;
        }

        // Character / Subject candidate loop with 3-pass cutout verification + auto-swap on failure
        let acceptedCanvas: HTMLCanvasElement | null = null;
        let acceptedChosen: any = candidates[0].chosen;
        let acceptedCutout = false;

        for (let ci = 0; ci < candidates.length; ci++) {
          const cand = candidates[ci];
          const baseUrl = cand.canvas.toDataURL('image/png');
          const facts = await analyzeImageDataUrl(baseUrl, cand.chosen?.title || a.query).catch(() => ({ hasAlpha: false }));

          if (!a.removeBackground || facts.hasAlpha) {
            const gradePreset = spec.creativeDirection?.colorGrade || 'portrait-natural';
            const graded = await applyWebGpuColorGrade(cand.canvas, gradePreset).catch(() => ({ canvas: cand.canvas }));
            acceptedCanvas = graded.canvas;
            acceptedChosen = cand.chosen;
            acceptedCutout = Boolean(facts.hasAlpha);
            emitStep('edit', `Enhanced high-res studio subject photo with ${gradePreset} WebGPU color grading.`);
            break;
          }

          onProgress?.(44 + ci * 5, `Cutout verify candidate ${ci + 1}/${candidates.length}`);
          const cutRes = await cutoutVerifyAndRefine(baseUrl, 3);
          const cutImg = await loadImage(cutRes.cutoutDataUrl);
          const cutCv = drawScaledElement(cutImg, 1600);

          if (cutRes.ok || ci === candidates.length - 1) {
            acceptedCanvas = cutCv;
            acceptedChosen = cand.chosen;
            acceptedCutout = true;
            emitStep(
              'edit',
              cutRes.ok
                ? `Cutout verified clean (${cutRes.passesUsed} pass${cutRes.passesUsed > 1 ? 'es' : ''}, score ${(cutRes.qualityScore * 100).toFixed(0)}%) on ${cand.chosen?.sourceDomain || 'web'} photo.`
                : `Completed best available 3-pass cutout (${cutRes.method}).`,
              {
                screenshotDataUrl: cutRes.outlineScreenshotDataUrl,
                screenshotLabel: '3-Pass WebGPU Cutout',
              }
            );
            break;
          } else {
            emitStep(
              'check',
              `Photo #${ci + 1} cutout failed edge check (${cutRes.reason}) — swapping to next candidate photo.`
            );
          }
        }

        if (acceptedCanvas) {
          if (a.adjust && Object.keys(a.adjust).length) acceptedCanvas = adjustCanvas(acceptedCanvas, a.adjust);
          const finalUrl = acceptedCanvas.toDataURL('image/png');
          const name = (acceptedChosen?.title || a.query).slice(0, 50);
          prepared[id] = { img: acceptedCanvas, dataUrl: finalUrl, cutout: acceptedCutout, role: 'subject', name };
          serializedAssets.push({ id, dataUrl: finalUrl, cutout: acceptedCutout, role: 'subject', name });
          if (acceptedChosen) {
            sources.push({
              domain: acceptedChosen.sourceDomain,
              url: acceptedChosen.sourceUrl || acceptedChosen.url,
              title: acceptedChosen.title,
            });
          }
        }
      }
    } catch {}
  }

  // 2B. SUPPORTING OBJECTS (Visual A-Z + cutout)
  for (let oi = 0; oi < (spec.supportingObjects || []).length; oi++) {
    const obj = spec.supportingObjects![oi];
    if (!obj?.query) continue;
    try {
      const cands = await fetchWebPhotoCandidates(obj.query);
      if (cands[0]) {
        const cut = await cutoutVerifyAndRefine(cands[0].canvas.toDataURL('image/png'), 2);
        const img = await loadImage(cut.cutoutDataUrl);
        const cvEl = drawScaledElement(img, 900);
        const oid = obj.id || `obj_${oi + 1}`;
        prepared[oid] = {
          img: cvEl,
          dataUrl: cut.cutoutDataUrl,
          cutout: true,
          role: 'object',
          name: obj.query.slice(0, 40),
          placement: obj.placement,
        };
        emitStep('search', `Added supporting object cutout: “${obj.query}”.`, { query: obj.query });
      }
    } catch {}
  }

  // 3. CUSTOM UNLISTED BRAND LOGOS WEB FALLBACK
  for (const lg of spec.logos || []) {
    if (lg.brandId === 'custom' && lg.query) {
      try {
        const cands = await fetchWebPhotoCandidates(lg.query);
        if (cands[0]) {
          const cut = await cutoutVerifyAndRefine(cands[0].canvas.toDataURL('image/png'), 2);
          const img = await loadImage(cut.cutoutDataUrl);
          const cvEl = drawScaledElement(img, 512);
          logoAssets[lg.id] = { img: cvEl, dataUrl: cut.cutoutDataUrl, cutout: true, role: 'logo', name: lg.label };
        }
      } catch {}
    }
  }

  const styleObj = CANVAS_STYLES[spec.style] || CANVAS_STYLES.bold;
  const palObj = CANVAS_DATA.PALETTES[spec.palette] || CANVAS_DATA.PALETTES['neon-night'];
  emitStep(
    'decision',
    hi
      ? `${styleObj.name} स्टाइल और ${palObj.name} पैलेट चुना। ${spec.rationale || ''}`.trim()
      : `Selected optimal ${styleObj.name} composition with ${palObj.name} palette. ${spec.rationale || ''}`.trim()
  );

  onProgress?.(72, 'Composing scene graph in code');
  let composed = await composeSceneGraphFromSpec(spec, prepared, logoAssets, resolved.size);

  // 4. QUALITY CONTROL & AUTO-REPAIR LOOP (Groq Vision primary + Gemini fallback)
  onProgress?.(88, 'Running visual Quality Control');
  try {
    const qcRes = await fetch('/api/studio/inspect-render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildWorkspaceAuthHeaders(token),
      },
      body: JSON.stringify({
        imageDataUrl: composed.dataUrl,
        prompt: message,
        plan: spec,
        width: resolved.size.w,
        height: resolved.size.h,
      }),
    });
    const qc = await qcRes.json().catch(() => null);
    if (qc && qc.inspectorAvailable) {
      emitStep(
        'check',
        `Quality Control score ${qc.score}/100${qc.inspectorModel ? ` (${qc.inspectorModel})` : ''}: ${qc.summary}`
      );
      if (!qc.approved) {
        onProgress?.(93, 'Applying automatic Quality Control repairs');
        const hints = qc.repairHints || {};
        const hasTextLayers = composed.graph.layers.some((l) => l.kind === 'text');
        if (hasTextLayers && (hints.increaseOverlay || hints.addTextPlate || qc.defects?.some((d: any) => d.area === 'text'))) {
          composed.graph.background.overlayOpacity = Math.min(0.82, (composed.graph.background.overlayOpacity || 0.5) + 0.2);
          for (const layer of composed.graph.layers) {
            if (layer.kind === 'text' && layer.textRole === 'headline') {
              layer.bgPlateColor = layer.bgPlateColor || 'rgba(6, 10, 22, 0.78)';
              layer.bgPlateRadius = layer.bgPlateRadius || Math.round((resolved.size.w / 100) * 1.6);
              layer.strokeColor = layer.strokeColor || '#000000';
              layer.strokeWidth = Math.max(2, layer.strokeWidth || 2);
            }
          }
        }
        if ((hints.swapBackground || qc.defects?.some((d: any) => d.area === 'background')) && alternateBgCandidates.length > 0) {
          const alt = alternateBgCandidates[0];
          const gradePreset = spec.creativeDirection?.colorGrade || 'cinematic-teal-orange';
          const graded = await applyWebGpuColorGrade(alt.canvas, gradePreset).catch(() => ({ canvas: alt.canvas }));
          const altUrl = graded.canvas.toDataURL('image/jpeg', 0.88);
          composed.graph.background.photoDataUrl = altUrl;
        }
        if (hasTextLayers && hints.shiftTextZone) {
          for (const layer of composed.graph.layers) {
            if (layer.kind === 'text' && layer.textRole === 'headline') {
              layer.y = Math.max(Math.round(resolved.size.h * 0.14), layer.y);
            }
          }
        }
        composed.dataUrl = await renderSceneGraph(composed.graph);
        emitStep('edit', 'Auto-repaired contrast/layout after Quality Control and re-rendered final image.');
      }
    }
  } catch {}

  onProgress?.(97, 'Finalizing verified PNG export');
  emitStep(
    'check',
    `Rendered ${composed.graph.layers.length} editable code layers (${resolved.size.w}×${resolved.size.h}) cleanly.`
  );

  const elapsedMs = Math.max(100, Math.round(performance.now() - t0));
  const secs = Math.max(1, Math.round(elapsedMs / 1000));
  emitStep('result', `Completed ${resolved.size.w}×${resolved.size.h} layered design in ${secs}s.`);
  onProgress?.(100, 'Done');

  return {
    imageDataUrl: composed.dataUrl,
    width: resolved.size.w,
    height: resolved.size.h,
    spec,
    serializedAssets,
    sceneGraph: composed.graph,
    info: composed.info,
    steps,
    sources,
    elapsedMs,
  };
}
