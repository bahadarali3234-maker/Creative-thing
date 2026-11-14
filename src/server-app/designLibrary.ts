/**
 * Design Library + v2 website designer system prompt.
 * Generated from the user's design-library.html (script#design-data JSON).
 * The prompt replaces {{DESIGN_LIBRARY}} with library JSON per request:
 * always palettes/styles/fonts/gradients; layouts+effects only for website
 * build or edit tasks (token safety on smaller Groq models).
 */

import { IMAGE_FINDER_SYSTEM_PROMPT } from './imageFinderModule';

export interface DesignLibraryData {
  palettes: string[][];
  styles: string[][];
  fonts: string[][];
  gradients: string[][];
  layouts: string[][];
  effects: string[][];
}

export const DESIGN_LIBRARY: DesignLibraryData = {
  "palettes": [
    [
      "Midnight Luxe",
      "elegant, premium",
      "#0b0d17",
      "#151a2b",
      "#c9a24b",
      "#6d5dfc",
      "#f5d98b",
      "#eef0f7",
      "luxury, jewellery, law firm"
    ],
    [
      "Ocean Breeze",
      "fresh, airy",
      "#f4fbff",
      "#ffffff",
      "#0ea5e9",
      "#0369a1",
      "#22d3ee",
      "#0c2a3d",
      "travel, spa, SaaS"
    ],
    [
      "Sunset Glow",
      "warm, energetic",
      "#1a0b14",
      "#2a1220",
      "#ff6b35",
      "#f72585",
      "#ffd166",
      "#fff1e8",
      "events, food delivery"
    ],
    [
      "Forest Calm",
      "natural, trustworthy",
      "#f3f7f2",
      "#ffffff",
      "#2f6b3a",
      "#8bb174",
      "#d9a441",
      "#1e2b1f",
      "eco brands, organic, wellness"
    ],
    [
      "Neon Cyber",
      "futuristic, techy",
      "#07070f",
      "#11111f",
      "#00f0ff",
      "#b026ff",
      "#ff2e97",
      "#e8f8ff",
      "gaming, crypto, tech"
    ],
    [
      "Royal Purple",
      "creative, bold",
      "#12071f",
      "#1d0f33",
      "#8b5cf6",
      "#d946ef",
      "#fbbf24",
      "#f3e8ff",
      "agency, music, nightlife"
    ],
    [
      "Coral Cafe",
      "friendly, cozy",
      "#fff8f3",
      "#ffffff",
      "#e76f51",
      "#2a9d8f",
      "#f4a261",
      "#3a2a22",
      "cafe, bakery, restaurant"
    ],
    [
      "Monochrome Pro",
      "minimal, sharp",
      "#ffffff",
      "#f4f4f5",
      "#111111",
      "#52525b",
      "#ef4444",
      "#18181b",
      "portfolio, studio, architecture"
    ],
    [
      "Rose Gold",
      "feminine, soft luxury",
      "#fff5f5",
      "#ffffff",
      "#b76e79",
      "#e8b4b8",
      "#d4a373",
      "#3b2327",
      "beauty, salon, wedding"
    ],
    [
      "Emerald Fintech",
      "trust, growth",
      "#06130f",
      "#0d231c",
      "#10b981",
      "#34d399",
      "#fbbf24",
      "#e8fff6",
      "finance, banking, investing"
    ],
    [
      "Sky Medical",
      "clean, caring",
      "#f5faff",
      "#ffffff",
      "#2563eb",
      "#14b8a6",
      "#38bdf8",
      "#0f2342",
      "clinic, hospital, pharmacy"
    ],
    [
      "Candy Pop",
      "playful, joyful",
      "#fff0f7",
      "#ffffff",
      "#ff4d9d",
      "#7c4dff",
      "#ffd23f",
      "#2b1b3d",
      "kids, toys, games"
    ],
    [
      "Desert Sand",
      "earthy, warm",
      "#faf3e7",
      "#ffffff",
      "#c2703d",
      "#8a5a3b",
      "#e3b04b",
      "#3b2a1c",
      "handicrafts, travel, interior"
    ],
    [
      "Arctic Frost",
      "cool, crisp",
      "#eef6fb",
      "#ffffff",
      "#3b82f6",
      "#94a3b8",
      "#67e8f9",
      "#0f172a",
      "SaaS, dashboards, startups"
    ],
    [
      "Crimson Noir",
      "aggressive, powerful",
      "#0a0a0a",
      "#161616",
      "#dc2626",
      "#f97316",
      "#fafafa",
      "#f5f5f5",
      "fitness, automotive, barber"
    ],
    [
      "Lavender Dream",
      "calm, dreamy",
      "#f7f3ff",
      "#ffffff",
      "#8b7cf6",
      "#c4b5fd",
      "#f9a8d4",
      "#2e2550",
      "meditation, apps, journals"
    ],
    [
      "Gold and Black",
      "premium, exclusive",
      "#0a0a0a",
      "#141414",
      "#d4af37",
      "#8c6d1f",
      "#f5e6a8",
      "#f5f0e1",
      "real estate, watches, hotels"
    ],
    [
      "Mint Fresh",
      "light, healthy",
      "#f0fdf9",
      "#ffffff",
      "#14b8a6",
      "#5eead4",
      "#fb923c",
      "#0f3d36",
      "health food, juice, yoga"
    ],
    [
      "Retro Sunset 80s",
      "nostalgic, vibrant",
      "#240046",
      "#3c096c",
      "#ff9e00",
      "#ff0054",
      "#00f5d4",
      "#fff1fb",
      "music, festivals, retro shops"
    ],
    [
      "Slate Corporate",
      "professional, serious",
      "#f8fafc",
      "#ffffff",
      "#334155",
      "#0ea5e9",
      "#f59e0b",
      "#0f172a",
      "B2B, consulting, enterprise"
    ],
    [
      "Cherry Blossom",
      "gentle, stylish",
      "#fff7fa",
      "#ffffff",
      "#ec4899",
      "#f9a8d4",
      "#84cc16",
      "#4a1d33",
      "florist, fashion, gifts"
    ],
    [
      "Deep Space",
      "cosmic, intelligent",
      "#05060f",
      "#0e1226",
      "#6366f1",
      "#22d3ee",
      "#f472b6",
      "#e0e7ff",
      "AI products, startups, science"
    ],
    [
      "Olive and Cream",
      "organic, refined",
      "#f6f1e3",
      "#fffdf6",
      "#6b7a3a",
      "#a3b18a",
      "#bc6c25",
      "#2a2f1c",
      "fine dining, farms, tea"
    ],
    [
      "Electric Sport",
      "energetic, athletic",
      "#0b132b",
      "#1c2541",
      "#3a86ff",
      "#ffbe0b",
      "#fb5607",
      "#f1faee",
      "sports, gyms, events"
    ]
  ],
  "styles": [
    [
      "Glassmorphism",
      "linear-gradient(135deg,#6d5dfc,#ec4899)",
      "background:rgba(255,255,255,.12);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);border:1px solid rgba(255,255,255,.25);box-shadow:0 8px 32px rgba(0,0,0,.25);border-radius:20px;color:#fff",
      "Needs a colorful or image background behind it. Great for navbars, cards, modals."
    ],
    [
      "Neumorphism (raised)",
      "#e0e5ec",
      "background:#e0e5ec;box-shadow:9px 9px 16px #a3b1c6,-9px -9px 16px #ffffff;border-radius:20px;color:#444",
      "Soft UI. Background and element share the same color. Use for buttons, toggles, cards."
    ],
    [
      "Neumorphism (pressed)",
      "#e0e5ec",
      "background:#e0e5ec;box-shadow:inset 6px 6px 10px #a3b1c6,inset -6px -6px 10px #ffffff;border-radius:16px;color:#444",
      "Pressed or active state, inputs, sliders."
    ],
    [
      "Claymorphism",
      "#fde2ea",
      "background:#ffb3c7;border-radius:28px;box-shadow:inset -8px -8px 16px rgba(0,0,0,.15),inset 8px 8px 16px rgba(255,255,255,.5),10px 14px 24px rgba(0,0,0,.18);color:#4a1630",
      "Chunky 3D puffy look for kids, apps, playful brands."
    ],
    [
      "Neo-Brutalism",
      "#f4f4f0",
      "background:#ffe14d;border:3px solid #000;box-shadow:6px 6px 0 #000;border-radius:0;color:#000;font-weight:800",
      "Bold borders, hard shadows, flat loud colors. Startups, creators, portfolios."
    ],
    [
      "Neon Glow",
      "#05050c",
      "background:#0b0b1a;border:2px solid #0ff;box-shadow:0 0 12px #0ff,inset 0 0 12px rgba(0,255,255,.3);border-radius:14px;color:#0ff;text-shadow:0 0 8px #0ff",
      "Dark backgrounds only. Gaming, crypto, nightlife."
    ],
    [
      "Aurora Mesh",
      "#0f0a1f",
      "background:radial-gradient(at 20% 20%,#7c3aed,transparent 50%),radial-gradient(at 80% 30%,#06b6d4,transparent 50%),radial-gradient(at 50% 90%,#ec4899,transparent 50%),#0f0a1f;color:#fff;border-radius:20px",
      "Animated or static mesh gradient hero and section backgrounds."
    ],
    [
      "Bento Grid",
      "#f3f4f6",
      "background:#fff;border:1px solid #e5e7eb;border-radius:24px;box-shadow:0 1px 2px rgba(0,0,0,.05);color:#111",
      "Feature sections as mixed-size tiles in a CSS grid."
    ],
    [
      "Minimal Line",
      "#fafafa",
      "background:#fafafa;border:1px solid #111;border-radius:2px;color:#111",
      "Thin borders, lots of whitespace, strong type. Studios, editorial."
    ],
    [
      "Dark Luxe Gold",
      "#050505",
      "background:linear-gradient(145deg,#1a1a1a,#0d0d0d);border:1px solid #c9a24b;border-radius:12px;color:#e9d9a6;box-shadow:0 10px 30px rgba(0,0,0,.6)",
      "Premium dark cards with metallic accents."
    ],
    [
      "Retro Paper",
      "#e8d5a8",
      "background:#f4e4c1;border:3px double #7a3e1d;border-radius:6px;color:#5a2d12;font-family:Courier New,monospace",
      "Vintage, typewriter, craft and old-school brands."
    ],
    [
      "Gradient Border",
      "#0e1120",
      "background:linear-gradient(#12162a,#12162a) padding-box,linear-gradient(135deg,#00f0ff,#b026ff,#ff2e97) border-box;border:2px solid transparent;border-radius:18px;color:#fff",
      "Premium highlight for pricing and featured cards."
    ]
  ],
  "fonts": [
    [
      "A",
      "Abril Fatface",
      "Lato",
      "editorial, fashion"
    ],
    [
      "B",
      "Bebas Neue",
      "Open Sans",
      "bold, sports"
    ],
    [
      "C",
      "Cormorant Garamond",
      "Montserrat",
      "luxury, weddings"
    ],
    [
      "D",
      "DM Serif Display",
      "DM Sans",
      "modern serif"
    ],
    [
      "E",
      "Epilogue",
      "Inter",
      "clean tech"
    ],
    [
      "F",
      "Fraunces",
      "Work Sans",
      "warm, friendly"
    ],
    [
      "G",
      "Gilda Display",
      "Karla",
      "boutique, spa"
    ],
    [
      "H",
      "Hanken Grotesk",
      "Source Sans 3",
      "corporate"
    ],
    [
      "I",
      "Instrument Serif",
      "Inter",
      "elegant minimal"
    ],
    [
      "J",
      "Josefin Sans",
      "Lora",
      "retro chic"
    ],
    [
      "K",
      "Kanit",
      "Roboto",
      "strong, automotive"
    ],
    [
      "L",
      "Lexend",
      "Merriweather",
      "readable, education"
    ],
    [
      "M",
      "Manrope",
      "Inter",
      "SaaS, apps"
    ],
    [
      "N",
      "Nunito",
      "Nunito Sans",
      "soft, kids, health"
    ],
    [
      "O",
      "Outfit",
      "Inter",
      "modern startup"
    ],
    [
      "P",
      "Playfair Display",
      "Source Sans 3",
      "classic editorial"
    ],
    [
      "Q",
      "Quicksand",
      "Nunito",
      "playful rounded"
    ],
    [
      "R",
      "Raleway",
      "Roboto",
      "light, elegant"
    ],
    [
      "S",
      "Space Grotesk",
      "DM Sans",
      "techy, creative"
    ],
    [
      "T",
      "Tenor Sans",
      "Lato",
      "refined, hotel"
    ],
    [
      "U",
      "Unbounded",
      "Inter",
      "futuristic, bold"
    ],
    [
      "V",
      "Vollkorn",
      "Work Sans",
      "bookish, calm"
    ],
    [
      "W",
      "Work Sans",
      "Libre Baskerville",
      "professional"
    ],
    [
      "X",
      "Xanh Mono",
      "Inter",
      "code, developer"
    ],
    [
      "Y",
      "Yeseva One",
      "Poppins",
      "beauty, feminine"
    ],
    [
      "Z",
      "Zen Dots",
      "Inter",
      "sci-fi, gaming"
    ]
  ],
  "gradients": [
    [
      "Sunrise",
      "linear-gradient(135deg,#ff9a9e,#fad0c4)"
    ],
    [
      "Ocean",
      "linear-gradient(135deg,#2193b0,#6dd5ed)"
    ],
    [
      "Purple Haze",
      "linear-gradient(135deg,#667eea,#764ba2)"
    ],
    [
      "Emerald",
      "linear-gradient(135deg,#11998e,#38ef7d)"
    ],
    [
      "Fire",
      "linear-gradient(135deg,#f12711,#f5af19)"
    ],
    [
      "Midnight",
      "linear-gradient(135deg,#0f2027,#203a43,#2c5364)"
    ],
    [
      "Candy",
      "linear-gradient(135deg,#ff6a88,#ff99ac,#ffd1ff)"
    ],
    [
      "Neon",
      "linear-gradient(135deg,#00f0ff,#b026ff,#ff2e97)"
    ],
    [
      "Gold",
      "linear-gradient(135deg,#bf953f,#fcf6ba,#b38728)"
    ],
    [
      "Mint",
      "linear-gradient(135deg,#a8edea,#fed6e3)"
    ],
    [
      "Royal",
      "linear-gradient(135deg,#141e30,#243b55)"
    ],
    [
      "Peach",
      "linear-gradient(135deg,#ffecd2,#fcb69f)"
    ]
  ],
  "layouts": [
    [
      "Navbar",
      "Logo (left) | Links (center) | CTA button + theme toggle (right)",
      "Sticky, blur on scroll, hamburger drawer on mobile, active link highlight with scroll-spy, smooth scroll."
    ],
    [
      "Hero – Split",
      "Headline + subtext + 2 buttons (left) | Hero image with floating cards (right)",
      "Typing or rotating word, floating shapes, CTA opens modal or scrolls."
    ],
    [
      "Hero – Centered",
      "Badge / Big headline / subtext / buttons / full-width image or mockup below",
      "Gradient text, animated aurora background, scroll indicator."
    ],
    [
      "Logo Marquee",
      "Row of partner logos scrolling infinitely",
      "Pure CSS marquee, pause on hover."
    ],
    [
      "Features Grid",
      "3 to 6 cards: icon, title, 2-line text",
      "Hover lift, staggered reveal via IntersectionObserver."
    ],
    [
      "Bento Showcase",
      "Mixed-size tiles in a 4-column grid, one large tile with image",
      "CSS grid-template-areas, tilt on hover."
    ],
    [
      "Gallery",
      "Masonry or grid of 8 to 12 images with category filter chips",
      "Working filter, lightbox with next/prev/ESC, lazy loading."
    ],
    [
      "Stats Counters",
      "4 big numbers with labels in a strip",
      "Count-up animation when visible."
    ],
    [
      "Process Steps",
      "3 to 4 steps connected by a line (only if real sequence)",
      "Progress line fills on scroll."
    ],
    [
      "Testimonials Slider",
      "Avatar, quote, name, role, star rating, arrows and dots",
      "Autoplay, swipe on touch, pause on hover."
    ],
    [
      "Pricing",
      "3 plan cards, middle highlighted, monthly/yearly toggle",
      "Toggle recalculates prices, buttons open signup modal."
    ],
    [
      "FAQ Accordion",
      "6 questions with expand/collapse",
      "One open at a time, animated height, aria-expanded."
    ],
    [
      "Contact + Form",
      "Info and map/image (left) | Form (right)",
      "JS validation, inline errors, success toast, button loading state."
    ],
    [
      "Newsletter CTA",
      "Full-width banner with email input and button",
      "Email regex validation, success state."
    ],
    [
      "Footer",
      "Brand + 3 link columns + socials + copyright + back-to-top",
      "Back-to-top button appears after 400px scroll."
    ],
    [
      "Shop Grid + Cart",
      "Product cards, search, category filter, cart drawer",
      "Add/remove/qty, running total, badge count, persistent in memory."
    ]
  ],
  "effects": [
    [
      "Scroll reveal",
      "IntersectionObserver adds .in class; CSS: .rv{opacity:0;transform:translateY(24px);transition:.7s}.rv.in{opacity:1;transform:none}"
    ],
    [
      "Gradient text",
      "background:linear-gradient(90deg,var(--primary),var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent"
    ],
    [
      "Hover lift card",
      "transition:.3s;:hover{transform:translateY(-8px);box-shadow:0 20px 40px rgba(0,0,0,.2)}"
    ],
    [
      "Marquee",
      "@keyframes mq{to{transform:translateX(-50%)}} .track{display:flex;width:max-content;animation:mq 30s linear infinite} (duplicate the items once)"
    ],
    [
      "Floating shape",
      "@keyframes fl{50%{transform:translateY(-18px)}} .shape{animation:fl 6s ease-in-out infinite}"
    ],
    [
      "Shimmer button",
      "background:linear-gradient(110deg,var(--primary) 40%,#fff6 50%,var(--primary) 60%);background-size:200% 100%;animation:sh 2.5s infinite;@keyframes sh{to{background-position:-200% 0}}"
    ],
    [
      "Parallax hero",
      "window scroll listener (requestAnimationFrame): bg.style.transform=`translateY(${scrollY*.3}px)`"
    ],
    [
      "Typing text",
      "JS loop that types and deletes words from an array into a span with a blinking caret"
    ],
    [
      "3D tilt card",
      "mousemove: compute rotateX/rotateY from cursor offset, apply transform:perspective(800px) rotateX() rotateY()"
    ],
    [
      "Count-up",
      "requestAnimationFrame easing from 0 to data-target when the element enters the viewport"
    ],
    [
      "Custom cursor glow",
      "a fixed radial-gradient div following mousemove with transform, pointer-events:none"
    ],
    [
      "Dark/light toggle",
      "data-theme attribute on html, CSS variables per theme, save choice in localStorage inside try/catch"
    ]
  ]
};

