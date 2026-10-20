import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatHour, todayIso } from '@/lib/dates';
import { authenticate, canUseBiometrics, confirmIdentity, createPin } from '@/lib/lock';
import { goBack } from '@/lib/nav';
import { clearPin, hasPin } from '@/lib/pin';
import { describePay, type PaySchedule } from '@/lib/plan';
import { remindersAvailable, rescheduleAll } from '@/lib/reminders';
import { seedSampleBills } from '@/lib/seed';
import { getSettings, updateSettings, useSettings, type Settings } from '@/lib/settings';
import { pickDate } from '@/ui/calendar';
import { Eyebrow, Icon, IconButton, T } from '@/ui/kit';
import { sheet, toast } from '@/ui/overlay';
import { C, F, GUTTER } from '@/ui/theme';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LEADS = [0, 1, 3, 7];
const leadLabel = (d: number) => (d === 0 ? 'On the due date' : d === 7 ? '1 week before' : `${d} ${d === 1 ? 'day' : 'days'} before`);
const HOURS = [7, 8, 9, 12, 18, 20];
const LOCK_LABEL: Record<Settings['lockMode'], string> = { off: 'Off', pin: 'PIN', biometric: 'Fingerprint or face' };

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

      <Section title="Pay" note="Splits your bills into what's due before payday and what can wait for it.">
        <Row label="Payday" value={s.pay ? describePay(s.pay) : 'Not set'} onPress={choosePay} />
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

      <Section title="Security">
        <Row label="App lock" value={LOCK_LABEL[s.lockMode]} onPress={chooseLock} />
        {s.lockMode !== 'off' && <Row label="Change PIN" onPress={changePin} />}
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

function choosePay() {
  const cur = getSettings().pay;
  const set = (pay: PaySchedule | null) => {
    updateSettings({ pay });
    sheet.hide();
    toast(pay ? `Payday: ${describePay(pay).toLowerCase()}` : 'Payday cleared');
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
    const current = cur?.every === 'week' ? cur.weekday : -1;
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

function chooseLock() {
  const cur = getSettings().lockMode;
  const pick = async (mode: Settings['lockMode']) => {
    sheet.hide();
    if (mode === cur) return;
    // Changing an existing lock needs the owner.
    if (cur !== 'off' && !(await confirmIdentity())) return;
    if (mode === 'off') {
      await clearPin();
      updateSettings({ lockMode: 'off' });
      toast('App lock is off');
      return;
    }
    if (mode === 'biometric' && !(await canUseBiometrics())) {
      sheet.show({ title: 'No fingerprint or face set up', message: 'Add one in your phone’s security settings first, or use a PIN.', actions: [{ label: 'OK' }] });
      return;
    }
    // A PIN is always there: it's the lock itself, or the backup for fingerprint/face.
    if (!(await hasPin()) && !(await createPin(mode === 'biometric' ? 'Choose a backup PIN' : 'Choose a 4-digit PIN'))) return;
    if (mode === 'biometric' && !(await authenticate('Turn on fingerprint or face unlock'))) return;
    updateSettings({ lockMode: mode });
    toast(mode === 'pin' ? 'Locked with your PIN' : 'Locked with fingerprint or face');
  };
  sheet.show({
    title: 'App lock',
    message: 'Asked when you open due, and again after a minute away.',
    content: (
      <Options
        selected={cur}
        options={[
          { key: 'off', label: 'Off', onPress: () => pick('off') },
          { key: 'pin', label: 'PIN', onPress: () => pick('pin') },
          { key: 'biometric', label: 'Fingerprint or face, PIN as backup', onPress: () => pick('biometric') },
        ]}
      />
    ),
  });
}

async function changePin() {
  if (!(await confirmIdentity())) return;
  if (await createPin('Choose a new PIN')) toast('PIN changed');
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

/** A list of choices in a sheet, with a check on the current one. */
function Options<K extends string | number>({ options, selected }: { options: { key: K; label: string; onPress: () => void }[]; selected: K }) {
  return (
    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
      {options.map((o) => (
        <Pressable
          key={String(o.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: o.key === selected }}
          onPress={o.onPress}
          style={({ pressed }) => [st.row, pressed && { backgroundColor: C.surface }]}>
          <T style={[st.rowLabel, o.key === selected && { fontFamily: F.semibold }]}>{o.label}</T>
          {o.key === selected && <Icon name="check" color={C.accent} size={18} />}
        </Pressable>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 56, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  rowLabel: { fontSize: 15, flexShrink: 1 },
  rowValue: { fontSize: 14, color: C.muted, flexShrink: 1 },
  note: { marginTop: 10, fontSize: 13, lineHeight: 19, color: C.dim },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  dayCell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: C.fg },
});
