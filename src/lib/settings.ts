import * as SQLite from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import type { PaySchedule } from './plan';

export type Settings = {
  /** When pay arrives, or null when not set. */
  pay: PaySchedule | null;
  /** Hour of the day reminders go off. */
  remindHour: number;
  /** Default lead time for new bills, in days before the due date. */
  remindDaysBefore: number;
  /** A "last call" the day before the deadline and an "overdue" nudge the day after. */
  extraNudges: boolean;
  /** A Monday-morning summary of the week's bills. */
  weeklyDigest: boolean;
  /** Id of the scheduled weekly summary, so it can be replaced. */
  digestId: string | null;
  /** How the app is locked: not at all, with the app PIN, or fingerprint/face (with the PIN as backup). */
  lockMode: 'off' | 'pin' | 'biometric';
};

const DEFAULTS: Settings = { pay: null, remindHour: 9, remindDaysBefore: 3, extraNudges: true, weeklyDigest: true, digestId: null, lockMode: 'off' };

const db = SQLite.openDatabaseSync('due.db');
db.execSync('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');

function load(): Settings {
  const rows = db.getAllSync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  // Before PINs existed the lock was a single switch for fingerprint/face.
  if (stored.appLock === true && stored.lockMode == null) stored.lockMode = 'biometric';
  delete stored.appLock;
  // Paydays used to be a day of the month only.
  if (typeof stored.payday === 'number' && stored.pay == null) stored.pay = { every: 'month', day: stored.payday };
  delete stored.payday;
  return { ...DEFAULTS, ...stored };
}

let snapshot = load();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return snapshot;
}

export function updateSettings(patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
  }
  snapshot = load();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => snapshot);
}
