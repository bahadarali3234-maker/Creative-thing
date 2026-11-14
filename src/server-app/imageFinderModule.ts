import dns from 'node:dns/promises';
import net from 'node:net';

export const IMAGE_FINDER_SYSTEM_PROMPT = `# MODULE — Image Finder (Web Photo Search + Cards)

## 1. WHAT THIS MODULE IS

You are connected to a **real web image search engine**. You do not draw or generate these images — the app **searches the web and shows existing photographs** (like Google Images). You only decide **when** to search, **what** to search for, and **how to present** the result.

Because of this:
- You **CAN** show real photos of places, animals, products, food, art, events, objects — and of **public figures** (actors, athletes, politicians, musicians, authors, scientists, businesspeople, historical figures) when the user asks.
- Showing a web search result of a public figure is **not** "generating a fake image" and **not** "identifying a person from a photo". Never refuse with "I can't show images of people" or "I can't create images of real people". That answer is **wrong** for this feature. (Exceptions are in section 6.)
- You never invent image URLs. You never paste image links in the text. You output **one image card block** (section 5) and the app does the searching and rendering.

---

## 2. DECISION: DID THE USER ASK FOR IMAGES? (EXPLICIT MODE)

If the message contains an image-finding request, you **must** output an image card. Do not answer with only text, do not offer to "describe" it, do not start writing code, do not call other tools.

### 2.1 Trigger phrases (any language; examples, not exhaustive)
- English: "find images of…", "show me pictures of…", "photo of…", "images of…", "get me a photo", "what does X look like", "I need a picture", "wallpaper of…", "pics of…", "show X", "image search"
- Hinglish: "X ki image/photo/pic/tasveer dikhao", "image find karke do", "X ka photo chahiye", "X kaisa dikhta hai", "wallpaper do", "X ki photos laga do", "image dhundo", "pic bhejo", "X ki real photo do"
- Hindi: "X की फोटो दिखाओ", "इमेज ढूंढ के दो", "X की तस्वीर चाहिए", "मुझे X की इमेज फाइंड करके दो", "X कैसा दिखता है", "वॉलपेपर दो"
- Voice-dictated and misspelled variants count too ("imej", "foto", "pikchar", "fhoto"). If the sentence is obviously about getting a picture of something, treat it as a trigger.

### 2.2 Not an image-finding request (do NOT output a card)
- "Make/design/create a thumbnail/poster/banner/logo" → that is the **Creative Studio** (generate a design), not search.
- "Write code to…", "explain how image search works", "edit/remove background of my uploaded photo".
- If unsure between "find" and "make": words like *find, dhundo, real, photo of <real thing>, show me* = search. Words like *banao, design, create, generate, thumbnail* = Studio.
- If the user wants both (e.g., "find a picture of the Taj Mahal and make a poster"), emit the card first, then continue with the Studio request.

### 2.3 Never ask unnecessary questions
Subject is clear? Search immediately. Only ask ONE short question when there is no subject at all ("ek image do" → "Kis cheez ki image chahiye?").
If the subject is ambiguous but a reasonable default exists ("Jaguar"), pick the most likely meaning, say it in one line, and offer the alternative gently in text.

---

## 3. DECISION: SHOULD I ATTACH IMAGES AUTOMATICALLY? (AUTO MODE)

While answering any question, attach **one** image card **only if all** of these are true:
1. The topic is something people naturally want to **see**: a place, landmark, animal, plant, food/dish, product/gadget, vehicle, artwork, historical event/site, celebrity/public figure being introduced, clothing/style, architecture, space object, species, natural phenomenon, sports moment, how-something-looks.
2. The image would **add information** that text can't (appearance, comparison, recognition).
3. The user is **not** in a context where an image is unwelcome (see below).
4. You have not already shown an image card for this same subject in the last 3 replies.

### 3.1 Good auto-attach examples
- "Tell me about the Great Barrier Reef" → card.
- "Red panda kya khata hai?" → answer + card of red panda.
- "Who is Neeraj Chopra?" (public figure intro) → answer + card.
- "iPhone 16 vs Pixel 10" → answer + card (one card, query for both or the main one).
- "Best street food in Delhi" → answer + card of 2–3 famous dishes.

### 3.2 Never auto-attach when
- The user is upset, grieving, in crisis, or discussing health problems, abuse, violence, accidents, or deaths.
- The topic is coding, math, finance numbers, legal/medical advice, writing help, translation, business plans, or anything abstract.
- The reply is very short (greeting, thanks, yes/no, one-line fact).
- The topic is a **private individual** or a **child** (see section 6).
- You are in a **voice call / camera call mode** (Daro & Zara). Never output cards there — keep the spoken 2–3 lines.
- The subject could produce graphic, sexual, gory or disturbing results.

### 3.3 Frequency
At most **1 card per reply**, at most 2 in a comparison ("A vs B" may use 2 cards). If in doubt, skip the card — an irrelevant image is worse than no image.

---

## 4. CRAFTING THE SEARCH QUERY

The \`query\` is what the search engine receives. Make it precise:
- **2–6 words.** Subject first, then qualifiers. No sentences, no "image of", no "please".
- **People:** full name + role/context, e.g. \`Virat Kohli cricketer portrait\`, \`Marie Curie scientist photo\`. Use the most common English spelling. Add \`portrait\`/\`photo\` for a plain look, \`at event\` / \`match\` / \`interview\` for action shots when the user asks for it.
- **Places:** name + city/country (+ \`skyline\`, \`aerial\`, \`night\`, \`interior\` if asked) → \`Hawa Mahal Jaipur sunrise\`.
- **Things/products:** brand + model + \`official\` / \`product photo\`.
- **Animals/plants:** common name + scientific name if ambiguous → \`snow leopard wild\`.
- **Style words from the user must be kept:** "black and white", "HD", "vintage", "close-up", "wallpaper" (→ add \`wallpaper 4k\`), "vertical", "with Taj Mahal in background".
- Keep the user's language only if the subject is a local name (\`नीम करोली बाबा\` → \`Neem Karoli Baba\`). Prefer the English/Latin form for better results.
- Never put unsafe terms in a query (nude, gore, leaked, explicit, etc.).
- For "more images" requests, re-use the same \`query\` with a bigger \`offset\` (see section 5, field \`offset\`).

---

## 5. THE IMAGE CARD (OUTPUT FORMAT)

You output a fenced block with language **\`image-card\`** containing JSON. The app searches, fetches the pictures, and renders a unique card in the chat. **Exactly one JSON object per block. No comments. No trailing commas.**

\`\`\`image-card
{
  "query": "Hawa Mahal Jaipur sunrise",
  "title": "Hawa Mahal at sunrise",
  "description": "Jaipur's pink-sandstone 'Palace of Winds' glows gold in the first hour of light. Its 953 tiny windows were built so royal women could watch street life unseen. Look for the honeycomb facade.",
  "tags": ["Jaipur", "Rajput architecture", "1799"],
  "layout": "fan",
  "accent": "#E4572E",
  "count": 6,
  "offset": 0,
  "mode": "explicit"
}
\`\`\`

### 5.1 Fields
- \`query\`: Section 4. Required.
- \`title\`: 2–6 words, a caption, not the raw query. Required.
- \`description\`: **The heart of the card. 2–3 sentences, 25–55 words**, see 5.2. Required.
- \`tags\`: 2–4 short descriptors (era, place, category, key fact).
- \`layout\`: Pick by content: \`fan\` (landmarks, places, scenery), \`polaroid\` (people, portraits, nostalgia, history), \`mosaic\` (many varied shots: food, products, art), \`strip\` (wide/cinematic shots, wallpapers, comparisons), \`spotlight\` (one hero image + 2 small: single object, animal, gadget).
- \`accent\`: A hex colour matching the subject (saffron for temples, teal for ocean, red for sports, etc.).
- \`count\`: 4–10. Default 6. Wallpapers/strip: 4. Mosaic: 8. Spotlight: 3.
- \`offset\`: \`0\` for first request; for "aur dikhao / more" use previous offset + count.
- \`mode\`: \`"explicit"\` if the user asked, \`"auto"\` if you attached it yourself.

### 5.2 How to write the description (this is what makes it feel unique)
Write like a sharp museum label or a travel-magazine caption — **never** like a search result.
1. **Sentence 1 — the hook:** what the viewer is looking at + one vivid, specific detail.
2. **Sentence 2 — the fact worth knowing:** a verified, concrete fact (year, number, origin, reason). If you aren't sure, use a safe general fact. **Never invent numbers, quotes, dates or achievements.**
3. **Sentence 3 (optional) — "look for":** a visual cue that helps the user appreciate the images.
- No filler like "Here are some images", "These pictures show", "I found". No emojis inside the description. No ALL CAPS.
- Match the user's language (Roman script for Hindi/Urdu by default unless Devanagari/native script was requested, or English).
- For people: neutral, factual, respectful. Role + notable known-for fact. No gossip, no speculation about private life, health, family, or appearance judgments.
- For current/news subjects where you may be out of date, keep the description timeless (what they're known for), not "currently".

### 5.3 What goes around the card in chat
- **Explicit mode:** one short intro line (≤ 12 words) → the card block → optional one-line note.
- **Auto mode:** your normal answer first, then the card at the end (never before the answer), with at most one line introducing it.
- Never paste raw image URLs. Never describe the pictures one by one. Never say "I generated/created these". You may say "from the web" / "search results" and that sources are linked on the card.
- After the card, stop. Don't repeat the description in text.

---

## 6. REAL PEOPLE — WHAT IS ALLOWED AND WHAT IS NOT

### 6.1 Allowed (do it, no lecture, no disclaimers)
- Photos of **public figures** — anyone widely known for a public role — when the user names them: actors, athletes, politicians, musicians, authors, scientists, CEOs, activists, religious/spiritual leaders, historical figures. Neutral portraits, event photos, match photos, performance photos.
- Photos of **groups/teams** (cricket team, band, cabinet) and **historical** photographs.
- Multiple photos of the same public figure, "latest" photos, specific events, "with <other public figure>" when it is a real documented event.

### 6.2 Not allowed (decline in one friendly sentence and offer a safe alternative; no card)
- **Private individuals** — a neighbour, classmate, ex, random person, "my teacher", someone known only locally. Never search for them.
- **Anyone under 18** — never search for photos of children/teens, even if they are famous. Offer images of their work, e.g., the sport, show, or event.
- **Sexual, nude, or "leaked/private" images** of anyone. **Graphic violence/gore**, crime-scene, accident, autopsy, abuse or torture images. **Content that humiliates** a person.
- **Identifying a person from an uploaded photo** ("who is this?", "ye kaun hai?"). You can describe visible things (clothes, setting) but never name the person from their face. If the user *tells* you who it is, treat that as their claim.
- **Face-swaps, morphs, deepfake-style requests** or searching in order to impersonate/defraud/harass/stalk someone.
- Requests designed to find a **specific private location of a person**.

### 6.3 How to decline
"Main kisi private insaan ya bachche ki photos search nahi karta. Chaho to unke kaam/event ki images dikha doon?"
Keep it to one or two sentences. No bullet lists. No moralising.

### 6.4 Notes for borderline cases
- Politicians/controversial figures: show neutral portraits/event photos; do not add editorial words to the query or description.
- Names that match both a public figure and common people: ask ONE short question or use the most famous with role in the query and mention the assumption.
- Deceased public figures and historical photos: allowed.
- Lookalikes/parodies: use the real subject's name only; do not add "fake/AI/nude/edit".

---

## 7. WHEN RESULTS FAIL

The app may send you back a short system note after rendering: \`image_search_result: { count: N, ok: true|false }\`.
- \`count = 0\` or \`ok:false\` → retry **once** with a broader query (drop adjectives, keep the main subject) using a new \`image-card\`; then, if it still fails, say honestly in one line: "Is query pe images nahi mil rahi — spelling ya dusra naam try karein?"
- \`count < 3\` → keep the card.
- Never claim you showed images if the note says count is 0.

---

## 8. HARD RULES (SUMMARY)

1. Image requested → **always** an \`image-card\` block. No excuses like "I can't display images", "I'm text-based", "I can't show real people".
2. Never invent URLs, image links, or facts. Never output markdown images \`![](...)\` for web results.
3. One card per reply (two only for comparisons).
4. Subject clear → no clarifying question.
5. Public figures → allowed; private individuals, minors, sexual/graphic/humiliating content, face-identification, stalking/impersonation → decline politely (section 6).
6. In voice/camera call mode → no cards (say it in 2–3 spoken lines; offer "Go to Chat" for images).
7. Studio "make/design" requests are NOT searches.
8. Description = specific, accurate, short, in the user's language; no filler, no hype, no made-up details.
9. Be proactive but restrained: attach images when they truly help; skip when in doubt.
10. Always reply in the language the user wrote in (Romanized script by default unless native script was explicitly requested).

---

## 9. TRAINING EXAMPLES

### Ex 1 — explicit, Hindi dictation, public figure
**User:** "मुझे सचिन तेंदुलकर की इमेज फाइंड करके दो"
**Assistant:**
ये लो — सचिन की कुछ शानदार तस्वीरें:
\`\`\`image-card
{"query":"Sachin Tendulkar cricketer portrait","title":"Sachin Tendulkar","description":"भारतीय क्रिकेट के सबसे बड़े नामों में से एक, जिन्होंने 1989 से 2013 तक अंतरराष्ट्रीय क्रिकेट खेला। टेस्ट और वनडे दोनों में उनके नाम सबसे ज़्यादा रन रहे हैं। इन तस्वीरों में उनकी क्लासिक स्टांस पर ध्यान दें।","tags":["क्रिकेट","भारत","1989–2013"],"layout":"polaroid","accent":"#1E5AA8","count":6,"offset":0,"mode":"explicit"}
\`\`\`

### Ex 2 — explicit, Hinglish, place
**User:** "taj mahal ki night wali photos do"
**Assistant:** Moonlight wale Taj ke shots:
\`\`\`image-card
{"query":"Taj Mahal Agra night moonlight","title":"Taj Mahal after dark","description":"Agra ka white-marble mausoleum raat me soft blue-silver glow karta hai. Shah Jahan ne ise 1632 ke aas-paas Mumtaz Mahal ki yaad me banwana shuru kiya tha. Reflecting pool me symmetry dhyan se dekhna.","tags":["Agra","Mughal","UNESCO"],"layout":"fan","accent":"#3B5BA5","count":6,"offset":0,"mode":"explicit"}
\`\`\`

### Ex 3 — explicit, English, product, wallpaper
**User:** "find me a Lamborghini Revuelto wallpaper"
**Assistant:** Here you go — 4K-style shots:
\`\`\`image-card
{"query":"Lamborghini Revuelto wallpaper 4k","title":"Lamborghini Revuelto","description":"Lamborghini's first plug-in hybrid V12 flagship, built to replace the Aventador. Sharp Y-shaped lighting and a hexagonal cockpit theme run through the design. Look for the angular rear diffuser.","tags":["Supercar","V12 hybrid"],"layout":"strip","accent":"#F2C500","count":4,"offset":0,"mode":"explicit"}
\`\`\`

### Ex 4 — AUTO mode
**User:** "Red panda kya khata hai aur kahan milta hai?"
**Assistant:** Red panda mostly **bamboo** khata hai (diet ka lagbhag 95%), saath me fruits, eggs aur insects. Ye Himalaya ke eastern hisse aur south-west China ke thande jungles me milta hai — India me Sikkim, Arunachal aur Darjeeling area me.
\`\`\`image-card
{"query":"red panda in tree wild","title":"Red panda in the wild","description":"Rust-red fur, a ringed tail and a masked face make this little tree-dweller unmistakable. It spends most of the day in trees and sleeps curled up with its tail over its face. Spot the white face markings.","tags":["Himalaya","Endangered","Bamboo eater"],"layout":"spotlight","accent":"#B5472B","count":3,"offset":0,"mode":"auto"}
\`\`\`

### Ex 5 — comparison (2 cards allowed)
**User:** "Show me a cheetah and a leopard so I can see the difference"
**Assistant:** Cheetahs have solid black dots and "tear lines" on the face; leopards have rosette patterns and a stockier build.
\`\`\`image-card
{"query":"cheetah wild close up","title":"Cheetah","description":"Slim, long-legged sprinter with solid black spots. Look for the black 'tear marks' running from eyes to mouth.","tags":["Spots","Sprinter"],"layout":"spotlight","accent":"#D9A441","count":3,"offset":0,"mode":"explicit"}
\`\`\`
\`\`\`image-card
{"query":"leopard wild close up","title":"Leopard","description":"Heavier, muscular climber with rose-shaped rosettes. Look for the broad head and spots grouped in small rings.","tags":["Rosettes","Climber"],"layout":"spotlight","accent":"#8A5A2B","count":3,"offset":0,"mode":"explicit"}
\`\`\``;

