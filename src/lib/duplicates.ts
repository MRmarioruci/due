import { payeeKey } from './recurring';
import type { Bill, BillDraft } from './types';

const norm = (s: string | null | undefined) => (s ? s.replace(/\s/g, '').toUpperCase() : null);

/**
 * A saved bill that is the same one as the draft (scanned twice), or null.
 * Same biller and amount, and the same due date or payment reference. Monthly bills from one biller
 * share the amount (and sometimes a fixed reference) but not the due date, so they don't match.
 */
export function findDuplicate(draft: Pick<BillDraft, 'payee' | 'amountMinor' | 'dueDate' | 'payment'>, bills: Bill[], ignoreId?: string): Bill | null {
  const key = payeeKey(draft.payee);
  const iban = norm(draft.payment.iban);
  const ref = norm(draft.payment.reference);
  if (!key && !iban) return null;
  return (
    bills.find((b) => {
      if (b.id === ignoreId) return false;
      const samePayee = (!!key && payeeKey(b.payee) === key) || (!!iban && norm(b.payment.iban) === iban);
      if (!samePayee) return false;
      const bRef = norm(b.payment.reference);
      if (ref && bRef && ref !== bRef) return false;
      if (draft.amountMinor == null || draft.amountMinor !== b.amountMinor) return false;
      if (draft.dueDate && b.dueDate) return draft.dueDate === b.dueDate;
      return !!ref && ref === bRef;
    }) ?? null
  );
}
