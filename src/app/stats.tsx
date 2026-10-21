import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { todayIso } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { findSeries, monthlyFixedCosts, payeeKey } from '@/lib/recurring';
import { priceChange } from '@/lib/price-change';
import { exportYear } from '@/lib/tax-export-file';
import { paidYears } from '@/lib/tax-export';
import { Options } from '@/ui/choosers';
import { sheet, toast } from '@/ui/overlay';
import type { Bill } from '@/lib/types';
import { t } from '@/i18n/core';
import { cadenceLabel, categoryLabel } from '@/i18n/labels';
import { homeCurrency } from '@/lib/settings';
import { computeStats, type Period } from '@/lib/stats';
import { useBills } from '@/lib/store';
import { Amount, Eyebrow, Icon, IconButton, T } from '@/ui/kit';
import { Animated, enterRow, GrowBar, useCountUp } from '@/ui/motion';
import { C, F, GUTTER, themed } from '@/ui/theme';

const CHART_H = 150;

const PERIODS: { key: Period; label: () => string; current: () => string; prev: () => string }[] = [
  { key: 'week', label: () => t('stats.week'), current: () => t('stats.paidThisWeek'), prev: () => t('stats.lastWeek') },
  { key: 'month', label: () => t('stats.month'), current: () => t('stats.paidThisMonth'), prev: () => t('stats.lastMonth') },
  { key: 'year', label: () => t('stats.year'), current: () => t('stats.paidThisYear'), prev: () => t('stats.lastYear') },
];

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const bills = useBills();
  const [period, setPeriod] = useState<Period>('month');
  const [sel, setSel] = useState<number | null>(null);
  const s = useMemo(() => computeStats(bills, period, new Date(), homeCurrency()), [bills, period]);
  const series = useMemo(() => findSeries(bills, todayIso()).filter((x) => x.currency === s.currency), [bills, s.currency]);
  const p = PERIODS.find((x) => x.key === period)!;

  const n = s.buckets.length;
  const i = sel ?? n - 1;
  const v = s.buckets[i].minor;
  const prev = s.buckets[n - 2].minor;
  const max = Math.max(1, ...s.buckets.map((b) => b.minor));
  const catMax = Math.max(1, ...s.categories.map((c) => c.minor));
  const shownV = useCountUp(v);
  const sub =
    sel != null && sel !== n - 1
      ? t('stats.tapLastBar')
      : prev > 0
        ? t('stats.change', { change: `${v >= prev ? '+' : '−'}${Math.abs(Math.round(((v - prev) / prev) * 100))}%`, period: p.prev() })
        : t('stats.nothingPaid', { period: p.prev() });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 40 }}>
      <View style={st.header}>
        <IconButton label={t('common.backToBills')} onPress={() => goBack()}>
          <Icon name="back" />
        </IconButton>
        <T style={{ fontFamily: F.semibold, fontSize: 15 }}>{t('common.stats')}</T>
        <View style={{ width: 44 }} />
      </View>

      <View style={st.segment} accessibilityRole="tablist">
        {PERIODS.map((x) => {
          const on = x.key === period;
          return (
            <Pressable key={x.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setPeriod(x.key); setSel(null); }} style={[st.segItem, on && { backgroundColor: C.fg }]}>
              <T style={{ fontFamily: F.medium, fontSize: 13.5, color: on ? C.bg : C.muted }}>{x.label()}</T>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 22 }}>
        <Eyebrow>{sel != null && sel !== n - 1 ? t('stats.paidIn', { period: s.buckets[i].label }) : p.current()}</Eyebrow>
        <View style={{ marginTop: 8 }}>
          <Amount currency={s.currency} value={formatAmount(shownV, s.currency)} size={44} />
        </View>
        <T style={{ marginTop: 8, fontSize: 13.5, color: C.muted }}>{sub}</T>
      </View>

      <View style={{ marginTop: 28 }}>
        <View style={st.chart}>
          {s.buckets.map((b, k) => (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${b.label}: ${s.currency} ${formatAmount(b.minor, s.currency)}`} onPress={() => setSel(k)} style={st.barHit}>
              <GrowBar
                size={Math.max(2, (b.minor / max) * CHART_H)}
                delay={k * 45}
                style={{ width: '100%', maxWidth: 30, backgroundColor: k === i ? C.accent : C.barMuted, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}
              />
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {s.buckets.map((b, k) => (
            <T key={k} style={[st.barLabel, { color: k === i ? C.fg : C.dim }]} numberOfLines={1}>{b.label}</T>
          ))}
        </View>
      </View>

      <View style={st.tiles}>
        <View style={st.tile}>
          <T style={st.tileValue}>{s.paidCount ? `${s.onTime}/${s.paidCount}` : '—'}</T>
          <T style={st.tileLabel}>{t('stats.onTime')}</T>
        </View>
        <View style={[st.tile, st.tileBorder]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
            <T style={st.tileValue}>{s.avgDaysEarly != null ? s.avgDaysEarly.toFixed(1) : '—'}</T>
            {s.avgDaysEarly != null && <T style={st.tileUnit}>{t('stats.days')}</T>}
          </View>
          <T style={st.tileLabel}>{t('stats.beforeDue')}</T>
        </View>
        <View style={[st.tile, st.tileBorder]}>
          <T style={st.tileValue}>{s.paidCount}</T>
          <T style={st.tileLabel}>{t('stats.billsPaid')}</T>
        </View>
      </View>

      {s.savedMinor > 0 && (
        <T style={{ marginTop: 14, fontSize: 13.5, color: C.muted }}>
          <T style={{ fontSize: 13.5, color: C.accent }}>{s.currency} {formatAmount(s.savedMinor, s.currency)}</T> {t('stats.savedDiscounts')}
        </T>
      )}

      {series.length > 0 && (
        <View style={{ marginTop: 28 }}>
          <Eyebrow style={{ marginBottom: 8 }}>{t('stats.fixedCosts')}</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <T style={{ fontFamily: F.semibold, fontSize: 22, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>
              {s.currency} {formatAmount(monthlyFixedCosts(series, s.currency), s.currency)}
            </T>
            <T style={{ fontSize: 13, color: C.dim }}>{t('stats.perMonth')}</T>
          </View>
          {series.map((x, idx) => (
            <Animated.View key={x.key} entering={enterRow(idx)} style={st.seriesRow}>
              <T style={{ flex: 1, fontSize: 13.5 }} numberOfLines={1}>{x.payee}</T>
              <SeriesChange bills={bills} seriesKey={x.key} lastDue={x.lastDue} />
              <T style={{ fontSize: 12.5, color: C.dim }}>{cadenceLabel(x.cadence)}</T>
              <T style={{ width: 84, textAlign: 'right', fontSize: 13.5, color: C.muted, fontVariant: ['tabular-nums'] }}>{formatAmount(x.amountMinor, x.currency)}</T>
            </Animated.View>
          ))}
        </View>
      )}

      {s.categories.length > 0 && (
        <View style={{ marginTop: 28 }}>
          <Eyebrow style={{ marginBottom: 8 }}>{t('stats.byCategory')}</Eyebrow>
          {s.categories.map((c, idx) => (
            <Animated.View key={c.category} entering={enterRow(idx)} style={{ paddingVertical: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={{ fontSize: 13.5 }}>{categoryLabel(c.category)}</T>
                <T style={{ fontSize: 13.5, color: C.muted, fontVariant: ['tabular-nums'] }}>{formatAmount(c.minor, s.currency)}</T>
              </View>
              <View style={{ height: 4, backgroundColor: C.track }}>
                <GrowBar horizontal size={c.minor / catMax} delay={150 + idx * 60} style={{ height: 4, backgroundColor: C.muted }} />
              </View>
            </Animated.View>
          ))}
        </View>
      )}
      {paidYears(bills).length > 0 && (
        <View style={{ marginTop: 28 }}>
          <Eyebrow style={{ marginBottom: 6 }}>{t('tax.section')}</Eyebrow>
          <Pressable accessibilityRole="button" onPress={() => chooseExport(bills)} style={({ pressed }) => [st.exportRow, pressed && { backgroundColor: C.surface }]}>
            <Icon name="download" size={16} />
            <View style={{ flex: 1, gap: 3 }}>
              <T style={{ fontSize: 15 }}>{t('tax.export')}</T>
              <T style={{ fontSize: 12.5, color: C.dim }}>{t('tax.exportDetail')}</T>
            </View>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

/** "▲ 6%" next to a fixed cost whose latest bill changed against the one before. */
function SeriesChange({ bills, seriesKey, lastDue }: { bills: Bill[]; seriesKey: string; lastDue: string }) {
  const latest = bills.find((b) => payeeKey(b.payee) === seriesKey && b.dueDate === lastDue);
  const change = latest ? priceChange(latest, bills) : null;
  if (!change) return null;
  return (
    <T style={{ fontFamily: F.mono, fontSize: 11, color: change.pct > 0 ? C.accent : C.dim }}>
      {change.pct > 0 ? '▲' : '▼'} {Math.round(Math.abs(change.pct))}%
    </T>
  );
}

/** Year, then format: a spreadsheet for the accountant or a PDF summary. */
function chooseExport(bills: Bill[]) {
  const years = paidYears(bills);
  const pickFormat = (year: number) =>
    sheet.show({
      title: t('tax.title', { year }),
      message: t('tax.formatText'),
      actions: (['csv', 'pdf'] as const).map((f) => ({
        label: t(`tax.${f}`),
        kind: f === 'pdf' ? 'primary' : 'secondary',
        onPress: () => exportYear(bills, year, f).catch((e) => toast(t('tax.failed', { error: (e as Error).message }))),
      })),
    });
  if (years.length === 1) return pickFormat(years[0]);
  sheet.show({
    title: t('tax.export'),
    content: <Options selected={null} options={years.map((y) => ({ key: y, label: String(y), onPress: () => pickFormat(y) }))} />,
  });
}

const st = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  segment: { marginTop: 16, flexDirection: 'row', borderWidth: 1, borderColor: C.line, padding: 3 },
  segItem: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  chart: { height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderBottomWidth: 1, borderBottomColor: C.axis },
  barHit: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barLabel: { flex: 1, textAlign: 'center', fontFamily: F.mono, fontSize: 10 },
  tiles: { marginTop: 28, flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  tile: { flex: 1, paddingVertical: 18, paddingRight: 8, gap: 8 },
  tileBorder: { borderLeftWidth: 1, borderLeftColor: C.line, paddingLeft: 16 },
  tileValue: { fontFamily: F.semibold, fontSize: 22, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 12.5, lineHeight: 17, color: C.dim },
  seriesRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  tileUnit: { fontSize: 13, color: C.dim },
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line },
}));
