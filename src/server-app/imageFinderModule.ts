import dns from 'node:dns/promises';
import net from 'node:net';

export const IMAGE_FINDER_SYSTEM_PROMPT = `# MODULE — Web Image Finder (Real Web Photo Cards)
You are connected to a real web image search engine (\`/api/google-scrape-images\`). You do NOT generate photos or invent URLs — you output an \`image-card\` fenced JSON block and the UI fetches and renders real web photographs.

1. EXPLICIT IMAGE REQUESTS:
- Whenever the user asks to find/show/search photos, images, pics, wallpapers, or tasveer ("find photos of...", "X ki photo dikhao", "what does X look like"), ALWAYS output one \`\`\`image-card block immediately after a short 1-line intro (<= 12 words). Never say "I can't show images" or paste raw URLs.
- Distinguish Search vs Studio: "find / search / dhundo / real photo / dikhao" = \`image-card\`; "make / create / design / banado / thumbnail / poster / logo / png" = code/Studio, not search.

2. SMART AUTO-ATTACH:
- Attach 1 \`image-card\` at the end of an answer when the topic is inherently visual (landmark, animal, plant, dish, gadget, vehicle, artwork, public figure) AND a real photo helps understanding.
- NEVER attach cards on coding, math, finance, medical/legal advice, grief/crisis, short greetings/yes-no, or in voice-call mode.

3. PEOPLE & SAFETY POLICY:
- PUBLIC FIGURES ARE ALLOWED: Athletes, actors, musicians, politicians, scientists, historical figures, teams — show neutral portraits/event photos without disclaimers.
- NOT ALLOWED (decline in 1 friendly sentence, NO card): private individuals, anyone under 18 / minors, sexual/nude/leaked content, gore/violence/humiliating imagery, identifying a person from an uploaded photo, deepfakes/stalking.

4. OUTPUT CONTRACT (exact JSON inside \`\`\`image-card):
\`\`\`image-card
{"query":"2-6 word English search query","title":"Short Caption","description":"2-3 crisp museum-label sentences (25-50 words) in the user's language (Roman script if Hindi/Urdu unless native requested) with 1 concrete fact + visual cue.","tags":["Tag1","Tag2"],"layout":"fan|polaroid|mosaic|strip|spotlight","accent":"#00A6FF","count":6,"offset":0,"mode":"explicit|auto"}
\`\`\`
- Layout guide: \`polaroid\` (people/portraits), \`fan\` (landmarks/places), \`mosaic\` (food/art/variety), \`strip\` (wide/wallpapers), \`spotlight\` (single animal/object). Keep queries clean, 2-6 English keywords, Moderate SafeSearch compliant.`;

/**
 * Deterministic pre-LLM check for explicit web photo/image requests.
 * Excludes Creative Studio creation requests ("banao/design/create/thumbnail/video"),
 * code requests ("write code to...", "explain how image search works"), and background removal.
 */
