import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';

import { formatMoney } from './money';
import { markPaid } from './reminders';
import { getBill } from './store';

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
      Alert.alert(`Did you pay ${bill.payee}?`, formatMoney(bill.amountMinor, bill.currency), [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Yes, mark paid', onPress: () => markPaid(bill) },
      ]);
    });
    return () => sub.remove();
  }, []);
}
