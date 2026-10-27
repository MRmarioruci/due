import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatHour } from '@/lib/dates';
import { authenticate, phoneHasLock } from '@/lib/lock';
import { describePay } from '@/lib/plan';
import { PAY_STYLES } from '@/lib/reminder-plan';
import { widgetProblem } from '@/widget';
import { deviceLang, LANGUAGES, t } from '@/i18n';
import { countryName, leadLabel, payStyleLabel } from '@/i18n/labels';
import { remindersAvailable, rescheduleAll } from '@/lib/reminders';
import { disableCalendarSync, enableCalendarSync, pickableCalendars, moveToCalendar } from '@/lib/calendar';
import { calendarLabel } from '@/lib/calendar-event';
import { removeAllBills } from '@/lib/remove';
import { seedSampleBills } from '@/lib/seed';
import { useBills } from '@/lib/store';
import { deviceRegion, getSettings, homeCurrency, updateSettings, useSettings } from '@/lib/settings';
import { chooseCountry, chooseCurrency, chooseLanguageSheet, choosePay, Options } from '@/ui/choosers';
import { Eyebrow, Icon, T } from '@/ui/kit';
import { sheet, toast } from '@/ui/overlay';
import { NAV_SPACE } from '@/ui/nav-bar';
import { C, F, GUTTER, themed } from '@/ui/theme';

const LEADS = [0, 1, 3, 7];
const HOURS = [7, 8, 9, 12, 18, 20];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const s = useSettings();
  const billCount = useBills().length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + NAV_SPACE }}>
      <View style={st.header}>
        <T style={{ fontFamily: F.semibold, fontSize: 24, letterSpacing: -0.7 }} accessibilityRole="header">{t('common.settings')}</T>
      </View>

      <Section title={t('settings.region')}>
        <Row label={t('settings.theme')} value={t(`settings.theme.${s.theme}`)} onPress={chooseTheme} />
        <Row label={t('settings.language')} value={s.language ? LANGUAGES.find((l) => l.code === s.language)?.name : `${t('settings.phoneLanguage')} · ${LANGUAGES.find((l) => l.code === deviceLang())?.name}`} onPress={() => chooseLanguageSheet(() => router.push('/settings'))} />
        <Row label={t('settings.country')} value={countryName(s.country ?? deviceRegion().country) ?? t('settings.notSet')} onPress={() => chooseCountry()} />
        <Row label={t('settings.currency')} value={homeCurrency()} onPress={() => chooseCurrency()} />
      </Section>

      <Section title={t('settings.pay')} note={t('settings.payNote')}>
        <Row label={t('settings.payBills')} value={payStyleLabel(s.payStyle)} onPress={choosePayStyle} />
        <Row label={t('settings.payday')} value={s.pay ? describePay(s.pay) : t('settings.notSet')} onPress={() => choosePay()} />
      </Section>

      {/* Days-before only matters for "just in time" paying; the other styles plan their own dates. */}
      <Section title={t('settings.reminders')} note={remindersAvailable ? (s.payStyle === 'last' ? t('settings.remindMeNote') : null) : t('remind.expoGo')}>
        {s.payStyle === 'last' && <Row label={t('settings.remindNew')} value={leadLabel(s.remindDaysBefore)} onPress={chooseLead} />}
        <Row label={t('settings.at')} value={formatHour(s.remindHour)} onPress={chooseHour} />
        <ToggleRow
          label={t('settings.nudges')}
          value={s.extraNudges}
          onChange={(v) => {
            updateSettings({ extraNudges: v });
            rescheduleAll();
          }}
        />
        <ToggleRow label={t('settings.digest')} value={s.weeklyDigest} onChange={(v) => updateSettings({ weeklyDigest: v })} />
        <ToggleRow label={t('calendar.sync')} value={s.calendarSync} onChange={toggleCalendar} />
        {s.calendarSync && <Row label={t('calendar.which')} value={s.calendarName ?? '—'} onPress={chooseCalendar} />}
      </Section>

      <Section title={t('settings.security')} note={t('settings.lockNote')}>
        <ToggleRow label={t('settings.lock')} value={s.appLock} onChange={toggleLock} />
      </Section>

      {widgetProblem && (
        <Section title={t('settings.widget')} note={widgetProblem}>
          <Row label={t('settings.widgetBroken')} onPress={() => toast(widgetProblem ?? '')} />
        </Section>
      )}

      <Section title={t('settings.general')}>
        <ToggleRow label={t('settings.billy')} value={s.billy} onChange={(v) => {
            updateSettings({ billy: v });
            toast(t(v ? 'billy.back' : 'billy.bye'));
          }}
        />
        <Row
          label={t('settings.sampleBills')}
          onPress={() => {
            seedSampleBills();
            toast(t('settings.sampleLoaded'));
            router.navigate('/');
          }}
        />
        <Row
          label={t('settings.rerunSetup')}
          onPress={() => {
            updateSettings({ onboarded: false });
            router.replace('/onboarding');
          }}
        />
        {billCount > 0 && (
          <Row
            label={t('settings.deleteAll')}
            value={String(billCount)}
            danger
            onPress={async () => {
              const sure = await sheet.confirm({
                title: t('settings.deleteAllTitle', { n: billCount }),
                message: t('settings.deleteAllText'),
                confirm: t('settings.deleteAllConfirm'),
                destructive: true,
              });
              if (!sure) return;
              await removeAllBills();
              toast(t('settings.deletedAll'));
            }}
          />
        )}
      </Section>

    </ScrollView>
  );
}

