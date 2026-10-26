import type { Flow } from './flow';
import type { Category } from './types';

/**
 * The money flow as a left-to-right Sankey: income (from its sources, when there are several)
 * splits into bills, the user's own splits (savings, investing…) and what's left; bills split again
 * by category. When more goes out than comes in, a "shortfall" source makes up the difference, so
 * every node's in and out add up.
 */
export type Split = { id: string; name: string; monthlyMinor: number };

export type NodeKind = 'source' | 'shortfall' | 'income' | 'bills' | 'split' | 'left' | 'category';
export type SankeyNode = { id: string; kind: NodeKind; col: number; minor: number; ref: string | null };
export type SankeyLink = { from: string; to: string; minor: number };
export type SankeyModel = { nodes: SankeyNode[]; links: SankeyLink[]; columns: number };

export function buildSankey(flow: Flow, sources: { label: string | null; minor: number }[], splits: Split[], months: number): SankeyModel {
  const splitMinor = splits.map((s) => ({ ...s, minor: s.monthlyMinor * months })).filter((s) => s.minor > 0);
  const out = flow.billsMinor + splitMinor.reduce((t, s) => t + s.minor, 0);
  const shortfall = Math.max(0, out - flow.incomeMinor);
  const feeders = [...sources.filter((s) => s.minor > 0).map((s, i) => ({ id: `source:${i}`, kind: 'source' as const, minor: s.minor * months, ref: s.label })), ...(shortfall ? [{ id: 'shortfall', kind: 'shortfall' as const, minor: shortfall, ref: null }] : [])];
  // One plain source needs no column of its own: the chart starts at income.
  const start = feeders.length > 1 ? 1 : 0;
  const total = flow.incomeMinor + shortfall;

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  if (start) {
    for (const f of feeders) nodes.push({ ...f, col: 0 });
    for (const f of feeders) links.push({ from: f.id, to: 'income', minor: f.minor });
  }
  nodes.push({ id: 'income', kind: 'income', col: start, minor: total, ref: null });

  const mid = start + 1;
  if (flow.billsMinor > 0) {
    nodes.push({ id: 'bills', kind: 'bills', col: mid, minor: flow.billsMinor, ref: null });
    links.push({ from: 'income', to: 'bills', minor: flow.billsMinor });
    for (const g of flow.groups) {
      nodes.push({ id: `cat:${g.key}`, kind: 'category', col: mid + 1, minor: g.minor, ref: g.key as Category | 'other' });
      links.push({ from: 'bills', to: `cat:${g.key}`, minor: g.minor });
    }
  }
  for (const s of splitMinor) {
    nodes.push({ id: `split:${s.id}`, kind: 'split', col: mid, minor: s.minor, ref: s.name });
    links.push({ from: 'income', to: `split:${s.id}`, minor: s.minor });
  }
  const left = total - out;
  if (left > 0) {
    nodes.push({ id: 'left', kind: 'left', col: mid, minor: left, ref: null });
    links.push({ from: 'income', to: 'left', minor: left });
  }
  return { nodes, links, columns: Math.max(...nodes.map((n) => n.col)) + 1 };
}
