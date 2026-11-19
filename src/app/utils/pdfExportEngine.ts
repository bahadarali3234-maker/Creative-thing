import { jsPDF } from 'jspdf';

export type PdfContentCategory =
  | 'mcq'
  | 'short_qa'
  | 'long_qa'
  | 'study_notes'
  | 'chapter_summary'
  | 'educational_explanation'
  | 'general_chat'
  | 'professional_document'
  | 'programming_explanation'
  | 'mixed_educational';

export type McqAnswerMode =
  | 'questions_only'
  | 'with_answers'
  | 'with_explanations'
  | 'separate_answer_key';

export type PdfTheme = 'light' | 'dark' | 'printer';
export type PdfPageSize = 'a4' | 'letter';

export interface McqOption {
  label: string;
  text: string;
}

export interface ParsedMcqItem {
  number: number;
  question: string;
  options: McqOption[];
  correctAnswer?: string;
  explanation?: string;
}

export interface ParsedQaItem {
  number: number;
  kind: 'short' | 'long';
  question: string;
  answer: string;
}

export type ParsedDocBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'ordered_list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'code_block'; language: string; code: string; isPrompt?: boolean }
  | { type: 'callout'; title?: string; text: string };

export interface ClassifiedPdfDocument {
  title: string;
  detectedCategory: PdfContentCategory;
  categoryLabel: string;
  mcqs: ParsedMcqItem[];
  qaPairs: ParsedQaItem[];
  blocks: ParsedDocBlock[];
  rawCodeBlockCount: number;
  hasUnicodeScript: boolean;
  stats: {
    mcqCount: number;
    shortQaCount: number;
    longQaCount: number;
    sectionCount: number;
    codeBlockCount: number;
    wordCount: number;
  };
}

export interface PdfExportOptions {
  categoryOverride?: PdfContentCategory | 'auto';
  mcqAnswerMode: McqAnswerMode;
  includeCode: boolean;
  theme: PdfTheme;
  pageSize: PdfPageSize;
  title?: string;
  authorName?: string;
}

export const CATEGORY_LABELS: Record<PdfContentCategory, string> = {
  mcq: 'MCQs & Practice Test',
  short_qa: 'Short Questions & Answers',
  long_qa: 'Long Descriptive Q&A',
  study_notes: 'Structured Study Notes',
  chapter_summary: 'Chapter Summary',
  educational_explanation: 'Educational Guide',
  general_chat: 'Conversation Report',
  professional_document: 'Professional Brief',
  programming_explanation: 'Technical Explanation',
  mixed_educational: 'Mixed Educational Pack',
};

function hasComplexUnicode(text: string): boolean {
  // Detects Arabic/Urdu/Persian, CJK, Cyrillic, Devanagari, or non-Latin1 characters
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0900-\u097F\u4E00-\u9FFF\u0400-\u04FF]/.test(
    text
  );
}

function isRtlScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

function normalizeLatinPunctuation(text: string): string {
  return String(text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, ' - ')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2260/g, '!=')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '');
}

function stripMarkdownFormatting(text: string): string {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^\s{0,3}>+\s?/gm, '')
    .trim();
}

function structuredContentToMarkdown(sc: any): string {
  if (!sc || typeof sc !== 'object') return '';
  const parts: string[] = [];
  const rawTitle = sc.mainTitle;
  const titleStr =
    typeof rawTitle === 'string'
      ? rawTitle
      : rawTitle && (rawTitle.white || rawTitle.red)
      ? `${rawTitle.white || ''} ${rawTitle.red || ''}`.trim()
      : '';
  if (titleStr) parts.push(`# ${titleStr}`);
  if (sc.intro) parts.push(String(sc.intro));
  if (Array.isArray(sc.sections)) {
    for (const s of sc.sections) {
      if (s?.title) parts.push(`## ${s.title}`);
      if (s?.description) parts.push(String(s.description));
      if (Array.isArray(s?.bullets) && s.bullets.length > 0) {
        parts.push(s.bullets.map((b: string) => `- ${b}`).join('\n'));
      }
      if (s?.promptSnippet) {
        parts.push(`\`\`\`prompt\n${s.promptSnippet}\n\`\`\``);
      }
      if (s?.codeSnippet) {
        parts.push(`\`\`\`${s.codeLanguage || 'tsx'}\n${s.codeSnippet}\n\`\`\``);
      }
    }
  }
  return parts.join('\n\n');
}

