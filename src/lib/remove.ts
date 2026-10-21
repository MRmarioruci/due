import { removeOriginals } from './originals';
import { cancelFor } from './reminders';
import { deleteBill, getBills } from './store';
import type { Bill } from './types';

/** Deletes a bill with everything that hangs off it: its reminders and the kept photo or PDF. */
export async function removeBill(bill: Bill) {
  await cancelFor(bill);
  removeOriginals(bill);
  deleteBill(bill.id);
}

/** Settings → Delete all bills. */
export async function removeAllBills() {
  for (const b of getBills()) await removeBill(b);
}
