import { t } from '../i18n/core';

import { fromIso } from './dates';
import { formatMoney } from './money';
import type { Bill } from './types';

/** What a bill looks like in a calendar: an all-day event on its due date. */
export type BillEvent = { title: string; notes: string; date: string };

export function billEvent(bill: Bill): BillEvent | null {
  if (!bill.dueDate) return null;
  const amount = bill.amountMinor != null ? ` · ${formatMoney(bill.amountMinor, bill.currency)}` : '';
  const lines = [
    bill.description,
    bill.payment.iban && `IBAN ${bill.payment.iban}`,
    bill.payment.reference && `${t('review.reference')} ${bill.payment.reference}`,
    t('calendar.openDue'),
  ].filter(Boolean);
  return { title: t('calendar.title', { payee: bill.payee }) + amount, notes: lines.join('\n'), date: bill.dueDate };
}

/** Android keeps all-day events in UTC: midnight to midnight of that date. */
export function allDayUtc(date: string): { startDate: Date; endDate: Date } {
  const [y, m, d] = date.split('-').map(Number);
  return { startDate: new Date(Date.UTC(y, m - 1, d)), endDate: new Date(Date.UTC(y, m - 1, d + 1)) };
}

/** The calendar app's "new event" form wants local times. */
export function allDayLocal(date: string): { startDate: Date; endDate: Date } {
  const start = fromIso(date);
  const end = fromIso(date);
  end.setDate(end.getDate() + 1);
  return { startDate: start, endDate: end };
}

/** A fingerprint of what's in the event, so sync only rewrites events that changed. */
export const eventSig = (e: BillEvent) => `${e.date}|${e.title}|${e.notes}`;

/** What we need to know about a calendar on the phone to choose one. */
export type CalendarInfo = {
  id: string;
  title: string;
  allowsModifications: boolean;
  accessLevel?: string;
  isPrimary?: boolean;
  isVisible?: boolean;
  ownerAccount?: string;
  name?: string | null;
  source: { name: string; type?: string; isLocalAccount?: boolean };
};

const GOOGLE = 'com.google';
const WRITABLE = ['owner', 'editor', 'contributor', 'root'];

/** The calendar due made on the phone itself before; Google Calendar never showed it. */
export const isOldDueCalendar = (c: CalendarInfo) => c.name === 'due' && c.ownerAccount === 'due';

/** Calendars bills can go into: ones the user can write to, Google accounts first. */
export function writableCalendars(all: CalendarInfo[]): CalendarInfo[] {
  return all
    .filter((c) => c.allowsModifications && (!c.accessLevel || WRITABLE.includes(c.accessLevel)) && !isOldDueCalendar(c))
    .sort((a, b) => Number(b.source.type === GOOGLE) - Number(a.source.type === GOOGLE));
}

/**
 * Where bills go unless the user picks: the main calendar of a Google account (it syncs to Google
 * Calendar on the web and other phones), else the phone's primary one, else any writable one.
 */
export function defaultCalendar(all: CalendarInfo[]): CalendarInfo | null {
  const ok = writableCalendars(all);
  const google = ok.filter((c) => c.source.type === GOOGLE);
  return (
    google.find((c) => c.isPrimary) ??
    // A Google account's own calendar is the one named after the account.
    google.find((c) => c.ownerAccount === c.source.name) ??
    google[0] ??
    ok.find((c) => c.isPrimary) ??
    ok[0] ??
    null
  );
}

/** "Personal · me@gmail.com" for a picker. */
export const calendarLabel = (c: CalendarInfo) => (c.source.name && c.source.name !== c.title ? `${c.title} · ${c.source.name}` : c.title);