function extractMcqsFromLines(lines: string[]): { mcqs: ParsedMcqItem[]; consumedIndices: Set<number> } {
  const mcqs: ParsedMcqItem[] = [];
  const consumed = new Set<number>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const qMatch =
      line.match(/^(?:\*\*)?(?:Q(?:uestion)?\s*#?\s*)?(\d{1,3})[.)\]:-]\s*(?:\*\*)?(.+)$/i) ||
      line.match(/^(?:\*\*)?Q(\d{1,3})\s*[:.-]\s*(.+)$/i);

    if (!qMatch) {
      i++;
      continue;
    }

    const qNum = Number(qMatch[1]) || mcqs.length + 1;
    let qText = stripMarkdownFormatting(qMatch[2]);
    let j = i + 1;

    // Collect multi-line stem up to first option
    while (j < lines.length) {
      const nextTrim = lines[j].trim();
      if (!nextTrim) {
        j++;
        continue;
      }
      if (/^(?:[-*•]\s*)?(?:\*\*)?[(\[]?[A-Ea-e][)\].:-]\s+/.test(nextTrim)) break;
      if (/^(?:\*\*)?(?:Q(?:uestion)?\s*#?\s*)?\d{1,3}[.)\]:-]\s+/i.test(nextTrim)) break;
      if (/^#{1,3}\s+/.test(nextTrim)) break;
      // Stop if we hit a direct Q/A answer line
      if (/^(?:\*\*)?(?:Ans(?:wer)?|Explanation)\s*[:.-]/i.test(nextTrim)) break;
      qText += ' ' + stripMarkdownFormatting(nextTrim);
      j++;
    }

    const options: McqOption[] = [];
    let correctAnswer: string | undefined;
    let explanation: string | undefined;

    while (j < lines.length) {
      const optLine = lines[j].trim();
      if (!optLine) {
        j++;
        continue;
      }
      const optMatch = optLine.match(/^(?:[-*•]\s*)?(?:\*\*)?[(\[]?([A-Ea-e])[)\].:-]\s*(?:\*\*)?(.+)$/);
      if (optMatch) {
        let optText = stripMarkdownFormatting(optMatch[2]);
        const inlineCorrect = /\((?:correct|answer)\)|✓|✔|\[correct\]/i.test(optText);
        optText = optText.replace(/\s*\((?:correct|answer)\)|\s*✓|\s*✔|\s*\[correct\]/gi, '').trim();
        const label = optMatch[1].toUpperCase();
        options.push({ label, text: optText });
        if (inlineCorrect && !correctAnswer) {
          correctAnswer = `${label}) ${optText}`;
        }
        j++;
        continue;
      }

      const ansMatch = optLine.match(/^(?:\*\*)?(?:Correct\s+)?Ans(?:wer)?\s*[:.-]\s*(?:\*\*)?(.+)$/i);
      if (ansMatch && options.length >= 2) {
        correctAnswer = stripMarkdownFormatting(ansMatch[1]);
        j++;
        continue;
      }

      const expMatch = optLine.match(/^(?:\*\*)?(?:Explanation|Rationale|Reason)\s*[:.-]\s*(?:\*\*)?(.+)$/i);
      if (expMatch && options.length >= 2) {
        explanation = stripMarkdownFormatting(expMatch[1]);
        j++;
        continue;
      }

      break;
    }

    if (options.length >= 2) {
      for (let k = i; k < j; k++) consumed.add(k);
      mcqs.push({
        number: qNum,
        question: qText,
        options,
        correctAnswer,
        explanation,
      });
      i = j;
    } else {
      i++;
    }
  }

  // Also parse standalone Answer Key block at bottom if individual MCQs lacked inline answers
  const answerKeyRegex = /^(?:#{1,3}\s*)?(?:Answer\s*Key|Correct\s*Answers)\s*:?$/i;
  const keyStart = lines.findIndex((l) => answerKeyRegex.test(l.trim()));
  if (keyStart !== -1 && mcqs.length > 0) {
    consumed.add(keyStart);
    for (let k = keyStart + 1; k < lines.length; k++) {
      const t = lines[k].trim();
      if (!t) continue;
      if (/^#{1,3}\s+/.test(t)) break;
      const m = t.match(/^(?:[-*•]\s*)?(?:Q(?:uestion)?\s*)?(\d{1,3})[.)\]:-\s]+\s*([A-Ea-e])(?:[).:\s-]+(.*))?$/i);
      if (m) {
        const num = Number(m[1]);
        const target = mcqs.find((q) => q.number === num) || mcqs[num - 1];
        if (target && !target.correctAnswer) {
          const letter = m[2].toUpperCase();
          const matchedOpt = target.options.find((o) => o.label === letter);
          target.correctAnswer = matchedOpt ? `${letter}) ${matchedOpt.text}` : letter;
          if (m[3] && !target.explanation) {
            target.explanation = stripMarkdownFormatting(m[3]);
          }
        }
        consumed.add(k);
      }
    }
  }

  return { mcqs, consumedIndices: consumed };
}

function extractQaPairsFromLines(
  lines: string[],
  consumed: Set<number>
): { qaPairs: ParsedQaItem[]; newlyConsumed: Set<number> } {
  const qaPairs: ParsedQaItem[] = [];
  const newlyConsumed = new Set<number>();

  let i = 0;
  while (i < lines.length) {
    if (consumed.has(i)) {
      i++;
      continue;
    }
    const line = lines[i].trim();
    const qMatch = line.match(
      /^(?:\*\*)?(?:Q(?:uestion)?\s*#?\s*(\d{1,3})?|(\d{1,3})\.)\s*[:.-]?\s*(?:\*\*)?(.+\?)\s*(?:\*\*)?$/i
    );
    const explicitQ = line.match(/^(?:\*\*)?Q(?:uestion)?\s*(\d{1,3})?\s*[:.-]\s*(?:\*\*)?(.+)$/i);
    const matched = explicitQ || qMatch;

    if (!matched) {
      i++;
      continue;
    }

    const qNum = Number(matched[1] || matched[2]) || qaPairs.length + 1;
    const questionText = stripMarkdownFormatting(matched[matched.length - 1]);
    let j = i + 1;
    const answerLines: string[] = [];
    let foundExplicitAnswer = false;

    while (j < lines.length) {
      if (consumed.has(j)) break;
      const t = lines[j].trim();
      if (!t) {
        if (answerLines.length > 0) answerLines.push('');
        j++;
        continue;
      }
      if (/^#{1,3}\s+/.test(t)) break;
      if (/^(?:\*\*)?Q(?:uestion)?\s*(\d{1,3})?\s*[:.-]/i.test(t)) break;
      if (/^(?:\*\*)?\d{1,3}[.)]\s+.+\?/.test(t)) break;

      const ansMatch = t.match(/^(?:\*\*)?(?:A|Ans(?:wer)?)\s*[:.-]\s*(?:\*\*)?(.*)$/i);
      if (ansMatch) {
        foundExplicitAnswer = true;
        if (ansMatch[1]) answerLines.push(stripMarkdownFormatting(ansMatch[1]));
        j++;
        continue;
      }
      if (foundExplicitAnswer || answerLines.length > 0 || questionText.endsWith('?')) {
        answerLines.push(stripMarkdownFormatting(t.replace(/^[-*•]\s+/, '• ')));
        j++;
        continue;
      }
      break;
    }

    const cleanAnswer = answerLines.join('\n').trim();
    if (cleanAnswer.length >= 8) {
      for (let k = i; k < j; k++) newlyConsumed.add(k);
      const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length;
      qaPairs.push({
        number: qNum,
        kind: wordCount > 55 || cleanAnswer.includes('\n\n') ? 'long' : 'short',
        question: questionText,
        answer: cleanAnswer,
      });
      i = j;
    } else {
      i++;
    }
  }

  return { qaPairs, newlyConsumed };
}

function parseBlocksFromRemainingLines(lines: string[], consumed: Set<number>): ParsedDocBlock[] {
  const blocks: ParsedDocBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    if (consumed.has(i)) {
      i++;
      continue;
    }
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // Code fences (preserved so toggle works dynamically without re-parsing everything)
    const fenceStart = trimmed.match(/^```([a-zA-Z0-9_-]*)/);
    if (fenceStart) {
      const lang = (fenceStart[1] || 'text').toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({
        type: 'code_block',
        language: lang,
        code: codeLines.join('\n'),
        isPrompt: lang === 'prompt',
      });
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1].length) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: stripMarkdownFormatting(headingMatch[2]) });
      i++;
      continue;
    }

    // Tables
    if (trimmed.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1])) {
      const parseRow = (row: string) =>
        row
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => stripMarkdownFormatting(c.trim()));
      const headers = parseRow(trimmed);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes('|') && !consumed.has(i)) {
        rows.push(parseRow(lines[i].trim()));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Bullet lists
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim()) && !consumed.has(i)) {
        items.push(stripMarkdownFormatting(lines[i].trim().replace(/^[-*•]\s+/, '')));
        i++;
      }
      blocks.push({ type: 'bullet_list', items });
      continue;
    }

    // Ordered lists
    if (/^\d{1,3}[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d{1,3}[.)]\s+/.test(lines[i].trim()) && !consumed.has(i)) {
        items.push(stripMarkdownFormatting(lines[i].trim().replace(/^\d{1,3}[.)]\s+/, '')));
        i++;
      }
      blocks.push({ type: 'ordered_list', items });
      continue;
    }

    // Blockquote / Callout
    if (/^>\s+/.test(trimmed)) {
      const qLines: string[] = [];
      while (i < lines.length && /^>\s*/.test(lines[i].trim()) && !consumed.has(i)) {
        qLines.push(stripMarkdownFormatting(lines[i].trim().replace(/^>\s*/, '')));
        i++;
      }
      blocks.push({ type: 'callout', text: qLines.join(' ') });
      continue;
    }

    // Paragraph
    const pLines: string[] = [stripMarkdownFormatting(trimmed)];
    i++;
    while (i < lines.length && !consumed.has(i)) {
      const t = lines[i].trim();
      if (
        !t ||
        /^```/.test(t) ||
        /^#{1,3}\s+/.test(t) ||
        /^[-*•]\s+/.test(t) ||
        /^\d{1,3}[.)]\s+/.test(t) ||
        /^>\s+/.test(t)
      ) {
        break;
      }
      pLines.push(stripMarkdownFormatting(t));
      i++;
    }
    const merged = pLines.join(' ').trim();
    if (merged) {
      blocks.push({ type: 'paragraph', text: merged });
    }
  }

  return blocks;
}

export function classifyExportContent(
  rawMarkdown: string,
  structuredContent?: any,
  titleOverride?: string
): ClassifiedPdfDocument {
  const sourceMarkdown =
    (rawMarkdown && rawMarkdown.trim()) || structuredContentToMarkdown(structuredContent) || '';
  const lines = sourceMarkdown.split(/\r?\n/);

  // Extract fenced blocks count cleanly & mask code lines before scanning for MCQs/Q&A
  const maskedLines = [...lines];
  let inFence = false;
  let rawCodeBlockCount = 0;
  for (let idx = 0; idx < maskedLines.length; idx++) {
    if (maskedLines[idx].trim().startsWith('```')) {
      if (!inFence) {
        const lang = maskedLines[idx].trim().slice(3).trim().toLowerCase();
        if (lang !== 'prompt') rawCodeBlockCount++;
      }
      inFence = !inFence;
      maskedLines[idx] = '';
    } else if (inFence) {
      maskedLines[idx] = '';
    }
  }

  const { mcqs, consumedIndices: mcqConsumed } = extractMcqsFromLines(maskedLines);
  const { qaPairs, newlyConsumed: qaConsumed } = extractQaPairsFromLines(maskedLines, mcqConsumed);

  const allConsumed = new Set<number>([...mcqConsumed, ...qaConsumed]);
  const blocks = parseBlocksFromRemainingLines(lines, allConsumed);

  // Determine title cleanly
  const firstH1 = blocks.find((b) => b.type === 'heading' && b.level === 1);
  const resolvedTitle =
    (titleOverride && titleOverride.trim()) ||
    (firstH1 && firstH1.type === 'heading' ? firstH1.text : '') ||
    'Think Creative Document';

  const shortQaCount = qaPairs.filter((q) => q.kind === 'short').length;
  const longQaCount = qaPairs.filter((q) => q.kind === 'long').length;
  const sectionCount = blocks.filter((b) => b.type === 'heading').length;
  const lower = sourceMarkdown.toLowerCase();

  let detectedCategory: PdfContentCategory = 'general_chat';
  if (mcqs.length >= 2 && qaPairs.length >= 2) {
    detectedCategory = 'mixed_educational';
  } else if (mcqs.length >= 2) {
    detectedCategory = 'mcq';
  } else if (qaPairs.length >= 2) {
    detectedCategory = longQaCount > shortQaCount ? 'long_qa' : 'short_qa';
  } else if (/chapter summary|summary of chapter|key takeaways|chapter \d+/i.test(lower)) {
    detectedCategory = 'chapter_summary';
  } else if (
    rawCodeBlockCount >= 1 &&
    /(function|component|api|architecture|typescript|react|python|sql|algorithm)/i.test(lower)
  ) {
    detectedCategory = 'programming_explanation';
  } else if (
    sectionCount >= 2 &&
    blocks.some((b) => b.type === 'bullet_list') &&
    /(study|notes|revision|definition|concept|formula|exam|syllabus)/i.test(lower)
  ) {
    detectedCategory = 'study_notes';
  } else if (/(definition|example|step-by-step|learn|understand|concept|explained)/i.test(lower)) {
    detectedCategory = 'educational_explanation';
  } else if (/(proposal|executive summary|roadmap|specification|brief|milestone|report)/i.test(lower)) {
    detectedCategory = 'professional_document';
  }

  const wordCount = sourceMarkdown.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length;

  return {
    title: resolvedTitle,
    detectedCategory,
    categoryLabel: CATEGORY_LABELS[detectedCategory],
    mcqs,
    qaPairs,
    blocks,
    rawCodeBlockCount,
    hasUnicodeScript: hasComplexUnicode(sourceMarkdown),
    stats: {
      mcqCount: mcqs.length,
      shortQaCount,
      longQaCount,
      sectionCount,
      codeBlockCount: rawCodeBlockCount,
      wordCount,
    },
  };
}

interface ThemeColors {
  pageBg: [number, number, number];
  cardBg: [number, number, number];
  accent: [number, number, number];
  accentSoft: [number, number, number];
  textPrimary: [number, number, number];
  textSecondary: [number, number, number];
  border: [number, number, number];
  successText: [number, number, number];
  successBg: [number, number, number];
}

function getThemePalette(theme: PdfTheme): ThemeColors {
  if (theme === 'dark') {
    return {
      pageBg: [11, 17, 26],
      cardBg: [18, 28, 42],
      accent: [56, 189, 248],
      accentSoft: [14, 42, 66],
      textPrimary: [244, 247, 251],
      textSecondary: [160, 174, 192],
      border: [38, 53, 74],
      successText: [110, 231, 183],
      successBg: [10, 48, 36],
    };
  }
  if (theme === 'printer') {
    return {
      pageBg: [255, 255, 255],
      cardBg: [250, 250, 250],
      accent: [17, 24, 39],
      accentSoft: [243, 244, 246],
      textPrimary: [0, 0, 0],
      textSecondary: [75, 85, 99],
      border: [180, 185, 194],
      successText: [17, 24, 39],
      successBg: [243, 244, 246],
    };
  }
  return {
    pageBg: [255, 255, 255],
    cardBg: [248, 250, 252],
    accent: [0, 166, 255],
    accentSoft: [232, 246, 255],
    textPrimary: [15, 23, 42],
    textSecondary: [71, 85, 105],
    border: [220, 228, 238],
    successText: [4, 120, 87],
    successBg: [236, 253, 245],
  };
}

/**
 * Renders Arabic / Urdu / non-Latin text lines into crisp high-DPI canvas image strips
 * so jsPDF never outputs broken ASCII "????" glyphs even offline.
 */
function renderUnicodeTextStrip(
  text: string,
  maxWidthMm: number,
  fontSizePt: number,
  rgb: [number, number, number],
  bold = false
): { dataUrl: string; widthMm: number; heightMm: number } | null {
  if (typeof document === 'undefined') return null;
  const pxPerMm = 3.7795275591;
  const dpiScale = 2.6;
  const maxWidthPx = Math.max(80, Math.round(maxWidthMm * pxPerMm * dpiScale));
  const fontPx = Math.round(fontSizePt * 1.333 * dpiScale);
  const lineHeightPx = Math.round(fontPx * 1.48);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const fontSpec = `${bold ? 'bold ' : ''}${fontPx}px "Noto Naskh Arabic", "Noto Sans", "Segoe UI", Tahoma, sans-serif`;
  ctx.font = fontSpec;

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidthPx - 8) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 0) lines.push(text);

  const totalHeightPx = lines.length * lineHeightPx + Math.round(fontPx * 0.35);
  canvas.width = maxWidthPx;
  canvas.height = totalHeightPx;

  const drawCtx = canvas.getContext('2d');
  if (!drawCtx) return null;
  drawCtx.clearRect(0, 0, canvas.width, canvas.height);
  drawCtx.font = fontSpec;
  drawCtx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  drawCtx.textBaseline = 'top';

  const rtl = isRtlScript(text);
  drawCtx.direction = rtl ? 'rtl' : 'ltr';
  drawCtx.textAlign = rtl ? 'right' : 'left';
  const xPos = rtl ? canvas.width - 4 : 4;

  lines.forEach((line, idx) => {
    drawCtx.fillText(line, xPos, idx * lineHeightPx + 2);
  });

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthMm: canvas.width / (pxPerMm * dpiScale),
    heightMm: canvas.height / (pxPerMm * dpiScale),
  };
}

