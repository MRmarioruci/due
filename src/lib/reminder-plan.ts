import { addDaysIso, daysBetween, fromIso, reminderMoment, shortDay, toIso, todayIso } from './dates';
import { activeDiscount, targetDate } from './discount';
import { formatMoney } from './money';
import type { Bill } from './types';
import { locale, t } from '../i18n/core';

export type PlannedReminder = { kind: 'main' | 'tomorrow' | 'overdue'; at: Date; title: string; body: string };

/** How early the user likes to pay: as soon as a bill arrives, halfway to the due date, or just before it. */
export type PayStyle = 'early' | 'midway' | 'last';

/** Labels live in i18n (style.early, style.early.detail, …). */
export const PAY_STYLES: { key: PayStyle }[] = [{ key: 'early' }, { key: 'midway' }, { key: 'last' }];

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
 * The main reminder as it stands: a snooze wins; else the one already planned (null once it has gone
 * off, so opening the app doesn't plan it again); else a fresh plan. Edits and setting changes clear
 * `remindAt` to re-plan.
 */
export function currentMain(bill: Pick<Bill, 'snoozedUntil' | 'remindAt'> & Bill, prefs: Prefs, now = new Date()): Date | null {
  if (bill.snoozedUntil && new Date(bill.snoozedUntil) > now) return new Date(bill.snoozedUntil);
  if (bill.remindAt) {
    const planned = new Date(bill.remindAt);
    return planned > now ? planned : null;
  }
  return mainReminder(bill, prefs, now);
}

/**
 * Every notification a bill should get: the main reminder (or a snoozed one), and with extra nudges on,
 * one the day before its deadline and one the day after it's due if it's still open then.
 */
export function planReminders(bill: Bill, prefs: Prefs, now = new Date()): PlannedReminder[] {
  if (bill.status !== 'open') return [];
  const target = targetDate(bill, todayIso(now));
  const title = `${bill.payee} · ${formatMoney(bill.amountMinor, bill.currency)}`;
  const out: PlannedReminder[] = [];

  const main = currentMain(bill, prefs, now);
  if (main && main > now) out.push({ kind: 'main', at: main, title, body: describeDue(bill, main) });

  if (prefs.extraNudges && target) {
    const dayBefore = at(addDaysIso(target, -1), prefs.remindHour);
    const sameDay = (a: Date, b: Date) => todayIso(a) === todayIso(b);
    if (dayBefore > now && !out.some((r) => sameDay(r.at, dayBefore)) && (!main || dayBefore > main)) {
      out.push({ kind: 'tomorrow', at: dayBefore, title, body: t('notify.lastCall', { text: describeDue(bill, dayBefore) }) });
    }
  }
  if (prefs.extraNudges && bill.dueDate) {
    const late = at(addDaysIso(bill.dueDate, 1), prefs.remindHour);
    if (late > now) out.push({ kind: 'overdue', at: late, title, body: t('notify.overdue', { date: shortDay(bill.dueDate) }) });
  }
  return out;
}

function describeDue(bill: Bill, when: Date): string {
  const discount = activeDiscount(bill, todayIso(when));
  if (discount) return t('notify.discount', { pct: discount.percent, date: shortDay(discount.until), amount: formatMoney(discount.payMinor, bill.currency) });
  if (!bill.dueDate) return t('notify.openQr');
  const days = daysBetween(todayIso(when), bill.dueDate);
  return days === 0 ? t('notify.dueToday') : days === 1 ? t('notify.dueTomorrow') : t('notify.dueOn', { date: shortDay(bill.dueDate) });
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
  const names = week.slice(0, 3).map((x) => `${x.b.payee} ${fromIso(x.deadline!).toLocaleDateString(locale(), { weekday: 'short' })}`);
  return {
    at: d,
    title: t('notify.digestTitle', { n: week.length, total: formatMoney(total, ccy) }),
    body: names.join(' · ') + (week.length > 3 ? ` · ${t('notify.more', { n: week.length - 3 })}` : ''),
  };
}

/** Phones cap scheduled notifications: iOS keeps only 64, Android refuses alarms past 500. */
export const NOTIFICATION_CAP = { ios: 60, android: 300 } as const;

/**
 * Which planned notifications get scheduled now: the soonest `cap`, keeping each bill's main
 * reminder ahead of other bills' extra nudges. The rest are scheduled as the window moves on.
 */
export function withinBudget<T extends { kind: PlannedReminder['kind']; at: Date }>(planned: T[], cap: number): T[] {
  const sorted = [...planned].sort((a, b) => a.at.getTime() - b.at.getTime());
  if (sorted.length <= cap) return sorted;
  const mains = sorted.filter((r) => r.kind === 'main').slice(0, cap);
  const room = cap - mains.length;
  const lastMain = mains[mains.length - 1]?.at.getTime() ?? Infinity;
  const extras = sorted.filter((r) => r.kind !== 'main' && r.at.getTime() <= lastMain).slice(0, room);
  return [...mains, ...extras].sort((a, b) => a.at.getTime() - b.at.getTime());
}

export type SnoozeOption = { key: 'later' | 'tomorrow' | 'days3' | 'payday'; at: Date };

/**
 * "Remind me later" choices with exact times: later today (3 hours on, until 21:00), tomorrow, in
 * 3 days and on payday, at the usual reminder hour. Options past the bill's deadline are left out.
 */
export function snoozeOptions(bill: Bill, hour: number, payday: string | null, now = new Date()): SnoozeOption[] {
  const target = targetDate(bill, todayIso(now));
  const deadline = target ? fromIso(target) : null;
  deadline?.setHours(23, 59, 0, 0);
  const dayAt = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const out: SnoozeOption[] = [];
  const later = new Date(now.getTime() + 3 * 3600_000);
  later.setMinutes(later.getMinutes() < 30 ? 30 : 60, 0, 0);
  if (later.getHours() < 21 && later.getHours() >= 7 && todayIso(later) === todayIso(now)) out.push({ key: 'later', at: later });
  out.push({ key: 'tomorrow', at: dayAt(1) });
  out.push({ key: 'days3', at: dayAt(3) });
  if (payday && daysBetween(todayIso(now), payday) > 1) {
    const p = fromIso(payday);
    p.setHours(hour, 0, 0, 0);
    if (p.getTime() !== dayAt(3).getTime()) out.push({ key: 'payday', at: p });
  }
  // Tomorrow always stays, even when the bill is due today: better late than forgotten.
  return out.filter((o) => o.key === 'tomorrow' || !deadline || o.at <= deadline).sort((a, b) => a.at.getTime() - b.at.getTime());
}
