// Rule-based intent detection (EN / Hinglish / Hindi). Fast, deterministic, no LLM needed.
const GEN_VERBS = /\b(make|create|design|generate|build|draw|prepare|banao|bana\s*do|bana\s*de|banado|banana|banaye|banayiye|tayyar|kar\s*do)\b|बनाओ|बना\s*दो|बना\s*दे|बनाइए|बनाना|डिज़ाइन|डिजाइन|तैयार|जनरेट/i;
const GEN_NOUNS = [
  ['thumbnail', /thumb\s*nail|thumbnil|थंबनेल|थम्बनेल|थंबनील/i],
  ['poster', /poster|पोस्टर/i],
  ['logo', /\blogo\b|लोगो/i],
  ['banner', /banner|बैनर|channel\s*art|cover\s*photo|header/i],
  ['wallpaper', /wallpaper|वॉलपेपर|वालपेपर/i],
  ['quote-card', /quote\s*card|quote\s*image|कोट\s*कार्ड/i],
  ['story-reel', /\bstory\b|\breel\b|\bshorts?\s*cover|स्टोरी|रील/i],
  ['ig-post', /insta(gram)?\s*post|social\s*(media)?\s*post|\bpost\s*(design|image)|फेसबुक\s*पोस्ट|पोस्ट\s*(बना|डिज़ाइन)/i],
  ['invitation', /invit(e|ation)|निमंत्रण|आमंत्रण|card\s*for\s*(wedding|birthday)|शादी\s*का\s*कार्ड/i],
  ['certificate', /certificate|सर्टिफिकेट|प्रमाण\s*पत्र/i],
  ['business-card', /business\s*card|visiting\s*card|विज़िटिंग\s*कार्ड/i],
  ['flyer', /flyer|pamphlet|पर्चा|फ्लायर|sale\s*(offer|ad)/i],
  ['album-cover', /album\s*cover|podcast\s*cover|song\s*cover/i],
  ['book-cover', /book\s*cover|किताब\s*का\s*कवर/i],
  ['infographic', /infographic|इन्फोग्राफिक/i],
  ['profile-dp', /\bdp\b|profile\s*(pic|photo|picture)|प्रोफाइल\s*(फोटो|पिक)/i],
  ['menu', /\bmenu\s*(card|design)|मेनू\s*कार्ड/i],
  ['product-ad', /\b(?:product|perfume|watch|sneaker|shoe|brand|launch|fashion|promo)\s*(?:ad|advert|poster|image|campaign)|\badvertisement\b|\bad\s*creative\b|\bad\b/i],
  ['news-card', /news\s*card|announcement\s*(card|image)/i],
  ['portrait', /\b(portrait|headshot|photoshoot|editorial\s*shot|model\s*shot|studio\s*shot)\b|पोर्ट्रेट|हेडशॉट/i],
];
const GENERIC_IMG = /\b(image|images|imej|photo|pic|picture|graphic|artwork|illustration|design)\b|इमेज|तस्वीर|फोटो|चित्र|ग्राफ़िक|ग्राफिक/i;
const EXPLICIT_GENERATE = /(generate|create|make|banao|bana\s*do|बनाओ|बना\s*दो|जनरेट)\s*(an?\s*|ek\s*|एक\s*)?(new\s*)?(image|picture|imej|photo|pic|इमेज|तस्वीर|फोटो)|image\s*(generate|generation|banao|bana\s*do)|इमेज\s*(जनरेट|बनाओ|बना\s*दो|बनानी)/i;
const SEARCH_WORDS = /\b(find|search|dhundo|dhoondo|dhoond|dikhao|dikha\s*do|show\s*me|get\s*me|look\s*up|laga\s*do\s*photo|real\s*photo|pics?\s*of|photos?\s*of|images?\s*of)\b|ढूंढ|ढूँढ|दिखाओ|दिखा\s*दो|फाइंड|खोजो|सर्च/i;
const EDIT_WORDS = /(remove|hata|hatao|हटा|हटाओ|nikalo|निकालो)\s*(the\s*)?(background|bg|बैकग्राउंड)|\bbackground\s*(remove|hata|change|replace|swap)|\b(change|replace|swap)\s+(the\s+)?(background|bg|sky|backdrop)|\bbg\s*(remove|hata|change|replace)|cut\s*-?out|transparent\s*(bana|kar)|बैकग्राउंड\s*(रिमूव|हटा|बदलो)|resize|crop|brighten|enhance|retouch|recreate|(change|edit|replace|update|modify|fix|badlo|likho)\s+(this|the|all|any)?\s*(text|title|headline|heading|word|words|font|color|colour|element|elements|thing|things|logo|logos|character|person|corner|image|photo|pic|background|outfit|clothes)|make\s+(everything|it|this|text)?\s*editable|canva\s*(style|edit|mode)?|text\s*(add|lagao|change|edit)|add\s*text/i;
const FACE_SWAP_WORDS = /\b(face\s*swap|swap\s*(the\s*)?face|replace\s*(the\s*)?(character|face|person|him|her|subject)|put\s+my\s+face|my\s+face\s+(in|on|onto|into)|chehra\s*(badlo|lagao)|mera\s*chehra|mera\s*face)\b|चेहरा\s*(बदलो|लगाओ)/i;

