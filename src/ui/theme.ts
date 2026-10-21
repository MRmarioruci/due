// Two themes from the design canvas: ink (dark, the default) and paper (light). Hairlines, one
// accent for urgency and the brand dot. `C` holds the active palette; `themed()` style sheets
// rebuild from it, and the root layout remounts the screens when the theme changes.

export type Palette = {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  dim: string;
  line: string;
  lineSoft: string;
  border: string;
  barMuted: string;
  accent: string;
  paper: string;
  /** Bottom sheet panel and toast. */
  sheet: string;
  backdrop: string;
  /** Empty part of a progress/category bar, and the faint ruler ticks. */
  track: string;
  tick: string;
  /** Chart baseline and neutral tag borders. */
  axis: string;
  /** Pinned footers over scrolling content. */
  footer: string;
};

export const DARK: Palette = {
  bg: '#0a0a0a',
  surface: '#141414',
  fg: '#ededed',
  muted: '#a1a1a1',
  dim: '#8f8f8f',
  line: '#1f1f1f',
  lineSoft: '#1a1a1a',
  border: '#262626',
  barMuted: '#5f5f5f',
  accent: '#FF5A36',
  paper: '#f3f1ec',
  sheet: '#111111',
  backdrop: 'rgba(0,0,0,0.6)',
  track: '#161616',
  tick: '#2a2a2a',
  axis: '#333333',
  footer: 'rgba(10,10,10,0.94)',
};

/** Contrast-checked on white: accent 5.0:1, dim 5.3:1, muted 7.7:1. */
export const LIGHT: Palette = {
  bg: '#ffffff',
  surface: '#f4f4f5',
  fg: '#0a0a0a',
  muted: '#52525b',
  dim: '#6b6b73',
  line: '#e4e4e7',
  lineSoft: '#ededee',
  border: '#d4d4d8',
  barMuted: '#a1a1aa',
  accent: '#CC3A16',
  paper: '#f3f1ec',
  sheet: '#ffffff',
  backdrop: 'rgba(0,0,0,0.35)',
  track: '#ececee',
  tick: '#d4d4d8',
  axis: '#c4c4cc',
  footer: 'rgba(255,255,255,0.94)',
};

export type ThemeName = 'dark' | 'light';

/** The active palette. Mutated in place by applyTheme, so `C.bg` always reads the current one. */
export const C: Palette = { ...DARK };

let current: ThemeName = 'dark';
let version = 0;

export const currentTheme = () => current;

export function applyTheme(name: ThemeName) {
  if (name === current) return;
  Object.assign(C, name === 'dark' ? DARK : LIGHT);
  current = name;
  version++;
}

/**
 * A style sheet that's rebuilt from the active palette when the theme changes. Use like
 * `const st = themed(() => StyleSheet.create({ … }))`; reading `st.row` builds it on first use.
 */
export function themed<T extends object>(make: () => T): T {
  let cache: { v: number; sheet: T } | null = null;
  return new Proxy({} as T, {
    get(_, key) {
      if (!cache || cache.v !== version) cache = { v: version, sheet: make() };
      return (cache.sheet as Record<string | symbol, unknown>)[key];
    },
  });
}

export const F = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const GUTTER = 20;
