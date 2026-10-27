import { getLocales } from 'expo-localization';
import * as SQLite from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import type { Contracts } from './contracts';
import type { KeptEvent } from './kept';
import type { PaySchedule } from './plan';
import type { PayStyle } from './reminder-plan';
import type { Category } from './types';

export type Settings = {
  /** Anonymous random id sent to due-api for rate limiting; not tied to the person or phone. */
  deviceId: string | null;
  /** Category the user kept for each biller (payeeKey → category); new bills from them get it. */
  learnedCategories: Record<string, Category>;
  /** Bill list order. */
  sortBy: 'due' | 'name' | 'amount';
  /** Colours: follow the phone, or always light / dark. */
  theme: 'system' | 'light' | 'dark';
  /** App language (see i18n); null follows the phone. */
  language: string | null;
  /** Finished the first-run setup. */
  onboarded: boolean;
  /** Home country (ISO 3166-1 alpha-2) and currency (ISO 4217); null means "use the phone's". */
  country: string | null;
  currency: string | null;
  /** When pay arrives, or null when not set. */
  pay: PaySchedule | null;
  /** How early bills get paid by default: right away, halfway, or just in time. */
  payStyle: PayStyle;
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
  /** Net income per month (salary first, then any other), for "Where it goes". Empty until set. */
  income: { label: string | null; monthlyMinor: number }[];
  /** The user's own splits of income besides bills (savings, investing…), per month, for "Where it goes". */
  splits: import('./sankey-model').Split[];
  /** Keep open bills in a "due" calendar on the phone, and its id and events (billId → event). */
  calendarSync: boolean;
  calendarId: string | null;
  calendarEvents: Record<string, { eventId: string; sig: string }>;
  /** Duplicates and double payments due stopped, for "money kept" in Stats. */
  kept: KeptEvent[];
  /** When to review each biller's contract (payeeKey → contract). */
  contracts: Contracts;
  /** Ask for the phone's own unlock (fingerprint, face, PIN or pattern) when opening the app. */
  appLock: boolean;
};

const DEFAULTS: Settings = { learnedCategories: {}, sortBy: 'due', theme: 'dark', language: null, deviceId: null, onboarded: false, country: null, currency: null, payStyle: 'last', pay: null, remindHour: 9, remindDaysBefore: 3, extraNudges: true, weeklyDigest: true, digestId: null, appLock: false, contracts: {}, kept: [], income: [], splits: [], calendarSync: false, calendarId: null, calendarEvents: {} };

const db = SQLite.openDatabaseSync('due.db');
db.execSync('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');

function load(): Settings {
  const rows = db.getAllSync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  // A short-lived version had separate PIN / fingerprint modes; either one means "locked".
  if (stored.lockMode != null) {
    if (stored.appLock == null) stored.appLock = stored.lockMode !== 'off';
    delete stored.lockMode;
  }
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

/** Net income per month, all sources together; 0 when not set. */
export const monthlyIncome = (s: Settings = snapshot) => s.income.reduce((sum, i) => sum + i.monthlyMinor, 0);

/** Notes money due stopped from being paid (see Stats → kept). */
export function recordKept(e: Omit<KeptEvent, 'at'>) {
  if (e.minor > 0) updateSettings({ kept: [...snapshot.kept, { ...e, at: new Date().toISOString() }] });
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** The phone's own region and currency, used until the user picks theirs. */
export function deviceRegion(): { country: string | null; currency: string | null } {
  const l = getLocales()[0];
  return { country: l?.regionCode ?? null, currency: l?.currencyCode ?? null };
}

/** Currency for new bills and totals when nothing else decides it. */
export function homeCurrency(): string {
  return snapshot.currency ?? deviceRegion().currency ?? 'EUR';
}

export function homeCountry(): string | null {
  return snapshot.country ?? deviceRegion().country;
}

/** This install's anonymous id, created on first use. */
export function deviceId(): string {
  if (snapshot.deviceId) return snapshot.deviceId;
  const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  updateSettings({ deviceId: id });
  return id;
}
