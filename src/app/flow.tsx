import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { locale, t } from '@/i18n/core';
import { cadenceLabel, categoryLabel } from '@/i18n/labels';
import { todayIso } from '@/lib/dates';
import { monthFlow, yearFlow, type FlowGroup } from '@/lib/flow';
import { formatAmount } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { latestBillOf } from '@/lib/reminders';
import { homeCurrency, monthlyIncome, useSettings } from '@/lib/settings';
import { useBills } from '@/lib/store';
import { Eyebrow, Icon, IconButton, T } from '@/ui/kit';
import { Animated, enterFade, enterRow } from '@/ui/motion';
import { Sankey, sankeyLayout, type SankeyNode } from '@/ui/sankey';
import { C, F, GUTTER, themed } from '@/ui/theme';

const SANKEY_H = 300;
const LABEL_H = 32;

/** "Where it goes": income on the left, flowing into bills by category and what's left. */
export default function FlowScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bills = useBills();
  const settings = useSettings();
  const [year, setYear] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const today = todayIso();
  const ccy = homeCurrency();
  const income = monthlyIncome(settings);

  const flow = (year ? yearFlow : monthFlow)(bills, income, ccy, today);
  const groupName = (g: FlowGroup) => (g.key === 'other' ? t('flow.other') : categoryLabel(g.key));
  // What's left leads in white; bills follow, the picked one in the accent.
  const picked = sel ?? flow.groups[0]?.key ?? 'left';
  const nodes: (SankeyNode & { name: string })[] = [
    ...(flow.leftMinor > 0 ? [{ key: 'left', name: t('flow.left'), minor: flow.leftMinor, color: C.fg, streamOpacity: 0.55 }] : []),
    ...flow.groups.map((g) => ({ key: g.key, name: groupName(g), minor: g.minor, color: g.key === picked ? C.accent : C.barMuted, streamOpacity: g.key === picked ? 0.75 : 0.12 })),
  ];
  const chartW = width - GUTTER * 2;
  const layout = sankeyLayout(nodes, Math.max(flow.incomeMinor, flow.billsMinor), chartW, SANKEY_H);
  const labelX = layout.x2 + 18;
  // Labels centre on their bar, but never overlap: small bars sit closer together than a label is tall.
  const labelTops: number[] = [];
  layout.nodes.forEach((n, i) => {
    const want = n.y + n.h / 2 - LABEL_H / 2;
    labelTops.push(i === 0 ? Math.max(-6, want) : Math.max(want, labelTops[i - 1] + LABEL_H));
  });
  const overflow = (labelTops[labelTops.length - 1] ?? 0) - (SANKEY_H - LABEL_H + 8);
  if (overflow > 0) for (let i = labelTops.length - 1, cap = SANKEY_H - LABEL_H + 8; i >= 0; i--, cap -= LABEL_H) labelTops[i] = Math.min(labelTops[i], cap);
  const pct = (minor: number) => `${Math.round((minor / Math.max(1, flow.incomeMinor)) * 100)}%`;
  const month = new Date().toLocaleDateString(locale(), { month: 'long' });
  const selected = flow.groups.find((g) => g.key === picked);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 32 }}>
        <View style={st.header}>
          <IconButton label={t('common.back')} onPress={() => goBack()} style={{ marginLeft: -12, borderWidth: 0 }}>
            <Icon name="back" />
          </IconButton>
          <T style={{ fontFamily: F.semibold, fontSize: 15 }}>{t('flow.title')}</T>
          <View style={{ width: 44 }} />
        </View>

        {income === 0 ? (
          <Animated.View entering={enterFade(0)} style={{ marginTop: 48, gap: 14 }}>
            <T style={{ fontSize: 30, letterSpacing: -1, lineHeight: 36 }}>{t('flow.emptyTitle')}</T>
            <T style={{ fontSize: 15, lineHeight: 22, color: C.muted }}>{t('flow.emptyText')}</T>
            <Pressable accessibilityRole="button" onPress={() => router.push('/income')} style={({ pressed }) => [st.primary, { marginTop: 18 }, pressed && { opacity: 0.85 }]}>
              <T style={st.primaryText}>{t('flow.addIncome')}</T>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            <View style={st.segment} accessibilityRole="tablist">
              {[false, true].map((y) => {
                const on = y === year;
                return (
                  <Pressable
                    key={String(y)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setYear(y);
                      setSel(null);
                    }}
                    style={[st.segItem, on && { backgroundColor: C.fg }]}>
                    <T style={{ fontFamily: F.medium, fontSize: 13.5, color: on ? C.bg : C.dim }}>{y ? t('flow.yearSoFar', { year: today.slice(0, 4) }) : month}</T>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 20 }}>
              <Eyebrow>{year ? t('flow.incomeYear') : t('flow.incomeMonth', { month: month.toUpperCase() })}</Eyebrow>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <T style={{ fontFamily: F.medium, fontSize: 15, color: C.dim }}>{ccy}</T>
                <T style={st.big}>{formatAmount(flow.incomeMinor, ccy)}</T>
              </View>
              <T style={{ marginTop: 10, fontSize: 14, color: C.muted }}>
                {t('flow.billsTake')} <T style={{ fontSize: 14, color: C.fg }}>{pct(flow.billsMinor)}</T> ·{' '}
                {flow.leftMinor >= 0 ? (
                  <>
                    <T style={{ fontSize: 14, color: C.fg }}>{`${ccy} ${formatAmount(flow.leftMinor, ccy)}`}</T> {t('flow.leftWord')}
                  </>
                ) : (
                  <T style={{ fontSize: 14, color: C.accent }}>{t('flow.over', { amount: `${ccy} ${formatAmount(-flow.leftMinor, ccy)}` })}</T>
                )}
              </T>
            </View>

            {flow.groups.length === 0 ? (
              <T style={{ marginTop: 40, fontSize: 14, lineHeight: 20, color: C.muted }}>{t('flow.noBills')}</T>
            ) : (
              <View key={year ? 'year' : 'month'} style={{ marginTop: 26, height: SANKEY_H + 8 }}>
                <Sankey layout={layout} width={chartW} height={SANKEY_H} incomeColor={C.fg} />
                {layout.nodes.map((n, i) => {
                  const node = nodes[i];
                  const on = n.key === picked || n.key === 'left';
                  const top = labelTops[i];
                  return (
                    <Animated.View key={n.key} entering={enterFade(900 + i * 110)} style={{ position: 'absolute', left: labelX, right: 0, top }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: n.key === picked }}
                        accessibilityLabel={`${node.name}, ${ccy} ${formatAmount(n.minor, ccy)}, ${pct(n.minor)}`}
                        disabled={n.key === 'left'}
                        onPress={() => setSel(n.key)}
                        style={st.label}>
                        <View style={{ flexShrink: 1 }}>
                          <T style={{ fontSize: 13, fontFamily: on ? F.semibold : F.regular, color: on ? C.fg : C.muted }} numberOfLines={1}>{node.name}</T>
                          <T style={{ fontFamily: F.mono, fontSize: 10, color: C.dim }}>{pct(n.minor)}</T>
                        </View>
                        <T style={{ fontSize: 13, color: on ? C.fg : C.muted, fontVariant: ['tabular-nums'] }}>{formatAmount(n.minor, ccy)}</T>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            )}

            {selected && (
              <View style={st.detail}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <T style={[st.eyebrow, { color: C.accent }]}>{groupName(selected).toUpperCase()}</T>
                  <T style={{ fontSize: 13, color: C.muted }}>{`${ccy} ${formatAmount(selected.minor, ccy)}`}</T>
                </View>
                {selected.rows.map((r, i) => (
                  <Animated.View key={`${picked}-${r.key}`} entering={enterRow(i)}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const b = latestBillOf(r.payee);
                        if (b) router.push({ pathname: '/bill/[id]', params: { id: b.id } });
                      }}
                      style={st.row}>
                      <T style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                        {r.payee}
                        {r.cadence && r.cadence !== 'monthly' && !year && <T style={{ fontSize: 12.5, color: C.dim }}>{` · ${t('flow.perMonth', { cadence: cadenceLabel(r.cadence).toLowerCase() })}`}</T>}
                      </T>
                      <T style={{ fontSize: 14, fontVariant: ['tabular-nums'] }}>{formatAmount(r.minor, ccy)}</T>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            )}

            <Pressable accessibilityRole="button" onPress={() => router.push('/income')} style={st.change}>
              <T style={{ fontSize: 13, color: C.dim }}>
                {t('flow.incomeLine', { amount: `${ccy} ${formatAmount(income, ccy)}` })} · <T style={{ fontSize: 13, color: C.fg, textDecorationLine: 'underline' }}>{t('flow.change')}</T>
              </T>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  segment: { marginTop: 10, flexDirection: 'row', borderWidth: 1, borderColor: C.line, padding: 3 },
  segItem: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  big: { fontFamily: F.regular, fontSize: 40, letterSpacing: -1.8, lineHeight: 44, fontVariant: ['tabular-nums'] },
  label: { height: LABEL_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1 },
  detail: { marginTop: 18, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  change: { marginTop: 20, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  primary: { height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fg },
  primaryText: { fontFamily: F.semibold, fontSize: 15, color: C.bg },
}));
