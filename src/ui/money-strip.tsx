import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n/core';

import { Icon, T } from './kit';
import { LEFT, SPLIT, useMoneyFlow } from './money-flow';
import { GrowBar } from './motion';
import { C, F, currentTheme, themed } from './theme';

/**
 * "Where it goes" in one line: this month's income as a bar split into bills, what's set aside and
 * what's left, growing in from the left. Tapping it opens the full chart. Before an income is set it
 * shows a grey bar inviting to.
 */
export function MoneyStrip({ delay = 0 }: { delay?: number }) {
  const m = useMoneyFlow();
  const theme = currentTheme();
  const free = Math.max(0, m.flow.leftMinor - m.splitTotal);
  const total = Math.max(1, m.flow.billsMinor + m.splitTotal + free);
  const parts =
    m.income > 0
      ? [
          { key: 'bills', frac: m.flow.billsMinor / total, color: C.accent, text: `${t('flow.summaryBills')} ${m.pct(m.flow.billsMinor)}` },
          { key: 'splits', frac: m.splitTotal / total, color: SPLIT[theme], text: `${t('flow.summarySplits')} ${m.pct(m.splitTotal)}` },
          { key: 'left', frac: free / total, color: LEFT[theme], text: `${t('flow.left')} ${m.pct(free)}` },
        ].filter((p) => p.frac > 0)
      : [
          { key: 'a', frac: 0.5, color: C.border, text: '' },
          { key: 'b', frac: 0.3, color: C.tick, text: '' },
          { key: 'c', frac: 0.2, color: C.track, text: '' },
        ];

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('flow.title')} onPress={() => router.push('/flow')} style={({ pressed }) => [st.wrap, pressed && { backgroundColor: C.surface }]}>
      <View style={st.head}>
        <T style={st.eyebrow}>{t('flow.stripTitle')}</T>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <Icon name="back" size={13} color={C.dim} />
        </View>
      </View>
      <View style={st.bar}>
        {parts.map((p, i) => (
          <View key={p.key} style={{ flex: p.frac, height: 6 }}>
            <GrowBar horizontal size={1} delay={delay + i * 260} style={{ height: 6, backgroundColor: p.color }} />
          </View>
        ))}
      </View>
      {m.income > 0 ? (
        <View style={st.legend}>
          {parts.map((p) => (
            <View key={p.key} style={st.legendItem}>
              <View style={[st.swatch, { backgroundColor: p.color }]} />
              <T style={st.legendText} numberOfLines={1}>{p.text}</T>
            </View>
          ))}
        </View>
      ) : (
        <T style={[st.legendText, { marginTop: 10 }]}>{t('flow.stripInvite')}</T>
      )}
    </Pressable>
  );
}

const st = themed(() => StyleSheet.create({
  wrap: { paddingVertical: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.dim },
  bar: { marginTop: 10, flexDirection: 'row', gap: 3 },
  legend: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 7, height: 7 },
  legendText: { fontSize: 12.5, color: C.muted },
}));
