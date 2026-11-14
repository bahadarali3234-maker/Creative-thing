import { test } from 'node:test';
import assert from 'node:assert';
import { isCodeVaultLibraryPrompt } from '../src/app/utils/clarificationGate';
import { parseThemeOptions } from '../src/app/utils/themeOptions';

test('isCodeVaultLibraryPrompt detects library prompts accurately', () => {
  const libraryPrompt = `Build this interface with the design references below. Recreate each one faithfully, keeping its layout, spacing, typography scale and colour roles.
There are 11 references with complete, self-contained source.
Each block is a single HTML file with inline CSS and any small script it needs, so it can be dropped straight into a page.
### 1. Logo Marquee — Cyber Lime (sections)
\`\`\`html
<!doctype html>
<html><body><div class="marquee">Northwind</div></body></html>
\`\`\``;

  assert.strictEqual(isCodeVaultLibraryPrompt(libraryPrompt), true);
  assert.strictEqual(isCodeVaultLibraryPrompt('https://fluorescent-code-vault-flow.base44.app please use this'), true);
  assert.strictEqual(isCodeVaultLibraryPrompt('Can you write a poem about autumn?'), false);
});

test('parseThemeOptions extracts options and preserves colors', () => {
  const sample = `**Option 1 - Cyber Lime**
- Mood: energetic, futuristic
- Colors: Primary #a3e635 | Secondary #22d3ee | Accent #f9fafb | Background #070b07 | Text #eaffd0
- Style: Neon
- Typography: Space Grotesk + DM Sans
- Why it fits: High tech vibe

**Option 2 - Crimson Noir**
- Mood: dark, dramatic
- Colors: Primary #dc2626 | Secondary #f97316 | Accent #fafafa | Background #0a0a0a | Text #f5f5f5
- Style: Noir
- Typography: Tenor Sans + Lato
- Why it fits: Luxury feel

Which theme do you prefer?`;

  const parsed = parseThemeOptions(sample);
  assert.ok(parsed !== null, 'parsed options should not be null');
  assert.strictEqual(parsed!.options.length, 2);
  assert.strictEqual(parsed!.options[0].name, 'Cyber Lime');
  assert.strictEqual(parsed!.options[0].colors[0].hex, '#a3e635');
  assert.strictEqual(parsed!.options[1].colors[0].hex, '#dc2626');
});

test('detectAndExtractCode extracts HTML and code into file attachments', async () => {
  const { detectAndExtractCode, sniffCodeLanguage } = await import('../src/app/utils/codeAttachment');
  
  const htmlSnippet = '<!doctype html><html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>';
  const result = detectAndExtractCode(htmlSnippet);
  assert.strictEqual(result.hasCode, true);
  assert.strictEqual(result.codeFiles.length, 1);
  assert.strictEqual(result.codeFiles[0].name.endsWith('.html'), true);
  assert.strictEqual(result.codeFiles[0].codeContent, htmlSnippet);
  assert.strictEqual(result.codeFiles[0].language, 'html');

  const cssSnippet = '.card { display: flex; padding: 20px; background: #000; }';
  const cssResult = detectAndExtractCode(cssSnippet);
  assert.strictEqual(cssResult.hasCode, true);
  assert.strictEqual(cssResult.codeFiles.length, 1);
  assert.strictEqual(cssResult.codeFiles[0].name.endsWith('.css'), true);

  const regularText = 'Please build a modern website for a law firm in New York.';
  const textResult = detectAndExtractCode(regularText);
  assert.strictEqual(textResult.hasCode, false);
  assert.strictEqual(textResult.codeFiles.length, 0);
});

