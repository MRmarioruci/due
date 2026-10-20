import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describePay } from '@/lib/plan';
import { countryByCode, currencyFor } from '@/lib/regions';
import { PAY_STYLES } from '@/lib/reminder-plan';
import { remindersAvailable, setupNotifications } from '@/lib/reminders';
import { deviceRegion, getSettings, updateSettings, useSettings } from '@/lib/settings';
import { chooseCountry, chooseCurrency, choosePay, countryFromLocation, setCountry } from '@/ui/choosers';
import { Button, Eyebrow, Icon, T } from '@/ui/kit';
import { Animated, enterFade, enterRow } from '@/ui/motion';
import { toast } from '@/ui/overlay';
import { C, F, GUTTER } from '@/ui/theme';

type Step = 'welcome' | 'region' | 'style' | 'pay' | 'reminders';
const STEPS: Step[] = ['welcome', 'region', 'style', 'pay', 'reminders'];

/** First launch: what due does, where you live (currency), when you're paid, and reminders. */
export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const s = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [locating, setLocating] = useState(false);
  const next = () => setStep(STEPS[STEPS.indexOf(step) + 1]);

  // Until the user picks, suggest the phone's own region.
  const country = s.country ?? deviceRegion().country;
  const currency = s.currency ?? currencyFor(country) ?? deviceRegion().currency ?? 'EUR';

  function finish() {
    updateSettings({ onboarded: true, country: getSettings().country ?? country, currency: getSettings().currency ?? currency });
    router.replace('/');
  }

  async function useLocation() {
    setLocating(true);
    try {
      const code = await countryFromLocation();
      if (code) {
        setCountry(code);
        toast(`Found you in ${countryByCode(code)?.name ?? code}`);
      } else {
        toast('Couldn’t get your location. Pick your country instead.');
      }
    } catch {
      toast('Couldn’t get your location. Pick your country instead.');
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={[st.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={st.progress}>
        {STEPS.map((x, i) => (
          <View key={x} style={[st.tick, i <= STEPS.indexOf(step) && { backgroundColor: C.fg }]} />
        ))}
      </View>

      <Animated.View key={step} entering={enterFade()} style={{ flex: 1 }}>
        {step === 'welcome' && (
          <View style={st.body}>
            <View style={st.logo}>
              <T style={st.logoText}>due</T>
              <View style={st.logoDot} />
            </View>
            <T style={st.title}>Every bill, paid at the right time.</T>
            {[
              ['Scan', 'Take a photo or import a PDF. The payment code and due date are read for you.'],
              ['Remind', 'A nudge a few days before each bill is due, never on a weekend.'],
              ['Pay', 'Show the payment QR to your banking app when it’s time.'],
            ].map(([h, t], i) => (
              <Animated.View key={h} entering={enterRow(i + 1)} style={st.point}>
                <T style={st.pointHead}>{h}</T>
                <T style={st.pointText}>{t}</T>
              </Animated.View>
            ))}
          </View>
        )}

        {step === 'region' && (
          <View style={st.body}>
            <Eyebrow>Step 1 of 4</Eyebrow>
            <T style={st.title}>Where do you live?</T>
            <T style={st.text}>It sets your currency and helps read dates on your bills. Bills from anywhere still work.</T>
            <View style={st.card}>
              <Pressable accessibilityRole="button" onPress={() => chooseCountry()} style={st.cardRow}>
                <T style={st.cardLabel}>Country</T>
                <T style={st.cardValue}>{countryByCode(country)?.name ?? 'Choose'}</T>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => chooseCurrency()} style={[st.cardRow, { borderBottomWidth: 0 }]}>
                <T style={st.cardLabel}>Currency</T>
                <T style={st.cardValue}>{currency}</T>
              </Pressable>
            </View>
            <Button title="Use my location" kind="secondary" loading={locating} onPress={useLocation} icon={<Icon name="pin" size={16} />} />
          </View>
        )}

        {step === 'style' && (
          <View style={st.body}>
            <Eyebrow>Step 2 of 4</Eyebrow>
            <T style={st.title}>When do you like to pay?</T>
            <T style={st.text}>Sets when reminders come. You can change it per bill, too.</T>
            <View style={{ gap: 8, marginTop: 8 }}>
              {PAY_STYLES.map((p, i) => {
                const on = s.payStyle === p.key;
                return (
                  <Animated.View key={p.key} entering={enterRow(i)}>
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => updateSettings({ payStyle: p.key })} style={[st.option, on && st.optionOn]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <T style={{ fontFamily: F.semibold, fontSize: 16 }}>{p.label}</T>
                        {p.key === 'last' && <T style={st.badge}>RECOMMENDED</T>}
                      </View>
                      <T style={{ fontSize: 13.5, lineHeight: 19, color: C.muted }}>{p.detail}</T>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}

        {step === 'pay' && (
          <View style={st.body}>
            <Eyebrow>Step 3 of 4</Eyebrow>
            <T style={st.title}>When do you get paid?</T>
            <T style={st.text}>due then shows which bills fall before payday and which can wait for it. You can skip this.</T>
            <View style={st.card}>
              <Pressable accessibilityRole="button" onPress={() => choosePay()} style={[st.cardRow, { borderBottomWidth: 0 }]}>
                <T style={st.cardLabel}>Payday</T>
                <T style={st.cardValue}>{s.pay ? describePay(s.pay) : 'Choose'}</T>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'reminders' && (
          <View style={st.body}>
            <Eyebrow>Step 4 of 4</Eyebrow>
            <T style={st.title}>Get a nudge before bills are due.</T>
            <T style={st.text}>
              {remindersAvailable
                ? 'One notification per bill, a few days ahead, at 09:00. You can change both in Settings.'
                : 'Reminders need the installed app; they don’t run in Expo Go on Android. Everything else works.'}
            </T>
          </View>
        )}
      </Animated.View>

      <View style={{ gap: 10 }}>
        {step === 'welcome' && <Button title="Get started" onPress={next} />}
        {step === 'region' && <Button title="Continue" onPress={() => { if (country) setCountry(country); updateSettings({ currency }); next(); }} />}
        {step === 'style' && <Button title="Continue" onPress={next} />}
        {step === 'pay' && (
          <>
            <Button title="Continue" onPress={next} />
            {!s.pay && <Button title="Skip for now" kind="secondary" onPress={next} />}
          </>
        )}
        {step === 'reminders' && (
          <>
            <Button
              title={remindersAvailable ? 'Turn on reminders' : 'Finish'}
              onPress={async () => {
                if (remindersAvailable) await setupNotifications();
                finish();
              }}
            />
            {remindersAvailable && <Button title="Not now" kind="secondary" onPress={finish} />}
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: GUTTER },
  progress: { flexDirection: 'row', gap: 6 },
  tick: { flex: 1, height: 2, backgroundColor: C.border },
  body: { flex: 1, justifyContent: 'center', gap: 16 },
  logo: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 8 },
  logoText: { fontFamily: F.semibold, fontSize: 52, letterSpacing: -1.6, lineHeight: 56 },
  logoDot: { width: 12, height: 12, backgroundColor: C.accent, marginBottom: 11 },
  title: { fontFamily: F.semibold, fontSize: 30, letterSpacing: -0.9, lineHeight: 36 },
  text: { fontSize: 15, lineHeight: 22, color: C.muted },
  point: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14, gap: 4 },
  pointHead: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.accent },
  pointText: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: 1, borderColor: C.line, marginTop: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  cardLabel: { fontSize: 15, color: C.muted },
  cardValue: { fontFamily: F.medium, fontSize: 15 },
  option: { borderWidth: 1, borderColor: C.line, padding: 16, gap: 6 },
  optionOn: { borderColor: C.fg, backgroundColor: C.surface },
  badge: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.8, color: C.accent },
});