/** Calendar sync on asks for access and puts the bills in the main Google calendar; off takes them out. */
async function toggleCalendar(on: boolean) {
  if (on) {
    const name = await enableCalendarSync();
    if (name) toast(t('calendar.syncedTo', { name }));
    else if (getSettings().calendarSync) toast(t('calendar.none'));
    else toast(t('calendar.noAccess'));
    return;
  }
  const sure = await sheet.confirm({ title: t('calendar.offTitle'), message: t('calendar.offTextNow'), confirm: t('calendar.offConfirm'), destructive: true });
  if (sure) await disableCalendarSync();
}

async function chooseCalendar() {
  const cals = await pickableCalendars();
  if (!cals.length) return toast(t('calendar.none'));
  sheet.show({
    title: t('calendar.pickTitle'),
    message: t('calendar.pickNote'),
    content: (
      <Options
        selected={getSettings().calendarId}
        options={cals.map((c) => ({
          key: c.id,
          label: calendarLabel(c),
          onPress: async () => {
            sheet.hide();
            await moveToCalendar(c);
            toast(t('calendar.syncedTo', { name: calendarLabel(c) }));
          },
        }))}
      />
    ),
  });
}

/* ---------- choosers: each opens one sheet ---------- */

function choosePayStyle() {
  sheet.show({
    title: t('settings.whenPay'),
    message: t('settings.whenPayNote'),
    content: (
      <Options
        selected={getSettings().payStyle}
        options={PAY_STYLES.map((p) => ({
          key: p.key,
          label: payStyleLabel(p.key),
          onPress: () => {
            updateSettings({ payStyle: p.key });
            rescheduleAll();
            sheet.hide();
            toast(t('settings.payStyleSet', { style: payStyleLabel(p.key) }));
          },
        }))}
      />
    ),
  });
}

function chooseTheme() {
  sheet.show({
    title: t('settings.theme'),
    content: (
      <Options
        selected={getSettings().theme}
        options={(['system', 'light', 'dark'] as const).map((m) => ({
          key: m,
          label: t(`settings.theme.${m}`),
          onPress: () => {
            sheet.hide();
            // The screens remount in the new colours; come back here afterwards.
            updateSettings({ theme: m });
            setTimeout(() => router.push('/settings'), 80);
          },
        }))}
      />
    ),
  });
}

function chooseLead() {
  sheet.show({
    title: t('settings.remindMe'),
    message: t('settings.remindMeNote'),
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
    title: t('settings.reminderTime'),
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
    sheet.show({ title: t('settings.noLockTitle'), message: t('settings.noLockText'), actions: [{ label: t('common.ok') }] });
    return;
  }
  if (!(await authenticate(on ? t('settings.lockOnPrompt') : t('settings.lockOffPrompt')))) return;
  updateSettings({ appLock: on });
  toast(on ? t('settings.lockOn') : t('settings.lockOff'));
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

function Row({ label, value, onPress, danger }: { label: string; value?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityHint={value} onPress={onPress} style={({ pressed }) => [st.row, pressed && { backgroundColor: C.surface }]}>
      <T style={[st.rowLabel, danger && { color: C.accent }]}>{label}</T>
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

const st = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 56, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  rowLabel: { fontSize: 15, flexShrink: 1 },
  rowValue: { fontSize: 14, color: C.muted, flexShrink: 1 },
  note: { marginTop: 10, fontSize: 13, lineHeight: 19, color: C.dim },
}));
