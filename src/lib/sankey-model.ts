import type { Flow } from './flow';
import type { Category } from './types';

/**
 * The money flow as a left-to-right Sankey, by what the money does: income (from its sources, when
 * there are several) splits into spending, saving and what's left. Spending is the bills, by
 * category, plus the user's own spending splits (groceries, going out…); saving is their saving
 * splits (savings, investing, pillar 3a…). When more goes out than comes in, a "shortfall" source
 * makes up the difference, so every node's in and out add up.
 */
export type SplitKind = 'spend' | 'save';
export type Split = { id: string; name: string; monthlyMinor: number; kind?: SplitKind };

// Names that mean putting money away, in the app's languages; anything else counts as spending.
const SAVING = /sav|spar|épar|epar|rispar|ahorr|poupan|invest|anlag|vorsorge|3a|säule|pilier|pilastro|pension|rente|retire|depot|etf|fund|fonds|aktie|stock|crypto|bitcoin|emergency|notgroschen|reserve|oszcz|inwest|emeryt|fond|αποταμ|επενδ|συνταξ|σύνταξ/i;

/** Spending or saving: as the user set it, else guessed from the name. */
export const splitKind = (s: Pick<Split, 'name' | 'kind'>): SplitKind => s.kind ?? (SAVING.test(s.name) ? 'save' : 'spend');

export type NodeKind = 'source' | 'shortfall' | 'income' | 'spending' | 'saving' | 'split' | 'left' | 'category';
export type SankeyNode = { id: string; kind: NodeKind; col: number; minor: number; ref: string | null; group?: SplitKind };
export type SankeyLink = { from: string; to: string; minor: number };
export type SankeyModel = { nodes: SankeyNode[]; links: SankeyLink[]; columns: number };

export function buildSankey(flow: Flow, sources: { label: string | null; minor: number }[], splits: Split[], months: number): SankeyModel {
  const scaled = splits.map((s) => ({ ...s, minor: s.monthlyMinor * months, group: splitKind(s) })).filter((s) => s.minor > 0);
  const spendSplits = scaled.filter((s) => s.group === 'spend');
  const saveSplits = scaled.filter((s) => s.group === 'save');
  const spending = flow.billsMinor + spendSplits.reduce((t, s) => t + s.minor, 0);
  const saving = saveSplits.reduce((t, s) => t + s.minor, 0);
  const shortfall = Math.max(0, spending + saving - flow.incomeMinor);
  const feeders = [...sources.filter((s) => s.minor > 0).map((s, i) => ({ id: `source:${i}`, kind: 'source' as const, minor: s.minor * months, ref: s.label })), ...(shortfall ? [{ id: 'shortfall', kind: 'shortfall' as const, minor: shortfall, ref: null }] : [])];
  // One plain source needs no column of its own: the chart starts at income.
  const start = feeders.length > 1 ? 1 : 0;
  const total = flow.incomeMinor + shortfall;

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const add = (node: SankeyNode, from: string) => {
    nodes.push(node);
    links.push({ from, to: node.id, minor: node.minor });
  };
  if (start) {
    for (const f of feeders) nodes.push({ ...f, col: 0 });
    for (const f of feeders) links.push({ from: f.id, to: 'income', minor: f.minor });
  }
  nodes.push({ id: 'income', kind: 'income', col: start, minor: total, ref: null });

  const mid = start + 1;
  if (spending > 0) {
    add({ id: 'spending', kind: 'spending', col: mid, minor: spending, ref: null }, 'income');
    for (const g of flow.groups) add({ id: `cat:${g.key}`, kind: 'category', col: mid + 1, minor: g.minor, ref: g.key as Category | 'other' }, 'spending');
    for (const s of spendSplits) add({ id: `split:${s.id}`, kind: 'split', col: mid + 1, minor: s.minor, ref: s.name, group: 'spend' }, 'spending');
  }
  if (saving > 0) {
    add({ id: 'saving', kind: 'saving', col: mid, minor: saving, ref: null }, 'income');
    for (const s of saveSplits) add({ id: `split:${s.id}`, kind: 'split', col: mid + 1, minor: s.minor, ref: s.name, group: 'save' }, 'saving');
  }
  const left = total - spending - saving;
  if (left > 0) add({ id: 'left', kind: 'left', col: mid, minor: left, ref: null }, 'income');
  return { nodes, links, columns: Math.max(...nodes.map((n) => n.col)) + 1 };
}
