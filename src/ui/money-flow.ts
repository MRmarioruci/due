import { locale, t } from '@/i18n/core';
import { categoryLabel } from '@/i18n/labels';
import { fromIso, todayIso } from '@/lib/dates';
import { monthFlow, yearFlow } from '@/lib/flow';
import { buildSankey, type SankeyNode } from '@/lib/sankey-model';
import { homeCurrency, monthlyIncome, useSettings } from '@/lib/settings';
import { useBills } from '@/lib/store';
import type { Category } from '@/lib/types';

import type { NodeStyle } from './sankey';
import { C, currentTheme } from './theme';

/** Splits (savings, investing…) and what's left get their own colours, apart from bills' accent. */
const SPLIT = { dark: '#3FD4F0', light: '#0E7490' };
const LEFT = { dark: '#C8F25A', light: '#4D7C0F' };

export type Period = 'month' | 'year';

/** Everything "Where it goes" and its share image show, for one period. */
export function useMoneyFlow(period: Period) {
  const bills = useBills();
  const settings = useSettings();
  const today = todayIso();
  const ccy = homeCurrency();
  const income = monthlyIncome(settings);
  const months = period === 'year' ? fromIso(today).getMonth() + 1 : 1;
  const flow = (period === 'year' ? yearFlow : monthFlow)(bills, income, ccy, today);
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
      case 'bills':
        return t('flow.bills');
      case 'split':
        return n.ref ?? '';
      case 'left':
        return t('flow.left');
      case 'category':
        return n.ref === 'other' ? t('flow.other') : categoryLabel(n.ref as Category);
    }
  };
  const colorOf = (n: SankeyNode) =>
    n.kind === 'income' || n.kind === 'source' ? C.fg : n.kind === 'split' ? SPLIT[theme] : n.kind === 'left' ? LEFT[theme] : n.kind === 'category' ? C.barMuted : C.accent;
  const styleOf =
    (amounts: boolean) =>
    (n: SankeyNode): NodeStyle => ({
      label: nameOf(n),
      value: n.kind === 'income' ? (amounts ? `${ccy} ${short(n.minor)}` : '100%') : amounts ? `${short(n.minor)} · ${pct(n.minor)}` : pct(n.minor),
      color: colorOf(n),
      strong: n.kind === 'income' || n.kind === 'left',
    });

  const splitTotal = model.nodes.filter((n) => n.kind === 'split').reduce((s, n) => s + n.minor, 0);
  const label = period === 'year' ? t('flow.yearSoFar', { year: today.slice(0, 4) }) : new Date().toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  return { flow, model, total, income, ccy, pct, short, nameOf, styleOf, splitTotal, label, splits: settings.splits, months };
}