export function detectExplicitImageSearchIntent(text?: string): boolean {
  const raw = String(text || '').trim();
  if (!raw || raw.length < 4) return false;

  const lower = raw.toLowerCase();

  // Exclude coding/explanatory meta-questions & non-visual analytical "find the ..." tasks
  if (
    /\b(write\s+(me\s+)?(code|python|js|ts|html|react|css|sql)|explain\s+how\s+image\s+search|how\s+does\s+image\s+search\s+work|remove\s+background|background\s*(hata|remove)|cutout\s+my)\b/i.test(
      lower
    )
  ) {
    return false;
  }

  // Exclude math/code/logic "find the value / area / bug / error / solution / meaning" unless explicit image noun is present
  const hasExplicitVisualNoun =
    /\b(images?|photos?|pics?|pictures?|wallpapers?|tasveer|tasweer|tasveerein|imej|foto|fhotos?|pikchar)\b/i.test(lower) ||
    /(फोटो|इमेज|तस्वीर|तस्वीरें|वॉलपेपर)/i.test(raw);
  const isNonVisualAnalyticalFind =
    /\bfind\s+(the\s+)?(value|sum|average|mean|median|mode|area|volume|perimeter|root|roots|derivative|integral|probability|solution|answer|meaning|definition|bug|error|issue|syntax|output|complexity|time|distance|speed|rate|ratio|percent|percentage|missing\s+number|next\s+number)\b/i.test(
      lower
    );

  // Exclude pure Creative Studio creation requests unless explicit search verb is also used
  const hasCreationVerb =
    /\b(banao|bana\s*do|bana\s*ke\s*do|design|create|generate|make|draw|export|as\s*png)\b/i.test(lower);
  const hasStudioArtifact =
    /\b(thumbnail|poster|banner|logo|quote\s*card|infographic|short\s*video|reel\b|explainer\s*video|motion\s*graphic|png|artwork|illustration)\b/i.test(
      lower
    );
  const hasExplicitSearchVerb =
    /\b(find\s+(?:the\s+)?(?:image|images|photo|photos|pic|pics|picture|pictures|wallpaper|wallpapers)?|dhundo|dhoondo|search|google|show\s+me|dikhao|dikha\s*do|real\s+photo|kaisa\s+dikhta|kaise\s+dikhte|what\s+does\s+.+\s+look\s+like|aur\s+dikhao|more\s+images|more\s+photos|fetch|get\s+me\s+(?:a\s+)?(?:photo|pic|picture|image))\b/i.test(
      lower
    );

  if ((hasCreationVerb || hasStudioArtifact) && !hasExplicitSearchVerb) {
    return false;
  }

  // Trigger deterministically on explicit "find the <subject>" (non-analytical) or any explicit image/search phrase
  if (/^\s*(?:please\s+|can\s+you\s+)?(?:find|for\s*nd)\s+(?:the\s+(?:images?|photos?|pics?|pictures?|wallpapers?)\s+(?:of|for|about)?|the\s+|(?:images?|photos?|pics?|pictures?|wallpapers?)\s+(?:of|for|about)?)/i.test(lower)) {
    if (!isNonVisualAnalyticalFind || hasExplicitVisualNoun) {
      return true;
    }
  }

  return (
    hasExplicitVisualNoun ||
    /\b(dikhao|dhundo|dhoondo)\b/i.test(lower) ||
    /(दिखाओ|ढूंढ)/i.test(raw) ||
    /what\s+does\s+.+\s+look\s+like|kaisa\s+dikhta\s+hai|aur\s+dikhao/i.test(lower)
  );
}

/**
 * Extracts a concise, clean web search query deterministically (ZERO AI) from prompts such as:
 * "find the image of Imran Khan", "find image Ferrari SF90", "find the Eiffel Tower night".
 */
