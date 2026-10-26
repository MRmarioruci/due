import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, useFonts } from '@expo-google-fonts/archivo';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import * as SystemUI from 'expo-system-ui';
import { Appearance, AppState, useColorScheme, View } from 'react-native';

import '@/i18n';
import { LockGate } from '@/lib/lock';
import { usePayCheck } from '@/lib/pay-check';
import { listenForResponses, scheduleDigest, setupNotifications, syncReminders } from '@/lib/reminders';
import { getSettings, useSettings, type Settings } from '@/lib/settings';
import { recategorizeOthers, useBills } from '@/lib/store';
import { pickCategory } from '@/lib/categorize';
import { updateWidget } from '@/widget';
import { OverlayHost } from '@/ui/overlay';
import { applyTheme, C, currentTheme, type ThemeName } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

// Home is always the bottom of the stack, so any screen opened directly (a reload, a notification) can go back to it.
export const unstable_settings = { initialRouteName: 'index' };

/** Screens that only make sense mid-flow; starting on one of them (e.g. after a reload) goes home instead. */
const TRANSIENT = ['/scan', '/review'];

const resolveTheme = (mode: Settings['theme'], scheme: string | null | undefined): ThemeName => (mode === 'system' ? (scheme === 'light' ? 'light' : 'dark') : mode);

// Apply the saved theme before anything draws.
applyTheme(resolveTheme(getSettings().theme, Appearance.getColorScheme()));

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, JetBrainsMono_400Regular, JetBrainsMono_500Medium });

  // A font that fails to load must not leave the app on the splash screen; system fonts are the fallback.
  const ready = loaded || !!fontError;
  useEffect(() => {
    if (fontError) console.warn('[fonts] failed to load, using system fonts', fontError);
    if (ready) SplashScreen.hideAsync();
  }, [ready, fontError]);

  usePayCheck();

  // Always start on the home screen, never mid-scan.
  const pathname = usePathname();
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    if (TRANSIENT.includes(pathname)) router.replace('/');
  }, [ready, pathname]);

  // Keep the Monday summary in step with the bills (debounced: saving one bill can touch several rows).
  const bills = useBills();
  const { weeklyDigest, remindHour } = useSettings();
  useEffect(() => {
    const t = setTimeout(() => {
      syncReminders();
      scheduleDigest(bills);
      updateWidget(bills);
    }, 1500);
    return () => clearTimeout(t);
  }, [bills, weeklyDigest, remindHour]);

  // Back in the app: the scheduling window moves on, so bills further out get their reminders.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncReminders();
    });
    return () => sub.remove();
  }, []);

  // The permission prompt waits for onboarding, which asks for it with an explanation first.
  const { onboarded, language, theme: themeMode } = useSettings();

  // Theme: the setting, or the phone's when it follows the system. Applied during render so the
  // remounted screens below draw with the new palette straight away.
  const scheme = useColorScheme();
  const themeName = resolveTheme(themeMode, scheme);
  applyTheme(themeName);
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(C.bg).catch(() => {});
  }, [themeName]);
  useEffect(() => {
    if (onboarded) setupNotifications();
  }, [onboarded]);
  useEffect(() => listenForResponses(), []);
  // Once per launch: bills filed under "other" get another look with the category rules.
  useEffect(() => {
    recategorizeOthers((b) => pickCategory({ payee: b.payee, description: b.description, model: null, learned: getSettings().learnedCategories }));
  }, []);

  if (!ready) return null;

  const navTheme = currentTheme() === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...navTheme, colors: { ...navTheme.colors, background: C.bg, card: C.bg, text: C.fg, border: C.line, primary: C.fg } };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <LockGate>
        {/* Remounts when the language or theme changes, so every screen redraws in it. */}
        <View key={`${language ?? 'phone'}-${themeName}`} style={{ flex: 1, backgroundColor: C.bg }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade_from_bottom' }}>
            <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="shared" options={{ animation: 'fade' }} />
            <Stack.Screen name="import" options={{ animation: 'fade' }} />
          </Stack>
        </View>
        <OverlayHost />
      </LockGate>
    </ThemeProvider>
  );
}
