import type { BillDraft } from './types';

/** Hands the scanned draft from the scan screen to the review screen without serializing it into route params. */
let pending: { draft: BillDraft; warning: string | null } | null = null;

export function setPendingDraft(d: typeof pending) {
  pending = d;
}

export function takePendingDraft() {
  return pending;
}
