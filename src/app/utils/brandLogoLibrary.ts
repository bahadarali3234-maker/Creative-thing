export type LogoBadgeStyle = 'clean' | 'dark-pill' | 'light-pill' | 'glass';

export interface BrandLogoMeta {
  id: string;
  name: string;
  label: string;
  keywords: RegExp;
  accentColor: string;
  renderSvg: (size: number) => string;
}

export const BRAND_LOGOS: BrandLogoMeta[] = [
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    label: 'Gemini',
    keywords: /\b(google\s*gemini|gemini)\b/i,
    accentColor: '#4e8cff',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="gemG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1C7DFB"/>
            <stop offset="50%" stop-color="#8B6DFF"/>
            <stop offset="100%" stop-color="#FF5F9E"/>
          </linearGradient>
        </defs>
        <path d="M32 4C33.8 18.8 45.2 30.2 60 32C45.2 33.8 33.8 45.2 32 60C30.2 45.2 18.8 33.8 4 32C18.8 30.2 30.2 18.8 32 4Z" fill="url(#gemG)"/>
      </svg>
    `,
  },
  {
    id: 'google-flow',
    name: 'Google Flow',
    label: 'Google Flow',
    keywords: /\b(google\s*flow|flow\s*ai|veo\s*flow)\b/i,
    accentColor: '#00d2ff',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="flowG1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4285F4"/>
            <stop offset="50%" stop-color="#34A853"/>
            <stop offset="100%" stop-color="#00E5FF"/>
          </linearGradient>
          <linearGradient id="flowG2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#EA4335"/>
            <stop offset="55%" stop-color="#FBBC05"/>
            <stop offset="100%" stop-color="#34A853"/>
          </linearGradient>
        </defs>
        <path d="M10 22C10 14.3 16.3 8 24 8H49C53 8 55.6 12.2 53.6 15.7C49.7 22.4 42.4 26.5 34.6 26.5H24C19.6 26.5 16 30.1 16 34.5V40C16 44.4 10 44.4 10 40V22Z" fill="url(#flowG1)"/>
        <path d="M54 42C54 49.7 47.7 56 40 56H15C11 56 8.4 51.8 10.4 48.3C14.3 41.6 21.6 37.5 29.4 37.5H40C44.4 37.5 48 33.9 48 29.5V24C48 19.6 54 19.6 54 24V42Z" fill="url(#flowG2)" opacity="0.92"/>
        <circle cx="32" cy="32" r="5.5" fill="#FFFFFF"/>
      </svg>
    `,
  },
  {
    id: 'google',
    name: 'Google',
    label: 'Google',
    keywords: /\bgoogle\b(?!\s*(flow|gemini|chrome))/i,
    accentColor: '#4285F4',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <path d="M57.6 32.6c0-1.9-.2-3.7-.5-5.4H32v10.3h14.4c-.6 3.3-2.5 6.2-5.4 8.1v6.7h8.7c5.1-4.7 7.9-11.6 7.9-19.7z" fill="#4285F4"/>
        <path d="M32 58.6c7.2 0 13.3-2.4 17.7-6.5l-8.7-6.7c-2.4 1.6-5.5 2.6-9 2.6-6.9 0-12.8-4.7-14.9-11H8.1v7c4.4 8.7 13.4 14.6 23.9 14.6z" fill="#34A853"/>
        <path d="M17.1 37c-.5-1.6-.8-3.3-.8-5s.3-3.4.8-5v-7h-9C6.2 23.8 5.2 27.8 5.2 32s1 8.2 2.9 12l9-7z" fill="#FBBC05"/>
        <path d="M32 16c3.9 0 7.5 1.4 10.2 4l7.7-7.7C45.3 7.9 39.2 5.4 32 5.4 21.5 5.4 12.5 11.3 8.1 20l9 7c2.1-6.3 8-11 14.9-11z" fill="#EA4335"/>
      </svg>
    `,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    label: 'YouTube',
    keywords: /\b(youtube|yt)\b/i,
    accentColor: '#FF0000',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <rect x="4" y="13" width="56" height="38" rx="11" fill="#FF0000"/>
        <polygon points="26,23 44,32 26,41" fill="#FFFFFF"/>
      </svg>
    `,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    label: 'Instagram',
    keywords: /\b(instagram|insta|ig)\b/i,
    accentColor: '#E1306C',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="igG" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#FD5949"/>
            <stop offset="50%" stop-color="#D6249F"/>
            <stop offset="100%" stop-color="#285AEB"/>
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="52" height="52" rx="15" fill="url(#igG)"/>
        <rect x="14" y="14" width="36" height="36" rx="10" fill="none" stroke="#fff" stroke-width="4"/>
        <circle cx="32" cy="32" r="8.5" fill="none" stroke="#fff" stroke-width="4"/>
        <circle cx="43.5" cy="20.5" r="2.6" fill="#fff"/>
      </svg>
    `,
  },
  {
    id: 'android',
    name: 'Android',
    label: 'Android',
    keywords: /\bandroid\b/i,
    accentColor: '#3DDC84',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <path d="M12 42c0-11 9-19 20-19s20 8 20 19v4H12v-4z" fill="#3DDC84"/>
        <line x1="22" y1="26" x2="16" y2="16" stroke="#3DDC84" stroke-width="3.6" stroke-linecap="round"/>
        <line x1="42" y1="26" x2="48" y2="16" stroke="#3DDC84" stroke-width="3.6" stroke-linecap="round"/>
        <circle cx="24" cy="34" r="2.8" fill="#0B1620"/>
        <circle cx="40" cy="34" r="2.8" fill="#0B1620"/>
      </svg>
    `,
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    label: 'Chrome',
    keywords: /\b(chrome|google\s*chrome)\b/i,
    accentColor: '#4285F4',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="#FBBC05"/>
        <path d="M8.5 21A26 26 0 0 1 55.5 21H32Z" fill="#EA4335"/>
        <path d="M8.5 21A26 26 0 0 0 32 58L43 38.5L21 21Z" fill="#34A853"/>
        <circle cx="32" cy="32" r="12" fill="#FFFFFF"/>
        <circle cx="32" cy="32" r="9.2" fill="#4285F4"/>
      </svg>
    `,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    label: 'OpenAI',
    keywords: /\b(openai|chatgpt)\b/i,
    accentColor: '#10A37F',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <rect x="4" y="4" width="56" height="56" rx="14" fill="#10A37F"/>
        <g fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linejoin="round">
          <circle cx="32" cy="32" r="14"/>
          <polygon points="32,16 46,24 46,40 32,48 18,40 18,24"/>
          <circle cx="32" cy="32" r="4.5" fill="#FFFFFF"/>
        </g>
      </svg>
    `,
  },
  {
    id: 'github',
    name: 'GitHub',
    label: 'GitHub',
    keywords: /\bgithub\b/i,
    accentColor: '#ffffff',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" fill="#181717"/>
        <path fill="#FFFFFF" d="M32 12c-11 0-20 9-20 20 0 8.8 5.7 16.3 13.7 19 1 .2 1.4-.4 1.4-1v-3.7c-5.6 1.2-6.7-2.4-6.7-2.4-.9-2.3-2.2-2.9-2.2-2.9-1.8-1.2.1-1.2.1-1.2 2 .1 3.1 2.1 3.1 2.1 1.8 3 4.7 2.2 5.8 1.7.2-1.3.7-2.2 1.3-2.7-4.5-.5-9.2-2.2-9.2-9.9 0-2.2.8-4 2.1-5.4-.2-.5-.9-2.6.2-5.3 0 0 1.7-.5 5.5 2.1a19 19 0 0 1 10 0c3.8-2.6 5.5-2.1 5.5-2.1 1.1 2.7.4 4.8.2 5.3 1.3 1.4 2.1 3.2 2.1 5.4 0 7.7-4.7 9.4-9.2 9.9.7.6 1.4 1.8 1.4 3.7v5.5c0 .5.4 1.2 1.4 1C46.3 48.3 52 40.8 52 32c0-11-9-20-20-20z"/>
      </svg>
    `,
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    label: 'X',
    keywords: /\b(twitter|x\.com|x\s+logo)\b/i,
    accentColor: '#ffffff',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <rect x="6" y="6" width="52" height="52" rx="14" fill="#09090B"/>
        <path fill="#FFFFFF" d="M36.3 29.4 49.4 14h-3.1L34.9 27.3 25.8 14H15.3l13.8 20L15.3 50h3.1l12-14 9.6 14h10.5L36.3 29.4zm-4.3 5-1.4-2-11.1-15.9h4.8l8.9 12.8 1.4 2 11.6 16.6h-4.8L32 34.4z"/>
      </svg>
    `,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    label: 'WhatsApp',
    keywords: /\bwhatsapp\b/i,
    accentColor: '#25D366',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <circle cx="32" cy="31" r="24" fill="#25D366"/>
        <polygon points="15,47 11,57 22,52" fill="#25D366"/>
        <path d="M24.5 22c-1 0-2.6 1.1-2.6 3.2 0 4.5 5 11.2 12.1 14 4.5 1.8 6 1.4 7 .9 1-.5 2.4-2.1 2.4-3.3 0-.6-.5-.9-1.2-1.2l-3.7-1.7c-.6-.3-1.1-.2-1.6.4l-1.5 1.9c-.4.5-.8.6-1.5.3-2.6-1.1-4.8-3.1-6.1-5.6-.3-.6-.2-1.1.3-1.5l1.5-1.6c.4-.5.5-1 .3-1.6l-1.5-3.6c-.3-.7-.7-1-1.3-1h-2.6z" fill="#FFFFFF"/>
      </svg>
    `,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    label: 'TikTok',
    keywords: /\btiktok\b/i,
    accentColor: '#FF0050',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <rect x="6" y="6" width="52" height="52" rx="14" fill="#09090B"/>
        <path d="M36 16v21a8 8 0 1 1-6.5-7.8v5a3.3 3.3 0 1 0 2.5 3.2V16h4c.6 4.4 3.8 7.8 8.2 8.4v4.4c-3.5-.2-6.4-1.6-8.2-3.8z" fill="#25F4EE" transform="translate(-1.5,-1)"/>
        <path d="M36 16v21a8 8 0 1 1-6.5-7.8v5a3.3 3.3 0 1 0 2.5 3.2V16h4c.6 4.4 3.8 7.8 8.2 8.4v4.4c-3.5-.2-6.4-1.6-8.2-3.8z" fill="#FE2C55" transform="translate(1.5,1)"/>
        <path d="M36 16v21a8 8 0 1 1-6.5-7.8v5a3.3 3.3 0 1 0 2.5 3.2V16h4c.6 4.4 3.8 7.8 8.2 8.4v4.4c-3.5-.2-6.4-1.6-8.2-3.8z" fill="#FFFFFF"/>
      </svg>
    `,
  },
  {
    id: 'figma',
    name: 'Figma',
    label: 'Figma',
    keywords: /\bfigma\b/i,
    accentColor: '#A259FF',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <path d="M22 10h10v14H22a7 7 0 0 1 0-14z" fill="#F24E1E"/>
        <path d="M32 10h10a7 7 0 0 1 0 14H32V10z" fill="#FF7262"/>
        <path d="M22 24h10v14H22a7 7 0 0 1 0-14z" fill="#A259FF"/>
        <circle cx="39" cy="31" r="7" fill="#1ABCFE"/>
        <path d="M22 38h10v7a7 7 0 0 1-14 0 7 7 0 0 1 4-7z" fill="#0ACF83"/>
      </svg>
    `,
  },
  {
    id: 'apple',
    name: 'Apple',
    label: 'Apple',
    keywords: /\bapple\b/i,
    accentColor: '#ffffff',
    renderSvg: (size) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
        <path fill="#FFFFFF" d="M38.2 17.2c2-2.4 3.3-5.7 2.9-9.1-2.9.1-6.4 1.9-8.4 4.3-1.8 2.1-3.4 5.5-3 8.8 3.2.2 6.5-1.6 8.5-4zm9.6 16.5c-.1-6.1 5-9.1 5.2-9.2-2.8-4.2-7.3-4.7-8.8-4.8-3.7-.4-7.3 2.2-9.2 2.2-1.9 0-4.9-2.2-8-2.1-4.1.1-7.9 2.4-10 6.1-4.3 7.4-1.1 18.4 3.1 24.4 2.1 2.9 4.5 6.2 7.7 6.1 3.1-.1 4.3-2 8-2 3.7 0 4.8 2 8 1.9 3.3-.1 5.4-3 7.4-5.9 2.3-3.4 3.3-6.7 3.4-6.9-.1 0-6.7-2.6-6.8-9.8z"/>
      </svg>
    `,
  },
];

