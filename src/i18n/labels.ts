// Labels for app values (categories, cadences, pay styles, …) in the current language.

import type { Cadence } from '@/lib/recurring';
import type { PayStyle } from '@/lib/reminder-plan';
import { countryByCode } from '@/lib/regions';
import type { Category } from '@/lib/types';

import { locale, t, type Key } from './core';

export const categoryLabel = (c: Category) => t(`cat.${c}` as Key);
export const cadenceLabel = (c: Cadence) => t(`cadence.${c}` as Key);
export const payStyleLabel = (s: PayStyle) => t(`style.${s}` as Key);
export const payStyleDetail = (s: PayStyle) => t(`style.${s}.detail` as Key);

/** Reminder lead time: "On the due date", "3 days before", "1 week before". */
export const leadLabel = (days: number) => (days === 0 ? t('lead.onDay') : days === 7 ? t('lead.week') : t('lead.days', { n: days }));

/** Country name in the app's language, falling back to the English name. */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    const name = new Intl.DisplayNames([locale()], { type: 'region' }).of(code.toUpperCase());
    if (name && name !== code.toUpperCase()) return name;
  } catch {}
  return countryByCode(code)?.name ?? code;
}
