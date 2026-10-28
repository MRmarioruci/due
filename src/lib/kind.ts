// Bill or receipt: due reads both from the same scan and works out which one it is.

import { guessCategory } from './categorize';
import { payeeKey } from './recurring';
import type { Bill, Category, Kind } from './types';

/** Categories that are almost always a till receipt, not a bill to pay. */
const SHOP_CATEGORIES: Category[] = ['groceries', 'dining', 'fuel', 'household', 'kids', 'leisure'];

/** Words printed on till receipts (and rarely on bills), in the app's languages plus Greek. No "Kasse" or "cassa": they're in health insurers' names. */
const RECEIPT_WORDS = [
  'quittung', 'kassenbon', 'kassenzettel', 'beleg', 'reçu', 'ticket de caisse', 'scontrino', 'ricevuta', 'recibo', 'ticket de compra',
  'paragon', 'kassabon', 'bon nr', 'receipt', 'apodeixi', 'απόδειξη', 'αποδειξη', 'λιανικής', 'λιανικη', 'ταμειακ', 'cash', 'barzahlung',
  'bar bezahlt', 'rückgeld', 'retour', 'resto', 'change due', 'ρέστα', 'μετρητά', 'κάρτα', 'visa ', 'mastercard', 'maestro', 'contactless',
  'kontaktlos', 'sans contact', 'ταμείο',
];

/** Words printed on bills to pay. */
const BILL_WORDS = ['zahlbar bis', 'fällig', 'payable', 'échéance', 'scadenza', 'vencimiento', 'vencimento', 'termin płatności', 'te betalen', 'λήξη', 'πληρωμή έως', 'due date', 'rechnung', 'facture', 'fattura', 'factura', 'invoice', 'faktura', 'λογαριασμός'];

export type KindHints = {
  /** A Swiss QR-bill or EPC code was scanned: it's a bill to pay. */
  paymentCode: boolean;
  payee: string;
  description?: string | null;
  /** What the reader said, when it says. */
  model?: Kind | null;
  dueDate?: string | null;
  iban?: string | null;
  reference?: string | null;
  /** Text the reader saw (e.g. the description), for the receipt and bill words. */
  text?: string | null;
  learned: Record<string, Kind>;
};

/**
 * What a scan most likely is. The user's earlier correction for this shop or biller wins, then a
 * payment code (always a bill), then the reader, then the clues: payment details mean a bill, a
 * shop name or till-receipt wording means a receipt.
 */
export function detectKind(h: KindHints): Kind {
  const remembered = h.learned[payeeKey(h.payee)];
  if (remembered) return remembered;
  if (h.paymentCode) return 'bill';
  if (h.model === 'bill' || h.model === 'receipt') return h.model;
  if (h.iban || h.reference) return 'bill';
  const hay = ` ${[h.payee, h.description, h.text].filter(Boolean).join(' ').toLowerCase()} `;
  if (BILL_WORDS.some((w) => hay.includes(w))) return 'bill';
  if (h.dueDate) return 'bill';
  const shop = guessCategory(h.payee, h.description);
  if (shop && SHOP_CATEGORIES.includes(shop)) return 'receipt';
  if (RECEIPT_WORDS.some((w) => hay.includes(w))) return 'receipt';
  return 'bill';
}

/** When a receipt was paid: its date (and time, when printed), as an ISO timestamp. Today when unknown. */
export function receiptPaidAt(date: string | null | undefined, time?: string | null, now = new Date()): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return now.toISOString();
  const [y, m, d] = date.split('-').map(Number);
  const hm = time && /^(\d{1,2}):(\d{2})/.exec(time);
  // Noon when there's no time, so the day doesn't shift in any time zone.
  const at = new Date(y, m - 1, d, hm ? Number(hm[1]) : 12, hm ? Number(hm[2]) : 0);
  // A date in the future is a misread: keep today instead.
  return at > now ? now.toISOString() : at.toISOString();
}

/**
 * An open bill this receipt pays (a payment confirmation from the biller): same payee and amount.
 * Then the bill gets marked paid instead of the spending being counted twice.
 */
export function billPaidBy(receipt: { payee: string; amountMinor: number | null; currency: string }, bills: Bill[]): Bill | null {
  const key = payeeKey(receipt.payee);
  if (!key || receipt.amountMinor == null) return null;
  return bills.find((b) => b.status === 'open' && b.kind !== 'receipt' && b.currency === receipt.currency && payeeKey(b.payee) === key && b.amountMinor === receipt.amountMinor) ?? null;
}