export function getBrandLogoById(id: string): BrandLogoMeta | undefined {
  return BRAND_LOGOS.find((b) => b.id === id);
}

/**
 * Matches requested brand logos in natural-language prompts.
 * Handles composite phrases cleanly (e.g. "Google, Google Flow, and Google Gemini" -> all 3,
 * while "Google Flow" alone -> ["google-flow"]).
 */
export function detectRequestedLogos(promptText: string): BrandLogoMeta[] {
  const txt = String(promptText || '');
  const found: BrandLogoMeta[] = [];
  const seen = new Set<string>();

  for (const brand of BRAND_LOGOS) {
    if (brand.id === 'google') {
      // Match standalone "google" even when "Google, Google Flow, and Google Gemini" appears,
      // by checking for a token of "google" not immediately followed by flow/gemini/chrome.
      if (/\bgoogle\b(?![\s-]*(flow|gemini|chrome))/i.test(txt)) {
        if (!seen.has(brand.id)) {
          seen.add(brand.id);
          found.push(brand);
        }
      }
      continue;
    }
    if (brand.keywords.test(txt) && !seen.has(brand.id)) {
      seen.add(brand.id);
      found.push(brand);
    }
  }
  return found;
}

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

/**
 * Renders a crisp rasterized logo element (with optional pill container & label) to a Canvas + PNG DataURL.
 */