const PLATFORM_SIZE = [
  [/youtube\s*thumb|yt\s*thumb|thumbnail|थंबनेल/i, 'yt-thumbnail'],
  [/youtube\s*(channel\s*)?(banner|art)|yt\s*banner/i, 'yt-banner'],
  [/insta(gram)?\s*(post)?\s*(square|1\s*:\s*1)|\b1\s*:\s*1\b|\bsquare\b/i, 'ig-square'],
  [/insta(gram)?\s*(post|portrait)|\b4\s*:\s*5\b/i, 'ig-portrait'],
  [/\bstory\b|\breel\b|\bshorts?\b|\b9\s*:\s*16\b|स्टोरी|रील/i, 'story-reel'],
  [/\b2\s*:\s*3\b/i, 'poster-2-3'],
  [/\b16\s*:\s*9\b|\bwidescreen\b/i, 'yt-thumbnail'],
  [/facebook\s*cover|fb\s*cover/i, 'fb-cover'],
  [/facebook|fb\s*post|link\s*share/i, 'fb-post'],
  [/\b(twitter|x)\s*header/i, 'x-header'],
  [/\b(twitter|x)\s*post/i, 'x-post'],
  [/linkedin\s*(banner|cover)/i, 'linkedin-banner'],
  [/pinterest/i, 'pinterest-pin'],
  [/\bdp\b|profile\s*(pic|photo)/i, 'profile-dp'],
  [/phone\s*wallpaper|mobile\s*wallpaper|मोबाइल\s*वॉलपेपर/i, 'phone-wallpaper'],
  [/desktop\s*wallpaper|pc\s*wallpaper|laptop\s*wallpaper/i, 'desktop-wallpaper'],
  [/\ba4\b/i, 'a4-portrait'],
  [/business\s*card|visiting\s*card/i, 'business-card'],
  [/\blogo\b|लोगो/i, 'logo-square'],
];
const STYLE_WORDS = /glass|neumorph|neon|cyberpunk|synthwave|retro|minimal|brutal|cinematic|editorial|luxury|pastel|comic|pop\s*art|grunge|sticker|mesh|flat|paper\s*cut|isometric|holo|blueprint|watercolou?r|anime|doodle|riso|गहरा|सिनेमैटिक|मिनिमल/i;