export function generateSmartPdfBlob(
  classifiedDoc: ClassifiedPdfDocument,
  options: PdfExportOptions
): { blob: Blob; filename: string; pageCount: number; resolvedCategory: PdfContentCategory } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: options.pageSize === 'letter' ? 'letter' : 'a4',
    compress: true,
  });

  const palette = getThemePalette(options.theme);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const marginTop = 20;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginX * 2;

  const resolvedCategory: PdfContentCategory =
    options.categoryOverride && options.categoryOverride !== 'auto'
      ? options.categoryOverride
      : classifiedDoc.detectedCategory;
  const docTitle = (options.title || classifiedDoc.title || 'Think Creative Document').trim();

  const fillPageBackground = () => {
    if (options.theme !== 'printer') {
      doc.setFillColor(...palette.pageBg);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
    }
  };

  fillPageBackground();
  let y = marginTop;

  const addNewPage = () => {
    doc.addPage();
    fillPageBackground();
    y = marginTop;
  };

  const ensureSpace = (neededMm: number) => {
    const maxY = pageHeight - marginBottom;
    if (y + neededMm > maxY && y > marginTop + 2) {
      addNewPage();
    }
  };

  const measureTextBlock = (
    text: string,
    maxWidthMm: number,
    fontSizePt: number,
    bold = false,
    lineFactor = 1.42
  ): { lines: string[]; heightMm: number; unicodeStrip?: ReturnType<typeof renderUnicodeTextStrip> } => {
    if (hasComplexUnicode(text)) {
      const strip = renderUnicodeTextStrip(text, maxWidthMm, fontSizePt, palette.textPrimary, bold);
      if (strip) {
        return { lines: [text], heightMm: strip.heightMm, unicodeStrip: strip };
      }
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSizePt);
    const clean = normalizeLatinPunctuation(text);
    const wrapped = doc.splitTextToSize(clean, maxWidthMm) as string[];
    const lineHeightMm = (fontSizePt * 0.352778) * lineFactor;
    return {
      lines: wrapped,
      heightMm: Math.max(lineHeightMm, wrapped.length * lineHeightMm),
    };
  };

  const drawTextBlock = (
    text: string,
    x: number,
    maxWidthMm: number,
    fontSizePt: number,
    color: [number, number, number],
    opts?: { bold?: boolean; italic?: boolean; lineFactor?: number }
  ) => {
    const bold = Boolean(opts?.bold);
    const lineFactor = opts?.lineFactor || 1.42;

    if (hasComplexUnicode(text)) {
      const strip = renderUnicodeTextStrip(text, maxWidthMm, fontSizePt, color, bold);
      if (strip) {
        ensureSpace(strip.heightMm + 1);
        doc.addImage(strip.dataUrl, 'PNG', x, y, strip.widthMm, strip.heightMm);
        y += strip.heightMm;
        return;
      }
    }

    doc.setFont('helvetica', bold ? 'bold' : opts?.italic ? 'italic' : 'normal');
    doc.setFontSize(fontSizePt);
    doc.setTextColor(...color);
    const clean = normalizeLatinPunctuation(text);
    const lines = doc.splitTextToSize(clean, maxWidthMm) as string[];
    const lineHeightMm = (fontSizePt * 0.352778) * lineFactor;

    for (const line of lines) {
      ensureSpace(lineHeightMm + 1);
      doc.text(line, x, y + lineHeightMm * 0.72);
      y += lineHeightMm;
    }
  };

  // ==================== COVER / TITLE HEADER ====================
  doc.setFillColor(...palette.accent);
  doc.rect(marginX, y, 22, 1.4, 'F');
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...palette.accent);
  doc.text(
    normalizeLatinPunctuation(`THINK CREATIVE  ·  ${CATEGORY_LABELS[resolvedCategory].toUpperCase()}`),
    marginX,
    y
  );
  y += 5;

  drawTextBlock(docTitle, marginX, contentWidth, 18, palette.textPrimary, { bold: true, lineFactor: 1.25 });
  y += 2;

  const metaParts = [
    options.authorName ? `Prepared for ${options.authorName}` : 'Think Creative Export',
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  ];
  if (classifiedDoc.mcqs.length > 0) metaParts.push(`${classifiedDoc.mcqs.length} MCQs`);
  if (classifiedDoc.qaPairs.length > 0) metaParts.push(`${classifiedDoc.qaPairs.length} Q&As`);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...palette.textSecondary);
  doc.text(normalizeLatinPunctuation(metaParts.join('   •   ')), marginX, y + 3);
  y += 7;

  doc.setDrawColor(...palette.border);
  doc.setLineWidth(0.35);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  // ==================== RENDER GENERAL BLOCKS (Filtered for Code) ====================
  const visibleBlocks = classifiedDoc.blocks.filter((b) => {
    if (b.type === 'code_block' && !options.includeCode) return false;
    // Skip duplicate H1 matching docTitle
    if (b.type === 'heading' && b.level === 1 && b.text.toLowerCase() === docTitle.toLowerCase()) {
      return false;
    }
    return true;
  });

  for (const block of visibleBlocks) {
    if (block.type === 'heading') {
      const pt = block.level === 1 ? 14 : block.level === 2 ? 12.2 : 10.8;
      ensureSpace(12);
      y += block.level === 2 ? 4 : 2.5;
      if (block.level <= 2 && options.theme !== 'printer') {
        doc.setFillColor(...palette.accent);
        doc.rect(marginX, y + 1, 2, 4.2, 'F');
        drawTextBlock(block.text, marginX + 4.5, contentWidth - 4.5, pt, palette.textPrimary, { bold: true });
      } else {
        drawTextBlock(block.text, marginX, contentWidth, pt, palette.textPrimary, { bold: true });
      }
      y += 2;
    } else if (block.type === 'paragraph') {
      const m = measureTextBlock(block.text, contentWidth, 10.2);
      if (m.heightMm < 70) ensureSpace(m.heightMm + 2);
      drawTextBlock(block.text, marginX, contentWidth, 10.2, palette.textPrimary);
      y += 3;
    } else if (block.type === 'bullet_list' || block.type === 'ordered_list') {
      for (let idx = 0; idx < block.items.length; idx++) {
        const item = block.items[idx];
        const prefix = block.type === 'ordered_list' ? `${idx + 1}.` : '•';
        const m = measureTextBlock(item, contentWidth - 7, 10);
        if (m.heightMm < 50) ensureSpace(m.heightMm + 1.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...palette.accent);
        doc.text(prefix, marginX + 1.5, y + 3.6);
        drawTextBlock(item, marginX + 6.5, contentWidth - 6.5, 10, palette.textPrimary);
        y += 1.4;
      }
      y += 2.5;
    } else if (block.type === 'callout') {
      const m = measureTextBlock(block.text, contentWidth - 8, 9.8);
      const boxH = m.heightMm + 6;
      ensureSpace(Math.min(boxH + 2, 65));
      if (options.theme !== 'printer') {
        doc.setFillColor(...palette.accentSoft);
        doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, 'F');
      }
      doc.setDrawColor(...palette.accent);
      doc.setLineWidth(0.6);
      doc.line(marginX, y, marginX, y + boxH);
      y += 3;
      drawTextBlock(block.text, marginX + 4, contentWidth - 8, 9.8, palette.textPrimary, { italic: true });
      y += 5;
    } else if (block.type === 'table') {
      const colCount = Math.max(1, block.headers.length);
      const colW = contentWidth / colCount;
      const rowH = 7;
      ensureSpace(rowH * 2 + 4);

      if (options.theme !== 'printer') {
        doc.setFillColor(...palette.accentSoft);
        doc.rect(marginX, y, contentWidth, rowH, 'F');
      }
      doc.setDrawColor(...palette.border);
      doc.setLineWidth(0.25);
      doc.rect(marginX, y, contentWidth, rowH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(...palette.textPrimary);
      block.headers.forEach((h, cIdx) => {
        doc.text(normalizeLatinPunctuation(h).slice(0, 32), marginX + cIdx * colW + 2, y + 4.8);
      });
      y += rowH;

      for (const row of block.rows) {
        ensureSpace(rowH + 1);
        doc.setDrawColor(...palette.border);
        doc.rect(marginX, y, contentWidth, rowH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.6);
        doc.setTextColor(...palette.textPrimary);
        row.slice(0, colCount).forEach((cell, cIdx) => {
          doc.text(normalizeLatinPunctuation(cell).slice(0, 36), marginX + cIdx * colW + 2, y + 4.8);
        });
        y += rowH;
      }
      y += 4;
    } else if (block.type === 'code_block') {
      const codeLines = block.code.split(/\r?\n/).slice(0, 60);
      const lineH = 3.9;
      const boxH = Math.min(codeLines.length * lineH + 7, pageHeight - marginTop - marginBottom - 6);
      ensureSpace(Math.min(boxH + 3, 55));

      if (options.theme !== 'printer') {
        doc.setFillColor(...palette.cardBg);
        doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, 'F');
      }
      doc.setDrawColor(...palette.border);
      doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, 'S');
      y += 4.5;

      doc.setFont('courier', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(...palette.textPrimary);
      for (const cl of codeLines) {
        ensureSpace(lineH + 1);
        const safeLine = normalizeLatinPunctuation(cl).slice(0, 96);
        doc.text(safeLine, marginX + 3, y + 2.5);
        y += lineH;
      }
      y += 5;
    }
  }

  // ==================== RENDER STRUCTURED Q&A PAIRS ====================
  if (classifiedDoc.qaPairs.length > 0) {
    ensureSpace(16);
    y += 3;
    drawTextBlock('Questions & Answers', marginX, contentWidth, 13, palette.accent, { bold: true });
    y += 3;

    for (const qa of classifiedDoc.qaPairs) {
      const qMeasure = measureTextBlock(`Q${qa.number}. ${qa.question}`, contentWidth - 6, 10.6, true);
      const aMeasure = measureTextBlock(qa.answer, contentWidth - 6, 9.9, false);
      const keepWhole = qMeasure.heightMm + aMeasure.heightMm + 12;

      if (keepWhole < pageHeight - marginTop - marginBottom - 10) {
        ensureSpace(keepWhole);
      } else {
        ensureSpace(qMeasure.heightMm + 16);
      }

      if (options.theme !== 'printer') {
        doc.setFillColor(...palette.cardBg);
        doc.roundedRect(marginX, y, contentWidth, Math.min(qMeasure.heightMm + 5, 28), 2, 2, 'F');
      }
      doc.setDrawColor(...palette.border);
      doc.setLineWidth(0.25);
      y += 2.5;
      drawTextBlock(`Q${qa.number}. ${qa.question}`, marginX + 3, contentWidth - 6, 10.6, palette.textPrimary, {
        bold: true,
      });
      y += 2;
      drawTextBlock(qa.answer, marginX + 3, contentWidth - 6, 9.9, palette.textPrimary);
      y += 4.5;
      doc.setDrawColor(...palette.border);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4.5;
    }
  }

  // ==================== RENDER STRUCTURED MCQs ====================
  if (classifiedDoc.mcqs.length > 0) {
    ensureSpace(18);
    y += 3;
    drawTextBlock('Multiple-Choice Questions', marginX, contentWidth, 13, palette.accent, { bold: true });
    y += 3;

    for (const mcq of classifiedDoc.mcqs) {
      // Measure complete MCQ stem + options + inline answer/explanation so nothing clips across pages
      const stemMeasure = measureTextBlock(`${mcq.number}. ${mcq.question}`, contentWidth - 6, 10.5, true);
      let optionsHeight = 0;
      for (const opt of mcq.options) {
        const om = measureTextBlock(`${opt.label}) ${opt.text}`, contentWidth - 12, 9.8);
        optionsHeight += om.heightMm + 1.2;
      }

      let extraHeight = 0;
      const showAnswerInline =
        (options.mcqAnswerMode === 'with_answers' || options.mcqAnswerMode === 'with_explanations') &&
        Boolean(mcq.correctAnswer);
      const showExplanationInline =
        options.mcqAnswerMode === 'with_explanations' && Boolean(mcq.explanation);

      if (showAnswerInline && mcq.correctAnswer) {
        extraHeight += measureTextBlock(`Answer: ${mcq.correctAnswer}`, contentWidth - 10, 9.4, true).heightMm + 4;
      }
      if (showExplanationInline && mcq.explanation) {
        extraHeight += measureTextBlock(`Explanation: ${mcq.explanation}`, contentWidth - 10, 9.1).heightMm + 3;
      }

      const totalMcqHeight = stemMeasure.heightMm + optionsHeight + extraHeight + 9;
      ensureSpace(Math.min(totalMcqHeight, pageHeight - marginTop - marginBottom - 8));

      // Stem
      drawTextBlock(`${mcq.number}. ${mcq.question}`, marginX, contentWidth, 10.5, palette.textPrimary, {
        bold: true,
      });
      y += 1.5;

      // Options
      for (const opt of mcq.options) {
        const isCorrectOpt =
          showAnswerInline &&
          mcq.correctAnswer &&
          mcq.correctAnswer.trim().toUpperCase().startsWith(opt.label);

        if (isCorrectOpt && options.theme !== 'printer') {
          const om = measureTextBlock(`${opt.label}) ${opt.text}`, contentWidth - 14, 9.8);
          doc.setFillColor(...palette.successBg);
          doc.roundedRect(marginX + 3, y - 0.5, contentWidth - 6, om.heightMm + 1.5, 1.5, 1.5, 'F');
        }

        drawTextBlock(
          `${opt.label}) ${opt.text}`,
          marginX + 5,
          contentWidth - 8,
          9.8,
          isCorrectOpt ? palette.successText : palette.textPrimary,
          { bold: Boolean(isCorrectOpt) }
        );
        y += 1.1;
      }

      if (showAnswerInline && mcq.correctAnswer) {
        y += 1;
        drawTextBlock(
          `Answer: ${mcq.correctAnswer}`,
          marginX + 5,
          contentWidth - 8,
          9.4,
          palette.successText,
          { bold: true }
        );
      }
      if (showExplanationInline && mcq.explanation) {
        y += 0.6;
        drawTextBlock(
          `Explanation: ${mcq.explanation}`,
          marginX + 5,
          contentWidth - 8,
          9.1,
          palette.textSecondary,
          { italic: true }
        );
      }

      y += 3.5;
      doc.setDrawColor(...palette.border);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4;
    }

    // Dedicated Separate Answer Key page
    if (options.mcqAnswerMode === 'separate_answer_key') {
      addNewPage();
      drawTextBlock('Answer Key & Explanations', marginX, contentWidth, 15, palette.accent, { bold: true });
      y += 3;
      doc.setDrawColor(...palette.border);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 5;

      for (const mcq of classifiedDoc.mcqs) {
        const ans = mcq.correctAnswer || 'Not specified in source';
        const lineText = `Q${mcq.number}.  ${ans}`;
        const expText = mcq.explanation ? `Note: ${mcq.explanation}` : '';
        const h1 = measureTextBlock(lineText, contentWidth - 6, 10, true).heightMm;
        const h2 = expText ? measureTextBlock(expText, contentWidth - 10, 9.1).heightMm : 0;
        ensureSpace(h1 + h2 + 6);

        drawTextBlock(lineText, marginX + 2, contentWidth - 4, 10, palette.successText, { bold: true });
        if (expText) {
          drawTextBlock(expText, marginX + 6, contentWidth - 10, 9.1, palette.textSecondary, { italic: true });
        }
        y += 2.5;
      }
    }
  }

  // ==================== STAMP RUNNING HEADERS & FOOTERS ====================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Running Header (subtle on pages 2+)
    if (p > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...palette.textSecondary);
      doc.text(normalizeLatinPunctuation(docTitle).slice(0, 70), marginX, 11);
      doc.setDrawColor(...palette.border);
      doc.setLineWidth(0.2);
      doc.line(marginX, 13.5, pageWidth - marginX, 13.5);
    }

    // Running Footer
    const footerY = pageHeight - 10;
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.2);
    doc.line(marginX, footerY - 4, pageWidth - marginX, footerY - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...palette.textSecondary);
    doc.text(
      normalizeLatinPunctuation(`Think Creative · ${CATEGORY_LABELS[resolvedCategory]}`),
      marginX,
      footerY
    );
    const pageLabel = `Page ${p} of ${totalPages}`;
    const labelW = doc.getTextWidth(pageLabel);
    doc.text(pageLabel, pageWidth - marginX - labelW, footerY);
  }

  const blob = doc.output('blob');
  const safeBase = docTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'think_creative_export';

  return {
    blob,
    filename: `${safeBase}_${options.pageSize}.pdf`,
    pageCount: totalPages,
    resolvedCategory,
  };
}
