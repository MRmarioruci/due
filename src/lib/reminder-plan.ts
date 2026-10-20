import { addDaysIso, daysBetween, fromIso, reminderMoment, shortDay, todayIso } from './dates';
import { activeDiscount, targetDate } from './discount';
import { formatMoney } from './money';
import type { Bill } from './types';

export type PlannedReminder = { kind: 'main' | 'tomorrow' | 'overdue'; at: Date; title: string; body: string };

type Prefs = { remindHour: number; extraNudges: boolean };

const at = (iso: string, hour: number) => {
  const d = fromIso(iso);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/**
 * Every notification a bill should get: the main reminder (or a snoozed one), and with extra nudges on,
 * one the day before its deadline and one the day after it's due if it's still open then.
 */
export function planReminders(bill: Bill, prefs: Prefs, now = new Date(), snoozedTo?: Date): PlannedReminder[] {
  if (bill.status !== 'open') return [];
  const target = targetDate(bill, todayIso(now));
  const title = `${bill.payee} · ${formatMoney(bill.amountMinor, bill.currency)}`;
  const out: PlannedReminder[] = [];

  const main = snoozedTo ?? (target ? reminderMoment(target, bill.remindDaysBefore, prefs.remindHour, now) : null);
  if (main && main > now) out.push({ kind: 'main', at: main, title, body: describeDue(bill, main) });

  if (prefs.extraNudges && target) {
    const dayBefore = at(addDaysIso(target, -1), prefs.remindHour);
    const sameDay = (a: Date, b: Date) => todayIso(a) === todayIso(b);
    if (dayBefore > now && !out.some((r) => sameDay(r.at, dayBefore)) && (!main || dayBefore > main)) {
      out.push({ kind: 'tomorrow', at: dayBefore, title, body: `${describeDue(bill, dayBefore)} Last call.` });
    }
  }
  if (prefs.extraNudges && bill.dueDate) {
    const late = at(addDaysIso(bill.dueDate, 1), prefs.remindHour);
    if (late > now) out.push({ kind: 'overdue', at: late, title, body: `Was due ${shortDay(bill.dueDate)} and isn't marked paid. Paid already? Tap Paid.` });
  }
  return out;
}

function describeDue(bill: Bill, when: Date): string {
  const discount = activeDiscount(bill, todayIso(when));
  if (discount) return `${discount.percent}% off until ${shortDay(discount.until)}: pay ${formatMoney(discount.payMinor, bill.currency)}.`;
  if (!bill.dueDate) return 'Tap to open the QR code.';
  const days = daysBetween(todayIso(when), bill.dueDate);
  return days === 0 ? 'Due today.' : days === 1 ? 'Due tomorrow.' : `Due ${shortDay(bill.dueDate)}.`;
}

/** Monday morning summary of the week ahead; null when nothing is due that week. */
export function planDigest(bills: Bill[], hour: number, now = new Date()): { at: Date; title: string; body: string } | null {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  const toMonday = (8 - d.getDay()) % 7;
  d.setDate(d.getDate() + toMonday);
  if (d <= now) d.setDate(d.getDate() + 7);

  const start = todayIso(d);
  const week = bills
    .filter((b) => b.status === 'open')
    .map((b) => ({ b, deadline: targetDate(b, start) }))
    .filter((x) => x.deadline && daysBetween(start, x.deadline) >= 0 && daysBetween(start, x.deadline) < 7)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  if (!week.length) return null;

  const ccy = week[0].b.currency;
  const total = week.filter((x) => x.b.currency === ccy).reduce((s, x) => s + (activeDiscount(x.b, start)?.payMinor ?? x.b.amountMinor ?? 0), 0);
  const names = week.slice(0, 3).map((x) => `${x.b.payee} ${fromIso(x.deadline!).toLocaleDateString(undefined, { weekday: 'short' })}`);
  return {
    at: d,
    title: `This week: ${week.length} ${week.length === 1 ? 'bill' : 'bills'}, ${formatMoney(total, ccy)}`,
    body: names.join(' · ') + (week.length > 3 ? ` · +${week.length - 3} more` : ''),
  };
}
