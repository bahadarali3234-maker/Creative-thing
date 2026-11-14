import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '@/app/context/ThemeContext';
import { matchTemplateConcept, matchPaletteCard, detectCatalogKind, TEMPLATE_CONCEPTS, PALETTE_CARDS } from '@/app/utils/designCatalog';

/** The exact option strings the server instructs the model to emit. */
const TEMPLATE_OPTIONS = [
  'Template 01 — Modern Minimal',
  'Template 02 — Premium Glassmorphism',
  'Template 03 — Editorial Creative',
  'Template 04 — Futuristic Advanced',
];
const PALETTE_OPTIONS = [
  'Palette 01 — Midnight Neon (dark)',
  'Palette 02 — Earthy Minimal (light)',
  'Palette 03 — Arctic Blue (light)',
  'Palette 04 — Obsidian Purple (dark)',
];

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme">{theme}</span>;
}

describe('light mode only', () => {
  it('always reports light and never applies the dark class', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(getByTestId('theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('website builder design catalog', () => {
  it('matches all four template option names emitted by the server', () => {
    for (const opt of TEMPLATE_OPTIONS) {
      expect(matchTemplateConcept(opt), opt).toBeDefined();
    }
    expect(TEMPLATE_CONCEPTS).toHaveLength(4);
    expect(detectCatalogKind(TEMPLATE_OPTIONS)).toBe('template');
  });

  it('matches all four palette option names (2 light, 2 dark) emitted by the server', () => {
    for (const opt of PALETTE_OPTIONS) {
      expect(matchPaletteCard(opt), opt).toBeDefined();
    }
    expect(PALETTE_CARDS).toHaveLength(4);
    expect(PALETTE_CARDS.filter((p) => p.mode === 'light')).toHaveLength(2);
    expect(PALETTE_CARDS.filter((p) => p.mode === 'dark')).toHaveLength(2);
    expect(detectCatalogKind(PALETTE_OPTIONS)).toBe('palette');
    for (const p of PALETTE_CARDS) {
      expect(p.swatches).toHaveLength(5);
      for (const s of p.swatches) expect(s.hex).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