export function extractExplicitImageQuery(rawPrompt: string): string {
  const original = String(rawPrompt || '').trim();
  if (!original) return '';

  // Step 1: Prioritize segment immediately after explicit trigger phrases
  let focused = original;
  const triggerMatch =
    /(?:^|\b)(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:(?:find|for\s*nd)\s+the\s+(?:images?|photos?|pics?|pictures?|wallpapers?)|(?:find|for\s*nd)\s+(?:images?|photos?|pics?|pictures?|wallpapers?)|(?:find|for\s*nd)\s+the|search\s+(?:for\s+)?(?:images?|photos?|pics?|pictures?|wallpapers?)?|show\s+me\s+(?:the\s+)?(?:images?|photos?|pics?|pictures?|wallpapers?)?|get\s+me\s+(?:the\s+)?(?:images?|photos?|pics?|pictures?|wallpapers?)?|fetch\s+(?:the\s+)?(?:images?|photos?|pics?|pictures?|wallpapers?)?|dikhao|dikha\s+do|dhundo|dhoondo)\b(?:\s+(?:of|for|about|on|ki|ke|ka))?\s*(.+)$/i.exec(
      original
    );
  if (triggerMatch && triggerMatch[1] && triggerMatch[1].trim().length >= 2) {
    focused = triggerMatch[1].trim();
  }

  // Step 2: Smart keyword strip (preserve subject nouns, adjectives, years, locations)
  let q = focused
    .replace(
      /\b(please|can you|could you|kindly|show me|find me|find|for nd|search for|search|get me|give me|fetch|dikhao|dikha do|dhundo|dhoondo|bhejo|laga do|chahiye|mujhe|some|online|google|ki|ke|ka|images?|photos?|pics?|pictures?|tasveer|tasweer|tasveerein|imej|foto|fhotos?|pikchar)\b/gi,
      ' '
    )
    .replace(/^(?:of|for|about|the|an|a|on|in)\b\s+/i, '')
    .replace(/\s+\b(?:please|for\s+me|in\s+google|on\s+google|online)\b$/i, '')
    .replace(/[?!.,:;"'()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!q || q.length < 2) {
    q = original
      .replace(/^(?:(?:find|for\s*nd)\s+the\s+(?:image|photo|pic)?|(?:find|for\s*nd)\s+(?:image|photo|pic)?|find)\b/i, '')
      .replace(/[?!.,:;"'()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 70);
  }
  return q.split(' ').filter(Boolean).slice(0, 7).join(' ');
}

export function extractCleanImageSearchQuery(rawPrompt: string): string {
  return extractExplicitImageQuery(rawPrompt);
}

function toDisplayCaptionCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 && /^[a-z]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function pickDeterministicLayout(query: string): 'polaroid' | 'strip' | 'mosaic' | 'spotlight' | 'fan' {
  const lower = query.toLowerCase();
  if (
    /\b(portrait|person|actor|actress|singer|player|president|prime\s*minister|king|queen|scientist|founder|celebrity|cricketer|footballer|ronaldo|messi|kohli|elon|musk|khan|face|man|woman|athlete|artist)\b/i.test(
      lower
    )
  ) {
    return 'polaroid';
  }
  if (/\b(wallpaper|banner|skyline|landscape|panoramic|4k|desktop|horizon|sunset|sunrise|mountain\s*range)\b/i.test(lower)) {
    return 'strip';
  }
  if (/\b(food|dish|recipe|biryani|pizza|burger|cake|architecture|interior|car|cars|supercar|painting|art|outfit|collection|city|cities)\b/i.test(lower)) {
    return 'mosaic';
  }
  if (/\b(phone|iphone|samsung|laptop|watch|camera|headphone|dog|cat|lion|tiger|eagle|bird|flower|rose)\b/i.test(lower)) {
    return 'spotlight';
  }
  return 'fan';
}

export function buildDeterministicImageCardMetadata(
  cleanedQuery: string,
  detail?: { title?: string; description?: string; sourceUrl?: string }
) {
  const rawTitle = String(detail?.title || '').trim();
  const displayTitle =
    rawTitle && rawTitle.toLowerCase() !== cleanedQuery.toLowerCase() && rawTitle.length <= 48
      ? rawTitle
      : toDisplayCaptionCase(cleanedQuery);

  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'of', 'in', 'on', 'at', 'to', 'hd', '4k', 'new']);
  const tags = cleanedQuery
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9\u0900-\u097F-]/g, ''))
    .filter((w) => w.length >= 2 && !stopWords.has(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));

  return {
    query: cleanedQuery,
    title: displayTitle,
    description: '',
    tags: tags.length ? tags : [displayTitle],
    layout: pickDeterministicLayout(cleanedQuery),
    intro: '',
  };
}

const UNSAFE_QUERY_PATTERNS: RegExp[] = [
  /\b(porn|xxx|nsfw|nude|nudity|naked|hentai|onlyfans|fansly|leaked\s*nude)\b/i,
  /\b(boobs?|tits?|nipples?|pussy|vagina|penis|dick|cock|bdsm)\b/i,
  /\b(gore|autopsy|beheading|decapitat|necrophilia|snuff|self[- ]?harm|suicide\s+photo|torture\s+photo)\b/i,
  /\b(child\s*porn|csam|loli|shota|underage\s*(nude|sex|sexy|bikini))\b/i,
  /\b(deepfake\s*(nude|porn)|revenge\s*porn)\b/i,
];

