import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, useFonts } from '@expo-google-fonts/archivo';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { listenForResponses, setupNotifications } from '@/lib/reminders';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.fg, border: C.line, primary: C.fg } };

export default function RootLayout() {
  const [loaded] = useFonts({ Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, JetBrainsMono_400Regular, JetBrainsMono_500Medium });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    setupNotifications();
    return listenForResponses();
  }, []);

  if (!loaded) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </ThemeProvider>
  );
}
