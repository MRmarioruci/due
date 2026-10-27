import { relativeDays, shortDay } from '../lib/dates';
import { activeDiscount } from '../lib/discount';
import { dialPoints, homeState } from '../lib/home';
import { formatAmount } from '../lib/money';
import type { Bill } from '../lib/types';
import { t } from '../i18n/core';

import type { WidgetDot } from './dial-svg';

const ACCENT = '#FF5A36';
const FG = '#ededed';
const MUTED = '#5f5f5f';

/** The middle of the dial: the one bill to deal with now, or that everything is handled. */
export type WidgetCentre =
  | { kind: 'focus'; label: string; urgent: boolean; currency: string; amount: string; payee: string }
  | { kind: 'calm'; label: string; headline: string; sub: string | null };

export type WidgetData = { dots: WidgetDot[]; todayColor: string; centre: WidgetCentre };

/** What the home-screen widget shows: the same dial and headline as the app's home screen. */
export function widgetData(bills: Bill[], today: string): WidgetData {
  const state = homeState(bills, today);
  const focus = state.kind === 'focus' ? state.focus : null;
  const points = dialPoints(bills, today);
  const biggest = Math.max(1, ...points.map((p) => p.bill.amountMinor ?? 0));
  const dots = points.map((p) => ({
    day: p.day,
    size: Math.round(7 + 9 * Math.sqrt((p.bill.amountMinor ?? 0) / biggest)),
    color: p.bill.id === focus?.id || p.overdue ? ACCENT : focus ? MUTED : FG,
  }));

  if (state.kind === 'focus') {
    const b = state.focus;
    return {
      dots,
      todayColor: FG,
      centre: {
        kind: 'focus',
        label: relativeDays(b.dueDate!, today).toUpperCase(),
        urgent: state.daysLeft <= 3,
        currency: b.currency,
        amount: formatAmount(activeDiscount(b, today)?.payMinor ?? b.amountMinor ?? 0, b.currency),
        payee: b.payee,
      },
    };
  }
  return {
    dots,
    todayColor: ACCENT,
    centre: {
      kind: 'calm',
      label: t('home.thisWeekCaps'),
      headline: state.kind === 'empty' ? t('home.nothingYet') : t('home.allHandled'),
      sub: state.kind === 'calm' && state.next ? `${t('widget.next')} ${shortDay(state.next.dueDate!)}` : null,
    },
  };
}
