/**
 * Student Quiz & MCQ Parser & Spellchecker Engine
 * Compliant with student workflow: Solved/Unsolved PDFs, Live MCQs, and Spellcheck Quizzes.
 */

export interface StudentMcqItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number; // 0-based
  explanation?: string;
}

export interface StudentQuizItem {
  id: string;
  question: string;
  expectedAnswer: string;
  acceptableKeywords: string[];
  explanation?: string;
}

export interface StudentStudyPackage {
  title: string;
  type: 'mcq' | 'short_question' | 'long_question' | 'mixed';
  mcqs: StudentMcqItem[];
  quizzes: StudentQuizItem[];
  sourceNotesSnippet?: string;
}

/**
 * Checks if a user prompt is related to student notes, MCQs, quiz, or exam prep.
 */
export function isStudentRequest(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return (
    /\b(mcq|mcqs|quiz|exam|test|notes|solve|unsolve|short\s*question|long\s*question|question\s*answer|live\s*solving)\b/i.test(
      lower
    ) ||
    /ایم\s*سی\s*کیوز|کوئز|سوالات|نوٹس|امتحان/i.test(text) ||
    /mcqs?\s*bana|quiz\s*lo|notes\s*ke|paper\s*bana|mcq\s*chahiye/i.test(lower)
  );
}

/**
 * Parses raw text from AI response into structured MCQs and Quizzes.
 */
export function parseStudentContent(raw: string): StudentStudyPackage | null {
  if (!raw || typeof raw !== 'string') return null;

  const mcqs: StudentMcqItem[] = [];
  const quizzes: StudentQuizItem[] = [];

  // Match ```mcq or ```quiz blocks if explicitly formatted
  const mcqBlockMatch = raw.match(/```(?:mcq|quiz|json:mcq)\s*([\s\S]*?)```/i);
  if (mcqBlockMatch) {
    try {
      const parsed = JSON.parse(mcqBlockMatch[1]);
      if (Array.isArray(parsed)) {
        parsed.forEach((item, idx) => {
          if (item.question && Array.isArray(item.options)) {
            mcqs.push({
              id: `mcq-${idx + 1}`,
              question: item.question,
              options: item.options,
              correctIndex: typeof item.correctIndex === 'number' ? item.correctIndex : 0,
              explanation: item.explanation || '',
            });
          }
        });
      }
    } catch {}
  }

  // Regex-based fallback parser for standard markdown MCQs
  // e.g. "1. What is X?\nA) Option 1\nB) Option 2\nC) Option 3\nD) Option 4\nAnswer: B"
  if (mcqs.length === 0) {
    const questionRegex = /(?:^|\n)(?:\d+[\.\)]\s*)([^\n]+)\n((?:[A-Da-d][\.\)]\s*[^\n]+\n?){2,5})(?:(?:Answer|Correct(?:\s*Option)?|Ans)[\s:]*([A-Da-d]|Option\s*[A-Da-d]))?/gi;
    let match: RegExpExecArray | null;
    let idx = 1;

    while ((match = questionRegex.exec(raw)) !== null) {
      const qText = match[1].trim();
      const optionsRaw = match[2];
      const answerChar = match[3] ? match[3].replace(/option/i, '').trim().toUpperCase() : 'A';

      const optionLines = optionsRaw.split('\n').filter((l) => /^[A-Da-d][\.\)]\s*/.test(l.trim()));
      const options = optionLines.map((l) => l.replace(/^[A-Da-d][\.\)]\s*/, '').trim());

      let correctIndex = 0;
      if (answerChar === 'B') correctIndex = 1;
      else if (answerChar === 'C') correctIndex = 2;
      else if (answerChar === 'D') correctIndex = 3;

      if (options.length >= 2) {
        mcqs.push({
          id: `mcq-${idx++}`,
          question: qText,
          options,
          correctIndex: correctIndex < options.length ? correctIndex : 0,
        });
      }
    }
  }

  // Regex parser for Short Questions / Quiz blanks
  // e.g. "Q1: What is velocity?\nA: Velocity is speed with direction."
  const sqRegex = /(?:^|\n)(?:Q\d*[\.:]\s*|\d+[\.\)]\s*)([^\n\?]+\?)\s*\n+(?:(?:Answer|Ans|Expected)[\s:]*)([^\n]+)/gi;
  let sqMatch: RegExpExecArray | null;
  let qIdx = 1;
  while ((sqMatch = sqRegex.exec(raw)) !== null) {
    const question = sqMatch[1].trim();
    const expectedAnswer = sqMatch[2].trim();
    const keywords = expectedAnswer
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .map((w) => w.replace(/[^a-z0-9]/gi, ''));

    quizzes.push({
      id: `quiz-${qIdx++}`,
      question,
      expectedAnswer,
      acceptableKeywords: keywords,
    });
  }

  if (mcqs.length === 0 && quizzes.length === 0) {
    return null;
  }

  return {
    title: 'Student Study Assessment & Quiz',
    type: mcqs.length > 0 && quizzes.length > 0 ? 'mixed' : mcqs.length > 0 ? 'mcq' : 'short_question',
    mcqs,
    quizzes,
  };
}

/**
 * Simple Levenshtein distance for spellchecking user answers against expected words.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export interface SpellCheckToken {
  word: string;
  isMisspelled: boolean;
  suggestedCorrection?: string;
}

/**
 * Checks user typed answer tokens against expected words.
 * Identifies misspelled words and suggests corrections.
 */
