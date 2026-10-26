import { afterEach, describe, expect, it } from 'vitest';

import { LANGUAGES, setLang, t } from './core';
import { de } from './de';
import { el } from './el';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it as itDict } from './it';
import { nb } from './nb';
import { nl } from './nl';
import { pl } from './pl';
import { pt } from './pt';

const DICTS: Record<string, Record<string, string | undefined>> = { de, fr, it: itDict, es, pt, nl, pl, nb, el };
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLang('en', null));

describe('translations', () => {
  it('cover all 10 languages', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(['de', 'el', 'en', 'es', 'fr', 'it', 'nb', 'nl', 'pl', 'pt']);
  });

  for (const [code, dict] of Object.entries(DICTS)) {
    it(`${code} translates every English text`, () => {
      const missing = Object.keys(en).filter((k) => !dict[k]);
      expect(missing).toEqual([]);
    });

    it(`${code} keeps the same placeholders`, () => {
      const wrong = Object.entries(en).filter(([k, v]) => {
        const own = dict[k];
        if (!own) return false;
        // English ordinals ({nth}) are replaced by the plain day number elsewhere.
        const want = placeholders(v).map((p) => (p === 'nth' ? 'day' : p));
        return JSON.stringify(placeholders(own)) !== JSON.stringify(want.sort());
      });
      expect(wrong.map(([k]) => k)).toEqual([]);
    });

    it(`${code} has no keys English doesn't know`, () => {
      const base = (k: string) => k.replace(/_(few|many)$/, '_one');
      expect(Object.keys(dict).filter((k) => !(base(k) in en))).toEqual([]);
    });
  }
});

describe('t()', () => {
  it('fills placeholders and picks plurals', () => {
    expect(t('home.open', { n: 1 })).toBe('1 bill open');
    expect(t('home.open', { n: 3 })).toBe('3 bills open');
    setLang('de');
    expect(t('home.open', { n: 3 })).toBe('3 offene Rechnungen');
  });

  it('uses Polish few/many forms', () => {
    setLang('pl');
    expect(t('home.open', { n: 1 })).toBe('1 otwarty rachunek');
    expect(t('home.open', { n: 3 })).toBe('3 otwarte rachunki');
    expect(t('home.open', { n: 5 })).toBe('5 otwartych rachunków');
    expect(t('home.open', { n: 22 })).toBe('22 otwarte rachunki');
  });

  it('falls back to English for a missing text', () => {
    setLang('fr');
    expect(t('common.ok')).toBe('OK');
  });
});
