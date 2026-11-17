import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontStyle = 'default' | 'editorial' | 'mono';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  fontStyle: FontStyle;
  setFontStyle: (style: FontStyle) => void;
  hapticEnabled: boolean;
  setHapticEnabled: (enabled: boolean) => void;
  triggerHaptic: (durationMs?: number) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  themeMode: 'light',
  setThemeMode: () => {},
  toggleTheme: () => {},
  setTheme: () => {},
  fontStyle: 'default',
  setFontStyle: () => {},
  hapticEnabled: true,
  setHapticEnabled: () => {},
  triggerHaptic: () => {},
});

const getInitialThemeMode = (): ThemeMode => {
  try {
    const savedMode = localStorage.getItem('app_theme_mode_v2');
    if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
      return savedMode;
    }
    const saved = localStorage.getItem('app_theme_v2');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'light';
};

const getInitialFontStyle = (): FontStyle => {
  try {
    const saved = localStorage.getItem('app_font_style_v1');
    if (saved === 'default' || saved === 'editorial' || saved === 'mono') return saved;
  } catch {}
  return 'default';
};

const getInitialHaptic = (): boolean => {
  try {
    const saved = localStorage.getItem('app_haptic_v1');
    if (saved === 'false') return false;
  } catch {}
  return true;
};

function resolveSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {}
  }
  return 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);
  const [systemPref, setSystemPref] = useState<Theme>(resolveSystemTheme);
  const [fontStyle, setFontStyleState] = useState<FontStyle>(getInitialFontStyle);
  const [hapticEnabled, setHapticEnabledState] = useState<boolean>(getInitialHaptic);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (ev: MediaQueryListEvent) => setSystemPref(ev.matches ? 'dark' : 'light');
    try {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } catch {
      return undefined;
    }
  }, []);

  const theme: Theme = themeMode === 'system' ? systemPref : themeMode;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.dataset.theme = theme;
    try {
      localStorage.setItem('app_theme_mode_v2', themeMode);
      localStorage.setItem('app_theme_v2', theme);
      localStorage.setItem('app_theme', theme);
    } catch {}
  }, [theme, themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontStyle = fontStyle;
    try {
      localStorage.setItem('app_font_style_v1', fontStyle);
    } catch {}
  }, [fontStyle]);

  useEffect(() => {
    try {
      localStorage.setItem('app_haptic_v1', hapticEnabled ? 'true' : 'false');
    } catch {}
  }, [hapticEnabled]);

  const setThemeMode = useCallback((mode: ThemeMode) => setThemeModeState(mode), []);
  const setTheme = useCallback((next: Theme) => setThemeModeState(next), []);
  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      const resolved = prev === 'system' ? resolveSystemTheme() : prev;
      return resolved === 'dark' ? 'light' : 'dark';
    });
  }, []);
  const setFontStyle = useCallback((style: FontStyle) => setFontStyleState(style), []);
  const setHapticEnabled = useCallback((enabled: boolean) => setHapticEnabledState(enabled), []);
  const triggerHaptic = useCallback(
    (durationMs = 12) => {
      if (!hapticEnabled) return;
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(durationMs);
        }
      } catch {}
    },
    [hapticEnabled]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        setThemeMode,
        toggleTheme,
        setTheme,
        fontStyle,
        setFontStyle,
        hapticEnabled,
        setHapticEnabled,
        triggerHaptic,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