export async function renderBrandLogoToDataUrl(
  brandId: string,
  opts: { size?: number; style?: LogoBadgeStyle; withLabel?: boolean; customLabel?: string } = {}
): Promise<{ dataUrl: string; width: number; height: number; brand: BrandLogoMeta } | null> {
  const brand = getBrandLogoById(brandId);
  if (!brand) return null;

  const iconSize = Math.max(48, Math.round(opts.size || 140));
  const style: LogoBadgeStyle = opts.style || 'glass';
  const withLabel = opts.withLabel !== false;
  const labelText = opts.customLabel || brand.label;

  const svgStr = brand.renderSvg(iconSize);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  const iconImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG logo render error'));
    img.src = svgUrl;
  });

  const padX = style === 'clean' ? 8 : Math.round(iconSize * 0.28);
  const padY = style === 'clean' ? 8 : Math.round(iconSize * 0.22);
  const gap = withLabel ? Math.round(iconSize * 0.22) : 0;
  const fontSize = Math.round(iconSize * 0.44);

  const probe = document.createElement('canvas').getContext('2d');
  let labelWidth = 0;
  if (withLabel && probe) {
    probe.font = `700 ${fontSize}px "Space Grotesk", "Inter", system-ui, sans-serif`;
    labelWidth = Math.ceil(probe.measureText(labelText).width);
  }

  const totalW = iconSize + (withLabel ? gap + labelWidth : 0) + padX * 2;
  const totalH = iconSize + padY * 2;

  const cv = document.createElement('canvas');
  cv.width = totalW;
  cv.height = totalH;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;

  if (style !== 'clean') {
    ctx.save();
    roundRect(ctx, 2, 2, totalW - 4, totalH - 4, totalH / 2);
    if (style === 'dark-pill') {
      ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (style === 'light-pill') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.drawImage(iconImg, padX, padY, iconSize, iconSize);

  if (withLabel) {
    ctx.save();
    ctx.font = `700 ${fontSize}px "Space Grotesk", "Inter", system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style === 'light-pill' ? '#0f172a' : '#ffffff';
    if (style === 'clean') {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 8;
    }
    ctx.fillText(labelText, padX + iconSize + gap, totalH / 2 + fontSize * 0.04);
    ctx.restore();
  }

  return {
    dataUrl: cv.toDataURL('image/png'),
    width: totalW,
    height: totalH,
    brand,
  };
}
