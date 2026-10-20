import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatHour } from '@/lib/dates';
import { goBack } from '@/lib/nav';
import { remindersAvailable, rescheduleAll } from '@/lib/reminders';
import { seedSampleBills } from '@/lib/seed';
import { updateSettings, useSettings } from '@/lib/settings';
import { Button, Eyebrow, Icon, IconButton, T } from '@/ui/kit';
import { C, F, GUTTER } from '@/ui/theme';

const HOURS = [7, 8, 9, 12, 18, 20];
const LEADS = [
  { days: 0, label: 'On the day' },
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const s = useSettings();

  function setPayday(day: number | null) {
    updateSettings({ payday: day == null ? null : Math.min(31, Math.max(1, day)) });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 40 }}>
      <View style={st.header}>
        <IconButton label="Back" onPress={goBack}>
          <Icon name="back" />
        </IconButton>
        <T style={{ fontFamily: F.semibold, fontSize: 15 }}>Settings</T>
        <View style={{ width: 44 }} />
      </View>

      <Eyebrow style={st.section}>Payday</Eyebrow>
      <T style={st.help}>The day your salary arrives. due then shows which bills fall before it and which can wait.</T>
      <View style={st.stepper}>
        <Pressable accessibilityRole="button" accessibilityLabel="Earlier payday" onPress={() => setPayday((s.payday ?? 26) - 1)} style={st.stepBtn}>
          <T style={st.stepGlyph}>−</T>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T style={st.stepValue}>{s.payday ? `${s.payday}.` : 'Not set'}</T>
          {s.payday != null && <T style={{ fontSize: 12.5, color: C.dim }}>of every month</T>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Later payday" onPress={() => setPayday((s.payday ?? 24) + 1)} style={st.stepBtn}>
          <T style={st.stepGlyph}>+</T>
        </Pressable>
      </View>
      {s.payday != null && (
        <Pressable accessibilityRole="button" onPress={() => setPayday(null)} style={{ alignSelf: 'flex-start', paddingVertical: 10 }}>
          <T style={{ fontSize: 13.5, color: C.muted, textDecorationLine: 'underline' }}>Clear payday</T>
        </Pressable>
      )}

      <Eyebrow style={st.section}>Reminder time</Eyebrow>
      <View style={st.chips}>
        {HOURS.map((h) => (
          <Chip key={h} label={formatHour(h)} on={s.remindHour === h} onPress={() => { updateSettings({ remindHour: h }); rescheduleAll(); }} />
        ))}
      </View>

      <Eyebrow style={st.section}>Remind me by default</Eyebrow>
      <View style={st.chips}>
        {LEADS.map((l) => (
          <Chip key={l.days} label={l.label} on={s.remindDaysBefore === l.days} onPress={() => updateSettings({ remindDaysBefore: l.days })} />
        ))}
      </View>
      <T style={[st.help, { marginTop: 12 }]}>
        {remindersAvailable ? 'Before the due date. You can change it per bill when you save one.' : 'Reminders don’t run in Expo Go on Android. They work in a development build.'}
      </T>

      <Eyebrow style={st.section}>Extra reminders</Eyebrow>
      <Toggle
        label="Last call and overdue"
        help="A nudge the day before the deadline, and one the day after it's due if it's still open."
        value={s.extraNudges}
        onChange={(v) => { updateSettings({ extraNudges: v }); rescheduleAll(); }}
      />
      <Toggle label="Weekly summary" help="Monday morning: what's due this week and how much." value={s.weeklyDigest} onChange={(v) => updateSettings({ weeklyDigest: v })} />

      {__DEV__ && (
        <>
          <Eyebrow style={st.section}>Development</Eyebrow>
          <Button title="Load sample bills" kind="secondary" onPress={() => { seedSampleBills(); goBack(); }} />
        </>
      )}
    </ScrollView>
  );
}

function Toggle({ label, help, value, onChange }: { label: string; help: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={st.toggle}>
      <View style={{ flex: 1, gap: 4 }}>
        <T style={{ fontFamily: F.medium, fontSize: 15 }}>{label}</T>
        <T style={{ fontSize: 13, lineHeight: 18, color: C.dim }}>{help}</T>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: C.border, true: C.accent }} thumbColor={C.fg} accessibilityLabel={label} />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[st.chip, on && st.chipOn]}>
      <T style={{ fontFamily: F.medium, fontSize: 14, color: on ? C.bg : C.fg }}>{label}</T>
    </Pressable>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  section: { marginTop: 32, marginBottom: 10 },
  help: { fontSize: 13.5, lineHeight: 20, color: C.muted },
  stepper: { marginTop: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, padding: 4 },
  stepBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontFamily: F.medium, fontSize: 22, color: C.fg },
  stepValue: { fontFamily: F.semibold, fontSize: 22, letterSpacing: -0.5 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 44, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  chipOn: { backgroundColor: C.fg, borderColor: C.fg },
});
