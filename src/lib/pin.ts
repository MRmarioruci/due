import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/** The app PIN, kept only as a salted SHA-256 in the phone's secure storage. */
const KEY = 'due.pin';
export const PIN_LENGTH = 4;

const MAX_TRIES = 5;
const COOLDOWN_MS = 30_000;
let failures = 0;
let lockedUntil = 0;

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const hash = (salt: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

export async function hasPin(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY)) != null;
}

export async function setPin(pin: string) {
  const salt = hex(Crypto.getRandomBytes(16));
  await SecureStore.setItemAsync(KEY, `${salt}:${await hash(salt, pin)}`);
}

export async function clearPin() {
  await SecureStore.deleteItemAsync(KEY);
}

/** Seconds left before another try is allowed, after too many wrong PINs. */
export function cooldownLeft(): number {
  return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
}

export async function checkPin(pin: string): Promise<boolean> {
  if (cooldownLeft() > 0) return false;
  const stored = await SecureStore.getItemAsync(KEY);
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  const ok = (await hash(salt, pin)) === expected;
  if (ok) {
    failures = 0;
  } else if (++failures >= MAX_TRIES) {
    failures = 0;
    lockedUntil = Date.now() + COOLDOWN_MS;
  }
  return ok;
}
