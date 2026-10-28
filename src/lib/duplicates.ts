import { payeeKey } from './recurring';
import type { Bill, BillDraft } from './types';

const norm = (s: string | null | undefined) => (s ? s.replace(/\s/g, '').toUpperCase() : null);

/**
 * A saved bill that is the same one as the draft (scanned twice), or null.
 * Same biller and amount, and the same due date or payment reference. Monthly bills from one biller
 * share the amount (and sometimes a fixed reference) but not the due date, so they don't match.
 */
export function findDuplicate(draft: Pick<BillDraft, 'kind' | 'payee' | 'amountMinor' | 'dueDate' | 'issueDate' | 'time' | 'payment'>, bills: Bill[], ignoreId?: string): Bill | null {
  const key = payeeKey(draft.payee);
  // The same receipt scanned twice: same shop, total and day (and time, when both have one).
  if (draft.kind === 'receipt') {
    if (!key || draft.amountMinor == null || !draft.issueDate) return null;
    return (
      bills.find(
        (b) =>
          b.id !== ignoreId &&
          b.kind === 'receipt' &&
          payeeKey(b.payee) === key &&
          b.amountMinor === draft.amountMinor &&
          b.issueDate === draft.issueDate &&
          (!draft.time || !b.time || draft.time === b.time),
      ) ?? null
    );
  }
  const iban = norm(draft.payment.iban);
  const ref = norm(draft.payment.reference);
  if (!key && !iban) return null;
  return (
    bills.find((b) => {
      if (b.id === ignoreId || b.kind === 'receipt') return false;
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
