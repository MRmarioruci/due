import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fromIso, toIso, todayIso } from '@/lib/dates';
import { locale, t } from '@/i18n/core';

import { Icon, T } from './kit';
import { sheet } from './overlay';
import { C, F } from './theme';

/** Month grid, weeks starting Monday. */
export function Calendar({ value, onChange }: { value: string | null; onChange: (iso: string) => void }) {
  const today = todayIso();
  const start = fromIso(value ?? today);
  const [month, setMonth] = useState(new Date(start.getFullYear(), start.getMonth(), 1));

  const first = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => toIso(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <View style={{ marginTop: 16 }}>
      <View style={st.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.prev')} onPress={() => shift(-1)} style={st.nav}>
          <Icon name="back" size={16} />
        </Pressable>
        <T style={{ fontFamily: F.semibold, fontSize: 15 }}>{month.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</T>
        <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.next')} onPress={() => shift(1)} style={[st.nav, { transform: [{ rotate: '180deg' }] }]}>
          <Icon name="back" size={16} />
        </Pressable>
      </View>
      <View style={st.row}>
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => new Date(2024, 0, wd).toLocaleDateString(locale(), { weekday: 'narrow' })).map((d, i) => (
          <T key={i} style={st.dow}>{d}</T>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={st.row}>
          {cells.slice(w * 7, w * 7 + 7).map((iso, i) => {
            if (!iso) return <View key={i} style={st.cell} />;
            const on = iso === value;
            const isToday = iso === today;
            return (
              <Pressable key={iso} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={fromIso(iso).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })} onPress={() => onChange(iso)} style={st.cell}>
                <View style={[st.day, isToday && st.today, on && st.selected]}>
                  <T style={{ fontSize: 14, fontVariant: ['tabular-nums'], color: on ? C.bg : i >= 5 ? C.dim : C.fg }}>{Number(iso.slice(8))}</T>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Opens the calendar in a sheet; resolves with the picked day, or null when dismissed. */
export function pickDate(title: string, value: string | null): Promise<string | null> {
  return new Promise((resolve) => {
    let picked = value;
    let settled = false;
    const done = (v: string | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const render = () =>
      sheet.show({
        title,
        content: (
          <Calendar
            value={picked}
            onChange={(iso) => {
              picked = iso;
              render();
            }}
          />
        ),
        onDismiss: () => done(null),
        actions: [{ label: t('common.done'), onPress: () => done(picked) }],
      });
    render();
  });
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontFamily: F.mono, fontSize: 11, color: C.dim, paddingVertical: 8 },
  cell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: C.barMuted },
  selected: { backgroundColor: C.fg, borderColor: C.fg },
});
