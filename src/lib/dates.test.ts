import { describe, expect, it } from 'vitest';

import { daysBetween, reminderMoment, relativeDays } from './dates';

const now = new Date(2026, 9, 20, 12); // Tue 20 Oct 2026, noon

describe('reminderMoment', () => {
  it('reminds n days before at 09:00', () => {
    const d = reminderMoment('2026-11-01', 3, 9, now)!; // due Sun 1 Nov
    expect([d.getMonth(), d.getDate(), d.getHours()]).toEqual([9, 29, 9]); // Thu 29 Oct
  });

  it('moves Saturday and Sunday reminders to Friday', () => {
    expect(reminderMoment('2026-11-01', 1, 9, now)!.getDate()).toBe(30); // Sat 31 -> Fri 30
    expect(reminderMoment('2026-11-01', 0, 9, now)!.getDate()).toBe(30); // Sun 1 -> Fri 30
  });

  it('skips moments in the past', () => {
    expect(reminderMoment('2026-10-21', 3, 9, now)).toBeNull();
  });
});

describe('relative days', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-10-20', '2026-11-01')).toBe(12);
    expect(relativeDays('2026-10-23', '2026-10-20')).toBe('3 DAYS');
    expect(relativeDays('2026-10-21', '2026-10-20')).toBe('TOMORROW');
    expect(relativeDays('2026-10-18', '2026-10-20')).toBe('2 DAYS LATE');
  });
});