export function buildDesignLibraryJson(includeWebsiteSections: boolean): string {
  const pick = (key: keyof DesignLibraryData) => `,\n"${key}":${JSON.stringify(DESIGN_LIBRARY[key])}`;
  let out = '{';
  out += `"palettes":${JSON.stringify(DESIGN_LIBRARY.palettes)}`;
  out += `,\n"styles":${JSON.stringify(DESIGN_LIBRARY.styles)}`;
  out += `,\n"fonts":${JSON.stringify(DESIGN_LIBRARY.fonts)}`;
  out += `,\n"gradients":${JSON.stringify(DESIGN_LIBRARY.gradients)}`;
  if (includeWebsiteSections) {
    out += `,\n"layouts":${JSON.stringify(DESIGN_LIBRARY.layouts)}`;
    out += `,\n"effects":${JSON.stringify(DESIGN_LIBRARY.effects)}`;
  }
  out += '}';
  return out;
}

const LIBRARY_FORMAT = `Library format:
- palettes: [name, mood, bg, surface, primary, secondary, accent, text, bestFor]
- styles: [name, stageBackground, css, usageNote]   (css is a ready-to-use declaration block)
- fonts: [letter, headingFont, bodyFont, vibe]
- gradients: [name, css]
- layouts: [name, wireframe, interactions]
- effects: [name, snippet]
Missing sections are simply not needed for this request.`;

