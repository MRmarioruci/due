import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, useFonts } from '@expo-google-fonts/archivo';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { usePayCheck } from '@/lib/pay-check';
import { listenForResponses, scheduleDigest, setupNotifications } from '@/lib/reminders';
import { useSettings } from '@/lib/settings';
import { useBills } from '@/lib/store';
import { updateWidget } from '@/widget';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.fg, border: C.line, primary: C.fg } };

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, JetBrainsMono_400Regular, JetBrainsMono_500Medium });

  // A font that fails to load must not leave the app on the splash screen; system fonts are the fallback.
  const ready = loaded || !!fontError;
  useEffect(() => {
    if (fontError) console.warn('[fonts] failed to load, using system fonts', fontError);
    if (ready) SplashScreen.hideAsync();
  }, [ready, fontError]);

  usePayCheck();

  // Keep the Monday summary in step with the bills (debounced: saving one bill can touch several rows).
  const bills = useBills();
  const { weeklyDigest, remindHour } = useSettings();
  useEffect(() => {
    const t = setTimeout(() => {
      scheduleDigest(bills);
      updateWidget(bills);
    }, 1500);
    return () => clearTimeout(t);
  }, [bills, weeklyDigest, remindHour]);

  useEffect(() => {
    setupNotifications();
    return listenForResponses();
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </ThemeProvider>
  );
}