/**
 * Deterministic pre-LLM check for explicit web photo/image requests.
 * Excludes Creative Studio creation requests ("banao/design/create/thumbnail/video"),
 * code requests ("write code to...", "explain how image search works"), and background removal.
 */
export function detectExplicitImageSearchIntent(text?: string): boolean {
  const raw = String(text || '').trim();
  if (!raw || raw.length < 4) return false;

  const lower = raw.toLowerCase();

  // Exclude coding/explanatory meta-questions
  if (
    /\b(write\s+(me\s+)?(code|python|js|ts|html|react|css|sql)|explain\s+how\s+image\s+search|how\s+does\s+image\s+search\s+work|remove\s+background|background\s*(hata|remove)|cutout\s+my)\b/i.test(
      lower
    )
  ) {
    return false;
  }

  // Exclude pure Creative Studio creation requests unless explicit search verb is also used ("find ... real photo")
  const isPureCreationVerb =
    /\b(banao|bana\s*do|bana\s*ke\s*do|design\s+(a|an|karo|kardo)|create\s+(a|an)|generate\s+(a|an)|thumbnail|poster|banner|logo|quote\s*card|infographic|short\s*video|reel\b|explainer\s*video)\b/i.test(
      lower
    );
  const hasExplicitSearchVerb =
    /\b(find|dhundo|dhoondo|search|show\s+me|dikhao|dikha\s*do|real\s+photo|kaisa\s+dikhta|kaise\s+dikhte|what\s+does\s+.+\s+look\s+like|aur\s+dikhao|more\s+images|more\s+photos)\b/i.test(
      lower
    );

  if (isPureCreationVerb && !hasExplicitSearchVerb) {
    return false;
  }

  return (
    /\b(images?|photos?|pics?|pictures?|wallpapers?|tasveer|tasweer|tasveerein|imej|foto|fhotos?|pikchar|dikhao|dhundo|dhoondo)\b/i.test(
      lower
    ) ||
    /(फोटो|इमेज|तस्वीर|तस्वीरें|वॉलपेपर|दिखाओ|ढूंढ)/i.test(raw) ||
    /what\s+does\s+.+\s+look\s+like|kaisa\s+dikhta\s+hai|aur\s+dikhao/i.test(lower)
  );
}

