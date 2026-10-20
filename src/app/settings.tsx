import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatHour } from '@/lib/dates';
import { authenticate, phoneHasLock } from '@/lib/lock';
import { goBack } from '@/lib/nav';
import { describePay } from '@/lib/plan';
import { countryByCode } from '@/lib/regions';
import { PAY_STYLES } from '@/lib/reminder-plan';
import { remindersAvailable, rescheduleAll } from '@/lib/reminders';
import { seedSampleBills } from '@/lib/seed';
import { deviceRegion, getSettings, homeCurrency, updateSettings, useSettings } from '@/lib/settings';
import { chooseCountry, chooseCurrency, choosePay, Options } from '@/ui/choosers';
import { Eyebrow, Icon, IconButton, T } from '@/ui/kit';
import { sheet, toast } from '@/ui/overlay';
import { C, F, GUTTER } from '@/ui/theme';

const LEADS = [0, 1, 3, 7];
const leadLabel = (d: number) => (d === 0 ? 'On the due date' : d === 7 ? '1 week before' : `${d} ${d === 1 ? 'day' : 'days'} before`);
const HOURS = [7, 8, 9, 12, 18, 20];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const s = useSettings();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 40 }}>
      <View style={st.header}>
        <IconButton label="Back" onPress={goBack}>
          <Icon name="back" />
        </IconButton>
        <T style={{ fontFamily: F.semibold, fontSize: 15 }}>Settings</T>
        <View style={{ width: 44 }} />
      </View>

      <Section title="Region">
        <Row label="Country" value={countryByCode(s.country ?? deviceRegion().country)?.name ?? 'Not set'} onPress={() => chooseCountry()} />
        <Row label="Currency" value={homeCurrency()} onPress={() => chooseCurrency()} />
      </Section>

      <Section title="Pay" note="Pay bills sets when reminders come. Payday splits your bills into what's due before it and what can wait.">
        <Row label="Pay bills" value={PAY_STYLES.find((p) => p.key === s.payStyle)?.label} onPress={choosePayStyle} />
        <Row label="Payday" value={s.pay ? describePay(s.pay) : 'Not set'} onPress={() => choosePay()} />
      </Section>

      <Section title="Reminders" note={remindersAvailable ? null : 'Reminders don’t run in Expo Go on Android. They work in the development build.'}>
        <Row label="Remind me" value={leadLabel(s.remindDaysBefore)} onPress={chooseLead} />
        <Row label="At" value={formatHour(s.remindHour)} onPress={chooseHour} />
        <ToggleRow
          label="Last call and overdue nudges"
          value={s.extraNudges}
          onChange={(v) => {
            updateSettings({ extraNudges: v });
            rescheduleAll();
          }}
        />
        <ToggleRow label="Monday summary" value={s.weeklyDigest} onChange={(v) => updateSettings({ weeklyDigest: v })} />
      </Section>

      <Section title="Security" note="Uses your phone’s own unlock: fingerprint, face, PIN or pattern. Asked when you open due and after a minute away.">
        <ToggleRow label="Lock with phone unlock" value={s.appLock} onChange={toggleLock} />
      </Section>

      <Section title="General">
        <Row
          label="Run setup again"
          onPress={() => {
            updateSettings({ onboarded: false });
            router.replace('/onboarding');
          }}
        />
      </Section>

      {__DEV__ && (
        <Section title="Development">
          <Row
            label="Load sample bills"
            onPress={() => {
              seedSampleBills();
              toast('Sample bills loaded');
              goBack();
            }}
          />
        </Section>
      )}
    </ScrollView>
  );
}

/* ---------- choosers: each opens one sheet ---------- */

function choosePayStyle() {
  sheet.show({
    title: 'When do you like to pay?',
    message: 'The default for bills. You can change it per bill.',
    content: (
      <Options
        selected={getSettings().payStyle}
        options={PAY_STYLES.map((p) => ({
          key: p.key,
          label: p.label,
          onPress: () => {
            updateSettings({ payStyle: p.key });
            rescheduleAll();
            sheet.hide();
            toast(`Paying bills: ${p.label.toLowerCase()}`);
          },
        }))}
      />
    ),
  });
}

function chooseLead() {
  sheet.show({
    title: 'Remind me',
    message: 'The default for new bills. You can change it per bill.',
    content: (
      <Options
        selected={getSettings().remindDaysBefore}
        options={LEADS.map((d) => ({
          key: d,
          label: leadLabel(d),
          onPress: () => {
            updateSettings({ remindDaysBefore: d });
            sheet.hide();
          },
        }))}
      />
    ),
  });
}

function chooseHour() {
  sheet.show({
    title: 'Reminder time',
    content: (
      <Options
        selected={getSettings().remindHour}
        options={HOURS.map((h) => ({
          key: h,
          label: formatHour(h),
          onPress: () => {
            updateSettings({ remindHour: h });
            rescheduleAll();
            sheet.hide();
          },
        }))}
      />
    ),
  });
}

/** Turning the lock on or off both need the phone's unlock, so no one else can change it. */
async function toggleLock(on: boolean) {
  if (on && !(await phoneHasLock())) {
    sheet.show({ title: 'Your phone has no screen lock', message: 'Set a PIN, pattern, fingerprint or face in your phone’s security settings first.', actions: [{ label: 'OK' }] });
    return;
  }
  if (!(await authenticate(on ? 'Turn on the app lock' : 'Turn off the app lock'))) return;
  updateSettings({ appLock: on });
  toast(on ? 'App lock is on' : 'App lock is off');
}

/* ---------- building blocks ---------- */

function Section({ title, note, children }: { title: string; note?: string | null; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 30 }}>
      <Eyebrow style={{ marginBottom: 6 }}>{title}</Eyebrow>
      <View style={{ borderTopWidth: 1, borderTopColor: C.line }}>{children}</View>
      {note && <T style={st.note}>{note}</T>}
    </View>
  );
}

function Row({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityHint={value} onPress={onPress} style={({ pressed }) => [st.row, pressed && { backgroundColor: C.surface }]}>
      <T style={st.rowLabel}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        {value && (
          <T style={st.rowValue} numberOfLines={1}>
            {value}
          </T>
        )}
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <Icon name="back" size={14} color={C.dim} />
        </View>
      </View>
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={st.row}>
      <T style={st.rowLabel}>{label}</T>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: C.border, true: C.accent }} thumbColor={C.fg} accessibilityLabel={label} />
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 56, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  rowLabel: { fontSize: 15, flexShrink: 1 },
  rowValue: { fontSize: 14, color: C.muted, flexShrink: 1 },
  note: { marginTop: 10, fontSize: 13, lineHeight: 19, color: C.dim },
});
