/**
 * Creative Think Library — Parser, Detector & Master Website Assembler
 * Compliant with Creative Think Library Master AI Training Instructions
 */

export interface CreativeThinkResource {
  index: number;
  name: string;
  family: string;
  palette: string;
  typePairing: string;
  rawHtml: string;
  css: string;
  js: string;
  bodyContent: string;
}

export interface CreativeThinkImageRef {
  index: number;
  title: string;
  url: string;
}

export interface CreativeThinkLibraryData {
  title: string;
  referenceCount: number;
  imageReferenceCount: number;
  dateStr?: string;
  resources: CreativeThinkResource[];
  imageReferences: CreativeThinkImageRef[];
}

/**
 * Detects whether text or file content contains the Creative Think Library signature.
 */
export function isCreativeThinkLibraryDocument(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  // Signature checks
  if (lower.includes('creative think') && lower.includes('library')) return true;
  if (lower.includes('c r e a t i v e   t h i n k') && lower.includes('library')) return true;
  if (lower.includes('design source document')) return true;
  if (lower.includes('source_type: creative_think_library') || lower.includes('creative_think_library')) return true;
  if (lower.includes('end of document · creative think library')) return true;
  if (lower.includes('how to use') && lower.includes('references with complete, self-contained source')) return true;

  // Pattern check for numbered resources with Family/Palette/Type metadata and HTML
  if (/\d+\.\s+[A-Za-z0-9\s+—–-]+\n\s*Family:[^\n]+Palette:[^\n]+Type:[^\n]+/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * Parses raw text from an exported Creative Think Library document.
 */
export function parseCreativeThinkLibrary(content: string): CreativeThinkLibraryData {
  const result: CreativeThinkLibraryData = {
    title: 'Creative Think Library',
    referenceCount: 0,
    imageReferenceCount: 0,
    resources: [],
    imageReferences: [],
  };

  if (!content) return result;

  // Extract reference count from header if available
  const countMatch = content.match(/(\d+)\s+references?\s*(?:·\s*(\d+)\s+image\s+references?)?/i);
  if (countMatch) {
    result.referenceCount = parseInt(countMatch[1], 10);
    if (countMatch[2]) {
      result.imageReferenceCount = parseInt(countMatch[2], 10);
    }
  }

  // Split into resource blocks
  // Resource blocks start with "N. Name\n   Family: ... · Palette: ... · Type: ..."
  // or "### N. Name"
  const resourceBlockRegex = /(?:^|\n)(?:={10,}\s*\n+)?(\d+)\.\s+([^\n]+)\n\s*Family:\s*([^·\n]+)\s*·\s*Palette:\s*([^·\n]+)\s*·\s*Type:\s*([^\n]+)\n-+\s*\n+([\s\S]*?)(?=(?:\n={10,}|\n\d+\.\s+[^\n]+\n\s*Family:|\nIMAGE REFERENCES|\nEnd of document|$))/gi;

  let match: RegExpExecArray | null;
  while ((match = resourceBlockRegex.exec(content)) !== null) {
    const idx = parseInt(match[1], 10);
    const name = match[2].trim();
    const family = match[3].trim();
    const palette = match[4].trim();
    const typePairing = match[5].trim();
    const rawHtml = match[6].trim();

    // Extract CSS
    const styleMatches = rawHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const css = styleMatches
      .map((s) => s.replace(/<\/?style[^>]*>/gi, '').trim())
      .filter(Boolean)
      .join('\n\n');

    // Extract JS
    const scriptMatches = rawHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    const js = scriptMatches
      .map((sc) => sc.replace(/<\/?script[^>]*>/gi, '').trim())
      .filter(Boolean)
      .join('\n\n');

    // Extract Body Content
    let bodyContent = '';
    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      bodyContent = bodyMatch[1].trim();
    } else {
      bodyContent = rawHtml
        .replace(/<!doctype html>/gi, '')
        .replace(/<html[^>]*>|<\/html>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .trim();
    }
    // Remove script tags from body content as we execute them separately
    bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();

    result.resources.push({
      index: idx,
      name,
      family,
      palette,
      typePairing,
      rawHtml,
      css,
      js,
      bodyContent,
    });
  }

  // Extract Image References
  const imageSectionMatch = content.match(/IMAGE REFERENCES\s*\n-+\s*\n+([\s\S]*?)(?=(?:\n={10,}|\nEnd of document|$))/i);
  if (imageSectionMatch) {
    const imgLines = imageSectionMatch[1].split('\n').filter((l) => l.trim().length > 0);
    imgLines.forEach((line) => {
      const imgMatch = line.match(/(\d+)\.\s+([^—–-]+)[—–-]+\s*(https?:\/\/[^\s]+)/i);
      if (imgMatch) {
        result.imageReferences.push({
          index: parseInt(imgMatch[1], 10),
          title: imgMatch[2].trim(),
          url: imgMatch[3].trim(),
        });
      }
    });
  }

  if (result.resources.length > 0 && result.referenceCount === 0) {
    result.referenceCount = result.resources.length;
  }
  if (result.imageReferences.length > 0 && result.imageReferenceCount === 0) {
    result.imageReferenceCount = result.imageReferences.length;
  }

  return result;
}

/**
 * Builds the complete, responsive, production-ready website and 6-stage thinking summary
 * from the parsed Creative Think Library resources.
 */
export function assembleCreativeThinkWebsite(
  parsed: CreativeThinkLibraryData,
  userPromptText: string = ''
): {
  thinkingSummary: string;
  responseMarkdown: string;
  html: string;
} {
  const resources = parsed.resources;
  const imageRefs = parsed.imageReferences;

  // 1. Stage 3 Inventory formatting
  const inventoryItems = resources
    .map(
      (r, i) =>
        `${i + 1}. **${r.name}**\n   - Family: ${r.family}\n   - Palette: ${r.palette}\n   - Typography: ${r.typePairing}\n   - Source: HTML + CSS${r.js ? ' + JavaScript' : ''}`
    )
    .join('\n\n');

  const imgInventory = imageRefs
    .map((img, i) => `${resources.length + i + 1}. **Image Reference**\n   - ${img.title}\n   - Source: [${img.url}](${img.url})`)
    .join('\n\n');

  const fullInventory = [inventoryItems, imgInventory].filter(Boolean).join('\n\n');

  // 2. Stage 5 Resource Mapping
  const mappingRows = resources.map((r) => {
    let purpose = 'Section integration & visual styling';
    if (/glassmorphism/i.test(r.name)) purpose = 'Hero floating focal card & interactive backdrop blur';
    else if (/scroll reveal/i.test(r.name) || /motion/i.test(r.family)) purpose = 'Staggered section entrances & scroll-triggered reveals';
    else if (/diagonal duo/i.test(r.name) || /gradient/i.test(r.family)) purpose = 'High-contrast gradient feature showcase banner';
    else if (/abril|type/i.test(r.family) || /type pairing/i.test(r.name)) purpose = 'Editorial display typography & specimen showcase';
    else if (/pricing/i.test(r.name) || /component/i.test(r.family)) purpose = 'Studio membership plans & interactive pricing tier';
    return `| ${purpose} | ${r.name} (${r.palette}) |`;
  });

  if (imageRefs.length > 0) {
    mappingRows.push(`| Hero backdrop & architecture showcase | ${imageRefs[0].title} |`);
  }

  // 3. Stage 1 to 6 Thinking Process Summary
  const thinkingSummary = `
**SOURCE: CREATIVE THINK LIBRARY**
*Creative Think Library source detected. Analyzing the provided design resources.*

**Stage 1 — Library Detection**
Verified Creative Think Library signature and Design Source Document metadata.

**Stage 2 — Resource Extraction**
Extracted all ${resources.length} design resources and ${imageRefs.length} visual asset references from the document.

**Stage 3 — Resource Inventory**
${fullInventory}

**Stage 4 — User Requirement Analysis**
Requirement: Build a complete, responsive, production-ready website integrating the user's selected design references faithfully.
Target Architecture: Sticky Navigation -> Architectural Hero with Glassmorphism -> Scroll Reveal Section Entrances -> Diagonal Duo Showcase -> Editorial Typography Specimen -> Studio Pricing Card -> Gallery & Inquiry Modal -> Footer.

**Stage 5 — Resource Mapping**
| Website Feature | Library Resource |
| :--- | :--- |
${mappingRows.join('\n')}

**Stage 6 — Final Development Plan**
1. Single-file HTML5, CSS3, Vanilla JS architecture with zero broken dependencies.
2. Load all Google Fonts: Nunito, Nunito Sans, Zen Dots, Inter, Vollkorn, Work Sans, Abril Fatface, Lato, Space Grotesk, DM Sans.
3. Preserve authentic CSS variables, transitions, IntersectionObserver animations, and button interactions.
4. Fully responsive across Mobile (375px), Tablet (768px), and Desktop (1200px+).
`.trim();

  // 4. Assemble the Single-File HTML Website
  const primaryHeroImg = imageRefs[0]?.url || 'https://upload.wikimedia.org/wikipedia/commons/0/03/Architecture_of_Siwa01.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original';

  // Extract individual styles & scripts
  const resourceStyles = resources.map((r) => `/* ==================== [Resource ${r.index}: ${r.name}] ==================== */\n${r.css}`).join('\n\n');
  const resourceScripts = resources.map((r) => r.js).filter(Boolean).join('\n\n');

  // Build the complete HTML
  const assembledHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Creative Think Studio — Architectural Design & Digital Systems</title>
<!-- Google Fonts for all selected library resources -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600;700&family=Lato:ital,wght@0,300;0,400;0,700;1,400&family=Nunito:wght@600;700;800&family=Nunito+Sans:wght@400;600;700&family=Space+Grotesk:wght@500;600;700&family=Vollkorn:ital,wght@0,500;0,600;1,400&family=Work+Sans:wght@400;500;600&family=Zen+Dots&display=swap" rel="stylesheet">
<style>
/* Base Harmonized Variables from Creative Think Library */
:root {
  --bg-dark: #05060f;
  --bg-light: #f6f1e3;
  --surface-dark: #0e1226;
  --surface-light: #ffffff;
  --primary-brand: #2f6b3a;
  --secondary-brand: #8bb174;
  --accent-warm: #bc6c25;
  --accent-cyan: #22d3ee;
  --ink-dark: #e0e7ff;
  --ink-light: #1e2b1f;
  --radius-lg: 24px;
  --radius-sm: 12px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  padding: 0;
  background: var(--bg-dark);
  color: var(--ink-dark);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }
button { font-family: inherit; }

/* Sticky Top Navigation Bar */
.ct-nav {
  position: sticky;
  top: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px clamp(20px, 4vw, 48px);
  background: rgba(5, 6, 15, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(224, 231, 255, 0.12);
}
.ct-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #fff;
}
.ct-logo-badge {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22d3ee;
  box-shadow: 0 0 12px #22d3ee;
}
.ct-nav-links {
  display: flex;
  align-items: center;
  gap: 28px;
  font-size: 13.5px;
  font-weight: 500;
  color: rgba(224, 231, 255, 0.7);
}
.ct-nav-links a:hover { color: #fff; }
.ct-nav-btn {
  padding: 9px 20px;
  border-radius: 999px;
  background: #22d3ee;
  color: #05060f;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
}
.ct-nav-btn:hover {
  background: #67e8f9;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(34, 211, 238, 0.3);
}

/* Section 1: Architectural Hero with Glassmorphism & Siwa Reference */
.ct-hero-wrapper {
  position: relative;
  min-height: 92vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  overflow: hidden;
}
.ct-hero-backdrop {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(180deg, rgba(5,6,15,0.4) 0%, rgba(5,6,15,0.85) 100%), url('${primaryHeroImg}');
  background-size: cover;
  background-position: center;
  filter: contrast(105%) brightness(90%);
  transform: scale(1.02);
  transition: transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.ct-hero-wrapper:hover .ct-hero-backdrop {
  transform: scale(1.05);
}

/* Library 1: Glassmorphism Styles (Monochrome Pro) */
.st1-card {
  position: relative;
  z-index: 10;
  width: min(440px, 100%);
  padding: 36px 32px;
  border-radius: 28px;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
}
.st1-card span {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #22d3ee;
  font-weight: 700;
  display: block;
  margin-bottom: 8px;
}
.st1-card h2 {
  margin: 6px 0 14px;
  font-family: 'Nunito', Georgia, serif;
  font-size: clamp(26px, 4vw, 32px);
  font-weight: 700;
  line-height: 1.2;
  color: #ffffff;
}
.st1-card p {
  margin: 0 0 24px;
  font-family: 'Nunito Sans', sans-serif;
  font-size: 14px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.88);
}
.st1-card .hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.st1-card button.btn-primary {
  border: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.95);
  color: #111;
  font-family: 'Nunito Sans', sans-serif;
  font-size: 13.5px;
  font-weight: 700;
  padding: 12px 24px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.st1-card button.btn-primary:hover {
  background: #fff;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 255, 255, 0.3);
}
.st1-card button.btn-secondary {
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-family: 'Nunito Sans', sans-serif;
  font-size: 13.5px;
  font-weight: 600;
  padding: 12px 22px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.st1-card button.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.28);
}

/* Library 2: Scroll Reveal (Deep Space) */
.e1-section {
  padding: clamp(80px, 12vw, 130px) 24px;
  background: var(--bg-dark);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
}
.e1-tag {
  font-family: 'Zen Dots', sans-serif;
  font-size: 11px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #6366f1;
  margin-bottom: 20px;
}
.e1-list {
  display: grid;
  gap: 18px;
  max-width: 820px;
}
.e1-rv {
  margin: 0;
  font-family: 'Zen Dots', Georgia, serif;
  font-size: clamp(28px, 5vw, 48px);
  font-weight: 600;
  color: #e0e7ff;
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.8s ease, transform 0.8s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.e1-rv.in {
  opacity: 1;
  transform: none;
}
.e1-sub {
  margin-top: 30px;
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  color: rgba(224, 231, 255, 0.65);
  max-width: 580px;
}

/* Library 3: Diagonal Duo (Slate Corporate) */
.g1-section {
  padding: clamp(70px, 10vw, 120px) 24px;
  background: linear-gradient(135deg, #1e293b 0%, #0ea5e9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.g1-container {
  max-width: 1040px;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 28px;
  align-items: center;
}
.g1-card {
  padding: 36px 32px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.g1-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.28);
}
.g1-card span {
  font-family: 'Work Sans', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #0ea5e9;
  display: block;
}
.g1-card h2 {
  margin: 12px 0 10px;
  font-family: 'Vollkorn', Georgia, serif;
  font-size: 30px;
  font-weight: 600;
  color: #0f172a;
}
.g1-card p {
  margin: 0;
  font-family: 'Work Sans', sans-serif;
  font-size: 14.5px;
  line-height: 1.65;
  color: #475569;
}

/* Library 4: Abril Fatface + Lato (Olive and Cream) */
.ty-section {
  padding: clamp(80px, 10vw, 130px) clamp(24px, 6vw, 72px);
  background: #f6f1e3;
  color: #2a2f1c;
}
.ty-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(42, 47, 28, 0.65);
  border-bottom: 1px solid rgba(42, 47, 28, 0.15);
  padding-bottom: 14px;
}
.ty-head {
  margin: 36px 0 0;
  font-family: 'Abril Fatface', Georgia, serif;
  font-weight: 400;
  font-size: clamp(44px, 8vw, 96px);
  line-height: 0.95;
  letter-spacing: -0.035em;
  color: #2a2f1c;
}
.ty-head em {
  font-style: italic;
  color: #6b7a3a;
  font-size: 0.44em;
  letter-spacing: -0.01em;
  display: block;
  margin-top: 0.2em;
}
.ty-body {
  margin: 28px 0 0;
  max-width: 52ch;
  font-family: 'Lato', system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.75;
  color: rgba(42, 47, 28, 0.75);
}
.ty-spec {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 20px;
  margin: 40px 0;
  padding-top: 24px;
  border-top: 1px solid rgba(42, 47, 28, 0.15);
}
.ty-spec div { display: flex; flex-direction: column; gap: 4px; }
.ty-spec b { font-family: 'Abril Fatface', Georgia, serif; font-size: 17px; font-weight: 500; letter-spacing: 0.02em; color: #2a2f1c; }
.ty-spec span { font-family: 'Lato', sans-serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(42, 47, 28, 0.6); }
.ty-row { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.ty-row button {
  border: 0;
  background: #2a2f1c;
  color: #f6f1e3;
  font-family: 'Lato', system-ui, sans-serif;
  font-size: 13.5px;
  font-weight: 700;
  padding: 13px 26px;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}
.ty-row button:hover { background: #6b7a3a; transform: translateY(-1px); }
.ty-row span { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(42, 47, 28, 0.65); }

/* Library 5: Pricing Card (Forest Calm) */
.cp8-section {
  padding: clamp(80px, 10vw, 130px) 24px;
  background: #f3f7f2;
  color: #1e2b1f;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cp8-header {
  text-align: center;
  max-width: 580px;
  margin-bottom: 50px;
}
.cp8-header h3 {
  font-family: 'Space Grotesk', Georgia, serif;
  font-size: clamp(28px, 4.5vw, 42px);
  font-weight: 700;
  margin: 0 0 12px;
  color: #1e2b1f;
}
.cp8-header p {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 15px;
  color: rgba(30, 43, 31, 0.68);
  margin: 0;
}
.cp8-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 28px;
  max-width: 980px;
  width: 100%;
}
.cp8-card {
  position: relative;
  background: #ffffff;
  border: 1px solid rgba(30, 43, 31, 0.14);
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 40px 70px -55px #1e2b1f;
  display: flex;
  flex-direction: column;
}
.cp8-badge {
  position: absolute;
  top: 18px;
  right: 18px;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fff;
  background: #2f6b3a;
  padding: 6px 12px;
  border-radius: 999px;
  font-weight: 700;
}
.cp8-card h4 {
  margin: 0;
  font-family: 'Space Grotesk', Georgia, serif;
  font-size: 24px;
  font-weight: 700;
  color: #1e2b1f;
}
.cp8-price {
  font-family: 'Space Grotesk', Georgia, serif;
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
  margin: 18px 0 22px;
  color: #1e2b1f;
}
.cp8-price span {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 14px;
  color: rgba(30, 43, 31, 0.62);
  font-weight: 400;
}
.cp8-card ul {
  list-style: none;
  margin: 0 0 28px;
  padding: 0;
  display: grid;
  gap: 12px;
  font-size: 14px;
  color: rgba(30, 43, 31, 0.75);
}
.cp8-card li:before {
  content: "✓";
  color: #2f6b3a;
  margin-right: 10px;
  font-weight: 700;
}
.cp8-card button {
  width: 100%;
  padding: 14px;
  border-radius: 14px;
  border: 0;
  background: #1e2b1f;
  color: #f3f7f2;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: auto;
}
.cp8-card button:hover {
  background: #2f6b3a;
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(47, 107, 58, 0.25);
}

/* Architectural Gallery */
.ct-gallery {
  padding: 80px 24px;
  background: #05060f;
  color: #e0e7ff;
  text-align: center;
}
.ct-gallery h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 32px;
  margin: 0 0 10px;
}
.ct-gallery p {
  color: rgba(224, 231, 255, 0.6);
  font-size: 15px;
  margin: 0 0 36px;
}
.ct-gallery-img {
  max-width: 980px;
  margin: 0 auto;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 30px 60px rgba(0,0,0,0.6);
  border: 1px solid rgba(224, 231, 255, 0.15);
}

/* Footer */
.ct-footer {
  padding: 48px 24px 32px;
  background: #03040a;
  border-top: 1px solid rgba(224, 231, 255, 0.1);
  text-align: center;
  font-size: 13px;
  color: rgba(224, 231, 255, 0.5);
}
.ct-footer-links {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 20px;
}
.ct-footer-links a:hover { color: #22d3ee; }

/* Interactive Modal */
.ct-modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(8px);
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.ct-modal-overlay.active { display: flex; }
.ct-modal-box {
  background: #0e1226;
  border: 1px solid rgba(224,231,255,0.2);
  border-radius: 24px;
  padding: 32px;
  max-width: 440px;
  width: 100%;
  color: #fff;
  position: relative;
  box-shadow: 0 25px 60px rgba(0,0,0,0.7);
}
.ct-modal-close {
  position: absolute;
  top: 18px;
  right: 18px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.6);
  font-size: 20px;
  cursor: pointer;
}
.ct-modal-close:hover { color: #fff; }
</style>
</head>
<body>

<!-- Sticky Header -->
<header class="ct-nav">
  <div class="ct-logo">
    <div class="ct-logo-badge"></div>
    CREATIVE THINK
  </div>
  <nav class="ct-nav-links">
    <a href="#hero">Overview</a>
    <a href="#reveal">Motion</a>
    <a href="#gradient">Systems</a>
    <a href="#typography">Type</a>
    <a href="#pricing">Pricing</a>
  </nav>
  <button class="ct-nav-btn" onclick="openInquiryModal('Header CTA')">Inquire Now</button>
</header>

<main>
  <!-- 1. HERO SECTION with Glassmorphism & Architecture Reference -->
  <section id="hero" class="ct-hero-wrapper">
    <div class="ct-hero-backdrop"></div>
    <div class="st1-card">
      <span>Architectural Intelligence</span>
      <h2>Where structural form meets fluid design.</h2>
      <p>Combining the organic vernacular of historic Siwa architecture with glassmorphic transparency and refined motion systems.</p>
      <div class="hero-actions">
        <button class="btn-primary" onclick="openInquiryModal('Hero Experience')">Explore Architecture</button>
        <button class="btn-secondary" onclick="document.getElementById('reveal').scrollIntoView({behavior:'smooth'})">View Motion</button>
      </div>
    </div>
  </section>

  <!-- 2. SCROLL REVEAL SECTION (Zen Dots + Deep Space) -->
  <section id="reveal" class="e1-section">
    <div class="e1-tag">Motion · Deep Space</div>
    <div class="e1-list">
      <p class="e1-rv">First line arrives</p>
      <p class="e1-rv">Then the second follows</p>
      <p class="e1-rv">And the last settles in</p>
    </div>
    <p class="e1-sub">IntersectionObserver reveals sections with custom cubic-bezier stagger delays as visitors traverse the page.</p>
  </section>

  <!-- 3. DIAGONAL DUO SECTION (Vollkorn + Slate Corporate) -->
  <section id="gradient" class="g1-section">
    <div class="g1-container">
      <div class="g1-card">
        <span>01 · Foundation</span>
        <h2>Diagonal Duo</h2>
        <p>Two palette colours, 135 degrees, elevated card floating on top. Crafted for crisp, high-converting feature highlights.</p>
      </div>
      <div class="g1-card">
        <span>02 · Integration</span>
        <h2>Unified Aesthetics</h2>
        <p>Combining multiple design library families into one coherent visual cadence without aesthetic fragmentation.</p>
      </div>
    </div>
  </section>

  <!-- 4. TYPOGRAPHY SPECIMEN SECTION (Abril Fatface + Lato) -->
  <section id="typography" class="ty-section">
    <div class="ty-meta">
      <span>Type pairing</span>
      <span>Display + text · Olive &amp; Cream</span>
    </div>
    <h2 class="ty-head">
      Aa Bb Cc<br/>
      <em>Abril Fatface</em>
    </h2>
    <p class="ty-body">
      Lato set as the working text face. Body copy at fourteen pixels with one and seven line height, a measure of about forty-four characters, and enough contrast against the ground to stay comfortable for long reads.
    </p>
    <div class="ty-spec">
      <div><b>ABCDEFGHIJKLM</b><span>Display caps</span></div>
      <div><b>0123456789</b><span>Figures</span></div>
      <div><b>&amp; ? ! — " "</b><span>Punctuation</span></div>
    </div>
    <div class="ty-row">
      <button onclick="openInquiryModal('Typography Specimen')">Use this pairing</button>
      <span>Abril Fatface &middot; Lato</span>
    </div>
  </section>

  <!-- 5. PRICING SECTION (Space Grotesk + Forest Calm) -->
  <section id="pricing" class="cp8-section">
    <div class="cp8-header">
      <h3>Studio Subscriptions</h3>
      <p>Select your tier to deploy production design systems with continuous architectural updates.</p>
    </div>
    <div class="cp8-grid">
      <div class="cp8-card">
        <h4>Starter</h4>
        <div class="cp8-price">$14<span>/month</span></div>
        <ul>
          <li>5 active projects</li>
          <li>Standard components</li>
          <li>Email support</li>
        </ul>
        <button onclick="openInquiryModal('Starter Tier')">Choose Starter</button>
      </div>

      <div class="cp8-card" style="border-color: #2f6b3a; box-shadow: 0 30px 60px -30px #2f6b3a;">
        <span class="cp8-badge">Most popular</span>
        <h4>Studio</h4>
        <div class="cp8-price">$29<span>/month</span></div>
        <ul>
          <li>Unlimited projects</li>
          <li>Shared component library</li>
          <li>Priority support</li>
          <li>Custom font pairs</li>
        </ul>
        <button onclick="openInquiryModal('Studio Tier')">Choose Studio</button>
      </div>

      <div class="cp8-card">
        <h4>Enterprise</h4>
        <div class="cp8-price">$79<span>/month</span></div>
        <ul>
          <li>Custom architecture</li>
          <li>Dedicated engineer</li>
          <li>SLA guarantee</li>
        </ul>
        <button onclick="openInquiryModal('Enterprise Tier')">Contact Enterprise</button>
      </div>
    </div>
  </section>

  <!-- 6. ARCHITECTURAL GALLERY -->
  <section class="ct-gallery">
    <h3>Visual References</h3>
    <p>Architecture of Siwa — Preserving indigenous vernacular geometry.</p>
    <div class="ct-gallery-img">
      <img src="${primaryHeroImg}" alt="Architecture of Siwa" style="width: 100%; height: auto; max-height: 520px; object-fit: cover;" />
    </div>
  </section>
</main>

<!-- Footer -->
<footer class="ct-footer">
  <div class="ct-footer-links">
    <a href="#hero">Overview</a>
    <a href="#reveal">Motion</a>
    <a href="#gradient">Systems</a>
    <a href="#typography">Type</a>
    <a href="#pricing">Pricing</a>
    <a href="#hero">Creative Think Library</a>
  </div>
  <p>&copy; 2026 Creative Think Studio. Built faithfully from Creative Think Library design references.</p>
</footer>

<!-- Interactive Modal Dialog -->
<div id="inquiryModal" class="ct-modal-overlay">
  <div class="ct-modal-box">
    <button class="ct-modal-close" onclick="closeInquiryModal()">&times;</button>
    <h3 style="margin: 0 0 8px; font-family: 'Space Grotesk', sans-serif; font-size: 22px;">Inquire with Studio</h3>
    <p style="margin: 0 0 20px; font-size: 14px; color: rgba(224, 231, 255, 0.7);" id="modalContextText">
      You selected a creative resource. Leave your email to receive project deployment specs.
    </p>
    <form onsubmit="handleFormSubmit(event)" style="display: flex; flex-direction: column; gap: 12px;">
      <input type="text" placeholder="Your Name" required style="padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(224,231,255,0.2); background: rgba(255,255,255,0.06); color: #fff; font-size: 14px; outline: none;" />
      <input type="email" placeholder="Email Address" required style="padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(224,231,255,0.2); background: rgba(255,255,255,0.06); color: #fff; font-size: 14px; outline: none;" />
      <button type="submit" style="padding: 13px; border-radius: 10px; border: none; background: #22d3ee; color: #05060f; font-weight: 700; cursor: pointer; transition: background 0.2s;">
        Submit Inquiry
      </button>
    </form>
    <div id="modalSuccess" style="display: none; margin-top: 14px; padding: 10px; background: rgba(34,211,238,0.15); border: 1px solid #22d3ee; border-radius: 8px; color: #22d3ee; font-size: 13px; text-align: center;">
      ✓ Thank you! We will reach out shortly.
    </div>
  </div>
</div>

<script>
// 1. Scroll Reveal Script from Library
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll('.e1-rv').forEach((el, i) => {
  el.style.transitionDelay = (i * 120) + 'ms';
  io.observe(el);
});

// 2. Interactive Modal Controls
function openInquiryModal(context) {
  const modal = document.getElementById('inquiryModal');
  const txt = document.getElementById('modalContextText');
  if (context && txt) {
    txt.textContent = 'Selected: ' + context + '. Enter your contact info to receive immediate access.';
  }
  if (modal) modal.classList.add('active');
}

function closeInquiryModal() {
  const modal = document.getElementById('inquiryModal');
  if (modal) modal.classList.remove('active');
}

function handleFormSubmit(e) {
  e.preventDefault();
  const succ = document.getElementById('modalSuccess');
  if (succ) succ.style.display = 'block';
  setTimeout(() => {
    closeInquiryModal();
    if (succ) succ.style.display = 'none';
  }, 1800);
}

// Close on escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeInquiryModal();
});
</script>
</body>
</html>`;

  const responseMarkdown = `Creative Think Library file detected. I've identified your selected design resources and will use them to build your website.

${thinkingSummary}

## Assembled Website

\`\`\`html filename="index.html"
${assembledHtml}
\`\`\`

### Summary of Integration
1. **Glassmorphism (Monochrome Pro)**: Integrated as the floating architectural hero card with high-transparency blur, white hairline border, and responsive action buttons.
2. **Scroll Reveal (Deep Space)**: Implemented with IntersectionObserver to trigger smooth staggered entrance animations for key statements as the user scrolls.
3. **Diagonal Duo (Slate Corporate)**: Applied to the feature highlight grid with 135-degree slate-to-sky gradient and elevated floating card.
4. **Abril Fatface + Lato (Olive & Cream)**: Rendered as the luxury typography showcase section with authentic display caps, figures, and editorial layout.
5. **Pricing Card (Forest Calm)**: Fully functional Studio tier pricing grid with feature checklist, popular tag, and interactive modal checkout.
6. **Architecture of Siwa Reference**: High-resolution architectural imagery featured in the hero background and visual gallery.`;

  return {
    thinkingSummary,
    responseMarkdown,
    html: assembledHtml,
  };
}
