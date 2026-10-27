import { locale, t } from '@/i18n/core';
import { categoryLabel } from '@/i18n/labels';
import { fromIso, todayIso } from '@/lib/dates';
import { currentPeriod, flowRange, periodFlow, periodMonths, type FlowPeriod } from '@/lib/flow';
import { buildSankey, type SankeyNode } from '@/lib/sankey-model';
import { homeCurrency, monthlyIncome, useSettings } from '@/lib/settings';
import { useBills } from '@/lib/store';
import type { Category } from '@/lib/types';

import type { NodeStyle } from './sankey';
import { C, currentTheme } from './theme';

/** Saving and what's left get their own colours; spending is the accent, the user's own spending a lighter one. */
export const SPLIT = { dark: '#3FD4F0', light: '#0E7490' };
export const SPEND = { dark: '#FF9F87', light: '#E07856' };
export const LEFT = { dark: '#C8F25A', light: '#4D7C0F' };

export type { FlowPeriod };

/** "October 2026", "2026 so far" or "2025". */
export function periodLabel(period: FlowPeriod, today = todayIso()): string {
  if (period.kind === 'year') return period.year === today.slice(0, 4) ? t('flow.yearSoFar', { year: period.year }) : period.year;
  return fromIso(`${period.month}-01`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
}

/** As a route param: "month:2026-10" or "year:2026"; anything else is this month. */
export const periodParam = (p: FlowPeriod) => (p.kind === 'month' ? `month:${p.month}` : `year:${p.year}`);
export function parsePeriod(param: string | undefined, today = todayIso()): FlowPeriod {
  const [kind, value] = (param ?? '').split(':');
  if (kind === 'year' && /^\d{4}$/.test(value)) return { kind, year: value };
  if (kind === 'month' && /^\d{4}-\d{2}$/.test(value)) return { kind, month: value };
  return currentPeriod(kind === 'year' ? 'year' : 'month', today);
}

/** Everything "Where it goes" and its share image show, for one period (this month by default). */
export function useMoneyFlow(asked?: FlowPeriod) {
  const bills = useBills();
  const settings = useSettings();
  const today = todayIso();
  const period = asked ?? currentPeriod('month', today);
  const ccy = homeCurrency();
  const income = monthlyIncome(settings);
  const months = periodMonths(period, today);
  const flow = periodFlow(period, bills, income, ccy, today);
  const range = flowRange(bills, ccy, today);
  const model = buildSankey(flow, settings.income.map((i) => ({ label: i.label, minor: i.monthlyMinor })), settings.splits, months);
  const total = model.nodes.find((n) => n.kind === 'income')?.minor ?? 0;
  const theme = currentTheme();

  const pct = (minor: number) => `${Math.round((minor / Math.max(1, total)) * 100)}%`;
  const short = (minor: number) => Math.round(minor / 100).toLocaleString(locale());
  const nameOf = (n: SankeyNode): string => {
    switch (n.kind) {
      case 'income':
        return t('flow.income');
      case 'source':
        return n.ref || (n.id === 'source:0' ? t('flow.salary') : t('flow.otherIncome'));
      case 'shortfall':
        return t('flow.shortfall');
      case 'spending':
        return t('flow.spending');
      case 'saving':
        return t('flow.saving');
      case 'split':
        return n.ref ?? '';
      case 'left':
        // Short: diagram labels have little room.
        return t('flow.leftShort');
      case 'category':
        return n.ref === 'other' ? t('flow.other') : categoryLabel(n.ref as Category);
    }
  };
  const colorOf = (n: SankeyNode) => {
    if (n.kind === 'income' || n.kind === 'source') return C.fg;
    if (n.kind === 'saving' || (n.kind === 'split' && n.group === 'save')) return SPLIT[theme];
    if (n.kind === 'split') return SPEND[theme];
    if (n.kind === 'left') return LEFT[theme];
    return n.kind === 'category' ? C.barMuted : C.accent;
  };
  const styleOf =
    (amounts: boolean) =>
    (n: SankeyNode): NodeStyle => ({
      label: nameOf(n),
      value: n.kind === 'income' ? (amounts ? `${ccy} ${short(n.minor)}` : '100%') : amounts ? `${short(n.minor)} · ${pct(n.minor)}` : pct(n.minor),
      color: colorOf(n),
      strong: n.kind === 'income' || n.kind === 'left',
    });

  const sumOf = (kind: SankeyNode['kind']) => model.nodes.find((n) => n.kind === kind)?.minor ?? 0;
  // Spent: bills and spending splits; saved: saving splits; free: what neither takes (below zero when over).
  const spent = sumOf('spending');
  const saved = sumOf('saving');
  const free = flow.incomeMinor - spent - saved;
  const label = periodLabel(period, today);
  return { flow, model, total, income, ccy, pct, short, nameOf, styleOf, spent, saved, free, label, splits: settings.splits, months, range };
}