export function isUnsafeImageQuery(query: string): boolean {
  const q = String(query || '').trim();
  if (!q) return false;
  return UNSAFE_QUERY_PATTERNS.some((rx) => rx.test(q));
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark testing
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpAddress(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();
  const ipVer = net.isIP(normalized);
  if (ipVer === 4) return isPrivateIpv4(normalized);
  if (ipVer === 6) {
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7);
      if (net.isIP(mapped) === 4) return isPrivateIpv4(mapped);
    }
    if (/^(fc|fd)[0-9a-f]{2}:/i.test(normalized)) return true; // unique local fc00::/7
    if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true; // link-local fe80::/10
    return false;
  }
  return true;
}

/**
 * Strict SSRF guard for external URLs fetched server-side.
 * Blocks non-HTTP(S) protocols, localhost, internal hostnames, cloud metadata IPs,
 * private IPv4/IPv6 ranges, and DNS hostnames resolving to private IPs.
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid external URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Blocked unsupported URL protocol');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    host === 'metadata'
  ) {
    throw new Error('Blocked internal or metadata hostname');
  }

  if (net.isIP(host) !== 0) {
    if (isPrivateIpAddress(host)) {
      throw new Error('Blocked private or loopback IP address');
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!records || records.length === 0) {
      throw new Error('Hostname failed DNS resolution');
    }
    for (const rec of records) {
      if (isPrivateIpAddress(rec.address)) {
        throw new Error('Blocked hostname resolving to private/internal IP');
      }
    }
  } catch (err: any) {
    if (String(err?.message || '').startsWith('Blocked') || String(err?.message || '').includes('DNS')) {
      throw err;
    }
    throw new Error('Unable to verify safe destination host');
  }

  return parsed;
}

const scrapeRateWindow = new Map<string, number[]>();

export function checkImageScrapeRateLimit(ipKey: string, maxPerMinute = 60): boolean {
  const key = ipKey || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const recent = (scrapeRateWindow.get(key) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= maxPerMinute) {
    scrapeRateWindow.set(key, recent);
    return false;
  }
  recent.push(now);
  scrapeRateWindow.set(key, recent);
  if (scrapeRateWindow.size > 500) {
    for (const [k, list] of scrapeRateWindow.entries()) {
      if (list.every((t) => now - t >= windowMs)) {
        scrapeRateWindow.delete(k);
      }
    }
  }
  return true;
}

export interface ScrapedImageItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  sourceUrl: string;
  sourceDomain: string;
  width: number;
  height: number;
}

export interface GoogleScrapeImagesResult {
  detail: {
    title: string;
    description: string;
    sourceUrl: string;
  };
  images: ScrapedImageItem[];
  hasMore: boolean;
  nextOffset: number;
  suggestions: string[];
  blocked?: boolean;
}

const BLOCKED_ADULT_DOMAINS = [
  'pornhub',
  'xvideos',
  'xnxx',
  'xhamster',
  'redtube',
  'youporn',
  'onlyfans',
  'rule34',
  'gelbooru',
  'danbooru',
  'liveleak',
  'bestgore',
];

function isBlockedImageCandidate(urlStr: string, titleStr = ''): boolean {
  const lower = `${urlStr} ${titleStr}`.toLowerCase();
  if (
    lower.endsWith('.svg') ||
    lower.includes('1x1') ||
    lower.includes('pixel') ||
    lower.includes('spacer') ||
    lower.includes('beacon') ||
    lower.includes('doubleclick')
  ) {
    return true;
  }
  return BLOCKED_ADULT_DOMAINS.some((d) => lower.includes(d));
}

async function fetchWikipediaDetail(query: string): Promise<{
  title: string;
  description: string;
  sourceUrl: string;
}> {
  const cleanTitle = query.replace(/\b(portrait|photo|images?|pictures?|wallpaper|4k|hd|close[- ]?up|sunrise|night|moonlight)\b/gi, '').trim() || query;
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanTitle
    )}&srlimit=1&format=json&origin=*`;
    const sRes = await fetch(searchUrl, { signal: AbortSignal.timeout(1600) });
    if (sRes.ok) {
      const sJson: any = await sRes.json();
      const topTitle = sJson?.query?.search?.[0]?.title;
      if (topTitle) {
        const sumRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle.replace(/\s+/g, '_'))}`,
          {
            headers: { 'User-Agent': 'CreativeStudioImageFinder/1.0' },
            signal: AbortSignal.timeout(1600),
          }
        );
        if (sumRes.ok) {
          const sumJson: any = await sumRes.json();
          if (sumJson?.extract) {
            return {
              title: sumJson.title || query,
              description: String(sumJson.extract).slice(0, 320),
              sourceUrl:
                sumJson?.content_urls?.desktop?.page ||
                `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle.replace(/\s+/g, '_'))}`,
            };
          }
        }
      }
    }
  } catch {
    // quiet detail fallback
  }

  return {
    title: query,
    description: '',
    sourceUrl: `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`,
  };
}

async function scrapeDirectWebsite(rawUrl: string): Promise<GoogleScrapeImagesResult> {
  const safeUrl = await assertSafeExternalUrl(rawUrl);
  const res = await fetch(safeUrl.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(3500),
  });

  if (res.url) {
    await assertSafeExternalUrl(res.url);
  }

  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : safeUrl.hostname;
  const pageDesc = descMatch ? descMatch[1].trim() : '';

  const imgUrls = new Set<string>();
  const images: ScrapedImageItem[] = [];
  const sourceDomain = safeUrl.hostname.replace(/^www\./, '');

  const metaRegex = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRegex.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], safeUrl).toString();
      if (!isBlockedImageCandidate(abs) && !imgUrls.has(abs)) {
        imgUrls.add(abs);
        images.push({
          id: `direct-${images.length}`,
          title: pageTitle,
          url: abs,
          thumbnail: abs,
          sourceUrl: safeUrl.toString(),
          sourceDomain,
          width: 1200,
          height: 800,
        });
      }
    } catch {}
  }

  const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((m = imgTagRegex.exec(html)) !== null && images.length < 12) {
    try {
      const abs = new URL(m[1], safeUrl).toString();
      if (/^https?:\/\//i.test(abs) && !isBlockedImageCandidate(abs) && !imgUrls.has(abs)) {
        imgUrls.add(abs);
        images.push({
          id: `direct-${images.length}`,
          title: pageTitle,
          url: abs,
          thumbnail: abs,
          sourceUrl: safeUrl.toString(),
          sourceDomain,
          width: 1000,
          height: 700,
        });
      }
    } catch {}
  }

  return {
    detail: {
      title: pageTitle,
      description: pageDesc,
      sourceUrl: safeUrl.toString(),
    },
    images,
    hasMore: false,
    nextOffset: images.length,
    suggestions: [],
  };
}

// Fast 10-minute in-memory search cache so repeat / paginated / multi-tab searches respond in <5ms
const imageSearchCache = new Map<string, { ts: number; result: GoogleScrapeImagesResult }>();
const IMAGE_SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchDuckDuckGoImagesFast(query: string, offset: number): Promise<{ items: ScrapedImageItem[]; hasMore: boolean }> {
  const items: ScrapedImageItem[] = [];
  let hasMore = false;
  try {
    const tokenRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iar=images&iax=images&ia=images&kp=-1`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(2200),
      }
    );

    if (tokenRes.ok) {
      const html = await tokenRes.text();
      const vqdMatch = html.match(/vqd=([\d-]+)/) || html.match(/vqd="([^"]+)"/);
      const vqd = vqdMatch ? vqdMatch[1] : null;

      if (vqd) {
        const imgRes = await fetch(
          `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&p=-1&s=${offset}`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Referer: 'https://duckduckgo.com/',
            },
            signal: AbortSignal.timeout(2500),
          }
        );

        if (imgRes.ok) {
          const data: any = await imgRes.json();
          const results = Array.isArray(data?.results) ? data.results : [];
          hasMore = Boolean(data?.next) || results.length >= 10;

          for (const item of results) {
            const rawUrl = String(item?.image || '').trim();
            if (!rawUrl || isBlockedImageCandidate(rawUrl, item?.title)) continue;

            let sourceDomain = 'web';
            try {
              sourceDomain = new URL(item.url || rawUrl).hostname.replace(/^www\./, '');
            } catch {
              sourceDomain = item.source || 'web';
            }

            items.push({
              id: `ddg-${offset}-${items.length}-${Math.random().toString(36).slice(2, 6)}`,
              title: String(item.title || query).trim(),
              url: rawUrl,
              thumbnail: String(item.thumbnail || rawUrl).trim(),
              sourceUrl: String(item.url || rawUrl).trim(),
              sourceDomain,
              width: Number(item.width) || 1200,
              height: Number(item.height) || 800,
            });
            if (items.length >= 12) break;
          }
        }
      }
    }
  } catch (ddgErr) {
    console.warn('[Image Finder] DuckDuckGo fast notice:', (ddgErr as any)?.name || ddgErr);
  }
  return { items, hasMore };
}

async function fetchWikipediaImagesFast(query: string, offset: number): Promise<ScrapedImageItem[]> {
  const items: ScrapedImageItem[] = [];
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=8&gsroffset=${offset}&prop=pageimages|info&inprop=url&piprop=original|thumbnail&pithumbsize=1000&format=json&origin=*`;
    const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(2000) });
    if (wikiRes.ok) {
      const wData: any = await wikiRes.json();
      const pages = wData?.query?.pages;
      if (pages && typeof pages === 'object') {
        for (const pageId of Object.keys(pages)) {
          const p = pages[pageId];
          const imgUrl = p?.original?.source || p?.thumbnail?.source;
          if (imgUrl && !isBlockedImageCandidate(imgUrl, p?.title)) {
            items.push({
              id: `wiki-${pageId}-${items.length}`,
              title: String(p.title || query),
              url: imgUrl,
              thumbnail: p?.thumbnail?.source || imgUrl,
              sourceUrl: p?.fullurl || `https://en.wikipedia.org/?curid=${pageId}`,
              sourceDomain: 'wikipedia.org',
              width: Number(p?.original?.width) || 1200,
              height: Number(p?.original?.height) || 800,
            });
            if (items.length >= 10) break;
          }
        }
      }
    }
  } catch {}
  return items;
}

async function fetchWikimediaCommonsImagesFast(query: string, offset: number): Promise<ScrapedImageItem[]> {
  const items: ScrapedImageItem[] = [];
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=8&gsroffset=${offset}&prop=imageinfo&iiprop=url|size&iiurlwidth=1000&format=json&origin=*`;
    const cRes = await fetch(commonsUrl, { signal: AbortSignal.timeout(2000) });
    if (cRes.ok) {
      const cData: any = await cRes.json();
      const pages = cData?.query?.pages;
      if (pages && typeof pages === 'object') {
        for (const pageId of Object.keys(pages)) {
          const p = pages[pageId];
          const info = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
          const imgUrl = info?.thumburl || info?.url;
          if (imgUrl && !isBlockedImageCandidate(imgUrl, p?.title)) {
            items.push({
              id: `commons-${pageId}-${items.length}`,
              title: String(p.title || query).replace(/^File:/i, ''),
              url: info?.url || imgUrl,
              thumbnail: info?.thumburl || imgUrl,
              sourceUrl: info?.descriptionurl || `https://commons.wikimedia.org/?curid=${pageId}`,
              sourceDomain: 'wikimedia.org',
              width: Number(info?.width) || 1200,
              height: Number(info?.height) || 800,
            });
            if (items.length >= 10) break;
          }
        }
      }
    }
  } catch {}
  return items;
}

async function fetchBingImagesFast(query: string, offset: number): Promise<ScrapedImageItem[]> {
  const items: ScrapedImageItem[] = [];
  try {
    const first = Math.max(1, offset + 1);
    const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=${first}&adlt=moderate`;
    const bRes = await fetch(bingUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(2200),
    });
    if (bRes.ok) {
      const html = await bRes.text();
      const matches = [...html.matchAll(/class="iusc"[^>]*m="([^"]+)"/g)];
      for (const match of matches) {
        try {
          const rawJson = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
          const obj = JSON.parse(rawJson);
          const murl = String(obj?.murl || '').trim();
          const turl = String(obj?.turl || murl).trim();
          const title = String(obj?.t || query).trim();
          if (murl && !isBlockedImageCandidate(murl, title)) {
            let sourceDomain = 'bing.com';
            try {
              sourceDomain = new URL(obj?.purl || murl).hostname.replace(/^www\./, '');
            } catch {}
            items.push({
              id: `bing-${offset}-${items.length}-${Math.random().toString(36).slice(2, 6)}`,
              title,
              url: murl,
              thumbnail: turl,
              sourceUrl: String(obj?.purl || murl).trim(),
              sourceDomain,
              width: 1200,
              height: 800,
            });
            if (items.length >= 12) break;
          }
        } catch {}
      }
    }
  } catch {}
  return items;
}

export async function searchGoogleScrapeImages(params: {
  query: string;
  offset?: number;
}): Promise<GoogleScrapeImagesResult> {
  const query = String(params.query || '').trim();
  const offset = Math.max(0, Math.min(200, Number(params.offset) || 0));

  if (!query) {
    return {
      detail: { title: '', description: '', sourceUrl: '' },
      images: [],
      hasMore: false,
      nextOffset: 0,
      suggestions: [],
    };
  }

  if (/^https?:\/\//i.test(query)) {
    return scrapeDirectWebsite(query);
  }

  if (isUnsafeImageQuery(query)) {
    return {
      detail: {
        title: 'Filtered query',
        description: 'This search contains unsafe terms and was blocked by SafeSearch policy.',
        sourceUrl: '',
      },
      images: [],
      hasMore: false,
      nextOffset: 0,
      suggestions: [],
      blocked: true,
    };
  }

  const cacheKey = `${query.toLowerCase()}::${offset}`;
  const cached = imageSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < IMAGE_SEARCH_CACHE_TTL_MS) {
    return cached.result;
  }

  // Launch ALL image providers + detail fetch in parallel for fast response (~1.2–2.2s cold)
  const [ddgSettled, bingSettled, wikiSettled, commonsSettled, detailSettled] = await Promise.allSettled([
    fetchDuckDuckGoImagesFast(query, offset),
    fetchBingImagesFast(query, offset),
    fetchWikipediaImagesFast(query, offset),
    fetchWikimediaCommonsImagesFast(query, offset),
    fetchWikipediaDetail(query),
  ]);

  const images: ScrapedImageItem[] = [];
  const seenUrls = new Set<string>();
  let hasMore = false;

  const pushUnique = (list: ScrapedImageItem[]) => {
    for (const item of list) {
      if (images.length >= 12) break;
      if (!item.url || seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      images.push(item);
    }
  };

  if (ddgSettled.status === 'fulfilled') {
    hasMore = ddgSettled.value.hasMore;
    pushUnique(ddgSettled.value.items);
  }
  if (images.length < 10 && bingSettled.status === 'fulfilled') {
    if (bingSettled.value.length >= 10) hasMore = true;
    pushUnique(bingSettled.value);
  }
  if (images.length < 10 && wikiSettled.status === 'fulfilled') {
    pushUnique(wikiSettled.value);
  }
  if (images.length < 10 && commonsSettled.status === 'fulfilled') {
    pushUnique(commonsSettled.value);
  }

  const detail =
    detailSettled.status === 'fulfilled'
      ? detailSettled.value
      : {
          title: query,
          description: '',
          sourceUrl: `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`,
        };

  const finalResult: GoogleScrapeImagesResult = {
    detail,
    images,
    hasMore: hasMore || images.length >= 8,
    nextOffset: offset + images.length,
    suggestions: [],
  };

  if (images.length > 0) {
    if (imageSearchCache.size > 200) {
      const oldestKey = imageSearchCache.keys().next().value;
      if (oldestKey) imageSearchCache.delete(oldestKey);
    }
    imageSearchCache.set(cacheKey, { ts: Date.now(), result: finalResult });
  }

  return finalResult;
}
