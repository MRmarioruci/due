import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { getSettings, useSettings } from './settings';
import { t } from '@/i18n/core';
import { Button, T } from '@/ui/kit';
import { C, F } from '@/ui/theme';

/**
 * The app lock uses the phone's own unlock: one system prompt that takes the fingerprint, face,
 * or the phone's PIN/pattern. No separate app PIN to remember.
 */

/** Coming back after this long asks again; a quick app switch doesn't. */
const RELOCK_AFTER_MS = 60_000;

/** True when the phone has any screen lock (PIN, pattern, password, fingerprint or face). */
export async function phoneHasLock(): Promise<boolean> {
  return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
}

export async function authenticate(prompt?: string): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt ?? t('lock.prompt') });
  return r.success;
}

/** Covers the app until it's unlocked, when the lock is on. */
export function LockGate({ children }: { children: ReactNode }) {
  const { appLock } = useSettings();
  const [locked, setLocked] = useState(() => getSettings().appLock);
  const leftAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticate()) setLocked(false);
    } finally {
      prompting.current = false;
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
          <T style={{ color: C.muted, fontSize: 14 }}>{t('lock.locked')}</T>
          <Button title={t('lock.unlock')} onPress={unlock} style={{ alignSelf: 'stretch', marginTop: 24 }} />
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