const STEP_0 = `STEP 0 - INTENT
Read the user's text and any image first.
A) Only wants an image analyzed -> analyze in detail. Do NOT build a website.
B) Wants a website AND gave an image ("use my image/logo/photo") -> do NOT just describe it. Check it internally (subject, colors, mood), then USE it in the site (hero, logo, product, about) and derive theme colors from it. Say in one line what you noticed and where you will use it.
C) Image is a design reference ("make it like this") -> extract layout, colors, type and recreate that style.
D) Anything else -> answer normally.
Follow exactly what the user asked, nothing more, nothing less.`;

const WEBSITE_STEPS = `IMPORTANT PRODUCT POLICY — WEBSITE & APP UI CREATION:
This application does NOT build or output complete HTML/CSS/JS websites or App UIs.
Whenever the user asks to create, build, make, or design a website, landing page, web app, or App UI:
1. NEVER output a full <!DOCTYPE html>...</html> single-file website or complete HTML/CSS/JS website build.
2. Clearly inform the user in Romanized script of their language (or English if asked in English): **"Go to Buildy (https://fluorescent-code-vault-flow.base44.app) to create your App or Web UI."**
3. Provide high-value architectural guidance AND a detailed, copy-ready Buildy prompt inside a \`\`\`prompt code block tailored to their request (including layout sections, palette from the Design Library, typography, and interactive behaviors) so they can paste it directly into Buildy.
4. If the user asks for backend logic, algorithms, scripts, or code in programming languages (Python, TypeScript, JavaScript logic, C++, Java, SQL, etc.) or detailed technical answers/prompts, answer thoroughly and accurately in those languages.`;

