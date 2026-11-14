/**
 * Parser for the v2 website designer "Option N" theme blocks.
 * The AI emits 4 theme options in this shape:
 *
 * **Option 1 - Midnight Luxe**
 * - Mood: elegant, premium
 * - Colors: 🟦 Primary `#c9a24b` | 🟪 Secondary `#6d5dfc` | ...
 * - Style: Dark Luxe Gold
 * - Typography: Cormorant Garamond + Montserrat
 * - Why it fits: ...
 *
 * The chat UI renders them as interactive swatch cards; clicking one sends
 * "I choose Option N". The parser returns the cleaned text without the raw
 * markdown blocks so the answer is not duplicated.
 */

export interface ThemeOptionColor {
  label: string;
  hex: string;
}

export interface ThemeOption {
  index: number;
  name: string;
  mood?: string;
  colors: ThemeOptionColor[];
  style?: string;
  typography?: string;
  whyItFits?: string;
}

export interface ParsedThemeOptions {
  options: ThemeOption[];
  /** Raw text with the option blocks (and the trailing question line) removed. */
  cleanedText: string;
}

const HEADING_RE = /\*\*Option\s*(\d+)\s*[-–—]\s*([^*\n]+)\*\*/g;
const FIELD_RE = /^[-*]\s*\**\s*(Mood|Colors|Style|Typography|Why it fits|Why)\s*\**\s*:\s*(.+)$/gim;
const LABELED_HEX_RE = /([A-Za-z][\w/-]*)\s*`#([0-9a-fA-F]{3,8})`/g;
const BARE_HEX_RE = /#([0-9a-fA-F]{6})\b/g;
const TRAILING_QUESTION_RE = /^\s*Which theme do you prefer[^\n]*$/gim;

function parseColors(line: string): ThemeOptionColor[] {
  const colors: ThemeOptionColor[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  LABELED_HEX_RE.lastIndex = 0;
  while ((m = LABELED_HEX_RE.exec(line)) !== null) {
    const hex = `#${m[2]!.toLowerCase()}`;
    if (seen.has(hex)) continue;
    seen.add(hex);
    const label = m[1]!.replace(/_/g, ' ').trim();
    colors.push({ label: label.charAt(0).toUpperCase() + label.slice(1), hex });
  }
  if (colors.length === 0) {
    BARE_HEX_RE.lastIndex = 0;
    while ((m = BARE_HEX_RE.exec(line)) !== null) {
      const hex = `#${m[1]!.toLowerCase()}`;
      if (seen.has(hex)) continue;
      seen.add(hex);
      colors.push({ label: `Color ${colors.length + 1}`, hex });
    }
  }
  return colors;
}

/**
 * Extracts theme options from AI text. Returns null when fewer than two
 * options with at least three colors each are present (not a theme menu).
 */
export function parseThemeOptions(rawText: string): ParsedThemeOptions | null {
  if (!rawText) return null;

  const headings: Array<{ index: number; name: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  HEADING_RE.lastIndex = 0;
  while ((m = HEADING_RE.exec(rawText)) !== null) {
    headings.push({ index: parseInt(m[1], 10), name: m[2].trim(), start: m.index, end: m.index + m[0].length });
  }
  if (headings.length < 2) return null;

  // Ignore code fences: option headings inside ``` blocks are not UI options.
  const fenceRanges: Array<[number, number]> = [];
  const fenceRe = /```[\s\S]*?(?:```|$)/g;
  let f: RegExpExecArray | null;
  while ((f = fenceRe.exec(rawText)) !== null) fenceRanges.push([f.index, f.index + f[0].length]);
  const inFence = (pos: number) => fenceRanges.some(([s, e]) => pos >= s && pos < e);
  const usable = headings.filter((h) => !inFence(h.start));
  if (usable.length < 2) return null;

  const options: ThemeOption[] = [];
  for (let i = 0; i < usable.length; i++) {
    const h = usable[i]!;
    const next = usable[i + 1];
    const blockEnd = next ? next.start : rawText.length;
    const block = rawText.slice(h.end, blockEnd);

    const fields: Record<string, string> = {};
    FIELD_RE.lastIndex = 0;
    let fm: RegExpExecArray | null;
    while ((fm = FIELD_RE.exec(block)) !== null) {
      const key = fm[1] === 'Why' ? 'Why it fits' : fm[1]!;
      if (!fields[key]) fields[key] = fm[2]!.trim();
    }

    const colors = parseColors(fields['Colors'] || '');
    const option: ThemeOption = { index: h.index, name: h.name, colors };
    if (fields['Mood']) option.mood = fields['Mood'];
    if (fields['Style']) option.style = fields['Style'];
    if (fields['Typography']) option.typography = fields['Typography'];
    if (fields['Why it fits']) option.whyItFits = fields['Why it fits'];
    options.push(option);
  }

  const valid = options.filter((o) => o.colors.length >= 3);
  if (valid.length < 2) return null;

  // Remove the raw markdown: everything from the first option heading through
  // the end of the last option block, plus the trailing preference question.
  const first = usable[0]!.start;
  const lastEnd = rawText.length; // last block runs to end of text by definition
  let cleaned = rawText.slice(0, first) + rawText.slice(lastEnd);
  cleaned = cleaned.replace(TRAILING_QUESTION_RE, '');
  // Also drop a question line that directly preceded the options.
  cleaned = cleaned.replace(/[^\n]*Which theme do you prefer[^\n]*/gi, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return { options: valid, cleanedText: cleaned };
}