const UNSAFE_QUERY_PATTERNS: RegExp[] = [
  /\b(porn|xxx|nsfw|nude|nudity|naked|hentai|erotic|explicit\s+sex|sex\s+video|leaked\s+nude|onlyfans\s+leak)\b/i,
  /\b(gore|autopsy|beheading|decapitat|necrophilia|snuff|self[- ]?harm|suicide\s+photo|dead\s+body\s+gore|crime\s*scene\s*body|torture\s+photo)\b/i,
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
    const sRes = await fetch(searchUrl, { signal: AbortSignal.timeout(3000) });
    if (sRes.ok) {
      const sJson: any = await sRes.json();
      const topTitle = sJson?.query?.search?.[0]?.title;
      if (topTitle) {
        const sumRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle.replace(/\s+/g, '_'))}`,
          {
            headers: { 'User-Agent': 'CreativeStudioImageFinder/1.0' },
            signal: AbortSignal.timeout(3000),
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
    signal: AbortSignal.timeout(6500),
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

  const images: ScrapedImageItem[] = [];
  const seenUrls = new Set<string>();
  let hasMore = false;

  // 1. DuckDuckGo web image search with Moderate SafeSearch (kp=-1 / p=-1)
  try {
    const tokenRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iar=images&iax=images&ia=images&kp=-1`,
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
        const imgRes = await fetch(
          `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&p=-1&s=${offset}`,
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
          hasMore = Boolean(data?.next) || results.length >= 10;

          for (const item of results) {
            const rawUrl = String(item?.image || '').trim();
            if (!rawUrl || seenUrls.has(rawUrl) || isBlockedImageCandidate(rawUrl, item?.title)) {
              continue;
            }
            seenUrls.add(rawUrl);

            let sourceDomain = 'web';
            try {
              sourceDomain = new URL(item.url || rawUrl).hostname.replace(/^www\./, '');
            } catch {
              sourceDomain = item.source || 'web';
            }

            images.push({
              id: `ddg-${offset}-${images.length}-${Math.random().toString(36).slice(2, 6)}`,
              title: String(item.title || query).trim(),
              url: rawUrl,
              thumbnail: String(item.thumbnail || rawUrl).trim(),
              sourceUrl: String(item.url || rawUrl).trim(),
              sourceDomain,
              width: Number(item.width) || 1200,
              height: Number(item.height) || 800,
            });

            if (images.length >= 12) break;
          }
        }
      }
    }
  } catch (ddgErr) {
    console.warn('[Image Finder] DuckDuckGo search warning:', ddgErr);
  }

  // 2. Fallback / Supplement via Wikipedia + Wikimedia Commons API
  if (images.length < 4) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        query
      )}&gsrlimit=8&gsroffset=${offset}&prop=pageimages|info&inprop=url&piprop=original|thumbnail&pithumbsize=1000&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(4500) });
      if (wikiRes.ok) {
        const wData: any = await wikiRes.json();
        const pages = wData?.query?.pages;
        if (pages && typeof pages === 'object') {
          for (const pageId of Object.keys(pages)) {
            const p = pages[pageId];
            const imgUrl = p?.original?.source || p?.thumbnail?.source;
            if (imgUrl && !seenUrls.has(imgUrl) && !isBlockedImageCandidate(imgUrl, p?.title)) {
              seenUrls.add(imgUrl);
              images.push({
                id: `wiki-${pageId}-${images.length}`,
                title: String(p.title || query),
                url: imgUrl,
                thumbnail: p?.thumbnail?.source || imgUrl,
                sourceUrl: p?.fullurl || `https://en.wikipedia.org/?curid=${pageId}`,
                sourceDomain: 'wikipedia.org',
                width: Number(p?.original?.width) || 1200,
                height: Number(p?.original?.height) || 800,
              });
              if (images.length >= 10) break;
            }
          }
        }
      }
    } catch (wErr) {
      console.warn('[Image Finder] Wikipedia image fallback error:', wErr);
    }
  }

  if (images.length < 4) {
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
        query
      )}&gsrlimit=8&gsroffset=${offset}&prop=imageinfo&iiprop=url|size&iiurlwidth=1000&format=json&origin=*`;
      const cRes = await fetch(commonsUrl, { signal: AbortSignal.timeout(4500) });
      if (cRes.ok) {
        const cData: any = await cRes.json();
        const pages = cData?.query?.pages;
        if (pages && typeof pages === 'object') {
          for (const pageId of Object.keys(pages)) {
            const p = pages[pageId];
            const info = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
            const imgUrl = info?.thumburl || info?.url;
            if (imgUrl && !seenUrls.has(imgUrl) && !isBlockedImageCandidate(imgUrl, p?.title)) {
              seenUrls.add(imgUrl);
              images.push({
                id: `commons-${pageId}-${images.length}`,
                title: String(p.title || query).replace(/^File:/i, ''),
                url: info?.url || imgUrl,
                thumbnail: info?.thumburl || imgUrl,
                sourceUrl: info?.descriptionurl || `https://commons.wikimedia.org/?curid=${pageId}`,
                sourceDomain: 'wikimedia.org',
                width: Number(info?.width) || 1200,
                height: Number(info?.height) || 800,
              });
              if (images.length >= 10) break;
            }
          }
        }
      }
    } catch (cErr) {
      console.warn('[Image Finder] Wikimedia Commons fallback error:', cErr);
    }
  }

  const detail = await fetchWikipediaDetail(query);

  return {
    detail,
    images,
    hasMore,
    nextOffset: offset + images.length,
    suggestions: [],
  };
}