const HEADER = `You are an elite executive AI intelligence, senior software architect, and multimodal analyst.

CRITICAL LANGUAGE & SCRIPT RULE:
1. Automatically detect the user's language from their query.
2. ALWAYS respond in the **Romanized version** of that language (using clean English alphabet letters — e.g. Roman Urdu, Roman Hindi, Roman Arabic) by default, UNLESS the user explicitly asks you to write in the native script (such as Urdu Nasta'liq or Hindi Devanagari).
3. If the user writes in English, respond in crisp, natural English.

VISUAL & FORMATTING EXCELLENCE:
- Always format responses in rich **Markdown** with prominent **bold** emphasis (\`**key insights**\`, \`**headings**\`, \`**values**\`) for immediate scannability.
- Whenever comparing metrics, specs, prices, schedules, or structured facts, render a clean **Markdown table** (\`| Metric | Value |\`).
- Whenever quantitative data, trends, breakdowns, or statistics help explain the answer, output a real interactive chart inside a \`\`\`chart code fence with valid JSON matching this schema:
  \`\`\`chart
  {
    "type": "bar",
    "title": "Descriptive Chart Title",
    "xKey": "name",
    "series": [{ "key": "value", "label": "Label" }],
    "data": [{ "name": "Item 1", "value": 42 }, { "name": "Item 2", "value": 78 }]
  }
  \`\`\`
  Supported "type" values: "bar", "line", "area", "pie".
- Never ask blocking clarification questions; deliver the most complete, executive-ready answer directly on the first pass.`;

const NON_WEBSITE_TAIL = `Answer directly at maximum clarity and depth without asking setup questions. Remember: use Romanized script for non-English languages (unless native script was explicitly requested), rich **bold** emphasis, Markdown tables, and \`\`\`chart JSON blocks whenever helpful.`;

const APP_RENDER_NOTE = `\n\nThe app renders code boxes, interactive Recharts charts, tables, and prompt blocks natively with one-click Copy and Preview buttons.`;

/** v2 system prompt with Design Library references for Buildy prompts and technical assistance. */
export function buildDesignerSystemPrompt(isWebsiteTask: boolean): string {
  const libJson = buildDesignLibraryJson(false);
  const parts = [
    HEADER,
    '<DESIGN_LIBRARY>',
    libJson,
    '</DESIGN_LIBRARY>',
    '',
    LIBRARY_FORMAT,
    '',
    STEP_0,
    '',
  ];
  if (isWebsiteTask) {
    parts.push(WEBSITE_STEPS, APP_RENDER_NOTE, '', IMAGE_FINDER_SYSTEM_PROMPT);
  } else {
    parts.push(NON_WEBSITE_TAIL, '', IMAGE_FINDER_SYSTEM_PROMPT);
  }
  return parts.join('\n');
}
