/** Dates are stored as local calendar days ("YYYY-MM-DD"); these helpers never go through UTC. */

export function todayIso(now = new Date()): string {
  return toIso(now);
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((fromIso(toIsoDate).getTime() - fromIso(fromIsoDate).getTime()) / 86_400_000);
}

export function addDaysIso(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/**
 * When to remind for a bill: `daysBefore` the due date at `hour`, moved back to Friday when it lands on a weekend.
 * Returns null when that moment has already passed.
 */
export function reminderMoment(dueDate: string, daysBefore: number, hour = 9, now = new Date()): Date | null {
  const d = fromIso(dueDate);
  d.setDate(d.getDate() - daysBefore);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() - 1);
  if (dow === 0) d.setDate(d.getDate() - 2);
  d.setHours(hour, 0, 0, 0);
  return d.getTime() > now.getTime() ? d : null;
}

/** "Thu 29 Oct" in the device locale. */
export function shortDay(d: Date | string): string {
  const date = typeof d === 'string' ? fromIso(d) : d;
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function longDate(iso: string): string {
  return fromIso(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeDays(dueDate: string, today = todayIso()): string {
  const n = daysBetween(today, dueDate);
  if (n < 0) return n === -1 ? '1 DAY LATE' : `${-n} DAYS LATE`;
  if (n === 0) return 'TODAY';
  if (n === 1) return 'TOMORROW';
  return `${n} DAYS`;
}

/** 9 -> "09:00". */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
