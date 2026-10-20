import { addDaysIso, daysBetween, fromIso, reminderMoment, shortDay, toIso, todayIso } from './dates';
import { activeDiscount, targetDate } from './discount';
import { formatMoney } from './money';
import type { Bill } from './types';

export type PlannedReminder = { kind: 'main' | 'tomorrow' | 'overdue'; at: Date; title: string; body: string };

/** How early the user likes to pay: as soon as a bill arrives, halfway to the due date, or just before it. */
export type PayStyle = 'early' | 'midway' | 'last';

export const PAY_STYLES: { key: PayStyle; label: string; detail: string }[] = [
  { key: 'early', label: 'Right away', detail: 'Remind me as soon as a bill arrives, so nothing hangs around.' },
  { key: 'midway', label: 'Halfway', detail: 'Remind me halfway between a bill arriving and its due date.' },
  { key: 'last', label: 'Just in time', detail: 'Remind me a few days before it’s due. The money stays with you longest.' },
];

type Prefs = { remindHour: number; extraNudges: boolean; payStyle?: PayStyle };

/** The next reminder slot from now: today at `hour` if that's still ahead, else tomorrow. */
function nextSlot(hour: number, now: Date): Date {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * When the main reminder goes off for a bill, following its pay style (or the default one).
 * Never after the deadline (discount or due date); null when that's already passed.
 */
export function mainReminder(bill: Bill, prefs: Prefs, now = new Date()): Date | null {
  const target = targetDate(bill, todayIso(now));
  if (!target) return null;
  const style = bill.payStyle ?? prefs.payStyle ?? 'last';
  const deadline = fromIso(target);
  deadline.setHours(23, 59, 0, 0);
  const latest = reminderMoment(target, bill.remindDaysBefore, prefs.remindHour, now);

  if (style === 'last') return latest;

  const arrived = bill.issueDate ?? toIso(new Date(bill.createdAt));
  let when: Date;
  if (style === 'early') {
    when = nextSlot(prefs.remindHour, now);
  } else {
    const mid = addDaysIso(arrived, Math.floor(Math.max(0, daysBetween(arrived, target)) / 2));
    when = reminderMoment(mid, 0, prefs.remindHour, now) ?? nextSlot(prefs.remindHour, now);
  }
  // A style that would remind later than "just in time" falls back to it.
  if (latest && when > latest) return latest;
  return when <= deadline ? when : latest;
}

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

  const main = snoozedTo ?? mainReminder(bill, prefs, now);
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
