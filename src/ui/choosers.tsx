import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { todayIso } from '@/lib/dates';
import { describePay, type PaySchedule } from '@/lib/plan';
import { countryByCode, COUNTRIES, CURRENCIES, currencyFor } from '@/lib/regions';
import { getSettings, updateSettings } from '@/lib/settings';

import { pickDate } from './calendar';
import { Icon, T } from './kit';
import { sheet, toast } from './overlay';
import { C, F } from './theme';

/** Sheets for picking settings, shared by onboarding and the settings screen. */

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** A list of choices with a check on the current one. */
export function Options<K extends string | number>({ options, selected }: { options: { key: K; label: string; detail?: string; onPress: () => void }[]; selected: K | null }) {
  return (
    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
      {options.map((o) => (
        <Pressable
          key={String(o.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: o.key === selected }}
          onPress={o.onPress}
          style={({ pressed }) => [st.row, pressed && { backgroundColor: C.surface }]}>
          <T style={[st.label, o.key === selected && { fontFamily: F.semibold }]} numberOfLines={1}>
            {o.label}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {o.detail && <T style={st.detail}>{o.detail}</T>}
            {o.key === selected && <Icon name="check" color={C.accent} size={18} />}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** Pay frequency, then the day it lands. `onDone` runs after a choice is saved. */
export function choosePay(onDone?: () => void) {
  const cur = getSettings().pay;
  const set = (pay: PaySchedule | null) => {
    updateSettings({ pay });
    sheet.hide();
    toast(pay ? `Payday: ${describePay(pay).toLowerCase()}` : 'Payday cleared');
    onDone?.();
  };

  const chooseMonthDay = () => {
    const current = cur?.every === 'month' ? cur.day : null;
    sheet.show({
      title: 'Which day of the month?',
      message: 'Weekend paydays count as the Friday before. Pick 31 for the last day of the month.',
      content: (
        <View style={st.dayGrid}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: d === current }} onPress={() => set({ every: 'month', day: d })} style={st.dayCell}>
              <View style={[st.dayInner, d === current && st.dayOn]}>
                <T style={{ fontSize: 15, fontVariant: ['tabular-nums'], color: d === current ? C.bg : C.fg }}>{d}</T>
              </View>
            </Pressable>
          ))}
        </View>
      ),
    });
  };

  const chooseWeekday = () => {
    const current = cur?.every === 'week' ? cur.weekday : null;
    sheet.show({
      title: 'Which day of the week?',
      content: <Options selected={current} options={WEEKDAYS.map((w, i) => ({ key: i + 1, label: w, onPress: () => set({ every: 'week', weekday: i + 1 }) }))} />,
    });
  };

  const chooseFortnight = async () => {
    const picked = await pickDate('When is your next payday?', cur?.every === '2weeks' ? cur.next : todayIso());
    if (picked) set({ every: '2weeks', next: picked });
  };

  sheet.show({
    title: 'How often are you paid?',
    content: (
      <Options
        selected={cur?.every ?? 'none'}
        options={[
          { key: 'month', label: 'Every month', onPress: chooseMonthDay },
          { key: '2weeks', label: 'Every other week', onPress: chooseFortnight },
          { key: 'week', label: 'Every week', onPress: chooseWeekday },
          { key: 'day', label: 'Every day', onPress: () => set({ every: 'day' }) },
          { key: 'none', label: 'Don’t plan around payday', onPress: () => set(null) },
        ]}
      />
    ),
  });
}

/** Country from the phone's location. Resolves with the ISO code, or null if refused or unknown. */
export async function countryFromLocation(): Promise<string | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;
  const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
  const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
  return place?.isoCountryCode ?? null;
}

/** Saves the country and, unless one was picked already, its currency. */
export function setCountry(code: string) {
  const currency = getSettings().currency ?? currencyFor(code);
  updateSettings({ country: code, ...(currency ? { currency } : {}) });
}

export function chooseCountry(onDone?: () => void) {
  sheet.show({
    title: 'Where do you live?',
    message: 'Sets your currency and helps read dates on bills.',
    content: (
      <SearchList
        placeholder="Search countries"
        items={COUNTRIES.map((c) => ({ key: c.code, label: c.name, detail: c.currency }))}
        selected={getSettings().country}
        onPick={(code) => {
          // A new country brings its own currency.
          updateSettings({ country: code, currency: currencyFor(code) ?? getSettings().currency });
          sheet.hide();
          toast(`${countryByCode(code)?.name}, ${currencyFor(code)}`);
          onDone?.();
        }}
      />
    ),
  });
}

export function chooseCurrency(onDone?: () => void) {
  sheet.show({
    title: 'Currency',
    message: 'Totals and new bills use it. Bills in other currencies are kept as they are.',
    content: (
      <SearchList
        placeholder="Search currencies"
        items={CURRENCIES.map((c) => ({ key: c, label: c }))}
        selected={getSettings().currency}
        onPick={(c) => {
          updateSettings({ currency: c });
          sheet.hide();
          onDone?.();
        }}
      />
    ),
  });
}

function SearchList({ items, selected, placeholder, onPick }: { items: { key: string; label: string; detail?: string }[]; selected: string | null; placeholder: string; onPick: (key: string) => void }) {
  const [q, setQ] = useState('');
  const shown = items.filter((i) => `${i.label} ${i.key} ${i.detail ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <View style={{ marginTop: 14 }}>
      <TextInput value={q} onChangeText={setQ} placeholder={placeholder} placeholderTextColor={C.dim} style={st.search} autoCorrect={false} accessibilityLabel={placeholder} />
      <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
        <Options selected={selected} options={shown.map((i) => ({ key: i.key, label: i.label, detail: i.detail, onPress: () => onPick(i.key) }))} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  label: { fontSize: 15, flexShrink: 1 },
  detail: { fontFamily: F.mono, fontSize: 12, color: C.dim },
  search: { height: 46, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, color: C.fg, fontFamily: F.regular, fontSize: 15 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  dayCell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: C.fg },
});
