import { describe, expect, it } from 'vitest';
import { parseThemeOptions } from '../app/utils/themeOptions';
import { buildDesignerSystemPrompt } from '../server-app/designLibrary';

const sample = `Great! Here are 4 theme options for your cafe website.

**Option 1 - Coral Cafe**
- Mood: friendly, cozy
- Colors: 🟦 Primary \`#e76f51\` | 🟪 Secondary \`#2a9d8f\` | 🟨 Accent \`#f4a261\` | ⬛ Background \`#fff8f3\` | ⬜ Text \`#3a2a22\`
- Style: Claymorphism
- Typography: Quicksand + Nunito
- Why it fits: warm cozy tones that match a neighborhood cafe.

**Option 2 - Midnight Luxe**
- Mood: elegant, premium
- Colors: 🟦 Primary \`#c9a24b\` | 🟪 Secondary \`#6d5dfc\` | 🟨 Accent \`#f5d98b\` | ⬛ Background \`#0b0d17\` | ⬜ Text \`#eef0f7\`
- Style: Dark Luxe Gold
- Typography: Cormorant Garamond + Montserrat
- Why it fits: a premium after-dark look.

**Option 3 - Forest Calm**
- Mood: natural, trustworthy
- Colors: 🟦 Primary \`#2f6b3a\` | 🟪 Secondary \`#8bb174\` | 🟨 Accent \`#d9a441\` | ⬛ Background \`#f3f7f2\` | ⬜ Text \`#1e2b1f\`
- Style: Bento Grid
- Typography: Fraunces + Work Sans
- Why it fits: organic calm for an eco cafe.

**Option 4 - Monochrome Pro**
- Mood: minimal, sharp
- Colors: 🟦 Primary \`#111111\` | 🟪 Secondary \`#52525b\` | 🟨 Accent \`#ef4444\` | ⬛ Background \`#ffffff\` | ⬜ Text \`#18181b\`
- Style: Minimal Line
- Typography: Space Grotesk + DM Sans
- Why it fits: sharp studio minimalism.

Which theme do you prefer? (1/2/3/4) or give your own colors.`;

describe('theme options parser', () => {
  it('parses 4 options with labeled swatch colors', () => {
    const parsed = parseThemeOptions(sample);
    expect(parsed).not.toBeNull();
    expect(parsed!.options).toHaveLength(4);
    expect(parsed!.options[0]!.name).toBe('Coral Cafe');
    expect(parsed!.options[0]!.colors).toHaveLength(5);
    expect(parsed!.options[0]!.colors[0]).toEqual({ label: 'Primary', hex: '#e76f51' });
    expect(parsed!.options[2]!.style).toBe('Bento Grid');
  });

  it('removes the raw option blocks and the preference question from the text', () => {
    const parsed = parseThemeOptions(sample);
    expect(parsed!.cleanedText).not.toContain('**Option');
    expect(parsed!.cleanedText).not.toContain('Which theme do you prefer');
    expect(parsed!.cleanedText).toContain('theme options');
  });

  it('returns null when there are fewer than two valid options', () => {
    expect(parseThemeOptions('Just a normal answer with #123456 hex in it.')).toBeNull();
    expect(parseThemeOptions('')).toBeNull();
  });
});

describe('designer system prompt (design library injection)', () => {
  it('injects the full library plus website workflow for website tasks', () => {
    const prompt = buildDesignerSystemPrompt(true);
    expect(prompt).toContain('"palettes"');
    expect(prompt).toContain('"layouts"');
    expect(prompt).toContain('"effects"');
    expect(prompt).toContain('picsum.photos/seed/');
    expect(prompt).toContain('**Option 1 - [Theme Name]**');
  });

  it('omits layout/effect sections for non-website requests', () => {
    const prompt = buildDesignerSystemPrompt(false);
    expect(prompt).toContain('"palettes"');
    expect(prompt).toContain('"styles"');
    expect(prompt).toContain('"fonts"');
    expect(prompt).not.toContain('"layouts"');
    expect(prompt).not.toContain('"effects"');
  });
});