export function detectLanguage(text) {
  const dev = (text.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  if (dev > lat) return 'hi';
  if (dev > 0 && lat > 0) return 'hinglish';
  const hinglishMarks = /\b(kar|karo|do|de|hai|ka|ki|ke|me|mein|se|ko|aur|banao|chahiye|dikhao|nahi)\b/i;
  return hinglishMarks.test(text) && lat > 0 ? 'hinglish' : 'en';
}

/** Parse "1200x628", "1200 × 628", "2560 by 1440" → {w,h} clamped, or null */
export function parseCustomSize(text, min = 200, max = 4096) {
  const m = /(\d{3,4})\s*(?:px\s*)?(?:x|×|by|\*|X)\s*(\d{3,4})\s*(?:px)?/i.exec(text || '');
  if (!m) return null;
  const c = (v) => Math.max(min, Math.min(max, parseInt(v, 10)));
  return { w: c(m[1]), h: c(m[2]) };
}

export function inferSizePreset(text) {
  for (const [re, id] of PLATFORM_SIZE) if (re.test(text)) return id;
  return null;
}

export function detectIntent(message, attachments = []) {
  const text = String(message || '').trim();
  const lang = detectLanguage(text);
  const hasImageUpload = attachments.some((a) => /^image\//.test(a.type || '') || a.kind === 'image');
  const reasons = [];
  if (!text) return { intent: 'none', confidence: 0, lang, reasons: ['empty'] };

  let recipe = null;
  for (const [id, re] of GEN_NOUNS) if (re.test(text)) { recipe = id; break; }
  const hasVerb = GEN_VERBS.test(text);
  const explicit = EXPLICIT_GENERATE.test(text);
  const generic = GENERIC_IMG.test(text);
  const search = SEARCH_WORDS.test(text);
  const edit = EDIT_WORDS.test(text);
  const faceSwap = FACE_SWAP_WORDS.test(text);

  if (faceSwap) {
    reasons.push('face-swap', hasImageUpload ? 'has-upload' : 'no-upload');
    return { intent: 'edit', confidence: hasImageUpload ? 0.96 : 0.85, recipe: recipe || 'portrait', lang, reasons };
  }

  // Edit: uploaded image + edit words (unless user also asked to create a full thumbnail/poster/banner from the upload)
  if (edit && (hasImageUpload || generic)) {
    const isCompositeFromRef = Boolean(recipe && ['thumbnail', 'poster', 'banner', 'flyer', 'ig-post'].includes(recipe) && !/\b(canva|editable|change\s+(the\s+)?text|edit\s+(the\s+)?text)\b/i.test(text));
    reasons.push(isCompositeFromRef ? 'generate-from-ref' : 'edit-words', hasImageUpload ? 'has-upload' : 'mentions-image');
    return { intent: isCompositeFromRef ? 'generate' : 'edit', confidence: hasImageUpload ? 0.9 : 0.65, recipe: recipe || 'generic', lang, reasons };
  }

  // Pure search ("find photos of X") is NOT studio, unless a design noun/explicit generate word is present
  if (search && !recipe && !explicit && !hasVerb) return { intent: 'search', confidence: 0.85, lang, reasons: ['search-words'] };
  if (search && generic && !recipe && !explicit) return { intent: 'search', confidence: 0.75, lang, reasons: ['search-words+image'] };

  let score = 0;
  if (recipe) { score += 0.55; reasons.push('design-noun:' + recipe); }
  if (hasVerb) { score += 0.25; reasons.push('make-verb'); }
  if (explicit) { score += 0.45; reasons.push('explicit-generate'); }
  if (generic && hasVerb) { score += 0.2; reasons.push('image-word+verb'); }
  if (hasImageUpload && (recipe || hasVerb)) { score += 0.1; reasons.push('has-upload'); }
  score = Math.min(1, score);
  if (score >= 0.6) return { intent: 'generate', confidence: Number(score.toFixed(2)), recipe: recipe || 'generic', lang, reasons };
  if (score >= 0.4) return { intent: 'maybe_generate', confidence: Number(score.toFixed(2)), recipe: recipe || 'generic', lang, reasons };
  return { intent: 'none', confidence: Number(score.toFixed(2)), lang, reasons };
}

export function analyzeRequestSignals(message) {
  const text = String(message || '');
  const custom = parseCustomSize(text);
  const preset = inferSizePreset(text);
  const quoted = /["“”'‘’「」]([^"“”'‘’]{3,120})["“”'‘’]/.exec(text);
  return { sizeKnown: !!(custom || preset), custom, preset, styleKnown: STYLE_WORDS.test(text), quotedText: quoted ? quoted[1] : null, lang: detectLanguage(text) };
}

export const POPUP_TEXT = {
  en: { title: 'Generate an image?', body: 'Do you agree to generate this image?', yes: 'Generate', no: 'Cancel' },
  hi: { title: 'इमेज बनानी है?', body: 'क्या आप इस इमेज को जनरेट करने के लिए सहमत हैं?', yes: 'जनरेट करें', no: 'रद्द करें' },
  hinglish: { title: 'Image banani hai?', body: 'Kya aap is image ko generate karne ke liye agree hain?', yes: 'Generate karo', no: 'Cancel' },
};
