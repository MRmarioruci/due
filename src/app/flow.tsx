import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n/core';
import { cadenceLabel } from '@/i18n/labels';
import { formatAmount } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { latestBillOf } from '@/lib/reminders';
import type { SankeyNode } from '@/lib/sankey-model';
import { Eyebrow, Icon, IconButton, T } from '@/ui/kit';
import { useMoneyFlow, type Period } from '@/ui/money-flow';
import { Animated, enterFade, enterRow } from '@/ui/motion';
import { Sankey } from '@/ui/sankey';
import { C, F, GUTTER, themed } from '@/ui/theme';

const CHART_H = 380;
const LABEL_W = 92;
/** Quick picks for a first split; each opens the editor with its name filled in. */
const SUGGESTED = ['flow.suggest.savings', 'flow.suggest.investing', 'flow.suggest.groceries', 'flow.suggest.fun'] as const;

/** "Where it goes": income splitting into bills (by category), the user's own splits and what's left. */
export default function FlowScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<Period>('month');
  const [sel, setSel] = useState<string | null>(null);
  const m = useMoneyFlow(period);
  const chartW = width - GUTTER * 2;
  const selected = m.model.nodes.find((n) => n.id === sel) ?? null;
  const free = m.flow.leftMinor - m.splitTotal;

  function press(n: SankeyNode) {
    if (n.kind === 'split') return router.push({ pathname: '/split', params: { id: n.id.slice('split:'.length) } });
    if (n.kind === 'income' || n.kind === 'source' || n.kind === 'shortfall') return router.push('/income');
    setSel(n.id === sel ? null : n.id);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 32 }}>
        <View style={st.header}>
          <IconButton label={t('common.back')} onPress={() => goBack()} style={{ marginLeft: -12, borderWidth: 0 }}>
            <Icon name="back" />
          </IconButton>
          <T style={{ fontFamily: F.semibold, fontSize: 15 }}>{t('flow.title')}</T>
          {m.income > 0 ? (
            <IconButton label={t('flow.share')} onPress={() => router.push({ pathname: '/flow-share', params: { period } })} style={{ marginRight: -12, borderWidth: 0 }}>
              <Icon name="share" />
            </IconButton>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {m.income === 0 ? (
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
              {(['month', 'year'] as const).map((p) => {
                const on = p === period;
                return (
                  <Pressable
                    key={p}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setPeriod(p);
                      setSel(null);
                    }}
                    style={[st.segItem, on && { backgroundColor: C.fg }]}>
                    <T style={{ fontFamily: F.medium, fontSize: 13.5, color: on ? C.bg : C.dim }}>{p === 'month' ? t('flow.thisMonth') : t('flow.yearSoFar', { year: new Date().getFullYear() })}</T>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 20 }}>
              <Eyebrow>{m.label.toUpperCase()}</Eyebrow>
              <T style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: C.muted }}>
                {t('flow.summaryBills')} <T style={st.hl}>{m.pct(m.flow.billsMinor)}</T>
                {m.splitTotal > 0 && (
                  <>
                    {' · '}
                    {t('flow.summarySplits')} <T style={st.hl}>{m.pct(m.splitTotal)}</T>
                  </>
                )}
                {' · '}
                {free >= 0 ? (
                  <>
                    <T style={st.hl}>{`${m.ccy} ${m.short(free)}`}</T> {t('flow.leftWord')}
                  </>
                ) : (
                  <T style={[st.hl, { color: C.accent }]}>{t('flow.over', { amount: `${m.ccy} ${m.short(-free)}` })}</T>
                )}
              </T>
            </View>

            <View key={period} style={{ marginTop: 24 }}>
              <Sankey model={m.model} width={chartW} height={CHART_H} labelW={LABEL_W} styleOf={m.styleOf(true)} selected={sel} onPress={press} />
            </View>
            <T style={st.hint}>{t('flow.hint')}</T>

            {selected && (selected.kind === 'category' || selected.kind === 'bills' || selected.kind === 'left') && (
              <View style={st.section}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <T style={[st.eyebrow, { color: C.accent }]}>{m.nameOf(selected).toUpperCase()}</T>
                  <T style={{ fontSize: 13, color: C.muted }}>{`${m.ccy} ${formatAmount(selected.minor, m.ccy)}`}</T>
                </View>
                {selected.kind === 'left' ? (
                  <T style={{ marginTop: 10, fontSize: 13.5, lineHeight: 20, color: C.muted }}>{t('flow.leftText')}</T>
                ) : (
                  (selected.kind === 'bills' ? m.flow.groups.flatMap((g) => g.rows) : (m.flow.groups.find((g) => `cat:${g.key}` === selected.id)?.rows ?? []))
                    .slice()
                    .sort((a, b) => b.minor - a.minor)
                    .map((r, i) => (
                      <Animated.View key={`${selected.id}-${r.key}`} entering={enterRow(i)}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            const b = latestBillOf(r.payee);
                            if (b) router.push({ pathname: '/bill/[id]', params: { id: b.id } });
                          }}
                          style={st.row}>
                          <T style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                            {r.payee}
                            {r.cadence && r.cadence !== 'monthly' && period === 'month' && <T style={{ fontSize: 12.5, color: C.dim }}>{` · ${t('flow.perMonth', { cadence: cadenceLabel(r.cadence).toLowerCase() })}`}</T>}
                          </T>
                          <T style={{ fontSize: 14, fontVariant: ['tabular-nums'] }}>{formatAmount(r.minor, m.ccy)}</T>
                        </Pressable>
                      </Animated.View>
                    ))
                )}
              </View>
            )}

            <View style={st.section}>
              <T style={st.eyebrow}>{t('flow.splitsTitle')}</T>
              <T style={{ marginTop: 6, fontSize: 13, lineHeight: 19, color: C.dim }}>{t('flow.splitsText')}</T>
              {m.splits.map((s, i) => (
                <Animated.View key={s.id} entering={enterRow(i)}>
                  <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/split', params: { id: s.id } })} style={st.row}>
                    <T style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{s.name}</T>
                    <T style={{ fontSize: 14, fontVariant: ['tabular-nums'] }}>{formatAmount(s.monthlyMinor, m.ccy)}</T>
                    <T style={{ fontSize: 12, color: C.dim }}>{t('flow.perMonthShort')}</T>
                  </Pressable>
                </Animated.View>
              ))}
              {m.splits.length === 0 && (
                <View style={st.chips}>
                  {SUGGESTED.map((k) => (
                    <Pressable key={k} accessibilityRole="button" onPress={() => router.push({ pathname: '/split', params: { name: t(k) } })} style={({ pressed }) => [st.chip, pressed && { backgroundColor: C.surface }]}>
                      <Icon name="plus" size={12} color={C.muted} />
                      <T style={{ fontSize: 13 }}>{t(k)}</T>
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable accessibilityRole="button" onPress={() => router.push('/split')} style={st.add}>
                <Icon name="plus" size={16} />
                <T style={{ fontSize: 14.5 }}>{t('flow.addSplit')}</T>
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" onPress={() => router.push('/income')} style={st.change}>
              <T style={{ fontSize: 13, color: C.dim }}>
                {t('flow.incomeLine', { amount: `${m.ccy} ${formatAmount(m.income, m.ccy)}` })} · <T style={{ fontSize: 13, color: C.fg, textDecorationLine: 'underline' }}>{t('flow.change')}</T>
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
  hl: { fontSize: 15, color: C.fg },
  hint: { marginTop: 10, fontSize: 12, color: C.dim, textAlign: 'center' },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.dim },
  section: { marginTop: 22, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  add: { marginTop: 6, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  change: { marginTop: 16, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  primary: { height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fg },
  primaryText: { fontFamily: F.semibold, fontSize: 15, color: C.bg },
}));
