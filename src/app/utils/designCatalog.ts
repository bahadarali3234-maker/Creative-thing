/**
 * Design catalog for the staged website-builder workflow.
 * The AI references these option names in its ```question blocks; the chat UI
 * detects them and renders real visual previews instead of plain text options.
 */

export interface TemplateConcept {
  id: string;
  name: string;
  matchers: string[];
  description: string;
  /** CSS mockup palette: [page bg, surface, text, accent, muted] */
  mock: { bg: string; surface: string; text: string; accent: string; muted: string };
  glass?: boolean;
  serif?: boolean;
  glow?: boolean;
}

export const TEMPLATE_CONCEPTS: TemplateConcept[] = [
  {
    id: 'modern-minimal',
    name: 'Template 01 — Modern Minimal',
    matchers: ['modern minimal', 'minimal premium', 'template 01'],
    description: 'Clean layouts, generous whitespace, premium typography, elegant cards with subtle shadows.',
    mock: { bg: '#FFFFFF', surface: '#F6F7F9', text: '#111318', accent: '#2563EB', muted: '#8A9099' },
  },
  {
    id: 'glassmorphism',
    name: 'Template 02 — Premium Glassmorphism',
    matchers: ['glassmorphism', 'glass', 'template 02'],
    description: 'Frosted glass panels, layered luminous gradients, translucent cards and smooth lighting.',
    mock: { bg: '#0B1020', surface: 'rgba(255,255,255,0.08)', text: '#F4F7FF', accent: '#7DD3FC', muted: '#9FB0D0' },
    glass: true,
  },
  {
    id: 'editorial',
    name: 'Template 03 — Editorial Creative',
    matchers: ['editorial', 'creative', 'luxury editorial', 'template 03'],
    description: 'Bold typography, large imagery, asymmetric layouts with strong visual hierarchy.',
    mock: { bg: '#FAF8F4', surface: '#FFFDF9', text: '#17130E', accent: '#C2410C', muted: '#9C948A' },
    serif: true,
  },
  {
    id: 'futuristic',
    name: 'Template 04 — Futuristic Advanced',
    matchers: ['futuristic', 'advanced', 'telemetry', 'template 04'],
    description: 'Modern dark interface, glowing accents, layered components and subtle motion.',
    mock: { bg: '#07080C', surface: '#101218', text: '#F1F5FA', accent: '#22D3EE', muted: '#6B7688' },
    glow: true,
  },
];

export function matchTemplateConcept(option: string): TemplateConcept | undefined {
  const lower = (option || '').toLowerCase();
  return TEMPLATE_CONCEPTS.find((t) => t.matchers.some((m) => lower.includes(m)));
}

export interface PaletteCard {
  id: string;
  name: string;
  matchers: string[];
  mode: 'light' | 'dark';
  tags: string[];
  tagline: string;
  /** 5 swatches in role order: Primary, Secondary, Tertiary/Accent, Accent, Background */
  swatches: Array<{ hex: string; role: string; dark?: boolean }>;
}

export const PALETTE_CARDS: PaletteCard[] = [
  {
    id: 'midnight-neon',
    name: 'Midnight Neon',
    matchers: ['midnight neon', 'midnight', 'neon'],
    mode: 'dark',
    tags: ['Bold', 'Modern', 'Futuristic', 'Versatile'],
    tagline: 'A sleek, modern palette with dark tones and electric accents. Perfect for SaaS and futuristic interfaces.',
    swatches: [
      { hex: '#0F172A', role: 'Primary' },
      { hex: '#7C3AED', role: 'Secondary' },
      { hex: '#22D3EE', role: 'Accent' },
      { hex: '#A78BFA', role: 'Tertiary' },
      { hex: '#EDE9FE', role: 'Background' },
    ],
  },
  {
    id: 'earthy-minimal',
    name: 'Earthy Minimal',
    matchers: ['earthy minimal', 'earthy', 'natural'],
    mode: 'light',
    tags: ['Warm', 'Natural', 'Elegant', 'Versatile'],
    tagline: 'A warm, sophisticated palette with natural tones. Perfect for lifestyle brands and premium interfaces.',
    swatches: [
      { hex: '#2E3A2F', role: 'Primary' },
      { hex: '#6B7F5B', role: 'Secondary' },
      { hex: '#D9C9B2', role: 'Tertiary' },
      { hex: '#C96F4F', role: 'Accent' },
      { hex: '#F8F6EE', role: 'Background' },
    ],
  },
  {
    id: 'arctic-blue',
    name: 'Arctic Blue',
    matchers: ['arctic blue', 'arctic', 'blue'],
    mode: 'light',
    tags: ['Fresh', 'Trustworthy', 'Clean', 'Corporate'],
    tagline: 'A crisp, professional palette of deep blues and sky accents. Ideal for finance, tech and healthcare.',
    swatches: [
      { hex: '#172554', role: 'Primary' },
      { hex: '#2563EB', role: 'Secondary' },
      { hex: '#93C5FD', role: 'Tertiary' },
      { hex: '#06B6D4', role: 'Accent' },
      { hex: '#F0F7FF', role: 'Background' },
    ],
  },
  {
    id: 'obsidian-purple',
    name: 'Obsidian Purple',
    matchers: ['obsidian purple', 'obsidian', 'purple'],
    mode: 'dark',
    tags: ['Rich', 'Premium', 'Creative', 'Bold'],
    tagline: 'A deep, dramatic palette of obsidian darks with violet highlights for creative and premium brands.',
    swatches: [
      { hex: '#10111B', role: 'Primary' },
      { hex: '#6D28D9', role: 'Secondary' },
      { hex: '#22D3EE', role: 'Accent' },
      { hex: '#A78BFA', role: 'Tertiary' },
      { hex: '#171827', role: 'Background' },
    ],
  },
];

export function matchPaletteCard(option: string): PaletteCard | undefined {
  const lower = (option || '').toLowerCase();
  return PALETTE_CARDS.find((p) => p.matchers.some((m) => lower.includes(m)));
}

/** True when at least two options of a question match one catalog kind. */
export function detectCatalogKind(options: string[]): 'template' | 'palette' | null {
  const tpl = options.filter((o) => matchTemplateConcept(o)).length;
  const pal = options.filter((o) => matchPaletteCard(o)).length;
  if (pal >= 2) return 'palette';
  if (tpl >= 2) return 'template';
  return null;
}