test('parseCreativeThinkLibrary and assembleCreativeThinkWebsite handle real library export', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const {
    isCreativeThinkLibraryDocument,
    parseCreativeThinkLibrary,
    assembleCreativeThinkWebsite,
  } = await import('../src/app/utils/creativeThinkLibrary');

  const filePath = path.join(process.cwd(), 'public/assets/aistudio/creative-think-library-6-items_e8b0a685.txt');
  assert.ok(fs.existsSync(filePath), 'library export file should exist on disk');

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  assert.strictEqual(isCreativeThinkLibraryDocument(fileContent), true);

  const parsed = parseCreativeThinkLibrary(fileContent);
  assert.strictEqual(parsed.resources.length, 5, 'should parse 5 design resources');
  assert.strictEqual(parsed.imageReferences.length, 1, 'should parse 1 image reference');

  assert.strictEqual(parsed.resources[0].name, 'Glassmorphism');
  assert.strictEqual(parsed.resources[0].palette, 'Monochrome Pro');
  assert.strictEqual(parsed.resources[1].name, 'Scroll Reveal');
  assert.strictEqual(parsed.resources[2].name, 'Diagonal Duo');
  assert.strictEqual(parsed.resources[3].name, 'Abril Fatface + Lato');
  assert.strictEqual(parsed.resources[4].name, 'Pricing Card');

  assert.strictEqual(parsed.imageReferences[0].title, 'Architecture of Siwa01');

  const { thinkingSummary, responseMarkdown, html } = assembleCreativeThinkWebsite(parsed, 'Build luxury portfolio');

  assert.ok(thinkingSummary.includes('Stage 1 — Library Detection'));
  assert.ok(thinkingSummary.includes('Stage 2 — Resource Extraction'));
  assert.ok(thinkingSummary.includes('Stage 3 — Resource Inventory'));
  assert.ok(thinkingSummary.includes('Stage 4 — User Requirement Analysis'));
  assert.ok(thinkingSummary.includes('Stage 5 — Resource Mapping'));
  assert.ok(thinkingSummary.includes('Stage 6 — Final Development Plan'));

  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('Nunito'));
  assert.ok(html.includes('Zen Dots'));
  assert.ok(html.includes('Vollkorn'));
  assert.ok(html.includes('Abril Fatface'));
  assert.ok(html.includes('Space Grotesk'));
  assert.ok(html.includes('Architecture of Siwa'));
  assert.ok(responseMarkdown.includes('```html filename="index.html"'));
});

test('isSensitiveOrReferenceTrigger matches policy and diagram keywords correctly', async () => {
  const { isSensitiveOrReferenceTrigger, DEFAULT_REFERENCE_CONFIG } = await import('../src/app/utils/referenceGallery');
  
  assert.strictEqual(DEFAULT_REFERENCE_CONFIG.messageText, 'It have this some refance');
  assert.strictEqual(DEFAULT_REFERENCE_CONFIG.items.length >= 2, true);

  // Matches sensitive / policy / diagram trigger keywords
  assert.strictEqual(isSensitiveOrReferenceTrigger('Can you explain this diagram reference?', DEFAULT_REFERENCE_CONFIG), true);
  assert.strictEqual(isSensitiveOrReferenceTrigger('policy restriction query', DEFAULT_REFERENCE_CONFIG), true);
  assert.strictEqual(isSensitiveOrReferenceTrigger('show me the anatomy model diagram', DEFAULT_REFERENCE_CONFIG), true);

  // Non-matching normal prompt
  assert.strictEqual(isSensitiveOrReferenceTrigger('Hello, how is the weather today?', DEFAULT_REFERENCE_CONFIG), false);
});

test('isWebsiteOrAppUiBuildRequest routes website/App UI builds to Buildy while allowing prompts and non-UI code', async () => {
  const { isWebsiteOrAppUiBuildRequest } = await import('../src/app/utils/buildyIntent');

  // Website / App UI build requests -> true (triggers upward-expanding Buildy card)
  assert.strictEqual(isWebsiteOrAppUiBuildRequest('Build a landing page for my cafe'), true);
  assert.strictEqual(isWebsiteOrAppUiBuildRequest('Create an ecommerce website with dark theme'), true);
  assert.strictEqual(isWebsiteOrAppUiBuildRequest('Mujhe aik portfolio website banao'), true);
  assert.strictEqual(isWebsiteOrAppUiBuildRequest('Design a modern app UI dashboard'), true);

  // Prompts, Python/C++/SQL code, and timetables -> false (handled directly in chat)
  assert.strictEqual(isWebsiteOrAppUiBuildRequest('Write a detailed Buildy prompt for a SaaS landing page'), false);
  assert.strictEqual(isWebsiteOrAppUiBuildRequest('Write a Python script to parse CSV and store in SQL'), false);
  assert.strictEqual(isWebsiteOrAppUiBuildRequest('Create a daily study timetable for me'), false);
});

test('GEMINI_TTS_VOICES uses strictly the 5 verified Gemini 3.8 Studio voices with style directives', async () => {
  const { GEMINI_TTS_VOICES } = await import('../src/app/utils/geminiTts');
  const ids = GEMINI_TTS_VOICES.map((v) => v.id);
  assert.deepStrictEqual(ids, ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);
  for (const v of GEMINI_TTS_VOICES) {
    assert.ok(v.style && v.style.length > 10, `Voice ${v.id} should include studio style metadata`);
  }
});

