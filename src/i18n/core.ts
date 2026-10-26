// Translation core. Kept free of native modules, so plain logic (reminder texts, labels)
// can use it and still run under the unit tests, where the language is English.

import { de } from './de';
import { el } from './el';
import { en, type Key } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { nb } from './nb';
import { nl } from './nl';
import { pl } from './pl';
import { pt } from './pt';

export type Lang = 'en' | 'de' | 'fr' | 'it' | 'es' | 'pt' | 'nl' | 'pl' | 'nb' | 'el';
export type { Key };

/** Each language's own name, as shown in the language picker. */
export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'nb', name: 'Norsk' },
  { code: 'el', name: 'Ελληνικά' },
];

const DICTS: Record<Lang, Partial<Record<string, string>>> = { en, de, fr, it, es, pt, nl, pl, nb, el };

let lang: Lang = 'en';
let region: string | null = null;

export function setLang(next: Lang, regionCode?: string | null) {
  lang = next;
  if (regionCode !== undefined) region = regionCode;
}

export const currentLang = () => lang;

/** BCP 47 tag for Intl formatting, e.g. "de-CH": the app language with the home country. */
export const locale = () => (region ? `${lang}-${region}` : lang);

export const isLang = (x: unknown): x is Lang => LANGUAGES.some((l) => l.code === x);

/**
 * Translates `key`, filling {placeholders} from `vars`. Missing translations fall back to English.
 * Plural keys (`_one` / `_other`, plus `_few` / `_many` where a language needs them) are picked by `vars.n`.
 */
/** Plural category, with built-in rules for when the JS engine lacks Intl.PluralRules. */
function pluralCategory(n: number): string {
  try {
    if (typeof Intl.PluralRules === 'function') return new Intl.PluralRules(lang).select(n);
  } catch {}
  if (!Number.isInteger(n)) return 'other';
  if (lang === 'fr' || lang === 'pt') return n === 0 || n === 1 ? 'one' : 'other';
  if (lang === 'pl') {
    if (n === 1) return 'one';
    const d = n % 10;
    const dd = n % 100;
    return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'few' : 'many';
  }
  return n === 1 ? 'one' : 'other';
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  const own = DICTS[lang] as Record<string, string | undefined>;
  const base = en as Record<string, string>;
  let text: string | undefined;
  if (vars && typeof vars.n === 'number' && `${key}_one` in en) {
    // Languages with more forms (Polish: few/many) add `_few` / `_many` keys; the rest use one/other.
    const cat = pluralCategory(vars.n);
    const fallback = cat === 'one' ? 'one' : 'other';
    text = own[`${key}_${cat}`] ?? own[`${key}_${fallback}`] ?? base[`${key}_${fallback}`];
  }
  text ??= own[key] ?? base[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_: string, name: string) => (vars[name] != null ? String(vars[name]) : `{${name}}`)) : text;
}
