import { useEffect } from 'react';
import { AppState } from 'react-native';

import { formatMoney } from './money';
import { markPaid } from './reminders';
import { getBill } from './store';
import { sheet, toast } from '@/ui/overlay';
import { t } from '@/i18n/core';

/**
 * After the user shares the QR code or copies payment details, they usually switch to their banking app.
 * When they come back, ask once whether they paid, so marking it takes one tap.
 */
let armed: { billId: string; at: number } | null = null;
const WINDOW_MS = 60 * 60 * 1000;

export function armPayCheck(billId: string) {
  armed = { billId, at: Date.now() };
}

/** Mount once, in the root layout. */
export function usePayCheck() {
  useEffect(() => {
    let wasAway = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') wasAway = true;
      if (state !== 'active' || !wasAway) return;
      wasAway = false;
      const a = armed;
      armed = null;
      if (!a || Date.now() - a.at > WINDOW_MS) return;
      const bill = getBill(a.billId);
      if (!bill || bill.status === 'paid') return;
      sheet.show({
        title: t('paycheck.title', { payee: bill.payee }),
        message: formatMoney(bill.amountMinor, bill.currency),
        actions: [
          {
            label: t('paycheck.yes'),
            onPress: async () => {
              await markPaid(bill);
              toast(t('bill.markedPaid', { payee: bill.payee }));
            },
          },
          { label: t('paycheck.notYet'), kind: 'secondary' },
        ],
      });
    });
    return () => sub.remove();
  }, []);
}
