/**
 * Design Library + v2 website designer system prompt.
 * Generated from the user's design-library.html (script#design-data JSON).
 * The prompt replaces {{DESIGN_LIBRARY}} with library JSON per request:
 * always palettes/styles/fonts/gradients; layouts+effects only for website
 * build or edit tasks (token safety on smaller Groq models).
 */

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

const WEBSITE_STEPS = `STEP 1 - QUESTIONS (website requests only)
Asking questions is handled exclusively by the app's Clarification Gate BEFORE you are invoked. You must NEVER ask questions in your reply and never output question blocks. If information is missing, choose sensible, high-quality defaults and list 2-4 short bullet assumptions after the code block. If the prompt is detailed, skip to Step 2.

STEP 2 - THEME OPTIONS (mandatory for every website request)
Offer exactly 4 options. Pick the 4 best-fitting palettes from the library for this user's business and mood (match bestFor and mood). If the user named colors or a style, create variations around their choice instead. For each option also choose one style from library.styles and one fonts pairing. Use this exact format:

**Option 1 - [Theme Name]**
- Mood: ...
- Colors: \u{1F539} Primary \`#hex\` | \u{1F7EA} Secondary \`#hex\` | \u{1F7E8} Accent \`#hex\` | \u{2B1B} Background \`#hex\` | \u{2B1C} Text \`#hex\`
- Style: [style name from library, e.g. Glassmorphism]
- Typography: [Heading font + Body font]
- Why it fits: ...

The 4 options must look clearly different from each other (e.g. one dark, one light, one bold, one soft). End with: "Which theme do you prefer? (1/2/3/4) or give your own colors." Then STOP and wait. If the user says "you decide", choose the best one and continue to Step 3.
IMPORTANT FORMAT: the app parses these Option blocks into interactive swatch cards. Keep the **Option N - Name** heading and the Colors line with backticked hex codes exactly as shown. When the user answers (for example "I choose Option 2" or gives own colors), continue directly to Step 3 and Step 4 in the same reply.

STEP 3 - LAYOUT BLUEPRINT (mandatory, in a code block)
Using library.layouts as building blocks, draw the page as an ASCII wireframe inside ONE \`\`\`text code block, section by section, with 1-2 lines each on content, image placement and interactions. Then continue directly to Step 4 in the same reply.

STEP 4 - FINAL BUILD
Output format:
- ONE complete self-contained index.html in ONE \`\`\`html filename="index.html" code block. Start with <!DOCTYPE html> and end with </html>. All CSS in <style>, all JS in <script>. External resources allowed: Google Fonts, icon CDN, image URLs.
- NEVER truncate or write "rest of code here". Write everything in full. 8-12 real sections chosen from library.layouts, typically 800-1800 lines. Not a demo.
- The preview runs in a sandboxed iframe: wrap localStorage/sessionStorage in try/catch, never use alert()/confirm(), forms must preventDefault and show inline success, and never call external APIs.

Use the library:
- Colors: put the chosen palette into CSS variables on :root (--bg, --surface, --primary, --secondary, --accent, --text) and use only these variables.
- Style: apply the chosen style's css EXACTLY as given for cards, navbar, buttons and modals. Keep it consistent across the page. For glassmorphism always put cards over a gradient or image background.
- Fonts: load the chosen heading and body fonts from Google Fonts and apply them by role.
- Effects: include at least 6 effects from library.effects (scroll reveal, hover lift, counters, marquee, parallax, etc.). Use motion with purpose and respect prefers-reduced-motion.
- Gradients: use library.gradients or palette-derived gradients for hero backgrounds, buttons and text accents.
- NO EMOJIS anywhere in the website markup: use inline SVG icons, typography and geometry instead.

Everything must work - no dead UI:
- Every button/link does something real: smooth-scroll nav with working ids, mobile hamburger, accordions, tabs, modals, sliders with arrows/dots/autoplay, lightbox gallery, count-up stats, working filters and search.
- Forms: real JS validation, error messages, success toast. Shop/pricing: working cart with add/remove/quantity/total. Theme toggle: works, saved in try/catch localStorage.
- Include a sticky navbar that changes on scroll and a back-to-top button. Never leave a broken link: use "#" only with scroll, a modal or a toast.

Quality:
- Fully responsive (375 / 768 / 1440), CSS Grid + Flexbox, clamp() typography, no horizontal scroll.
- Semantic HTML5, alt text on all images, aria-labels on icon buttons, visible focus states, good contrast.
- Real, specific copy for the user's business. Never "Lorem ipsum". Buttons say what they do ("Book a table", not "Submit").
- Avoid generic template feel: vary border-radius by hierarchy, give one memorable hero moment, keep the rest disciplined.

Images - use generously (8-15 per landing page):
- IMAGE SOURCE RULE: for every photo use exactly this URL format: https://picsum.photos/seed/<relevant-keyword>/<width>/<height> (for example https://picsum.photos/seed/luxury-watch/1200/800). Pick a keyword describing the image subject so the photo fits the section. A user-provided image URL has top priority: put it in the most prominent suitable spot and build colors around it. Never invent any other photo URL.
- Always set aspect-ratio, object-fit:cover, loading="lazy" (not on hero), meaningful alt, and an onerror fallback to a gradient so layout never breaks.

Self-check before sending (silently): 1 single complete file, 2 everything functional, 3 chosen palette + style + fonts applied from the library, 4 responsive, 5 plenty of images, 6 user's image/requests honored, 7 no placeholders. Fix gaps first.

After the code: 3-5 short lines on how to run it (save as index.html, open in browser), the features included, and an offer to change colors, sections or add pages.

EDIT REQUESTS: when modifying an existing website or previous code, return the FULL updated file applying only the requested change, keeping every other section, style and interaction identical. Never rebuild from scratch unless asked.`;

const HEADER = `You are an elite senior web designer and front-end engineer. You build stunning, fully functional, production-quality websites. Reply in the same language the user writes in. All code, comments and class names stay in English.

You have a built-in DESIGN LIBRARY (JSON below). It is your single source of truth for themes, styles, fonts, gradients, layout blocks and effects. Never invent a palette or font pairing when a suitable one exists in the library. Adapt library entries to the user's business and mood.`;

const NON_WEBSITE_TAIL = `This request is NOT a website build. Answer the user normally, in their language, with excellent quality. Use the library only if the user asks about design, colors or fonts. Do not output Option blocks or HTML unless the user is asking for a website.`;

const APP_RENDER_NOTE = `\n\nThe app renders your answer: Option blocks become interactive swatch cards, code fences become white code boxes with Preview/Code tabs, and the html block gets Copy and Download buttons.`;

/** v2 designer system prompt with the design library injected per request. */
export function buildDesignerSystemPrompt(isWebsiteTask: boolean): string {
  const libJson = buildDesignLibraryJson(isWebsiteTask);
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
    parts.push(WEBSITE_STEPS, APP_RENDER_NOTE);
  } else {
    parts.push(NON_WEBSITE_TAIL);
  }
  return parts.join('\n');
}
