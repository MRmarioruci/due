import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { checkPin, cooldownLeft, hasPin, setPin } from './pin';
import { getSettings, useSettings } from './settings';
import { Button, T } from '@/ui/kit';
import { sheet } from '@/ui/overlay';
import { PinPad } from '@/ui/pin-pad';
import { C, F } from '@/ui/theme';

/** Coming back after this long asks again; a quick app switch doesn't. */
const RELOCK_AFTER_MS = 60_000;

/** Whether the phone can do fingerprint/face: it has a sensor and one is saved. */
export async function canUseBiometrics(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function authenticate(prompt = 'Unlock due'): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: 'Use PIN' });
  return r.success;
}

const wrongPinHint = () => {
  const wait = cooldownLeft();
  return wait > 0 ? `Too many tries. Wait ${wait}s.` : 'Wrong PIN';
};

/** Asks for a new PIN twice in a sheet. Resolves true once it's saved. */
export function createPin(title = 'Choose a 4-digit PIN'): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const step = (first: string | null, hint: string | null) =>
      sheet.show({
        onDismiss: () => finish(false),
        content: (
          <PinPad
            key={first ? 'confirm' : `new-${hint}`}
            title={first ? 'Enter it again' : title}
            hint={hint}
            onComplete={async (pin) => {
              if (!first) {
                step(pin, null);
                return true;
              }
              if (pin !== first) {
                step(null, 'The PINs didn’t match. Try again.');
                return false;
              }
              await setPin(pin);
              sheet.hide();
              finish(true);
              return true;
            }}
          />
        ),
      });
    step(null, null);
  });
}

/** Confirms it's the owner before changing the lock: fingerprint/face if that's the mode, else the PIN. */
export function confirmIdentity(): Promise<boolean> {
  const { lockMode } = getSettings();
  if (lockMode === 'off') return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const askPin = (hint: string | null) =>
      sheet.show({
        onDismiss: () => finish(false),
        content: (
          <PinPad
            key={hint ?? 'pin'}
            title="Enter your PIN"
            hint={hint}
            onComplete={async (pin) => {
              if (await checkPin(pin)) {
                sheet.hide();
                finish(true);
                return true;
              }
              askPin(wrongPinHint());
              return false;
            }}
          />
        ),
      });
    (async () => {
      if (lockMode === 'biometric' && (await authenticate('Confirm it’s you'))) return finish(true);
      if (await hasPin()) askPin(null);
      else finish(false);
    })();
  });
}

/** Covers the app until it's unlocked, when an app lock is set. */
export function LockGate({ children }: { children: ReactNode }) {
  const { lockMode } = useSettings();
  const [locked, setLocked] = useState(() => getSettings().lockMode !== 'off');
  const [hint, setHint] = useState<string | null>(null);
  const [pinSet, setPinSet] = useState(true);
  const leftAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const tryBiometrics = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticate()) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, []);

  // Turning the lock off in settings unlocks at once.
  const showLock = lockMode !== 'off' && locked;

  useEffect(() => {
    if (!showLock) return;
    hasPin().then(setPinSet);
    if (lockMode === 'biometric') tryBiometrics();
  }, [showLock, lockMode, tryBiometrics]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current && getSettings().lockMode !== 'off' && Date.now() - leftAt.current > RELOCK_AFTER_MS) setLocked(true);
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
          {pinSet ? (
            <PinPad
              title="Enter your PIN"
              hint={hint}
              extraKey={lockMode === 'biometric' ? { label: 'Finger / face', onPress: tryBiometrics } : undefined}
              onComplete={async (pin) => {
                if (await checkPin(pin)) {
                  setHint(null);
                  setLocked(false);
                  return true;
                }
                setHint(wrongPinHint());
                return false;
              }}
            />
          ) : (
            // Locks set up before PINs existed: fingerprint/face only.
            <Button title="Unlock" onPress={tryBiometrics} style={{ alignSelf: 'stretch', marginHorizontal: 40 }} />
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  cover: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 36 },
  logo: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  logoText: { fontFamily: F.semibold, fontSize: 40, letterSpacing: -1.2, lineHeight: 44 },
  logoDot: { width: 10, height: 10, backgroundColor: C.accent, marginBottom: 9 },
});
