import type { AttachedFile } from '../types';

/**
 * Detects if a string is code and converts it into an AttachedFile object.
 * Supports:
 *  1. Markdown code fences: ```lang\n...```
 *  2. Raw pasted code: HTML, React/TSX/JSX, TS/JS, CSS, Python, SQL, JSON, etc.
 */

interface CodeDetectionResult {
  hasCode: boolean;
  cleanedText: string;
  codeFiles: AttachedFile[];
}

// Sniff language and return appropriate extension and mime type
export function sniffCodeLanguage(code: string, hintedLang?: string): {
  lang: string;
  ext: string;
  mime: string;
} {
  const normalizedHint = (hintedLang || '').trim().toLowerCase();

  if (normalizedHint) {
    if (['tsx', 'typescript-react', 'react-ts'].includes(normalizedHint)) {
      return { lang: 'tsx', ext: 'tsx', mime: 'text/typescript-jsx' };
    }
    if (['jsx', 'javascript-react', 'react'].includes(normalizedHint)) {
      return { lang: 'jsx', ext: 'jsx', mime: 'text/javascript-jsx' };
    }
    if (['ts', 'typescript'].includes(normalizedHint)) {
      return { lang: 'ts', ext: 'ts', mime: 'text/typescript' };
    }
    if (['js', 'javascript', 'mjs', 'cjs'].includes(normalizedHint)) {
      return { lang: 'js', ext: 'js', mime: 'text/javascript' };
    }
    if (['html', 'htm'].includes(normalizedHint)) {
      return { lang: 'html', ext: 'html', mime: 'text/html' };
    }
    if (['css', 'scss', 'sass', 'less'].includes(normalizedHint)) {
      return { lang: 'css', ext: 'css', mime: 'text/css' };
    }
    if (['py', 'python'].includes(normalizedHint)) {
      return { lang: 'py', ext: 'py', mime: 'text/x-python' };
    }
    if (['json'].includes(normalizedHint)) {
      return { lang: 'json', ext: 'json', mime: 'application/json' };
    }
    if (['sql'].includes(normalizedHint)) {
      return { lang: 'sql', ext: 'sql', mime: 'text/x-sql' };
    }
    if (['sh', 'bash', 'zsh'].includes(normalizedHint)) {
      return { lang: 'sh', ext: 'sh', mime: 'text/x-sh' };
    }
    if (['cpp', 'c', 'h', 'hpp'].includes(normalizedHint)) {
      return { lang: 'cpp', ext: 'cpp', mime: 'text/x-c++src' };
    }
  }

  const trimmed = code.trim();

  // HTML
  if (
    /<!doctype html>/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed) ||
    /<head[\s>]/i.test(trimmed) ||
    /<body[\s>]/i.test(trimmed) ||
    (/<div[\s>]/i.test(trimmed) && /<\/div>/i.test(trimmed)) ||
    (/<template[\s>]/i.test(trimmed) && /<\/template>/i.test(trimmed))
  ) {
    return { lang: 'html', ext: 'html', mime: 'text/html' };
  }

  // React / TSX
  if (
    (/import\s+React/i.test(trimmed) || /className=/i.test(trimmed) || /<[A-Z]\w+.*>.*<\/[A-Z]\w+>/s.test(trimmed)) &&
    (/(interface|type)\s+[A-Z]\w+/i.test(trimmed) || /:\s*(string|number|boolean|any)/.test(trimmed))
  ) {
    return { lang: 'tsx', ext: 'tsx', mime: 'text/typescript-jsx' };
  }

  // JSX
  if (/className=/i.test(trimmed) || (/<[a-zA-Z][\w-]*.*>.*<\/[a-zA-Z][\w-]*>/s.test(trimmed) && /return\s*\(/i.test(trimmed))) {
    return { lang: 'jsx', ext: 'jsx', mime: 'text/javascript-jsx' };
  }

  // TypeScript
  if (
    /(interface|type)\s+[A-Z]\w+/i.test(trimmed) ||
    /:\s*(string|number|boolean|Record<|Array<)/i.test(trimmed) ||
    /as\s+[A-Z]\w+/i.test(trimmed)
  ) {
    return { lang: 'ts', ext: 'ts', mime: 'text/typescript' };
  }

  // Python
  if (
    /^\s*def\s+\w+\s*\(.*?\)\s*:/m.test(trimmed) ||
    /^\s*class\s+\w+\s*(\(.*?\))?\s*:/m.test(trimmed) ||
    /^\s*import\s+[\w.]+/m.test(trimmed) && /^\s*from\s+[\w.]+\s+import/m.test(trimmed)
  ) {
    return { lang: 'py', ext: 'py', mime: 'text/x-python' };
  }

  // CSS
  if (
    (/@media\s/i.test(trimmed) || /@import\s/i.test(trimmed) || /[.#][a-zA-Z0-9_-]+\s*\{/i.test(trimmed)) &&
    /;\s*\}/.test(trimmed)
  ) {
    return { lang: 'css', ext: 'css', mime: 'text/css' };
  }

  // JSON
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return { lang: 'json', ext: 'json', mime: 'application/json' };
    } catch {
      // not valid JSON
    }
  }

  // SQL
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|DROP)\s+/i.test(trimmed)) {
    return { lang: 'sql', ext: 'sql', mime: 'text/x-sql' };
  }

  // JavaScript fallback
  if (
    /function\s+\w+\s*\(/.test(trimmed) ||
    /const\s+\w+\s*=/.test(trimmed) ||
    /let\s+\w+\s*=/.test(trimmed) ||
    /import\s+.*?from\s+['"]/.test(trimmed) ||
    /console\.(log|error|warn)/.test(trimmed)
  ) {
    return { lang: 'js', ext: 'js', mime: 'text/javascript' };
  }

  return { lang: 'code', ext: 'txt', mime: 'text/plain' };
}

// Generate descriptive filename from snippet content
function generateFileName(code: string, ext: string, index = 1): string {
  // Check for React Component or function name
  const compMatch = code.match(/(?:export\s+(?:default\s+)?)?(?:function|const|class)\s+([A-Z]\w+)/);
  if (compMatch && compMatch[1]) {
    return `${compMatch[1]}.${ext}`;
  }

  // Check for standard function name
  const fnMatch = code.match(/(?:function|def|const)\s+([a-z]\w+)/);
  if (fnMatch && fnMatch[1]) {
    return `${fnMatch[1]}.${ext}`;
  }

  if (ext === 'html') return index === 1 ? 'index.html' : `page-${index}.html`;
  if (ext === 'css') return index === 1 ? 'styles.css' : `theme-${index}.css`;
  if (ext === 'json') return index === 1 ? 'data.json' : `payload-${index}.json`;
  if (ext === 'sql') return index === 1 ? 'schema.sql' : `query-${index}.sql`;
  if (ext === 'py') return index === 1 ? 'script.py' : `module-${index}.py`;

  return `code-snippet-${index}.${ext}`;
}

/**
 * Checks if raw text appears to be code (without markdown backticks)
 */
export function isRawCode(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;

  // Check for HTML document, doctype, or common HTML/XML tag trees
  if (/<!doctype html>/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) return true;
  if (/<\/?(div|section|article|header|footer|nav|main|span|p|h[1-6]|button|form|input|style|script|svg|link|meta|head|body|template|canvas|iframe)[\s>\/]/i.test(trimmed)) {
    return true;
  }
  if (/<[a-zA-Z][\w-]*.*?>[\s\S]*<\/[a-zA-Z][\w-]*>/.test(trimmed) && trimmed.includes('<') && trimmed.includes('>')) {
    return true;
  }

  // Count code-like indicators
  let score = 0;
  if (/import\s+.*?from\s+['"]/.test(trimmed)) score += 3;
  if (/export\s+(default\s+)?(function|const|class|interface|type)/.test(trimmed)) score += 3;
  if (/(function|const|let|var)\s+\w+\s*=\s*(\(|async)/.test(trimmed)) score += 2;
  if (/function\s+\w+\s*\(.*?\)\s*\{/.test(trimmed)) score += 2;
  if (/def\s+\w+\s*\(.*?\)\s*:/.test(trimmed)) score += 3;
  if (/class\s+\w+(\s+extends|\s*\{|\s*:)/.test(trimmed)) score += 2;
  if (/(interface|type)\s+[A-Z]\w+\s*=/.test(trimmed)) score += 3;
  if (/return\s*\(/.test(trimmed) || /return\s+<[A-Za-z]/.test(trimmed)) score += 2;
  if (/[{};]\s*$/.test(trimmed) && trimmed.includes('{') && trimmed.includes('}')) score += 2;
  if (/[.#:][a-zA-Z0-9_-]+\s*\{[\s\S]*?\}/.test(trimmed)) score += 3; // CSS block
  if (/console\.(log|error|warn)\(/.test(trimmed)) score += 2;
  if (/;\s*\n/.test(trimmed)) score += 1;
  if (/=>\s*\{/.test(trimmed)) score += 2;
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\s+/i.test(trimmed)) score += 3;

  // If text has code structure
  const lineCount = trimmed.split('\n').length;
  if (lineCount >= 2 && score >= 2) return true;
  if (score >= 3) return true;

  return false;
}

/**
 * Parses input text: extracts any code blocks or raw code and builds AttachedFile objects.
 */
export function detectAndExtractCode(input: string): CodeDetectionResult {
  if (!input || !input.trim()) {
    return { hasCode: false, cleanedText: input, codeFiles: [] };
  }

  const codeFiles: AttachedFile[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]+?)```/g;
  let hasMarkdownCode = false;
  let fileIndex = 1;

  // 1. Extract markdown code fences: ```lang\n...```
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(input)) !== null) {
    hasMarkdownCode = true;
    const langHint = match[1] || '';
    const codeBody = match[2].trim();

    if (codeBody) {
      const { lang, ext, mime } = sniffCodeLanguage(codeBody, langHint);
      const name = generateFileName(codeBody, ext, fileIndex++);
      const size = new Blob([codeBody]).size;

      codeFiles.push({
        id: `code-att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        name,
        size,
        type: mime,
        preview: codeBody,
        isImage: false,
        codeContent: codeBody,
        language: lang,
      });
    }
  }

  if (hasMarkdownCode && codeFiles.length > 0) {
    // Strip code blocks out of the user prompt so only instructions remain
    const cleanedText = input.replace(codeBlockRegex, '').replace(/\n{3,}/g, '\n\n').trim();
    return {
      hasCode: true,
      cleanedText,
      codeFiles,
    };
  }

  // 2. Check for raw code pasting (no backticks)
  if (isRawCode(input)) {
    const codeBody = input.trim();
    const { lang, ext, mime } = sniffCodeLanguage(codeBody);
    const name = generateFileName(codeBody, ext, 1);
    const size = new Blob([codeBody]).size;

    const codeFile: AttachedFile = {
      id: `code-att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name,
      size,
      type: mime,
      preview: codeBody,
      isImage: false,
      codeContent: codeBody,
      language: lang,
    };

    return {
      hasCode: true,
      cleanedText: '', // Cleared so it attaches cleanly as a file chip
      codeFiles: [codeFile],
    };
  }

  return { hasCode: false, cleanedText: input, codeFiles: [] };
}
