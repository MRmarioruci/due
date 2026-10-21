// App-side language handling: picks the language from settings (or the phone) and
// switches it. Plain code imports `t` from './core'; this file needs native modules.

import { getLocales } from 'expo-localization';

import { getSettings, homeCountry, updateSettings } from '@/lib/settings';

import { isLang, setLang, type Lang } from './core';

export { LANGUAGES, locale, t, type Lang } from './core';

/** The phone's language when due has it, else English. */
export function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode;
  return isLang(code) ? code : 'en';
}

/** The language in use: the one picked in Settings, or the phone's. */
export function appLang(): Lang {
  const chosen = getSettings().language;
  return chosen && isLang(chosen) ? chosen : deviceLang();
}

/** Applies the saved choice; call at startup and whenever the region changes. */
export function syncLanguage() {
  setLang(appLang(), homeCountry());
}

/** null follows the phone. The root layout remounts on change, so every screen redraws. */
export function chooseLanguage(lang: Lang | null) {
  updateSettings({ language: lang });
  syncLanguage();
}

syncLanguage();
