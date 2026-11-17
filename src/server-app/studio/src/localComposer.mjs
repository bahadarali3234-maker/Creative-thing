import { contrastRatio, readableOn } from './color.mjs';
import { normalizePlan, fontLinkFor } from './plan.mjs';

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>\"']/g, (c) => ESC_MAP[c]);
const hasDeva = (s) => /[\u0900-\u097F]/.test(String(s || ''));

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function cleanUserTopic(raw) {
  let t = String(raw || '').trim();
  const quoted = /["“”'‘’]([^"“”'‘’]{2,140})["“”'‘’]/.exec(t);
  t = t
    .replace(/\b(make|create|design|generate|build|draw|prepare|give\s+me|please|can\s+you|i\s+want|banao|bana\s*do|bana\s*de|banado|banana|banaye|tayyar|kar\s*do)\b/gi, ' ')
    .replace(/^(an?|the|ek)\s+/i, ' ')
    .replace(/\b(youtube\s*thumb\s*nail|yt\s*thumbnail|thumbnail|poster|banner|channel\s*art|logo|wordmark|wallpaper|quote\s*card|story\s*cover|reel\s*cover|instagram\s*post|ig\s*post|social\s*media\s*post|invitation|certificate|business\s*card|visiting\s*card|flyer|pamphlet|album\s*cover|book\s*cover|infographic|profile\s*dp|menu\s*card|product\s*ad|news\s*card|image|photo|picture|graphic|design)\b/gi, ' ')
    .replace(/\b(for|of|about|on|with|ka|ki|ke|par|mein|me)\b/gi, ' ')
    .replace(/\b\d{3,4}\s*(?:x|×|by|\*)\s*\d{3,4}\b/gi, ' ')
    .replace(/बनाओ|बना\s*दो|डिज़ाइन|थंबनेल|पोस्टर|लोगो|बैनर|इमेज|फोटो/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (quoted && quoted[1]) {
    return { headline: quoted[1].trim(), topic: t || quoted[1].trim() };
  }
  return { headline: t || String(raw || '').trim(), topic: t || String(raw || '').trim() };
}

function pickBestStyle({ msg, recipe, resolved, previousPlan, library }) {
  const lower = msg.toLowerCase();
  if (resolved.style && library.idx.styles[resolved.style]) return resolved.style;

  const styleRules = [
    [/neon|cyberpunk|gaming|esports|futuristic|sci-fi|hacker|ai|robot|tech/i, 'neon-cyberpunk'],
    [/synthwave|80s|vaporwave|retrowave|outrun/i, 'synthwave-retro'],
    [/luxury|gold|royal|jewel|perfume|watch|premium|vip|elegance/i, 'dark-luxury'],
    [/minimal|swiss|clean|corporate|modern\s*simple|white/i, 'minimal-swiss'],
    [/glass|frosted|ui|saas|app/i, 'glassmorphism'],
    [/neumorph|soft\s*ui/i, 'neumorphism'],
    [/brutal|bold\s*sale|street|anti/i, 'brutalist'],
    [/cinematic|movie|film|thriller|drama|dark\s*moody/i, 'cinematic-poster'],
    [/editorial|magazine|fashion|vogue|article/i, 'magazine-editorial'],
    [/pastel|cute|soft|wedding|baby|flower|floral/i, 'pastel-soft'],
    [/comic|pop\s*art|cartoon|funny|wow/i, 'pop-art-comic'],
    [/grunge|rock|hip\s*hop|rap|metal|urban/i, 'grunge-street'],
    [/sticker|bubbly|playful/i, 'sticker-pop'],
    [/mesh|gradient|startup|trendy/i, 'gradient-mesh-modern'],
    [/flat|vector|explainer|illustration|diagram/i, 'flat-vector'],
    [/paper\s*cut|diwali|holi|eid|festival|navratri|craft/i, 'paper-cut-layers'],
    [/isometric|3d\s*card/i, 'isometric-3d-css'],
    [/holo|iridescent|chrome|y2k/i, 'holographic'],
    [/blueprint|engineering|architect|diagram/i, 'blueprint-tech'],
    [/watercolor|paint|wellness|yoga|calm|poem/i, 'watercolor-wash'],
    [/anime|manga|chibi|otaku/i, 'anime-glow'],
    [/doodle|sketch|hand\s*drawn|kids|school/i, 'doodle-hand-drawn'],
    [/riso|vintage\s*print|indie/i, 'riso-retro-print'],
  ];
  for (const [re, id] of styleRules) {
    if (re.test(lower) && library.idx.styles[id]) return id;
  }
  if (previousPlan?.style && !/change\s*style|different\s*style|make\s*it\s*(dark|light)/i.test(lower)) {
    return previousPlan.style;
  }
  return recipe.stylePrefs[0] || 'gradient-mesh-modern';
}

function pickBestPalette({ msg, styleObj, previousPlan, library }) {
  const lower = msg.toLowerCase();
  const candIds = styleObj.palettes || [];
  const wantsDark = /\b(dark|black|night|midnight|moody|neon)\b/i.test(lower);
  const wantsLight = /\b(light|white|cream|pastel|bright|clean|daylight)\b/i.test(lower);

  const palRules = [
    [/diwali|lamp|diya|festive|gold\s*orange/i, 'diwali-glow'],
    [/india|tiranga|saffron|republic|independence/i, 'saffron-india'],
    [/finance|money|crypto|wealth|invest|emerald|luxury/i, 'midnight-emerald'],
    [/gold|royal|wedding|luxury|award/i, 'ink-gold'],
    [/nature|forest|eco|mountain|jungle|tea|matcha/i, 'forest-calm'],
    [/ocean|sea|water|blue|trust|tech/i, 'ocean-deep'],
    [/sunset|warm|summer|beach|mango/i, 'sunset-pop'],
    [/red|urgent|breaking|alert|fire|sale/i, 'money-red'],
    [/sakura|cherry|pink|floral|anime/i, 'sakura'],
    [/candy|pop|sweet|ice\s*cream/i, 'candy'],
    [/synth|80s|retro/i, 'retro-wave'],
    [/horror|blood|thriller|halloween/i, 'blood-moon'],
    [/mint|fresh|health|salad|fitness/i, 'fresh-mint'],
    [/cyber|lime|gaming/i, 'cyber-lime'],
    [/ice|snow|winter|minimal|clean/i, 'ice-white'],
  ];
  for (const [re, id] of palRules) {
    if (re.test(lower) && library.idx.palettes[id]) return id;
  }

  if (wantsDark) {
    const darkMatch = candIds.find((id) => {
      const p = library.idx.palettes[id];
      return p && isDarkHex(p.colors[0]);
    });
    if (darkMatch) return darkMatch;
    return 'neon-night';
  }
  if (wantsLight) {
    const lightMatch = candIds.find((id) => {
      const p = library.idx.palettes[id];
      return p && !isDarkHex(p.colors[0]);
    });
    if (lightMatch) return lightMatch;
    return 'mono-clean';
  }
  if (previousPlan?.palette && library.idx.palettes[previousPlan.palette]) {
    return previousPlan.palette;
  }
  return candIds[0] || 'neon-night';
}

function pickBestLayout({ recipe, size, hasPhoto, isFullBleedPhoto, library }) {
  const ratio = size.w / Math.max(1, size.h);
  const aspect = ratio >= 2.2 ? 'wide' : ratio >= 1.2 ? 'landscape' : ratio <= 0.65 ? 'tall' : ratio < 0.9 ? 'portrait' : 'square';

  if (recipe.id === 'thumbnail') {
    if (/vs\b|versus/i.test(recipe.hint || '')) return 'versus-split';
    return hasPhoto ? 'text-left-subject-right' : 'split-diagonal';
  }
  if (recipe.id === 'quote-card') return 'quote-center';
  if (recipe.id === 'certificate' || recipe.id === 'invitation' || recipe.id === 'menu') return 'frame-border';
  if (recipe.id === 'product-ad') return 'product-spotlight';
  if (recipe.id === 'logo' || recipe.id === 'profile-dp' || recipe.id === 'album-cover') {
    return hasPhoto && !isFullBleedPhoto && ratio >= 1.15 ? 'text-left-subject-right' : 'centered-hero';
  }
  if (recipe.id === 'banner') return ratio >= 2.1 ? 'banner-safe-wide' : 'text-left-subject-right';
  if (recipe.id === 'story-reel' || recipe.id === 'wallpaper') {
    return aspect === 'tall' || aspect === 'portrait' ? 'story-vertical' : 'centered-hero';
  }
  if (recipe.id === 'infographic') return 'poster-stack';
  if (recipe.id === 'poster' || recipe.id === 'flyer' || recipe.id === 'book-cover') {
    if (hasPhoto && isFullBleedPhoto && aspect !== 'wide') return 'photo-bottom-plate';
    return aspect === 'landscape' || aspect === 'wide' ? 'text-left-subject-right' : 'poster-stack';
  }

  for (const lId of recipe.layoutPrefs || []) {
    const l = library.idx.layouts[lId];
    if (l && (l.aspects.includes('any') || l.aspects.includes(aspect))) return lId;
  }
  return recipe.layoutPrefs?.[0] || 'centered-hero';
}

function isDarkHex(hex) {
  const h = String(hex || '#000').replace('#', '');
  if (h.length !== 6 && h.length !== 3) return true;
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.48;
}

function buildCopyForPlan({ message, headline, topic, recipe, resolved, previousPlan }) {
  if (previousPlan?.text && /bigger|larger|dark|light|color|style|font/i.test(message) && !resolved.text) {
    return { ...previousPlan.text };
  }

  const cleanTitle = (headline || topic || 'Creative Studio')
    .replace(/\s+/g, ' ')
    .trim();

  if (recipe.id === 'wallpaper' || recipe.id === 'profile-dp') {
    const t = resolved.text ? resolved.text.trim() : '';
    return { title: t, subtitle: '', badge: '', cta: '', extra: [] };
  }

  if (recipe.id === 'quote-card') {
    const dashMatch = /^(.+?)\s*(?:—|–|-|\bby\b)\s*([A-Z][\w\s.]{1,40})$/i.exec(cleanTitle);
    if (dashMatch) {
      return {
        title: dashMatch[1].trim().replace(/^["']|["']$/g, ''),
        subtitle: dashMatch[2].trim(),
        badge: '',
        cta: '',
        extra: [],
      };
    }
    return {
      title: cleanTitle.slice(0, 120),
      subtitle: '',
      badge: 'DAILY THOUGHT',
      cta: '',
      extra: [],
    };
  }

  if (recipe.id === 'logo') {
    const words = cleanTitle.split(/\s+/).filter(Boolean);
    const brandName = words.slice(0, 3).join(' ') || 'Studio';
    const tag = words.length > 3 ? words.slice(3, 7).join(' ') : '';
    return { title: brandName, subtitle: tag, badge: '', cta: '', extra: [] };
  }

  const words = cleanTitle.split(/\s+/).filter(Boolean);
  let titleWords = words;
  let subtitle = '';
  let badge = '';
  let cta = '';

  if (recipe.id === 'thumbnail') {
    titleWords = words.slice(0, 5);
    subtitle = words.length > 5 ? words.slice(5, 11).join(' ') : '';
    badge = /\bvs\b|new|top|2025|2026|live|pro|secret|guide|tutorial/i.test(message)
      ? (/\b2026\b/.test(message) ? '2026 EDITION' : /\b2025\b/.test(message) ? '2025 EDITION' : 'FEATURED')
      : '';
  } else if (recipe.id === 'product-ad') {
    titleWords = words.slice(0, 4);
    subtitle = words.length > 4 ? words.slice(4, 12).join(' ') : '';
    badge = /\bnew\b/i.test(message) ? 'NEW ARRIVAL' : 'LIMITED EDITION';
    cta = 'EXPLORE NOW';
  } else if (recipe.id === 'poster' || recipe.id === 'flyer') {
    titleWords = words.slice(0, 6);
    subtitle = words.length > 6 ? words.slice(6, 15).join(' ') : '';
    badge = recipe.id === 'flyer' ? 'SPECIAL FEATURE' : 'OFFICIAL SHOWCASE';
  } else {
    titleWords = words.slice(0, 7);
    subtitle = words.length > 7 ? words.slice(7, 16).join(' ') : '';
  }

  return {
    title: (resolved.text || titleWords.join(' ') || 'Creative Design').trim(),
    subtitle: subtitle.trim(),
    badge,
    cta,
    extra: [],
  };
}

function shouldSearchWebPhoto({ recipe, resolved, topic, hasUpload }) {
  if (hasUpload && resolved.photo !== 'no') return false;
  if (resolved.web === 'no') return false;
  if (!recipe.usesPhotos) return false;
  const abstractWords = /\b(abstract|geometric|gradient|minimal\s*type|typographic|pattern|wireframe)\b/i;
  if (abstractWords.test(topic)) return false;
  return topic.trim().length >= 2;
}

function buildSearchQuery(topic, recipe) {
  let q = String(topic || '')
    .replace(/["“”'‘’]/g, ' ')
    .replace(/\b(thumbnail|poster|banner|cover|post|wallpaper|design|card|flyer|ad|dp|face\s*swap|swap\s*face|replace\s*character|with\s*my\s*face|my\s*face|write\s*text|add\s*text)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = q.split(' ').filter((w) => w.length > 1).slice(0, 6);
  if (!words.length) return '';
  q = words.join(' ');
  if (recipe.id === 'product-ad' && !/studio|photo|product/i.test(q)) {
    q = `${q} studio photography`;
  }
  return q.slice(0, 75);
}

/**
 * Splits prompts like "Cristiano Ronaldo in a neon cyberpunk stadium" or
 * "BMW M4 on rainy Tokyo street" into separate subject query + background scene query.
 */
function splitSubjectAndBackground(topic, msg) {
  const clean = String(topic || '')
    .replace(/["“”'‘’][^"“”'‘’]{2,120}["“”'‘’]/g, ' ')
    .replace(/\b(write|text|saying|titled)\s+[^,.;]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const splitRe = /^(.{2,55}?)\s+(?:standing\s+in|standing\s+on|walking\s+in|sitting\s+in|in\s+front\s+of|against\s+a|against|inside|outside|in\s+a|in\s+an|in\s+the|on\s+a|on\s+the|at\s+a|at\s+the|\bin\b|\bon\b|\bat\b)\s+(.{3,65})$/i;
  const m = splitRe.exec(clean);
  if (m) {
    const subj = m[1].trim();
    const bg = m[2].trim();
    if (subj.split(/\s+/).length <= 6 && bg.split(/\s+/).length >= 1) {
      return {
        subjectQuery: subj.slice(0, 65),
        bgQuery: bg.slice(0, 65),
      };
    }
  }

  // Check if msg mentions an explicit background phrase like "background of X" or "with X background"
  const bgPhrase = /(?:background\s*(?:of|is|:)?|bg\s*(?:of|:)?)\s+([a-zA-Z0-9\s-]{3,55})/i.exec(msg || '');
  if (bgPhrase && bgPhrase[1]) {
    const bg = bgPhrase[1].trim();
    const subj = clean.replace(bgPhrase[0], '').trim();
    if (subj.length >= 2 && bg.length >= 3) {
      return { subjectQuery: subj.slice(0, 65), bgQuery: bg.slice(0, 65) };
    }
  }
  return null;
}

/**
 * Zero-API-key Creative Director plan generator following planner.md + library catalog strictly.
 */
export function createLocalPlan({ message, resolved, intent, uploads = [], library, previousPlan = null }) {
  const msg = String(message || '').trim();
  const bad = new RegExp(
    '\\b(' +
      library.raw.safety.blockedQueryTerms
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|') +
      ')\\b',
    'i'
  );
  if (bad.test(msg)) {
    return {
      plan: { refuse: { reason: 'Safety rules do not allow generating explicit or harmful depictions.' } },
      warnings: [],
      refused: true,
    };
  }

  const recipeId = library.idx.recipes[intent?.recipe] ? intent.recipe : 'generic';
  const recipe = library.recipe(recipeId);
  const { headline, topic } = cleanUserTopic(msg);
  const hasUpload = Array.isArray(uploads) && uploads.length > 0 && resolved.photo !== 'no';

  const styleId = pickBestStyle({ msg, recipe, resolved, previousPlan, library });
  const styleObj = library.idx.styles[styleId] || library.idx.styles[recipe.stylePrefs[0]];
  const paletteId = pickBestPalette({ msg, styleObj, previousPlan, library });

  const size = resolved.size || (() => {
    const s = library.size(recipe.defaultSize);
    return { w: s.w, h: s.h, preset: s.id };
  })();

  const lang = hasDeva(msg) || hasDeva(resolved.text) ? 'hi' : (resolved.language || 'en');
  let fontsId = (styleObj.fonts && styleObj.fonts[0]) || 'modern-grotesk';
  if (lang === 'hi' || lang === 'hinglish') {
    fontsId =
      (styleObj.fonts || []).find((f) => library.idx.fonts[f]?.scripts?.includes('devanagari')) ||
      'hi-bold-poppins';
  }

  const faceSwapIntent = /\b(face\s*swap|swap\s*(the\s*)?face|replace\s*(the\s*)?(character|face|person|him|her|subject)|put\s+my\s+face|my\s+face\s+(in|on|onto|into)|chehra\s*(badlo|lagao)|mera\s*chehra|mera\s*face)\b|चेहरा\s*(बदलो|लगाओ)/i.test(msg);

  const wantsSearch = shouldSearchWebPhoto({ recipe, resolved, topic, hasUpload });
  const splitPair = resolved.web !== 'no' ? splitSubjectAndBackground(topic, msg) : null;
  const willHavePhoto = hasUpload || wantsSearch || (faceSwapIntent && resolved.web !== 'no');
  const isCutoutRecipe = recipe.id === 'thumbnail' || recipe.id === 'product-ad';
  const layoutId = faceSwapIntent
    ? (resolved.text ? 'photo-bottom-plate' : 'centered-hero')
    : pickBestLayout({
        recipe,
        size,
        hasPhoto: willHavePhoto,
        isFullBleedPhoto: !isCutoutRecipe && !hasUpload && !splitPair,
        library,
      });

  // Extract explicit "write text ..." instruction when user did not quote
  let explicitTextWrite = resolved.text;
  if (!explicitTextWrite) {
    const writeMatch = /(?:write\s+text|add\s+text|text\s*:|likho)\s+([^,.\n]{2,90})/i.exec(msg);
    if (writeMatch && writeMatch[1]) {
      explicitTextWrite = writeMatch[1].trim();
    }
  }
  const text = buildCopyForPlan({
    message: msg,
    headline,
    topic,
    recipe,
    resolved: { ...resolved, text: explicitTextWrite || resolved.text },
    previousPlan,
  });
  if (faceSwapIntent && !explicitTextWrite) {
    text.title = '';
    text.subtitle = '';
    text.badge = '';
    text.cta = '';
  }

  const assets = [];
  if (faceSwapIntent && hasUpload) {
    if (uploads.length >= 2) {
      // Two images uploaded: 1st = target character/scene, 2nd = user face
      assets.push({
        id: 'a1',
        source: 'upload',
        uploadId: uploads[0].id,
        faceUploadId: uploads[1].id,
        role: 'face_swap_target',
        removeBackground: false,
        adjust: { contrast: 1.04, saturate: 1.05 },
        why: 'WebGPU policy-safe face swap placing second face image onto first scene.',
      });
    } else {
      // Single uploaded user face + prompt -> search web for matching target image, then swap
      const targetQ = buildSearchQuery(topic, recipe) || 'cinematic portrait hero scene';
      assets.push({
        id: 'a1',
        source: 'search',
        query: targetQ,
        faceUploadId: uploads[0].id,
        role: 'face_swap_target',
        removeBackground: false,
        adjust: { contrast: 1.04, saturate: 1.05 },
        why: `Web search target "${targetQ}" with WebGPU face swap using uploaded face.`,
      });
    }
  } else if (hasUpload) {
    uploads.slice(0, 2).forEach((u, idx) => {
      assets.push({
        id: `a${idx + 1}`,
        source: 'upload',
        uploadId: u.id,
        role: 'subject',
        removeBackground:
          resolved.photo === 'yes-cutout'
            ? true
            : resolved.photo === 'yes-asis'
            ? false
            : isCutoutRecipe || Boolean(splitPair?.bgQuery),
        adjust: { contrast: 1.06, saturate: 1.08 },
        why: 'User-provided subject photo integrated cleanly into composition.',
      });
    });
    if (splitPair?.bgQuery && resolved.web !== 'no') {
      assets.push({
        id: `a${assets.length + 1}`,
        source: 'search',
        query: splitPair.bgQuery,
        role: 'background',
        removeBackground: false,
        adjust: { contrast: 1.05, saturate: 1.12 },
        why: `Web-searched background scene for "${splitPair.bgQuery}".`,
      });
    }
  } else if (wantsSearch) {
    if (splitPair) {
      assets.push({
        id: 'a1',
        source: 'search',
        query: splitPair.subjectQuery,
        role: 'subject',
        removeBackground: true,
        adjust: { contrast: 1.08, saturate: 1.1 },
        why: `Web-searched character/subject photo with contour cutout for "${splitPair.subjectQuery}".`,
      });
      assets.push({
        id: 'a2',
        source: 'search',
        query: splitPair.bgQuery,
        role: 'background',
        removeBackground: false,
        adjust: { contrast: 1.05, saturate: 1.12 },
        why: `Web-searched matching background scene for "${splitPair.bgQuery}".`,
      });
    } else {
      const q = buildSearchQuery(topic, recipe);
      if (q) {
        assets.push({
          id: 'a1',
          source: 'search',
          query: q,
          role: isCutoutRecipe ? 'subject' : 'background',
          removeBackground: isCutoutRecipe && /\b(person|car|phone|shoes|watch|bottle|laptop|product|player|cat|dog|ronaldo|messi|kohli|hero|singer|actor|star|man|woman)\b/i.test(q),
          adjust: { contrast: 1.08, saturate: 1.1 },
          why: `Real photographic visual reference for "${q}".`,
        });
      }
    }
  }

  const effects = [...(styleObj.effects || ['vignette', 'grain'])];
  const motifs = [];
  if (styleId === 'quote-card' || recipe.id === 'quote-card') motifs.push('quote-mark');
  if (styleId === 'pop-art-comic' || styleId === 'sticker-pop') motifs.push('starburst', 'sparkle');
  if (styleId === 'bold-yt-thumbnail') motifs.push('arrow-curved', 'lightning');
  if (styleId === 'paper-cut-layers' && /diwali|lamp|diya|festive/i.test(msg)) motifs.push('lantern', 'sparkle');
  if (!motifs.length && (styleObj.effects || []).includes('sparkles')) motifs.push('sparkle');

  const rawPlan = {
    refuse: null,
    brief: {
      goal: `${recipe.name} tailored for ${size.preset || `${size.w}x${size.h}`}`,
      audience: 'Social & visual viewers',
      message: text.title || topic,
      mood: styleObj.mood || 'High-impact studio composition',
    },
    rationale: `Selected ${styleObj.name} with ${library.idx.palettes[paletteId]?.name || paletteId} palette and ${library.idx.layouts[layoutId]?.name || layoutId} layout to maximize hierarchy and visual punch at ${size.w}×${size.h}.`,
    recipe: recipe.id,
    style: styleId,
    palette: paletteId,
    fonts: fontsId,
    layout: layoutId,
    effects,
    motifs,
    size,
    language: lang,
    text,
    assets,
    textScale: /bigger|larger|huge/i.test(msg) ? 1.2 : /smaller|compact/i.test(msg) ? 0.85 : 1,
  };

  return normalizePlan(rawPlan, { library, resolved, intent, uploads });
}

function splitHighlightWord(title) {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { before: '', accent: words[0] || '', after: '' };
  if (words.length === 2) return { before: words[0], accent: words[1], after: '' };
  let pickIdx = words.length - 1;
  let longestLen = 0;
  words.forEach((w, i) => {
    const cleanLen = w.replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '').length;
    if (cleanLen >= longestLen && i > 0) {
      longestLen = cleanLen;
      pickIdx = i;
    }
  });
  return {
    before: words.slice(0, pickIdx).join(' '),
    accent: words[pickIdx],
    after: words.slice(pickIdx + 1).join(' '),
  };
}

function buildBespokeVectorScene({ styleId, recipeId, title, primary, accent, text }) {
  const initials = (String(title || 'CS')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'CS').slice(0, 2);

  if (recipeId === 'logo') {
    return `
      <svg viewBox="0 0 240 240" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
        <defs>
          <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="var(--primary)"/>
            <stop offset="100%" stop-color="var(--accent)"/>
          </linearGradient>
        </defs>
        <circle cx="120" cy="120" r="96" fill="none" stroke="url(#lg1)" stroke-width="5" opacity="0.35"/>
        <polygon points="120,24 204,72 204,168 120,216 36,168 36,72" fill="var(--surface)" stroke="url(#lg1)" stroke-width="7" stroke-linejoin="round"/>
        <polygon points="120,48 182,84 182,156 120,192 58,156 58,84" fill="url(#lg1)" opacity="0.18"/>
        <text x="120" y="136" text-anchor="middle" fill="var(--text)" font-size="64" font-weight="900" letter-spacing="2" font-family="sans-serif">${esc(initials)}</text>
      </svg>
    `;
  }

  if (styleId === 'paper-cut-layers') {
    return `
      <svg viewBox="0 0 1000 500" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="760" cy="145" r="78" fill="var(--accent)" opacity="0.9"/>
        <path d="M0,340 Q240,250 490,320 T1000,295 L1000,500 L0,500 Z" fill="var(--surface)" opacity="0.88"/>
        <path d="M0,395 Q310,330 620,400 T1000,370 L1000,500 L0,500 Z" fill="var(--primary)" opacity="0.45"/>
        <path d="M0,445 Q420,405 760,452 T1000,432 L1000,500 L0,500 Z" fill="var(--bg)" opacity="0.92"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 600 600" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;opacity:.92">
      <defs>
        <radialGradient id="sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.42"/>
          <stop offset="65%" stop-color="var(--primary)" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="300" cy="300" r="260" fill="url(#sg1)"/>
      <circle cx="300" cy="300" r="196" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="10 12" opacity="0.48"/>
      <circle cx="300" cy="300" r="142" fill="none" stroke="var(--primary)" stroke-width="4" opacity="0.65"/>
      <polygon points="300,115 445,200 445,400 300,485 155,400 155,200" fill="var(--surface)" fill-opacity="0.55" stroke="var(--accent)" stroke-width="3"/>
      <circle cx="300" cy="300" r="68" fill="var(--primary)" fill-opacity="0.32" stroke="var(--text)" stroke-opacity="0.35" stroke-width="2"/>
    </svg>
  `;
}

/**
 * High-craft deterministic HTML/CSS/SVG Composer producing export-safe studio compositions
 * matching all 16 rules in validate.mjs and instructions/composer.md — zero API key needed.
 */
export function composeLocalHtml({ plan, library, assetManifest = [] }) {
  const W = plan.size.w;
  const H = plan.size.h;
  const U = +(W / 100).toFixed(3);
  const slices = library.slices(plan);
  const basePalette = slices.palette || library.idx.palettes['neon-night'];
  const ep = plan.extractedPalette;
  const bgColor = ep?.bgHex || basePalette.colors[0];
  const surfaceColor = ep?.surfaceHex || basePalette.colors[1];
  const primaryColor = ep?.primaryHex || basePalette.colors[2];
  const accentColor = ep?.accentHex || basePalette.colors[3];
  const paletteText = ep?.textHex || basePalette.colors[4];
  const textColor = plan.paletteOverride?.text || readableOn(bgColor) || paletteText;
  const fonts = slices.fonts || library.idx.fonts['modern-grotesk'];
  const fontLink = fontLinkFor(library, plan);
  const layout = slices.layout || library.idx.layouts['centered-hero'];
  const styleId = plan.style || 'gradient-mesh-modern';
  const isHindi = plan.language === 'hi' || plan.language === 'hinglish' || hasDeva(JSON.stringify(plan.text || {}));
  const darkBg = isDarkHex(bgColor);

  const effectCss = (slices.effects || [])
    .filter((e) => e.type === 'css' && e.code)
    .map((e) => e.code)
    .join('\n');

  const resolveSvgVars = (svgStr) =>
    String(svgStr || '')
      .replace(/var\(--bg\)/g, bgColor)
      .replace(/var\(--surface\)/g, surfaceColor)
      .replace(/var\(--primary\)/g, primaryColor)
      .replace(/var\(--accent\)/g, accentColor)
      .replace(/var\(--text\)/g, textColor);

  const motifMap = Object.fromEntries(
    (slices.motifs || []).map((m) => [m.id, resolveSvgVars(m.svg)])
  );
  const bgAsset = assetManifest.find((m) => m.role === 'background') || null;
  const subjAsset = assetManifest.find((m) => m.role === 'subject' || m.role === 'face_swap_target') || null;
  const primaryAsset = subjAsset || bgAsset || assetManifest[0] || null;
  const hasPhoto = Boolean(primaryAsset);
  const hasDualLayers = Boolean(bgAsset && subjAsset && bgAsset.id !== subjAsset.id);
  const isCutout = Boolean(primaryAsset?.hasAlpha);
  const isFaceSwap = primaryAsset?.role === 'face_swap_target';
  const isFullPhotoLayout =
    hasDualLayers ||
    isFaceSwap ||
    layout.id === 'photo-bottom-plate' ||
    (hasPhoto && !isCutout && (plan.recipe === 'wallpaper' || plan.recipe === 'poster' || plan.recipe === 'news-card' || plan.recipe === 'generic'));

  const titleStr = String(plan.text?.title || '').trim();
  const subStr = String(plan.text?.subtitle || '').trim();
  const badgeStr = String(plan.text?.badge || '').trim();
  const ctaStr = String(plan.text?.cta || '').trim();
  const rf = plan.repairFlags || {};
  const wordsCount = Math.max(1, titleStr.split(/\s+/).filter(Boolean).length);

  // Compute proportional responsive typography based on canvas height/width & word count
  const baseScale = W >= H ? Math.min(W * 0.068, H * 0.145) : Math.min(W * 0.105, H * 0.072);
  const wordFactor = wordsCount <= 2 ? 1.18 : wordsCount <= 4 ? 1.0 : wordsCount <= 7 ? 0.82 : 0.68;
  const userTextScale = (Number(plan.textScale) || 1) * (rf.preventTextClip ? 0.88 : 1);
  const titlePx = Math.round(clamp(baseScale * wordFactor * userTextScale, H * 0.042, H * 0.22));
  const subPx = Math.round(clamp(titlePx * 0.36, H * 0.025, H * 0.056));
  const badgePx = Math.round(clamp(H * 0.024, 14, 34));

  const titleFont = `'${fonts.display}', ${isHindi ? "'Noto Sans Devanagari', " : ''}sans-serif`;
  const bodyFont = `'${fonts.body}', ${isHindi ? "'Noto Sans Devanagari', " : ''}sans-serif`;
  const headlineParts = splitHighlightWord(titleStr);

  // Choose background treatment matching chosen style
  let backgroundLayers = '';
  if (styleId === 'bold-yt-thumbnail') {
    backgroundLayers = `
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 72% 48%, ${primaryColor} 0%, ${bgColor} 78%);"></div>
      <div class="fx-sun" style="opacity:.22"></div>
    `;
  } else if (styleId === 'synthwave-retro') {
    backgroundLayers = `
      <div style="position:absolute;inset:0;background:linear-gradient(180deg, ${bgColor} 0%, ${surfaceColor} 58%, ${bgColor} 100%);"></div>
      <div class="fx-stars" style="opacity:.75"></div>
      <div class="fx-retrosun" style="top:18%;opacity:.85"></div>
      <div class="fx-floor" style="opacity:.6"></div>
    `;
  } else if (styleId === 'neon-cyberpunk') {
    backgroundLayers = `
      <div class="fx-mesh" style="position:absolute;inset:0;opacity:.7"></div>
      <div class="fx-grid" style="opacity:.22"></div>
      <div class="fx-scan" style="opacity:.18"></div>
    `;
  } else if (styleId === 'blueprint-tech') {
    backgroundLayers = `
      <div style="position:absolute;inset:0;background:linear-gradient(135deg, ${bgColor} 0%, ${surfaceColor} 100%);"></div>
      <div class="fx-grid" style="opacity:.28"></div>
      <div class="fx-corners"></div>
    `;
  } else if (styleId === 'pop-art-comic') {
    backgroundLayers = `
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 65% 40%, ${accentColor} 0%, ${primaryColor} 55%, ${bgColor} 100%);"></div>
      <div class="fx-halftone" style="opacity:.22"></div>
    `;
  } else if (styleId === 'dark-luxury') {
    backgroundLayers = `
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 38%, ${surfaceColor} 0%, ${bgColor} 76%);"></div>
      <div class="fx-spot"></div>
      <div class="fx-corners" style="opacity:.65"></div>
    `;
  } else if (styleId === 'holographic') {
    backgroundLayers = `
      <div class="fx-holo" style="position:absolute;inset:0;opacity:.38"></div>
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 25% 25%, rgba(255,255,255,.16), transparent 55%), radial-gradient(circle at 80% 75%, ${primaryColor}55, transparent 60%);"></div>
    `;
  } else {
    backgroundLayers = `
      <div class="fx-mesh" style="position:absolute;inset:0;opacity:.88"></div>
      <div style="position:absolute;width:calc(var(--u)*52);height:calc(var(--u)*52);right:-10%;top:-12%;border-radius:50%;background:radial-gradient(circle, ${accentColor}44, transparent 70%);"></div>
      <div style="position:absolute;width:calc(var(--u)*48);height:calc(var(--u)*48);left:-10%;bottom:-14%;border-radius:50%;background:radial-gradient(circle, ${primaryColor}48, transparent 70%);"></div>
    `;
  }

  // Zones conversion helper
  const zStyle = (z, extra = '') =>
    z
      ? `position:absolute;left:${(z.x * 100).toFixed(1)}%;top:${(z.y * 100).toFixed(1)}%;width:${(z.w * 100).toFixed(1)}%;height:${(z.h * 100).toFixed(1)}%;${extra}`
      : '';

  const zones = layout.zones || {};
  const subjZone = zones.subject || zones.photo || { x: 0.56, y: 0.08, w: 0.4, h: 0.88, anchor: 'bottom' };
  const titleZone = zones.title || zones.quote || zones.heading || zones.name || { x: 0.06, y: 0.24, w: 0.52, h: 0.46, align: 'left' };
  const subZone = zones.subtitle || zones.author || zones.caption || zones.body || { x: titleZone.x, y: Math.min(0.82, titleZone.y + titleZone.h + 0.03), w: titleZone.w, h: 0.12, align: titleZone.align || 'left' };

  // Asset / Subject layer (supports Dual Background + Cutout Subject + Face Swap scenes)
  const objPos = rf.faceTopAnchor ? 'object-position:center 18%;' : '';
  const bgScrimAlpha = rf.scrimBoost ? '0.88' : '0.82';
  let subjectHtml = '';
  if (hasDualLayers && bgAsset && subjAsset) {
    const rimFx = rf.cutoutPolish
      ? `filter:drop-shadow(0 0 calc(var(--u)*1.2) rgba(255,255,255,0.28)) drop-shadow(0 18px 34px rgba(0,0,0,.78));`
      : `filter:drop-shadow(0 0 calc(var(--u)*1.8) ${accentColor}) drop-shadow(0 20px 34px rgba(0,0,0,.68));`;
    subjectHtml = `
      <div style="position:absolute;inset:0;overflow:hidden;">
        <img src="{{asset:${bgAsset.id}}}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 68% 45%, transparent 18%, rgba(4,8,18,0.68) 85%), linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,${bgScrimAlpha}) 100%);"></div>
      </div>
      <div style="${zStyle(subjZone, 'display:flex;align-items:' + (subjZone.anchor === 'bottom' ? 'flex-end' : 'center') + ';justify-content:center;pointer-events:none;z-index:8;')}">
        <div style="position:relative;width:100%;height:100%;display:flex;align-items:${subjZone.anchor === 'bottom' ? 'flex-end' : 'center'};justify-content:center;">
          <div style="position:absolute;width:82%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle, ${accentColor} 0%, transparent 68%);opacity:0.42;top:14%;filter:blur(8px);"></div>
          <img src="{{asset:${subjAsset.id}}}" alt="" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;${objPos}position:relative;z-index:2;${rimFx}" />
          <div style="position:absolute;bottom:2%;width:66%;height:6%;border-radius:50%;background:radial-gradient(ellipse at center, rgba(0,0,0,0.62) 0%, transparent 72%);z-index:1;"></div>
        </div>
      </div>
    `;
  } else if (hasPhoto && isFullPhotoLayout) {
    subjectHtml = `
      <div style="position:absolute;inset:0;overflow:hidden;">
        <img src="{{asset:${primaryAsset.id}}}" alt="" style="width:100%;height:100%;object-fit:cover;${objPos}display:block;" />
      </div>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,${rf.scrimBoost ? '0.28' : '0.12'}) 0%, rgba(0,0,0,${rf.scrimBoost ? '0.32' : '0.14'}) 52%, rgba(0,0,0,${titleStr ? (rf.scrimBoost ? '0.90' : '0.84') : '0.28'}) 100%);"></div>
    `;
  } else if (hasPhoto && isCutout) {
    const stickerFx = rf.cutoutPolish
      ? `filter:drop-shadow(0 2px 10px rgba(0,0,0,0.42)) drop-shadow(0 18px 28px rgba(0,0,0,.58));`
      : styleId === 'bold-yt-thumbnail' || styleId === 'sticker-pop' || styleId === 'pop-art-comic'
        ? `filter:drop-shadow(4px 0 0 #fff) drop-shadow(-4px 0 0 #fff) drop-shadow(0 4px 0 #fff) drop-shadow(0 -4px 0 #fff) drop-shadow(0 16px 24px rgba(0,0,0,.55));`
        : `filter:drop-shadow(0 0 calc(var(--u)*1.4) var(--accent)) drop-shadow(0 18px 26px rgba(0,0,0,.52));`;
    subjectHtml = `
      <div style="${zStyle(subjZone, 'display:flex;align-items:' + (subjZone.anchor === 'bottom' ? 'flex-end' : 'center') + ';justify-content:center;pointer-events:none;')}">
        <div style="position:relative;width:100%;height:100%;display:flex;align-items:${subjZone.anchor === 'bottom' ? 'flex-end' : 'center'};justify-content:center;">
          <div style="position:absolute;width:85%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle, var(--accent) 0%, transparent 70%);opacity:0.35;top:15%;"></div>
          <img src="{{asset:${primaryAsset.id}}}" alt="" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;${objPos}position:relative;z-index:2;${stickerFx}" />
          <div style="position:absolute;bottom:2%;width:68%;height:6%;border-radius:50%;background:radial-gradient(ellipse at center, rgba(0,0,0,0.58) 0%, transparent 72%);z-index:1;"></div>
        </div>
      </div>
    `;
  } else if (hasPhoto) {
    const borderCol = darkBg ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.14)';
    subjectHtml = `
      <div style="${zStyle(subjZone, 'padding:calc(var(--u)*1.4);box-sizing:border-box;display:flex;align-items:center;justify-content:center;')}">
        <div style="position:relative;width:100%;height:100%;border-radius:calc(var(--u)*2.4);overflow:hidden;border:2px solid ${borderCol};box-shadow:0 calc(var(--u)*2) calc(var(--u)*4.8) rgba(0,0,0,0.38);">
          <img src="{{asset:${primaryAsset.id}}}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
          <div style="position:absolute;inset:0;background:linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.35) 100%);pointer-events:none;"></div>
        </div>
      </div>
    `;
  } else if (plan.recipe === 'logo' || (!hasPhoto && layout.id === 'text-left-subject-right') || (!hasPhoto && layout.id === 'subject-left-text-right') || (!hasPhoto && layout.id === 'poster-stack')) {
    const svgArt = resolveSvgVars(
      buildBespokeVectorScene({
        styleId,
        recipeId: plan.recipe,
        title: titleStr,
        primary: primaryColor,
        accent: accentColor,
        text: textColor,
      })
    );
    if (plan.recipe === 'logo') {
      subjectHtml = `
        <div style="position:absolute;left:50%;top:12%;transform:translateX(-50%);width:calc(var(--u)*34);height:calc(var(--u)*34);display:flex;align-items:center;justify-content:center;">
          ${svgArt}
        </div>
      `;
    } else {
      subjectHtml = `
        <div style="${zStyle(subjZone, 'display:flex;align-items:center;justify-content:center;pointer-events:none;')}">
          <div style="width:86%;height:86%;display:flex;align-items:center;justify-content:center;">
            ${svgArt}
          </div>
        </div>
      `;
    }
  }

  // Motif accents
  let motifsHtml = '';
  if (motifMap['quote-mark']) {
    motifsHtml += `<div style="position:absolute;left:7%;top:8%;width:calc(var(--u)*11);opacity:.28;pointer-events:none">${motifMap['quote-mark']}</div>`;
  }
  if (motifMap.sparkle) {
    motifsHtml += `
      <div style="position:absolute;right:7%;top:9%;width:calc(var(--u)*4.2);opacity:.78;pointer-events:none">${motifMap.sparkle}</div>
      <div style="position:absolute;left:6%;bottom:9%;width:calc(var(--u)*3.1);opacity:.55;pointer-events:none">${motifMap.sparkle}</div>
    `;
  }
  if (motifMap.lantern) {
    motifsHtml += `<div style="position:absolute;right:8%;bottom:8%;width:calc(var(--u)*12);opacity:.85;pointer-events:none">${motifMap.lantern}</div>`;
  }

  // Diagonal split panel when using split-diagonal
  const splitPanel =
    layout.id === 'split-diagonal'
      ? `<div style="position:absolute;inset:0;background:linear-gradient(145deg, ${surfaceColor} 0%, ${bgColor} 100%);clip-path:polygon(0 0,60% 0,44% 100%,0 100%);pointer-events:none;"></div>`
      : '';

  // Frame border for invitation/certificate
  const frameBorderHtml =
    layout.id === 'frame-border'
      ? `<div style="position:absolute;inset:calc(var(--u)*3.5);border:3px solid var(--accent);border-radius:calc(var(--u)*1.2);pointer-events:none;"><div style="position:absolute;inset:calc(var(--u)*1);border:1px solid var(--text);opacity:.32;"></div></div>`
      : '';

  // Typography styling per style
  const effectiveTextColor = isFullPhotoLayout ? '#ffffff' : textColor;
  const effectiveAccentColor = isFullPhotoLayout ? '#ffd166' : accentColor;
  const titleTreatClass =
    styleId === 'bold-yt-thumbnail' || styleId === 'pop-art-comic'
      ? 'fx-stroke'
      : styleId === 'neon-cyberpunk' || styleId === 'synthwave-retro' || styleId === 'anime-glow'
      ? 'fx-glow'
      : '';
  const textTransformRule = isHindi ? 'none' : styleId === 'bold-yt-thumbnail' || styleId === 'brutalist' || styleId === 'neon-cyberpunk' ? 'uppercase' : 'none';

  // Readability glass/solid plate if text sits over non-solid photo or busy mesh
  const needsBackingPlate = (Boolean(rf.forceBackingPlate) || styleId === 'glassmorphism' || (hasPhoto && isFullPhotoLayout && layout.id !== 'photo-bottom-plate')) && titleStr;
  const alignVal = titleZone.align || (plan.recipe === 'logo' || plan.recipe === 'quote-card' || plan.recipe === 'certificate' ? 'center' : 'left');
  const titleTopOverride = plan.recipe === 'logo' ? 0.54 : titleZone.y;
  const subTopOverride = plan.recipe === 'logo' ? 0.72 : subZone.y;

  const separateLowerFooter = (layout.id === 'poster-stack' || layout.id === 'product-spotlight' || layout.id === 'story-vertical') && hasPhoto && !isFullPhotoLayout;
  const titleSafeLeftPct = rf.safeMarginBoost ? Math.max(7.5, titleZone.x * 100) : titleZone.x * 100;
  const titleSafeWidthPct = rf.safeMarginBoost ? Math.min(85, titleZone.w * 100) : titleZone.w * 100;

  const headlineHtml = titleStr
    ? `
    <div style="position:absolute;left:${titleSafeLeftPct.toFixed(1)}%;top:${(titleTopOverride * 100).toFixed(1)}%;width:${titleSafeWidthPct.toFixed(1)}%;z-index:20;text-align:${alignVal};${
      needsBackingPlate
        ? `background:${darkBg || isFullPhotoLayout ? 'rgba(10,14,26,0.78)' : 'rgba(255,255,255,0.9)'};padding:calc(var(--u)*2.2) calc(var(--u)*2.8);border-radius:calc(var(--u)*2);border:1px solid ${darkBg || isFullPhotoLayout ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.14)'};box-sizing:border-box;`
        : ''
    }">
      ${
        badgeStr && plan.recipe !== 'logo'
          ? `<div style="display:inline-block;margin-bottom:calc(var(--u)*1.4);padding:calc(var(--u)*0.55) calc(var(--u)*1.5);border-radius:calc(var(--u)*0.8);background:${effectiveAccentColor};color:${readableOn(effectiveAccentColor)};font-family:${bodyFont};font-size:${badgePx}px;font-weight:800;letter-spacing:${isHindi ? '0' : '0.08em'};text-transform:${isHindi ? 'none' : 'uppercase'};">${esc(badgeStr)}</div>`
          : ''
      }
      <h1 class="${titleTreatClass}" style="margin:0;font-family:${titleFont};font-size:${titlePx}px;font-weight:${fonts.displayWeight || 800};line-height:${isHindi ? 1.2 : 1.06};color:${effectiveTextColor};text-transform:${textTransformRule};word-wrap:break-word;${
        titleTreatClass ? '' : `text-shadow:0 calc(var(--u)*0.4) calc(var(--u)*1.8) rgba(0,0,0,${darkBg || isFullPhotoLayout ? '0.45' : '0.08'});`
      }">
        ${headlineParts.before ? `<span>${esc(headlineParts.before)} </span>` : ''}<span style="color:${effectiveAccentColor}">${esc(headlineParts.accent)}</span>${headlineParts.after ? `<span> ${esc(headlineParts.after)}</span>` : ''}
      </h1>
      ${
        !separateLowerFooter && subStr
          ? `<p style="margin:calc(var(--u)*1.6) 0 0 0;font-family:${bodyFont};font-size:${subPx}px;font-weight:${fonts.bodyWeight || 500};line-height:1.38;color:${effectiveTextColor};opacity:0.9;">${esc(subStr)}</p>`
          : ''
      }
      ${
        !separateLowerFooter && ctaStr && plan.recipe !== 'thumbnail'
          ? `<div style="margin-top:calc(var(--u)*2.2);display:inline-block;padding:calc(var(--u)*1.0) calc(var(--u)*2.4);border-radius:calc(var(--u)*1.2);background:${primaryColor};color:${readableOn(primaryColor)};font-family:${bodyFont};font-size:${Math.max(badgePx, Math.round(subPx * 0.85))}px;font-weight:800;letter-spacing:${isHindi ? '0' : '0.05em'};box-shadow:0 calc(var(--u)*0.8) calc(var(--u)*2) rgba(0,0,0,0.28);">${esc(ctaStr)}</div>`
          : ''
      }
    </div>
    ${
      separateLowerFooter && (subStr || (ctaStr && plan.recipe !== 'thumbnail'))
        ? `<div style="position:absolute;left:${(subZone.x * 100).toFixed(1)}%;top:${(Math.max(0.76, subZone.y) * 100).toFixed(1)}%;width:${(subZone.w * 100).toFixed(1)}%;z-index:20;text-align:${alignVal};">
            ${
              subStr
                ? `<p style="margin:0;font-family:${bodyFont};font-size:${subPx}px;font-weight:${fonts.bodyWeight || 500};line-height:1.35;color:${effectiveTextColor};opacity:0.92;">${esc(subStr)}</p>`
                : ''
            }
            ${
              ctaStr && plan.recipe !== 'thumbnail'
                ? `<div style="margin-top:calc(var(--u)*1.4);display:inline-block;padding:calc(var(--u)*0.9) calc(var(--u)*2.2);border-radius:calc(var(--u)*1.1);background:${primaryColor};color:${readableOn(primaryColor)};font-family:${bodyFont};font-size:${Math.max(badgePx, Math.round(subPx * 0.85))}px;font-weight:800;letter-spacing:${isHindi ? '0' : '0.05em'};box-shadow:0 calc(var(--u)*0.8) calc(var(--u)*2) rgba(0,0,0,0.28);">${esc(ctaStr)}</div>`
                : ''
            }
          </div>`
        : ''
    }
  `
    : '';

  const finishOverlays = `
    ${styleId !== 'minimal-swiss' ? '<div class="fx-vignette" style="opacity:0.42"></div>' : ''}
    ${slices.effects?.some((e) => e.id === 'letterbox') ? '<div class="fx-bars"></div>' : ''}
  `;

  return `<!DOCTYPE html>
<html lang="${isHindi ? 'hi' : 'en'}">
<head>
<meta charset="UTF-8" />
<link rel="stylesheet" href="${esc(fontLink)}" />
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:transparent}
#canvas{
  width:${W}px;
  height:${H}px;
  position:relative;
  overflow:hidden;
  background:var(--bg);
  color:var(--text);
  font-family:${bodyFont};
  --bg:${bgColor};
  --surface:${surfaceColor};
  --primary:${primaryColor};
  --accent:${accentColor};
  --text:${textColor};
  --u:${U}px;
}
${effectCss}
</style>
</head>
<body>
<div id="canvas">
  ${backgroundLayers}
  ${splitPanel}
  ${subjectHtml}
  ${motifsHtml}
  ${frameBorderHtml}
  ${headlineHtml}
  ${finishOverlays}
</div>
</body>
</html>`;
}

/**
 * Deterministic visual defect fixer for fallback/local studio plans when the
 * multimodal visual inspector flags contrast, layout clipping, cutout halos, or face cropping.
 */
export function applyVisualDefectPlanAdjustments(plan, defects = []) {
  const nextFlags = { ...(plan.repairFlags || {}) };
  for (const d of Array.isArray(defects) ? defects : []) {
    const area = String(d?.area || '').toLowerCase();
    const issueLower = `${d?.issue || ''} ${d?.fixInstruction || ''}`.toLowerCase();
    if (area === 'text' || /contrast|readab|dark|bright|clip|truncat|overlap/.test(issueLower)) {
      nextFlags.forceBackingPlate = true;
      nextFlags.scrimBoost = true;
      if (/clip|truncat|large|big|fit|overflow/.test(issueLower)) {
        nextFlags.preventTextClip = true;
      }
    }
    if (area === 'layout' || /margin|edge|clip|overlap|crowd|spacing/.test(issueLower)) {
      nextFlags.safeMarginBoost = true;
      nextFlags.preventTextClip = true;
    }
    if (area === 'cutout' || /halo|edge|outline|background|float/.test(issueLower)) {
      nextFlags.cutoutPolish = true;
    }
    if (area === 'face' || /head|forehead|face|crop|portrait/.test(issueLower)) {
      nextFlags.faceTopAnchor = true;
    }
  }
  return {
    ...plan,
    repairFlags: nextFlags,
  };
}
