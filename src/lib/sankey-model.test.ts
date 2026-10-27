import { describe, expect, it } from 'vitest';

import type { Flow } from './flow';
import { buildSankey, splitKind } from './sankey-model';

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
  it('splits income into spending (bills by category, plus spending splits), saving and what’s left', () => {
    const splits = [{ id: 's', name: 'Savings', monthlyMinor: 80000 }, { id: 'g', name: 'Groceries', monthlyMinor: 60000 }];
    const m = buildSankey(flow, [{ label: null, minor: 620000 }], splits, 1);
    expect(m.columns).toBe(3);
    expect(m.nodes.map((n) => [n.id, n.col, n.minor])).toEqual([
      ['income', 0, 620000],
      ['spending', 1, 390000],
      ['cat:housing', 2, 185000],
      ['cat:other', 2, 145000],
      ['split:g', 2, 60000],
      ['saving', 1, 80000],
      ['split:s', 2, 80000],
      ['left', 1, 150000],
    ]);
    // Every node passes on exactly what it takes in.
    for (const n of m.nodes) {
      const into = sum(m.links.filter((l) => l.to === n.id));
      const outOf = sum(m.links.filter((l) => l.from === n.id));
      if (into && outOf) expect(outOf).toBe(into);
    }
  });

  it('tells saving from spending by name unless the user chose', () => {
    expect(['Savings', 'Investing', 'Pillar 3a', 'Säule 3a', 'Notgroschen', 'Αποταμίευση', 'ETF'].map((name) => splitKind({ name }))).toEqual(Array(7).fill('save'));
    expect(['Groceries', 'Lebensmittel', 'Entertainment', 'Fun'].map((name) => splitKind({ name }))).toEqual(Array(4).fill('spend'));
    expect(splitKind({ name: 'Savings', kind: 'spend' })).toBe('spend');
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