export function checkSpellingAgainstExpected(
  userText: string,
  expectedAnswer: string
): {
  tokens: SpellCheckToken[];
  hasSpellingError: boolean;
  accuracyScore: number;
} {
  const userWords = userText.trim().split(/\s+/);
  const expectedWords = expectedAnswer
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ''))
    .filter((w) => w.length > 2);

  let hasSpellingError = false;
  let matchedKeywords = 0;

  const tokens: SpellCheckToken[] = userWords.map((rawWord) => {
    const cleanWord = rawWord.toLowerCase().replace(/[^a-z0-9]/gi, '');
    if (cleanWord.length <= 2) {
      return { word: rawWord, isMisspelled: false };
    }

    // Exact match in expected
    if (expectedWords.includes(cleanWord)) {
      matchedKeywords++;
      return { word: rawWord, isMisspelled: false };
    }

    // Check for near-miss (distance 1 or 2)
    let bestMatch = '';
    let bestDist = 999;
    for (const exp of expectedWords) {
      if (Math.abs(exp.length - cleanWord.length) <= 2) {
        const dist = getLevenshteinDistance(cleanWord, exp);
        if (dist <= 2 && dist < bestDist) {
          bestDist = dist;
          bestMatch = exp;
        }
      }
    }

    if (bestMatch && bestDist > 0 && bestDist <= 2) {
      hasSpellingError = true;
      return {
        word: rawWord,
        isMisspelled: true,
        suggestedCorrection: bestMatch,
      };
    }

    return { word: rawWord, isMisspelled: false };
  });

  const accuracyScore = Math.min(
    100,
    Math.round(
      (matchedKeywords / Math.max(1, Math.min(expectedWords.length, 6))) * 100
    )
  );

  return { tokens, hasSpellingError, accuracyScore };
}

/**
 * Generates printable HTML string for downloading as Solved or Unsolved PDF.
 */
export function generatePdfDocumentHtml(
  studyPackage: StudentStudyPackage,
  isSolved: boolean
): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const mcqsHtml = studyPackage.mcqs
    .map((mcq, idx) => {
      const optionsHtml = mcq.options
        .map((opt, optIdx) => {
          const letter = String.fromCharCode(65 + optIdx);
          const isCorrect = isSolved && optIdx === mcq.correctIndex;
          return `
          <div style="margin: 6px 0; padding: 8px 12px; border-radius: 6px; ${
            isCorrect
              ? 'background: #e6f9ed; border: 1.5px solid #22c55e; color: #166534; font-weight: 600;'
              : 'background: #f8fafc; border: 1px solid #e2e8f0; color: #334155;'
          }">
            <span style="font-weight: 700; margin-right: 8px;">(${letter})</span>
            ${opt}
            ${isCorrect ? '<span style="float: right; color: #22c55e; font-weight: 800;">✓ Correct</span>' : ''}
          </div>
        `;
        })
        .join('');

      return `
      <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px dashed #cbd5e1; page-break-inside: avoid;">
        <h4 style="margin: 0 0 10px; font-size: 15px; color: #0f172a;">
          <span style="color: #0284c7; font-weight: 800;">Q${idx + 1}.</span> ${mcq.question}
        </h4>
        <div style="margin-left: 12px;">
          ${optionsHtml}
        </div>
        ${
          isSolved && mcq.explanation
            ? `<p style="margin: 10px 0 0 12px; font-size: 12.5px; color: #64748b; font-style: italic;">
                <strong>Explanation:</strong> ${mcq.explanation}
              </p>`
            : ''
        }
      </div>
    `;
    })
    .join('');

  const quizzesHtml = studyPackage.quizzes
    .map((q, idx) => {
      return `
      <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px dashed #cbd5e1; page-break-inside: avoid;">
        <h4 style="margin: 0 0 10px; font-size: 15px; color: #0f172a;">
          <span style="color: #0284c7; font-weight: 800;">Q${idx + 1}.</span> ${q.question}
        </h4>
        ${
          isSolved
            ? `<div style="margin: 8px 0 0 12px; padding: 10px 14px; background: #e0f2fe; border-left: 4px solid #0284c7; border-radius: 4px; color: #0369a1; font-size: 14px;">
                <strong>Answer:</strong> ${q.expectedAnswer}
              </div>`
            : `<div style="margin: 8px 0 0 12px; height: 55px; border-bottom: 1px solid #94a3b8; color: #94a3b8; font-size: 12px; padding-top: 35px;">
                Answer: ____________________________________________________________________
              </div>`
        }
      </div>
    `;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${studyPackage.title} — ${isSolved ? 'Solved Answer Key' : 'Question Paper'}</title>
<style>
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    line-height: 1.6;
    padding: 36px 48px;
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
  }
  .header {
    text-align: center;
    border-bottom: 2.5px solid #0f172a;
    padding-bottom: 16px;
    margin-bottom: 28px;
  }
  .header h1 {
    margin: 0 0 6px;
    font-size: 24px;
    letter-spacing: -0.02em;
  }
  .header p {
    margin: 0;
    font-size: 13px;
    color: #64748b;
  }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 8px;
    ${isSolved ? 'background: #e6f9ed; color: #166534;' : 'background: #e0f2fe; color: #0369a1;'}
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${studyPackage.title}</h1>
    <p>Generated by Creative Think AI Assistant · ${dateStr}</p>
    <div class="badge">${isSolved ? 'Solved Edition with Solutions' : 'Student Question Paper (Unsolved)'}</div>
  </div>

  ${mcqsHtml}
  ${quizzesHtml}

  <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px;">
    &copy; 2026 Creative Think Student Learning Suite. All questions calibrated for academic rigor.
  </div>
</body>
</html>`;
}
