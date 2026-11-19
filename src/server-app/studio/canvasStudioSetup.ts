import fs from 'fs';
import path from 'path';

/**
 * Backend-saved Creative Studio Image Generation Setup
 * Preserves the exact design catalog, planner system prompt, spec normalization,
 * intent/question setup, and Canvas Design Engine configuration from creative-studio_bfcfe471.html,
 * powered strictly by the server-side Groq API secret without asking the user for any API key.
 */

export const STUDIO_DATA = {
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
  },
  FONTS: {
    'hi-bold-poppins': { display: 'Poppins', dw: '800', body: 'Poppins', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@500;800;900&display=swap', bestFor: 'Headlines in Hindi+English, thumbnails, general' },
    'hi-news-khand': { display: 'Khand', dw: '700', body: 'Hind', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Khand:wght@600;700&family=Hind:wght@500&display=swap', bestFor: 'News, sports, urgent Hindi headlines' },
    'hi-rozha': { display: 'Rozha One', dw: '400', body: 'Hind', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Rozha+One&family=Hind:wght@500&display=swap', bestFor: 'Festival, cultural, invitations in Hindi' },
    'hi-yatra': { display: 'Yatra One', dw: '400', body: 'Hind', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Yatra+One&family=Hind:wght@500&display=swap', bestFor: 'Rustic, vintage, brush-like Hindi titles' },
    'hi-kalam': { display: 'Kalam', dw: '700', body: 'Kalam', bw: '400', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap', bestFor: 'Handwritten Hindi, doodle, casual' },
    'hi-baloo': { display: 'Baloo 2', dw: '800', body: 'Baloo 2', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;800&display=swap', bestFor: 'Friendly rounded Hindi, kids, food' },
    'hi-rajdhani': { display: 'Rajdhani', dw: '700', body: 'Rajdhani', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap', bestFor: 'Tech / gaming Hindi' },
    'hi-serif': { display: 'Noto Serif Devanagari', dw: '800', body: 'Noto Sans Devanagari', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@800&family=Noto+Sans+Devanagari:wght@500&display=swap', bestFor: 'Editorial Hindi, quotes' },
    'hi-anek': { display: 'Anek Devanagari', dw: '800', body: 'Anek Devanagari', bw: '400', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Anek+Devanagari:wght@400;800&display=swap', bestFor: 'Modern Hindi UI-style posters' },
    'hi-tiro': { display: 'Tiro Devanagari Hindi', dw: '400', body: 'Hind', bw: '500', scripts: ['latin', 'devanagari'], url: 'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Hind:wght@500&display=swap', bestFor: 'Classic literary Hindi' },
    'condensed-bebas': { display: 'Bebas Neue', dw: '400', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@500;700&display=swap', bestFor: 'Tall condensed titles: news, gaming, sports' },
    'anton-oswald': { display: 'Anton', dw: '400', body: 'Oswald', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500&display=swap', bestFor: 'Heavy impact thumbnails' },
    'editorial-playfair': { display: 'Playfair Display', dw: '900', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@500&display=swap', bestFor: 'Editorial, documentary, quotes' },
    'modern-grotesk': { display: 'Space Grotesk', dw: '700', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@500&display=swap', bestFor: 'Tech, SaaS, clean modern' },
    'luxe-dm-serif': { display: 'DM Serif Display', dw: '400', body: 'Montserrat', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Montserrat:wght@500&display=swap', bestFor: 'Luxury, fashion, wedding' },
    'comic-bangers': { display: 'Bangers', dw: '400', body: 'Poppins', bw: '600', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Bangers&family=Poppins:wght@600&display=swap', bestFor: 'Comic / pop-art / fun' },
    'street-marker': { display: 'Permanent Marker', dw: '400', body: 'Inter', bw: '600', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Inter:wght@600&display=swap', bestFor: 'Street, grunge, handwritten emphasis' },
    'arcade-pixel': { display: 'Press Start 2P', dw: '400', body: 'Space Grotesk', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@500&display=swap', bestFor: 'Retro games (keep titles very short)' },
    'techno-orbitron': { display: 'Orbitron', dw: '800', body: 'Rajdhani', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800&family=Rajdhani:wght@500&display=swap', bestFor: 'Sci-fi, cyberpunk' },
    'royal-cinzel': { display: 'Cinzel', dw: '700', body: 'Montserrat', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Montserrat:wght@500&display=swap', bestFor: 'Royal, historical, awards' },
    'wide-unbounded': { display: 'Unbounded', dw: '800', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@800&family=Inter:wght@500&display=swap', bestFor: 'Wide, trendy, music, startup' },
    'art-syne': { display: 'Syne', dw: '800', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Inter:wght@500&display=swap', bestFor: 'Art, design studios' },
    'heavy-archivo': { display: 'Archivo Black', dw: '400', body: 'Inter', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@500&display=swap', bestFor: 'Brutalist, sale, bold statement' },
    'script-pacifico': { display: 'Pacifico', dw: '400', body: 'Poppins', bw: '500', scripts: ['latin'], url: 'https://fonts.googleapis.com/css2?family=Pacifico&family=Poppins:wght@500&display=swap', bestFor: 'Friendly script accents (not for Hindi)' },
  },
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
  },
} as const;

export const STYLE_INFO: Record<string, string> = {
  bold: 'loud high-contrast YouTube/social thumbnails, sale, sports, news',
  neon: 'tech, AI, gaming, coding, night, cyber (dark)',
  glass: 'modern app/SaaS/promos, premium clean (frosted card)',
  luxury: 'jewellery, wedding, premium brand, awards (dark+gold)',
  swiss: 'minimal corporate, announcements, clean posters (light)',
  comic: 'fun, kids, cricket/sports, memes, comics',
  mesh: 'startup launches, banners, modern gradients',
  pastel: 'quotes, wellness, kids, soft lifestyle, greetings (light)',
  cinema: 'documentary, film, story, history, serious topics',
  synth: 'music, retro, party, 80s, gaming posters',
  brutal: 'bold statements, events, streetwear (light, loud)',
  sticker: 'social posts, reels, food, youth, friendly tips',
};

export const STYLE_NAMES: Record<string, string> = {
  bold: 'Bold Thumbnail',
  neon: 'Neon Cyberpunk',
  glass: 'Glassmorphism',
  luxury: 'Dark Luxury',
  swiss: 'Minimal Swiss',
  comic: 'Pop Art Comic',
  mesh: 'Gradient Mesh',
  pastel: 'Pastel Soft',
  cinema: 'Cinematic',
  synth: 'Synthwave',
  brutal: 'Brutalist',
  sticker: 'Sticker Pop',
};

export const STYLE_PAL: Record<string, string[]> = {
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

export const RECIPE_DEFAULTS: Record<string, [string, string, string]> = {
  thumbnail: ['bold', 'money-red', 'text-left-subject-right'],
  poster: ['cinema', 'teal-orange', 'poster-stack'],
  'ig-post': ['sticker', 'candy', 'centered-hero'],
  'story-reel': ['sticker', 'sunset-pop', 'story-vertical'],
  banner: ['mesh', 'holo', 'banner-wide'],
  'quote-card': ['pastel', 'pastel-dream', 'quote-center'],
  logo: ['luxury', 'ink-gold', 'centered-text'],
  infographic: ['glass', 'ocean-deep', 'centered-hero'],
  wallpaper: ['synth', 'retro-wave', 'centered-text'],
  'product-ad': ['luxury', 'ink-gold', 'product-spotlight'],
  'profile-dp': ['sticker', 'candy', 'centered-hero'],
  invitation: ['luxury', 'royal-gold', 'centered-text'],
  certificate: ['luxury', 'ink-gold', 'centered-text'],
  'business-card': ['swiss', 'mono-clean', 'text-left-subject-right'],
  flyer: ['comic', 'sunset-pop', 'poster-stack'],
  'album-cover': ['synth', 'retro-wave', 'centered-hero'],
  'book-cover': ['cinema', 'teal-orange', 'poster-stack'],
  'news-card': ['bold', 'money-red', 'text-left-subject-right'],
  menu: ['luxury', 'ink-gold', 'centered-text'],
  portrait: ['cinema', 'teal-orange', 'centered-hero'],
  generic: ['mesh', 'sunset-pop', 'centered-hero'],
};

export const RECIPE_SIZE: Record<string, string> = {
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

export const RECIPES_NAME: Record<string, string> = {
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

const VALID_MOTIFS = new Set(['lightning', 'heart', 'starburst', 'sparkle', 'check', 'blob', 'quote', 'arrow']);

const EMOJI_HINT: Record<string, string> = {
  money: '💰', earn: '💰', paise: '💰', kamai: '💰', कमाई: '💰',
  ai: '🤖', robot: '🤖', tech: '💻', code: '💻', game: '🎮', gaming: '🎮',
  music: '🎵', food: '🍔', recipe: '🍳', travel: '✈️', fitness: '💪', gym: '💪',
  health: '🥗', cricket: '🏏', football: '⚽', birthday: '🎂', wedding: '💍',
  diwali: '🪔', festival: '🎉', love: '❤️', news: '📰', exam: '📚', study: '📚',
  business: '📈', crypto: '🪙', bitcoin: '🪙', car: '🚗', phone: '📱',
  camera: '📷', idea: '💡', fire: '🔥', sale: '🏷️', offer: '🏷️',
  rocket: '🚀', startup: '🚀',
};

export function pickEmoji(text: string): string {
  const t = String(text || '').toLowerCase();
  for (const k of Object.keys(EMOJI_HINT)) {
    if (t.includes(k)) return EMOJI_HINT[k];
  }
  return '⭐';
}

export const isDevaStr = (s: string) => /[\u0900-\u097F]/.test(String(s || ''));

const SUPPORTED_BRAND_LOGOS: Array<{ id: string; label: string; re: RegExp }> = [
  { id: 'google-gemini', label: 'Google Gemini', re: /\b(google\s*gemini|gemini)\b/i },
  { id: 'google-flow', label: 'Google Flow', re: /\b(google\s*flow|flow\s*ai|veo\s*flow)\b/i },
  { id: 'google', label: 'Google', re: /\bgoogle\b(?![\s-]*(flow|gemini|chrome))/i },
  { id: 'youtube', label: 'YouTube', re: /\b(youtube|yt)\b/i },
  { id: 'instagram', label: 'Instagram', re: /\b(instagram|insta)\b/i },
  { id: 'android', label: 'Android', re: /\bandroid\b/i },
  { id: 'chrome', label: 'Chrome', re: /\b(chrome|google\s*chrome)\b/i },
  { id: 'openai', label: 'OpenAI', re: /\b(openai|chatgpt)\b/i },
  { id: 'github', label: 'GitHub', re: /\bgithub\b/i },
  { id: 'x', label: 'X', re: /\b(twitter|x\.com)\b/i },
  { id: 'whatsapp', label: 'WhatsApp', re: /\bwhatsapp\b/i },
  { id: 'tiktok', label: 'TikTok', re: /\btiktok\b/i },
  { id: 'figma', label: 'Figma', re: /\bfigma\b/i },
  { id: 'apple', label: 'Apple', re: /\bapple\b/i },
];

export function detectPromptBrandLogos(message: string) {
  const txt = String(message || '');
  const out: Array<{ id: string; brandId: string; label: string; placement: string }> = [];
  const placements = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
  for (const b of SUPPORTED_BRAND_LOGOS) {
    if (b.re.test(txt)) {
      const idx = out.length;
      out.push({
        id: `logo_${b.id}`,
        brandId: b.id,
        label: b.label,
        placement: placements[idx % placements.length],
      });
    }
  }
  return out;
}

export function detectCharacterPlacement(message: string): 'left-corner' | 'right-corner' | 'center' {
  const t = String(message || '').toLowerCase();
  if (/\b(left\s*corner|bottom\s*left|on\s*the\s*left|left\s*side|baaye|baye)\b/.test(t)) return 'left-corner';
  if (/\b(right\s*corner|bottom\s*right|on\s*the\s*right|right\s*side|daaye|daye)\b/.test(t)) return 'right-corner';
  if (/\b(in\s*the\s*center|in\s*center|centered|middle|beech\s*mein|center\s*mein)\b/.test(t)) return 'center';
  return 'right-corner';
}

export function detectFaceSwapIntent(message: string, uploadsCount: number): boolean {
  const t = String(message || '');
  if (
    /\b(face\s*swap|swap\s*(the\s*)?face|put\s+my\s+face|my\s+face\s+(in|on|onto|into)|using\s+my\s+face|with\s+my\s+face|use\s+my\s+photo|chehra\s*(badlo|lagao)|mera\s*chehra|mera\s*face)\b/i.test(
      t
    )
  ) {
    return uploadsCount > 0;
  }
  // If user uploaded 1 portrait/face and describes a role/scene like "make me a superhero", "astronaut portrait", etc.
  if (
    uploadsCount === 1 &&
    /\b(make\s+me|turn\s+me\s+into|dress\s+me\s+as|me\s+as\s+a|put\s+me\s+in|i\s+am\s+in)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export function buildProPortraitKeyword(message: string): string {
  const cleaned = String(message || '')
    .replace(/\b(face\s*swap|swap\s*(the\s*)?face|with\s+my\s+face|using\s+my\s+face|put\s+my\s+face\s+(in|on|into|onto)|make\s+me|turn\s+me\s+into|generate|create|make|design|image|photo|picture|thumbnail|poster|banner|please)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = cleaned.split(' ').slice(0, 7).join(' ') || 'cinematic executive';
  return `${base} studio portrait dramatic lighting 85mm photography`;
}

export function buildPlannerSystemPrompt(): string {
  const styleIds = Object.keys(STYLE_INFO);
  return `You are the Creative Director of a multi-layer AI Image Creation & Editing Studio. Given the user's prompt, uploaded file vision analyses (roles, OCR text, lighting, clothing, camera angle), and resolved canvas dimensions, output ONE cohesive JSON design plan for our deterministic HTML5 Canvas + WebGPU + Visual A-Z Search renderer.

CRITICAL RULES
- NEVER refuse normal creative designs, public figures, celebrities, brand logos, or user-uploaded face/character edits. Only refuse extreme CSAM or explicit pornography ("refuse":null otherwise).
- Choose ONE clean, high-craft visual direction tailored to the topic. Avoid unnecessary effects, random clutter, or excessive glow.
- Use ONLY valid IDs listed below.
- UPLOADED FILES & IDENTITY PRESERVATION:
  - Inspect "uploadAnalyses" carefully! Respect each file's detected role: "main-character", "face-reference", "background-reference", "design-reference", or "object".
  - When the user supplies a character/person (and is not requesting a face-swap onto a different body), PRESERVE their identity by using that upload (source:"upload", uploadId:"...", role:"subject"). Never randomly replace the user's character with a web stranger!
  - If an upload is a "background-reference", map it as role:"background", source:"upload".
- TOPIC-SPECIFIC BACKGROUND RESEARCH (Visual A-Z Engine):
  - When no background upload is given, prefer "backgroundSpec":{"mode":"search","query":"<specific realistic scene/location matching exact topic, 4-8 words>"} for photo-led designs (thumbnails, posters, banners, flyers, portraits, product ads, news cards). Never use generic keywords like "abstract background" when a real topic location/environment exists (e.g., "cricketer" -> "cricket stadium floodlights night crowd photography"; "AI SaaS" -> "modern dark glass server room dramatic lighting").
  - Also optionally list up to 2 topic-relevant "supportingObjects": [{"query":"<specific single object cutout photo>", "placement":"top-right|bottom-left|mid-right"}] ONLY when it genuinely elevates the visual story without clutter.
- TEXT INTELLIGENCE & HIERARCHY:
  - Priority: (1) Exact text explicitly provided by the user, (2) Relevant OCR text detected in uploaded reference images ("detectedOcrText"), (3) Short, crisp headline (2-6 words) strictly relevant to the topic. Never invent unrelated headlines.
  - "accentWord": 1-2 exact words from title to highlight in accent color, or "".
  - "subtitle", "badge", "cta": concise optional supporting copy only when helpful.
  - Hindi/Devanagari -> choose a font id starting with "hi-".
- "characterSpec": {
    "needed": true|false,
    "source": "upload"|"search"|"none",
    "query": "specific subject query if searched",
    "placement": "right-corner"|"left-corner"|"center",
    "removeBackground": true
  }
- "logos": array of requested brand logos e.g. [{"id":"logo_1","brandId":"google-gemini","label":"Google Gemini","placement":"top-left"}]. Built-in brandIds: google, google-flow, google-gemini, youtube, instagram, android, chrome, openai, github, x, whatsapp, tiktok, figma, apple. For unlisted brands, brandId:"custom" + "query":"<brand> logo transparent png".
- "faceSwap": if user uploaded a face/selfie and wants their face placed into a scene or uploaded body, set {"needed":true,"proPortraitQuery":"<5-8 word photography query matching outfit/lighting/role>"}. Otherwise {"needed":false}.
- "creativeDirection": {
    "colorGrade": "cinematic-teal-orange|golden-editorial|neon-pop|luxury-noir|portrait-natural",
    "overlayOpacity": 0.48,
    "lighting": "concise lighting & depth note",
    "useTextPlate": false
  }

STYLES (id: best for)
${styleIds.map((i) => `${i}: ${STYLE_INFO[i]}`).join('\n')}
PALETTES: ${Object.entries(STUDIO_DATA.PALETTES).map(([i, p]) => `${i}(${p.mood})`).join(', ')}
FONTS: ${Object.entries(STUDIO_DATA.FONTS).map(([i, f]) => `${i}${(f.scripts as readonly string[]).includes('devanagari') ? '[hindi]' : ''}(${f.bestFor})`).join('; ')}
LAYOUTS: text-left-subject-right, subject-left-text-right, centered-hero, centered-text, poster-stack, story-vertical, quote-center, banner-wide, product-spotlight
MOTIFS: lightning, heart, starburst, sparkle, check, blob, quote, arrow

OUTPUT (JSON only, no markdown):
{"refuse":null,"brief":{"goal":"","audience":"","message":""},"rationale":"","recipe":"thumbnail|poster|ig-post|story-reel|banner|quote-card|logo|infographic|wallpaper|product-ad|profile-dp|invitation|certificate|business-card|flyer|album-cover|book-cover|news-card|menu|portrait|generic","style":"id","palette":"id","fonts":"id","layout":"id","language":"hi|en|hinglish","title":"","accentWord":"","subtitle":"","badge":"","cta":"","hero":{"type":"asset","id":"a1"},"motifs":["sparkle"],"backgroundSpec":{"mode":"search|gradient","query":"","mood":""},"characterSpec":{"needed":true,"source":"search|upload|none","query":"","placement":"right-corner|left-corner|center","removeBackground":true},"supportingObjects":[],"logos":[],"faceSwap":{"needed":false,"proPortraitQuery":""},"creativeDirection":{"colorGrade":"portrait-natural","overlayOpacity":0.5,"lighting":"","useTextPlate":false},"assets":[]}`;
}

export function cleanTitleFromRequest(msg: string): string {
  const t = String(msg || '')
    .replace(/["“”]/g, '')
    .replace(/\b(youtube|yt|instagram|insta|facebook|thumbnail|poster|banner|logo|logos|wallpaper|post|story|reel|card|image|design|please|bana|banao|do|de|ek|ka|ki|ke|for|a|an|the|make|create|generate|right|left|corner|center|with|and|on|in|put|show|google\s*flow|google\s*gemini|google)\b/gi, ' ')
    .replace(/बनाओ|बना|दो|एक|का|की|के|थंबनेल|पोस्टर|लोगो|बैनर|इमेज/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const w = t.split(' ').filter(Boolean).slice(0, 6);
  return w.join(' ') || 'Featured Showcase';
}

export function mapExtendedStyleToCanvasStyle(styleId?: string | null): string | null {
  if (!styleId) return null;
  if (STYLE_INFO[styleId]) return styleId;
  const alias: Record<string, string> = {
    'bold-yt-thumbnail': 'bold',
    'neon-cyberpunk': 'neon',
    glassmorphism: 'glass',
    neumorphism: 'glass',
    'dark-luxury': 'luxury',
    'minimal-swiss': 'swiss',
    'pop-art-comic': 'comic',
    'gradient-mesh-modern': 'mesh',
    'pastel-soft': 'pastel',
    'cinematic-poster': 'cinema',
    'synthwave-retro': 'synth',
    brutalist: 'brutal',
    'sticker-pop': 'sticker',
    'magazine-editorial': 'cinema',
    'grunge-street': 'brutal',
    'flat-vector': 'swiss',
    'paper-cut-layers': 'pastel',
    'isometric-3d-css': 'mesh',
    holographic: 'mesh',
    'blueprint-tech': 'neon',
    'watercolor-wash': 'pastel',
    'anime-glow': 'neon',
    'doodle-hand-drawn': 'comic',
    'riso-retro-print': 'brutal',
  };
  return alias[styleId] || null;
}

export interface StudioUploadAnalysis {
  uploadId: string;
  name?: string;
  role: 'main-character' | 'face-reference' | 'background-reference' | 'design-reference' | 'object';
  subjectDescription?: string;
  ocrText?: string[];
  clothing?: string;
  colors?: string[];
  lighting?: string;
  cameraAngle?: string;
  hasTransparentBg?: boolean;
  preserveIdentity?: boolean;
}

function buildTopicBackgroundQuery(message: string, title: string, recipeId: string): string {
  const base = cleanTitleFromRequest(message) || title;
  if (/\b(cricket|ipl|stadium|match)\b/i.test(message)) return `${base} cricket stadium night floodlights atmosphere`;
  if (/\b(ai|tech|coding|software|saas|gemini|google|cyber|robot)\b/i.test(message)) return `${base} modern dark futuristic tech studio environment`;
  if (/\b(food|recipe|burger|pizza|coffee|restaurant|menu)\b/i.test(message)) return `${base} moody restaurant kitchen table lighting photography`;
  if (/\b(fitness|gym|workout)\b/i.test(message)) return `${base} dark dramatic gym lighting equipment atmosphere`;
  if (/\b(movie|film|cinema|thriller|horror)\b/i.test(message)) return `${base} moody atmospheric cinema scene lighting`;
  if (['portrait', 'poster', 'thumbnail', 'banner', 'flyer', 'product-ad', 'news-card'].includes(recipeId)) {
    return `${base} realistic environment dramatic photography backdrop`.slice(0, 75);
  }
  return `${base} dramatic studio atmosphere background`.slice(0, 75);
}

export function fallbackSpec(
  message: string,
  resolved: { style?: string | null; text?: string | null; language?: string; photo?: string | null },
  recipeId: string,
  uploads: Array<{ id: string; name?: string }> = [],
  uploadAnalyses: StudioUploadAnalysis[] = []
) {
  const [st, pal, defLay] = RECIPE_DEFAULTS[recipeId] || RECIPE_DEFAULTS.generic;
  const ocrHeadline = uploadAnalyses.flatMap((u) => u.ocrText || []).find((t) => t && t.trim().length >= 3);
  const title = resolved.text || ocrHeadline || cleanTitleFromRequest(message);
  const hindi = isDevaStr(title) || resolved.language === 'hi';
  const mappedStyle = mapExtendedStyleToCanvasStyle(resolved.style) || st;
  const hasUpload = uploads.length > 0 && resolved.photo !== 'no';
  const placement = detectCharacterPlacement(message);
  const logos = detectPromptBrandLogos(message);
  const isFaceSwap = detectFaceSwapIntent(message, uploads.length);

  const bgUpload = uploadAnalyses.find((u) => u.role === 'background-reference');
  const charUpload =
    uploadAnalyses.find((u) => u.role === 'main-character' || u.role === 'face-reference' || u.role === 'object') ||
    (uploads[0] ? { uploadId: uploads[0].id, role: 'main-character' as const } : undefined);

  const lay =
    placement === 'left-corner'
      ? 'subject-left-text-right'
      : placement === 'center'
        ? 'centered-hero'
        : placement === 'right-corner' && ['thumbnail', 'news-card', 'business-card', 'generic', 'ig-post'].includes(recipeId)
          ? 'text-left-subject-right'
          : defLay;

  const photoLedRecipe = ['thumbnail', 'poster', 'portrait', 'banner', 'flyer', 'product-ad', 'news-card', 'ig-post'].includes(recipeId);
  const wantsSearchSubject =
    !hasUpload &&
    resolved.photo !== 'no' &&
    (/\b(photo|portrait|celebrity|cricketer|player|actor|leader|man|woman|character|person|mountain|car|bike|coffee|product|khan|kohli|elon|tech|ai)\b/i.test(
      message
    ) ||
      placement !== 'right-corner') &&
    !['quote-card', 'logo', 'certificate', 'invitation', 'menu'].includes(recipeId);

  const wantsSearchBg =
    !bgUpload &&
    (photoLedRecipe ||
      /\b(studio|galaxy|city|office|stadium|stage|mountain|forest|background|backdrop|abstract|cyber|street|beach|sunset|night)\b/i.test(
        message
      )) &&
    !['quote-card', 'logo', 'certificate', 'menu'].includes(recipeId);

  const assets: any[] = [];
  if (hasUpload && !isFaceSwap && charUpload) {
    assets.push({
      id: 'a1',
      source: 'upload',
      uploadId: charUpload.uploadId,
      role: 'subject',
      removeBackground: resolved.photo !== 'yes-asis',
      adjust: { brightness: 1.03, contrast: 1.07, saturate: 1.06 },
    });
  } else if (wantsSearchSubject || isFaceSwap) {
    assets.push({
      id: 'a1',
      source: 'search',
      query: (isFaceSwap ? buildProPortraitKeyword(message) : cleanTitleFromRequest(message)).slice(0, 80),
      role: 'subject',
      removeBackground: true,
      adjust: { brightness: 1.03, contrast: 1.06, saturate: 1.06 },
    });
  }

  if (bgUpload) {
    assets.push({
      id: 'bg1',
      source: 'upload',
      uploadId: bgUpload.uploadId,
      role: 'background',
      removeBackground: false,
      adjust: {},
    });
  }

  const bgQuery = buildTopicBackgroundQuery(message, title, recipeId);

  return {
    recipe: recipeId,
    style: mappedStyle,
    palette: (STYLE_PAL[mappedStyle] && STYLE_PAL[mappedStyle][0]) || pal,
    fonts: hindi ? 'hi-bold-poppins' : 'modern-grotesk',
    layout: lay,
    language: resolved.language || 'en',
    title,
    accentWord: title.split(' ').slice(-1)[0] || '',
    subtitle: '',
    badge: '',
    cta: '',
    backgroundSpec: {
      mode: bgUpload ? 'upload' : wantsSearchBg ? 'search' : 'gradient',
      query: bgQuery,
      mood: mappedStyle,
    },
    characterSpec: {
      needed: hasUpload || wantsSearchSubject || isFaceSwap,
      source: isFaceSwap ? 'search' : hasUpload ? 'upload' : wantsSearchSubject ? 'search' : 'none',
      query: isFaceSwap ? buildProPortraitKeyword(message) : cleanTitleFromRequest(message),
      placement,
      removeBackground: resolved.photo !== 'yes-asis',
    },
    supportingObjects: [],
    logos,
    faceSwap: isFaceSwap
      ? { needed: true, proPortraitQuery: buildProPortraitKeyword(message) }
      : { needed: false },
    creativeDirection: {
      colorGrade:
        mappedStyle === 'cinema'
          ? 'cinematic-teal-orange'
          : mappedStyle === 'neon'
            ? 'neon-pop'
            : mappedStyle === 'luxury'
              ? 'luxury-noir'
              : 'portrait-natural',
      overlayOpacity: 0.52,
      lighting: 'soft key light with clean subject-background separation',
      useTextPlate: false,
    },
    hero:
      hasUpload || wantsSearchSubject || isFaceSwap
        ? { type: 'asset', id: 'a1' }
        : {
            type: ['quote-card', 'logo', 'certificate', 'invitation', 'menu'].includes(recipeId) ? 'none' : 'emoji',
            char: pickEmoji(message + ' ' + title),
          },
    motifs: ['sparkle'],
    assets,
    brief: { goal: `Design a crisp ${RECIPES_NAME[recipeId] || 'image'}`, audience: 'viewer', message: title },
    rationale: `Selected ${STYLE_NAMES[mappedStyle] || mappedStyle} with topic-matched scene backdrop and layered typography.`,
  };
}

export function normalizeCanvasSpec(
  raw: any,
  opts: {
    resolved: { style?: string | null; text?: string | null; language?: string; photo?: string | null; size?: { w: number; h: number } };
    recipeId: string;
    uploads?: Array<{ id: string; name?: string }>;
    uploadAnalyses?: StudioUploadAnalysis[];
    message?: string;
  }
) {
  const { resolved, recipeId, uploads = [], uploadAnalyses = [], message = '' } = opts;
  const warn: string[] = [];

  // Permissive policy: only allow refusal if strictly extreme CSAM/explicit gore/pornography keywords
  if (raw && raw.refuse) {
    const reasonStr = String(raw.refuse?.reason || raw.refuse);
    if (/\b(csam|child\s*abuse|explicit\s*porn|pornography|graphic\s*gore)\b/i.test(reasonStr)) {
      return { refused: reasonStr.slice(0, 220), spec: null, warn };
    }
    warn.push('ignored-overcautious-refusal');
  }

  const s: any = { ...(raw || {}) };
  if (raw?.refuse) {
    Object.assign(s, fallbackSpec(message, resolved, recipeId, uploads, uploadAnalyses));
  }

  s.recipe = RECIPE_DEFAULTS[s.recipe] ? s.recipe : RECIPE_DEFAULTS[recipeId] ? recipeId : 'generic';
  const def = RECIPE_DEFAULTS[s.recipe];

  const forcedStyle = mapExtendedStyleToCanvasStyle(resolved.style);
  const rawStyle = mapExtendedStyleToCanvasStyle(s.style);
  s.style = forcedStyle || rawStyle || def[0];

  if (!STUDIO_DATA.PALETTES[s.palette as keyof typeof STUDIO_DATA.PALETTES]) {
    s.palette = (STYLE_PAL[s.style] || [def[1]])[0];
    warn.push('palette-fixed');
  }

  s.language = ['hi', 'en', 'hinglish'].includes(s.language) ? s.language : resolved.language || 'en';
  const firstOcr = uploadAnalyses.flatMap((u) => u.ocrText || []).find((t) => t && t.trim().length >= 3);
  s.title = String(resolved.text || s.title || firstOcr || '').trim().slice(0, 140) || cleanTitleFromRequest(message);
  const hindi = isDevaStr(s.title + (s.subtitle || '') + (s.badge || ''));

  const fontEntry = STUDIO_DATA.FONTS[s.fonts as keyof typeof STUDIO_DATA.FONTS];
  if (!fontEntry) {
    s.fonts = hindi ? 'hi-bold-poppins' : 'modern-grotesk';
  } else if (hindi && !(fontEntry.scripts as readonly string[]).includes('devanagari')) {
    warn.push('font-swapped-for-hindi');
    s.fonts = 'hi-bold-poppins';
  }

  // Placement & Corner Resolution
  const promptPlacement = detectCharacterPlacement(message);
  const rawPlace = String(s.characterSpec?.placement || '').toLowerCase();
  const validPlace =
    rawPlace === 'left-corner' || rawPlace === 'right-corner' || rawPlace === 'center'
      ? (rawPlace as 'left-corner' | 'right-corner' | 'center')
      : promptPlacement;

  if (!s.layout) {
    s.layout =
      validPlace === 'left-corner'
        ? 'subject-left-text-right'
        : validPlace === 'center'
          ? 'centered-hero'
          : def[2];
  } else if (promptPlacement === 'left-corner' && s.layout === 'text-left-subject-right') {
    s.layout = 'subject-left-text-right';
  } else if (promptPlacement === 'right-corner' && s.layout === 'subject-left-text-right') {
    s.layout = 'text-left-subject-right';
  }

  s.accentWord =
    s.accentWord && s.title.toLowerCase().includes(String(s.accentWord).toLowerCase()) ? String(s.accentWord) : '';
  for (const k of ['subtitle', 'badge', 'cta']) {
    s[k] = String(s[k] || '').trim().slice(0, 60);
  }
  if (s.recipe === 'quote-card') {
    s.badge = '';
    s.cta = '';
  }

  s.motifs = (Array.isArray(s.motifs) ? s.motifs : [])
    .filter((m: string) => VALID_MOTIFS.has(m))
    .slice(0, 2);

  // Merge LLM logos with deterministic detected logos from prompt
  const promptLogos = detectPromptBrandLogos(message);
  const rawLogos = Array.isArray(s.logos) ? s.logos : [];
  const mergedLogos: any[] = [];
  const seenBrands = new Set<string>();
  const defaultPlacements = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];

  for (const l of [...rawLogos, ...promptLogos]) {
    if (!l || typeof l !== 'object') continue;
    const brandId = String(l.brandId || 'custom').toLowerCase();
    const label = String(l.label || brandId).trim().slice(0, 40);
    const key = brandId !== 'custom' ? brandId : label.toLowerCase();
    if (!key || seenBrands.has(key)) continue;
    seenBrands.add(key);
    mergedLogos.push({
      id: String(l.id || `logo_${mergedLogos.length + 1}`),
      brandId,
      label,
      query: l.query ? String(l.query).slice(0, 70) : `${label} logo transparent png`,
      placement: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center'].includes(l.placement)
        ? l.placement
        : defaultPlacements[mergedLogos.length % defaultPlacements.length],
    });
  }
  s.logos = mergedLogos.slice(0, 5);

  const bgUpload = uploadAnalyses.find((u) => u.role === 'background-reference');
  const charUpload = uploadAnalyses.find(
    (u) => u.role === 'main-character' || u.role === 'face-reference' || u.role === 'object'
  );

  // Photo-led designs search for topic-specific background unless uploaded
  const photoLedRecipe = ['thumbnail', 'poster', 'portrait', 'banner', 'flyer', 'product-ad', 'news-card', 'ig-post'].includes(s.recipe);
  const defaultBgMode = bgUpload
    ? 'upload'
    : s.backgroundSpec?.mode === 'search' || (photoLedRecipe && !['quote-card', 'logo', 'certificate', 'menu'].includes(s.recipe))
      ? 'search'
      : 'gradient';
  s.backgroundSpec = {
    mode: defaultBgMode,
    query: String(s.backgroundSpec?.query || buildTopicBackgroundQuery(message, s.title, s.recipe)).trim().slice(0, 80),
    mood: String(s.backgroundSpec?.mood || s.style),
  };

  // Supporting objects (max 2)
  s.supportingObjects = (Array.isArray(s.supportingObjects) ? s.supportingObjects : [])
    .filter((o: any) => o && typeof o.query === 'string' && o.query.trim())
    .slice(0, 2)
    .map((o: any, idx: number) => ({
      id: String(o.id || `obj_${idx + 1}`),
      query: String(o.query).trim().slice(0, 75),
      placement: ['top-right', 'bottom-left', 'mid-right', 'mid-left'].includes(o.placement)
        ? o.placement
        : idx === 0
          ? 'top-right'
          : 'bottom-left',
    }));

  // Creative Direction defaults
  const validGrades = new Set(['cinematic-teal-orange', 'golden-editorial', 'neon-pop', 'luxury-noir', 'portrait-natural']);
  const cd = s.creativeDirection && typeof s.creativeDirection === 'object' ? s.creativeDirection : {};
  s.creativeDirection = {
    colorGrade: validGrades.has(String(cd.colorGrade))
      ? String(cd.colorGrade)
      : s.style === 'cinema'
        ? 'cinematic-teal-orange'
        : s.style === 'neon' || s.style === 'synth'
          ? 'neon-pop'
          : s.style === 'luxury'
            ? 'luxury-noir'
            : 'portrait-natural',
    overlayOpacity: Number.isFinite(Number(cd.overlayOpacity))
      ? Math.max(0.25, Math.min(0.85, Number(cd.overlayOpacity)))
      : 0.52,
    lighting: String(cd.lighting || 'Clean key light and depth separation').slice(0, 120),
    useTextPlate: Boolean(cd.useTextPlate),
  };

  // Face swap metadata
  const detectedFaceSwap = detectFaceSwapIntent(message, uploads.length);
  const wantsFaceSwap = Boolean(s.faceSwap?.needed || detectedFaceSwap) && uploads.length > 0;
  s.faceSwap = {
    needed: wantsFaceSwap,
    proPortraitQuery: wantsFaceSwap
      ? String(s.faceSwap?.proPortraitQuery || buildProPortraitKeyword(message)).trim().slice(0, 90)
      : '',
  };

  // Character spec (preserve uploaded character identity unless face-swap or explicit web search requested)
  s.characterSpec = {
    needed: s.characterSpec?.needed !== false && (uploads.length > 0 || s.assets?.length > 0 || wantsFaceSwap),
    source: wantsFaceSwap
      ? 'search'
      : charUpload || (uploads.length > 0 && !bgUpload)
        ? 'upload'
        : s.characterSpec?.source === 'search'
          ? 'search'
          : uploads.length > 0 && !bgUpload
            ? 'upload'
            : 'none',
    query: String(s.characterSpec?.query || s.faceSwap.proPortraitQuery || '').trim().slice(0, 80),
    placement: validPlace,
    removeBackground: s.characterSpec?.removeBackground !== false && resolved.photo !== 'yes-asis',
  };

  // Normalize assets list safely
  const validUploadIds = new Set(uploads.map((u) => u.id));
  const rawAssets = Array.isArray(s.assets) ? s.assets.slice(0, 4) : [];
  const normAssets: any[] = [];
  for (const a of rawAssets) {
    if (!a || typeof a !== 'object') continue;
    const id = String(a.id || `a${normAssets.length + 1}`).replace(/[^a-z0-9_-]/gi, '') || 'a1';
    if (a.source === 'upload') {
      if (resolved.photo === 'no') continue;
      const targetUpId = validUploadIds.has(a.uploadId) ? a.uploadId : charUpload?.uploadId || uploads[0]?.id;
      if (!targetUpId) continue;
      const inferredRole =
        uploadAnalyses.find((u) => u.uploadId === targetUpId)?.role === 'background-reference'
          ? 'background'
          : a.role === 'background'
            ? 'background'
            : 'subject';
      normAssets.push({
        id,
        source: 'upload',
        uploadId: targetUpId,
        role: inferredRole,
        removeBackground:
          inferredRole === 'background'
            ? false
            : resolved.photo === 'yes-cutout'
              ? true
              : resolved.photo === 'yes-asis'
                ? false
                : a.removeBackground !== false,
        adjust: a.adjust && typeof a.adjust === 'object' ? a.adjust : { brightness: 1.03, contrast: 1.08, saturate: 1.08 },
      });
    } else if (a.source === 'search' && a.query) {
      // Preserve uploaded character identity instead of searching a stranger when user uploaded a character
      if (a.role !== 'background' && charUpload && !wantsFaceSwap && resolved.photo !== 'no') {
        normAssets.push({
          id,
          source: 'upload',
          uploadId: charUpload.uploadId,
          role: 'subject',
          removeBackground: resolved.photo !== 'yes-asis',
          adjust: { brightness: 1.03, contrast: 1.07, saturate: 1.06 },
        });
      } else {
        normAssets.push({
          id,
          source: 'search',
          query: String(a.query).trim().slice(0, 80),
          role: a.role === 'background' ? 'background' : 'subject',
          removeBackground: a.role === 'background' ? false : a.removeBackground !== false,
          adjust: a.adjust && typeof a.adjust === 'object' ? a.adjust : {},
        });
      }
    }
  }

  // Ensure uploaded background is included if detected
  if (bgUpload && !normAssets.some((a) => a.role === 'background')) {
    normAssets.push({
      id: 'bg1',
      source: 'upload',
      uploadId: bgUpload.uploadId,
      role: 'background',
      removeBackground: false,
      adjust: {},
    });
  } else if (
    s.backgroundSpec.mode === 'search' &&
    s.backgroundSpec.query &&
    !normAssets.some((a) => a.role === 'background')
  ) {
    normAssets.push({
      id: 'bg1',
      source: 'search',
      query: s.backgroundSpec.query,
      role: 'background',
      removeBackground: false,
      adjust: {},
    });
  }

  if (!normAssets.some((a) => a.role !== 'background')) {
    if (wantsFaceSwap && s.faceSwap.proPortraitQuery) {
      normAssets.unshift({
        id: 'a1',
        source: 'search',
        query: s.faceSwap.proPortraitQuery,
        role: 'subject',
        removeBackground: true,
        adjust: { brightness: 1.03, contrast: 1.08, saturate: 1.06 },
      });
    } else if ((charUpload || (uploads.length > 0 && !bgUpload)) && resolved.photo !== 'no') {
      const uid = charUpload?.uploadId || uploads[0].id;
      normAssets.unshift({
        id: 'a1',
        source: 'upload',
        uploadId: uid,
        role: 'subject',
        removeBackground: resolved.photo !== 'yes-asis',
        adjust: { brightness: 1.03, contrast: 1.08, saturate: 1.08 },
      });
    } else if (s.characterSpec.source === 'search' && s.characterSpec.query) {
      normAssets.unshift({
        id: 'a1',
        source: 'search',
        query: s.characterSpec.query,
        role: 'subject',
        removeBackground: s.characterSpec.removeBackground !== false,
        adjust: { brightness: 1.03, contrast: 1.06, saturate: 1.08 },
      });
    }
  }
  s.assets = normAssets;

  const h = s.hero || {};
  const assetIds = new Set(normAssets.map((a) => a.id));
  if (h.type === 'asset') {
    if (assetIds.has(h.id)) {
      s.hero = h;
    } else if (normAssets.length > 0) {
      const subj = normAssets.find((a) => a.role !== 'background') || normAssets[0];
      s.hero = { type: 'asset', id: subj.id };
    } else {
      warn.push('asset-missing');
      s.hero = { type: 'emoji', char: pickEmoji(s.title) };
    }
  } else if (h.type === 'emoji') {
    s.hero = { type: 'emoji', char: String(h.char || '').trim().slice(0, 4) || pickEmoji(s.title) };
  } else if (h.type === 'motif' && VALID_MOTIFS.has(h.id)) {
    s.hero = h;
  } else {
    s.hero = { type: 'none' };
  }

  if (normAssets.length > 0 && s.hero.type !== 'asset') {
    const subj = normAssets.find((a) => a.role !== 'background');
    if (subj) s.hero = { type: 'asset', id: subj.id };
  }

  s.rationale = String(s.rationale || '').trim().slice(0, 300);
  return { refused: null, spec: s, warn };
}

/**
 * Serves the user's uploaded creative-studio HTML cleanly wired to backend secret Groq keys:
 * removes Settings dialog, API key inputs, localStorage key storage, and "Not set up" banner.
 */
export function buildBackendPoweredStudioHtml(): string {
  const htmlPath = path.join(process.cwd(), 'public', 'assets', 'aistudio', 'creative-studio_bfcfe471.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('Creative Studio template HTML not found on server.');
  }
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // Remove header key status badge + settings gear button + entire Settings dialog cleanly
  html = html
    .replace('  <span class="chip warn" id="status">Not set up</span>\n', '')
    .replace('  <button class="iconbtn" id="openSettings" aria-label="Settings">⚙️</button>\n', '')
    .replace(/<dialog id="settings">[\s\S]*?<\/dialog>\s*/i, '');

  // Pre-configure Settings object & llmChat to run seamlessly via backend Groq secrets + image search/proxy
  html = html
    .replace(
      "const KEY = 'creative_studio_settings_v1';",
      "const KEY = 'creative_studio_settings_v1';"
    )
    .replace(
      /const Settings = \{[\s\S]*?\};/,
      `const Settings = {
  get() { return { provider: 'groq', model: 'backend-groq', searchUrl: '/api/google-scrape-images', proxyUrl: '/api/studio/img-proxy?url=', apiKey: 'backend' }; },
  set() {},
  clear() {}
};`
    )
    .replace(
      /async function llmChat\(messages[\s\S]*?\n\}/,
      `async function llmChat(messages, { temperature = .6, maxTokens = 1800 } = {}) {
  const res = await fetch('/api/studio/llm-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, temperature, maxTokens })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.text) throw new Error(j.error || ('Backend Groq API error ' + res.status));
  return String(j.text);
}`
    )
    .replace(
      'const configured = () => { const s = Settings.get(); return !!(s.apiKey && s.model); };',
      'const configured = () => true;'
    )
    .replace(
      /if\s*\(!configured\(\)\)\s*\{[\s\S]*?return;\s*\}/,
      ''
    )
    .replace(
      /\/\* ---------- settings dialog ---------- \*\/[\s\S]*?\/\* ---------- uploads ---------- \*\//,
      `function renderStatus() { const st = $('#status'); if (st) { st.textContent = 'Ready'; st.className = 'chip ok'; } }
/* ---------- uploads ---------- */`
    )
    .replace("if (!configured()) setTimeout(() => $('#openSettings').click(), 400);", '')
    .replace(
      /const r = await fetch\(s\.searchUrl \+ '\?q=' \+ encodeURIComponent\(q\)\);/,
      "const r = await fetch(s.searchUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, offset: 0 }) });"
    );

  return html;
}
