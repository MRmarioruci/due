import { describe, expect, it } from 'vitest';

import { contractOf, dueForReview, nextReview, planReviewReminders, type Contracts } from './contracts';

const kpt = { payee: 'KPT Krankenkasse AG', reviewBy: '2026-11-30', yearly: true };
const gym = { payee: 'Activ Fitness', reviewBy: '2026-12-15', yearly: false };
const contracts: Contracts = { kpt, activ: gym };

describe('contracts', () => {
  it('belong to the biller, not one bill', () => {
    expect(contractOf('KPT', contracts)).toBe(kpt);
    expect(contractOf('Swisscom', contracts)).toBeNull();
  });

  it('roll a yearly review on, and end a one-off', () => {
    expect(nextReview(kpt, '2026-10-26')).toBe('2026-11-30');
    expect(nextReview(kpt, '2026-11-30')).toBe('2026-11-30');
    expect(nextReview(kpt, '2026-12-01')).toBe('2027-11-30');
    expect(nextReview(gym, '2026-12-16')).toBeNull();
    expect(nextReview({ ...kpt, reviewBy: '2024-02-29' }, '2025-01-01')).toBe('2025-02-28');
  });

  it('show within the last 30 days, soonest first', () => {
    expect(dueForReview(contracts, '2026-10-26')).toEqual([]);
    expect(dueForReview(contracts, '2026-11-20').map((r) => [r.key, r.daysLeft])).toEqual([
      ['kpt', 10],
      ['activ', 25],
    ]);
  });

  it('remind three weeks and one week before', () => {
    const at = planReviewReminders({ kpt }, 9, new Date(2026, 9, 26, 12)).map((r) => [r.at.toDateString(), r.daysLeft]);
    // 9 Nov is a Monday; 23 Nov is a Monday.
    expect(at).toEqual([
      [new Date(2026, 10, 9).toDateString(), 21],
      [new Date(2026, 10, 23).toDateString(), 7],
    ]);
    expect(planReviewReminders({ kpt }, 9, new Date(2026, 10, 24, 12))).toEqual([]);
  });
});
