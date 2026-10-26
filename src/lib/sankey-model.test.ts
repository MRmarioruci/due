import { describe, expect, it } from 'vitest';

import type { Flow } from './flow';
import { buildSankey } from './sankey-model';

const flow: Flow = {
  incomeMinor: 620000,
  billsMinor: 330000,
  leftMinor: 290000,
  groups: [
    { key: 'housing', minor: 185000, rows: [] },
    { key: 'other', minor: 145000, rows: [] },
  ],
};

const sum = (xs: { minor: number }[]) => xs.reduce((s, x) => s + x.minor, 0);

describe('sankey model', () => {
  it('starts at income, splits into bills, own splits and what’s left, then bills by category', () => {
    const m = buildSankey(flow, [{ label: null, minor: 620000 }], [{ id: 's', name: 'Savings', monthlyMinor: 80000 }], 1);
    expect(m.columns).toBe(3);
    expect(m.nodes.map((n) => [n.id, n.col, n.minor])).toEqual([
      ['income', 0, 620000],
      ['bills', 1, 330000],
      ['cat:housing', 2, 185000],
      ['cat:other', 2, 145000],
      ['split:s', 1, 80000],
      ['left', 1, 210000],
    ]);
    // Every node passes on exactly what it takes in.
    for (const n of m.nodes) {
      const into = sum(m.links.filter((l) => l.to === n.id));
      const outOf = sum(m.links.filter((l) => l.from === n.id));
      if (into && outOf) expect(outOf).toBe(into);
    }
  });

  it('shows several sources feeding income', () => {
    const m = buildSankey(flow, [{ label: null, minor: 520000 }, { label: null, minor: 100000 }], [], 1);
    expect(m.columns).toBe(4);
    expect(m.nodes.filter((n) => n.col === 0).map((n) => n.id)).toEqual(['source:0', 'source:1']);
  });

  it('balances overspending with a shortfall', () => {
    const m = buildSankey(flow, [{ label: null, minor: 620000 }], [{ id: 'i', name: 'Investing', monthlyMinor: 400000 }], 1);
    expect(m.nodes.find((n) => n.id === 'shortfall')?.minor).toBe(110000);
    expect(m.nodes.find((n) => n.id === 'income')?.minor).toBe(730000);
    expect(m.nodes.some((n) => n.id === 'left')).toBe(false);
  });

  it('scales the splits for the year so far', () => {
    const m = buildSankey({ ...flow, incomeMinor: 6200000, billsMinor: 3300000, leftMinor: 2900000 }, [{ label: null, minor: 620000 }], [{ id: 's', name: 'Savings', monthlyMinor: 80000 }], 10);
    expect(m.nodes.find((n) => n.id === 'split:s')?.minor).toBe(800000);
  });
});
