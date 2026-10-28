/**
 * Dragging the marker around the home dial: which day a finger is on, and snapping to a bill's day
 * when it's close, so landing on a bill is easy.
 */
export const SPAN = 300;

/** The day under a point on the dial (centre `c`), from 0 (today) to `days`; the gap clamps to its ends. */
export function dayAtPoint(x: number, y: number, c: number, days: number): number {
  const deg = (Math.atan2(x - c, -(y - c)) * 180) / Math.PI;
  const clamped = Math.max(-SPAN / 2, Math.min(SPAN / 2, deg));
  return ((clamped + SPAN / 2) / SPAN) * days;
}

/** The nearest bill day within `reach` days, else the whole day under the finger. */
export function snapDay(day: number, billDays: number[], reach = 0.9): number {
  let best: number | null = null;
  for (const d of billDays) if (Math.abs(d - day) <= reach && (best == null || Math.abs(d - day) < Math.abs(best - day))) best = d;
  return best ?? Math.round(day);
}

/** The bill day after (`dir` 1) or before (−1) `day`, for stepping with a screen reader. */
export function stepBillDay(day: number, billDays: number[], dir: 1 | -1): number {
  const sorted = [...new Set(billDays)].sort((a, b) => a - b);
  const next = dir > 0 ? sorted.find((d) => d > day) : [...sorted].reverse().find((d) => d < day);
  return next ?? day;
}
