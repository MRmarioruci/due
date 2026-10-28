import { payeeKey } from './recurring';
import type { Bill, BillDraft } from './types';

/** "Payment reminder" in the app's languages; a fallback for when the model doesn't say. */
const WORDS = [
  'mahnung', 'zahlungserinnerung', 'rappel de paiement', 'sommation', 'sollecito', 'diffida', 'recordatorio de pago', 'requerimiento de pago',
  'lembrete de pagamento', 'aviso de cobrança', 'aanmaning', 'betalingsherinnering', 'upomnienie', 'wezwanie do zapłaty', 'payment reminder',
  'overdue notice', 'final notice',
];

/** True when the text calls the document a payment reminder. */
export function looksLikeDunning(...texts: (string | null | undefined)[]): boolean {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  return WORDS.some((w) => hay.includes(w));
}

/**
 * The open bill a payment reminder is chasing: same biller, and the same reference or the
 * reminder's amount without its fee (or the same amount when there's no fee).
 */
export function chasedBill(draft: Pick<BillDraft, 'payee' | 'amountMinor' | 'payment' | 'dunning'>, bills: Bill[], status: Bill['status'] = 'open'): Bill | null {
  if (!draft.dunning) return null;
  const key = payeeKey(draft.payee);
  const ref = draft.payment.reference?.replace(/\s/g, '') || null;
  const base = draft.amountMinor != null ? draft.amountMinor - (draft.dunning.feeMinor ?? 0) : null;
  return (
    bills.find((b) => {
      if (b.status !== status || payeeKey(b.payee) !== key) return false;
      const bRef = b.payment.reference?.replace(/\s/g, '') || null;
      if (ref && bRef) return ref === bRef;
      return base != null && (b.amountMinor === base || b.amountMinor === draft.amountMinor);
    }) ?? null
  );
}

/** A payment reminder for a bill already marked paid: the biller may not have the payment yet. */
export function alreadyPaid(draft: Pick<BillDraft, 'payee' | 'amountMinor' | 'payment' | 'dunning'>, bills: Bill[]): Bill | null {
  return chasedBill(draft, bills, 'paid');
}
