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
