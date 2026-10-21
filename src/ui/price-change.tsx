import { View } from 'react-native';

import { locale, t } from '@/i18n/core';
import { shortDay } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { PriceChange } from '@/lib/price-change';

import { T } from './kit';
import { C, F } from './theme';

/** "▲ 6.4%  CHF 23.20 more than the bill of 1 Dec": shown when a biller's amount changed. */
export function PriceChangeLine({ change, currency }: { change: PriceChange; currency: string }) {
  const up = change.pct > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
      <T style={{ fontFamily: F.monoMedium, fontSize: 12.5, color: up ? C.accent : C.muted }}>
        {up ? '▲' : '▼'} {Math.abs(change.pct).toLocaleString(locale(), { maximumFractionDigits: 1 })}%
      </T>
      <T style={{ flex: 1, fontSize: 13, color: C.muted }} numberOfLines={2}>
        {t(up ? 'price.up' : 'price.down', { diff: formatMoney(Math.abs(change.diffMinor), currency), date: shortDay(change.previousDate) })}
      </T>
    </View>
  );
}
