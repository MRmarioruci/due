import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { getSettings, useSettings } from './settings';
import { Button, T } from '@/ui/kit';
import { C, F } from '@/ui/theme';

/** Coming back after this long asks for the fingerprint or face again; a quick app switch doesn't. */
const RELOCK_AFTER_MS = 60_000;

/** Whether the phone can lock the app: it has a sensor and a fingerprint or face saved. */
export async function canLock(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function authenticate(prompt = 'Unlock due'): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: 'Cancel' });
  return r.success;
}

/** Covers the app until the user unlocks it, when the app lock is on. */
export function LockGate({ children }: { children: ReactNode }) {
  const { appLock } = useSettings();
  const [locked, setLocked] = useState(() => getSettings().appLock);
  const leftAt = useRef<number | null>(null);
  const busy = useRef(false);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (await authenticate()) setLocked(false);
    } finally {
      busy.current = false;
    }
  }, []);

  // Turning the lock off in settings unlocks at once.
  const showLock = appLock && locked;

  useEffect(() => {
    if (showLock) unlock();
  }, [showLock, unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current && getSettings().appLock && Date.now() - leftAt.current > RELOCK_AFTER_MS) setLocked(true);
      if (state === 'active') leftAt.current = null;
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {showLock && (
        <View style={[StyleSheet.absoluteFill, st.cover]}>
          <View style={st.logo}>
            <T style={st.logoText}>due</T>
            <View style={st.logoDot} />
          </View>
          <T style={{ color: C.muted, fontSize: 14 }}>Locked</T>
          <Button title="Unlock" onPress={unlock} style={{ alignSelf: 'stretch', marginTop: 24 }} />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  cover: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  logo: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  logoText: { fontFamily: F.semibold, fontSize: 40, letterSpacing: -1.2, lineHeight: 44 },
  logoDot: { width: 10, height: 10, backgroundColor: C.accent, marginBottom: 9 },
});
