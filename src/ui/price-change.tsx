import { View } from 'react-native';

import { locale, t } from '@/i18n/core';
import { longDate, shortDay } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { PriceChange } from '@/lib/price-change';

import { T } from './kit';
import { C, F } from './theme';

/**
 * "▲ 6.4%  CHF 23.20 more than the bill of 1 Dec": shown when a biller's amount changed. After a rise,
 * a contract that can still be reviewed gets its date underneath.
 */
export function PriceChangeLine({ change, currency, reviewBy }: { change: PriceChange; currency: string; reviewBy?: string | null }) {
  const up = change.pct > 0;
  return (
    <View style={{ marginTop: 12, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T style={{ fontFamily: F.monoMedium, fontSize: 12.5, color: up ? C.accent : C.muted }}>
          {up ? '▲' : '▼'} {Math.abs(change.pct).toLocaleString(locale(), { maximumFractionDigits: 1 })}%
        </T>
        <T style={{ flex: 1, fontSize: 13, color: C.muted }} numberOfLines={2}>
          {t(up ? 'price.up' : 'price.down', { diff: formatMoney(Math.abs(change.diffMinor), currency), date: shortDay(change.previousDate) })}
        </T>
      </View>
      {up && reviewBy && <T style={{ fontSize: 13, color: C.fg }}>{t('contract.priceUp', { date: longDate(reviewBy) })}</T>}
    </View>
  );
}
