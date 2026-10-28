export type Category =
  | 'insurance'
  | 'telecom'
  | 'utilities'
  | 'housing'
  | 'taxes'
  | 'fees'
  | 'health'
  | 'transport'
  | 'shopping'
  // Everyday spending, mostly from receipts.
  | 'groceries'
  | 'dining'
  | 'fuel'
  | 'household'
  | 'kids'
  | 'leisure'
  | 'other';

/** A bill is something to pay; a receipt is something already paid (shopping, a meal, fuel). */
export type Kind = 'bill' | 'receipt';

/** How the bill gets paid. Drives what the bill screen offers. */
export type PayMethod =
  | 'qr_transfer' // a payment QR the user's banking app can scan (Swiss QR-bill, EPC/GiroCode)
  | 'bank_transfer' // printed bank details only
  | 'direct_debit' // taken automatically; nothing to do but have the money there
  | 'portal' // pay on the biller's website / app
  | 'other';

/** Payment standards we decode exactly on the device. */
export type PaymentStandard = 'swiss_qr' | 'epc';

/** Where a field's value came from: decoded from a payment code, read by the model, or typed by the user. */
export type Source = 'qr' | 'ai' | 'user';

export type Payment = {
  standard: PaymentStandard | null;
  /** The decoded payment code exactly as scanned; re-encoded for the bill screen. */
  raw: string | null;
  iban: string | null;
  bic: string | null;
  creditorName: string | null;
  /** Needed to build a Swiss QR-bill when the original code wasn't scanned (e.g. a PDF). */
  creditorAddress: Address | null;
  reference: string | null;
  referenceType: 'QRR' | 'SCOR' | 'NON' | null;
  message: string | null;
  accountNumber: string | null;
  payUrl: string | null;
};

/** Early-payment discount (Skonto): `percent` off when paid by `until` (YYYY-MM-DD). */
export type Discount = { percent: number; until: string };

/** A payment reminder (Mahnung) for an earlier bill: 1 first reminder, 2 second, 3 final notice. */
export type Dunning = { level: 1 | 2 | 3; feeMinor: number | null };

export type Address = { street: string | null; buildingNumber: string | null; postcode: string | null; town: string | null; country: string | null };

export type Bill = {
  id: string;
  /** Missing on everything saved before receipts existed: those are bills. */
  kind?: Kind;
  payee: string;
  /** Short line under the payee, e.g. "Health insurance · November premium". */
  description: string | null;
  /** In minor units (Rappen, cents). Null when unknown. */
  amountMinor: number | null;
  currency: string;
  dueDate: string | null; // YYYY-MM-DD
  issueDate: string | null; // YYYY-MM-DD; for a receipt, the day of the purchase
  /** Time printed on a receipt (HH:MM). */
  time?: string | null;
  /** Optional in stored data: bills saved before discounts existed don't have it. */
  discount?: Discount | null;
  /** Set when the bill is a payment reminder for an earlier one. */
  dunning?: Dunning | null;
  category: Category;
  country: string | null; // ISO 3166-1 alpha-2
  payMethod: PayMethod;
  payment: Payment;
  sources: Partial<Record<SourcedField, Source>>;
  status: 'open' | 'paid';
  paidAt: string | null; // ISO timestamp
  /** What was actually paid, when it differs from `amountMinor` (a discount was taken). */
  paidAmountMinor?: number | null;
  createdAt: string; // ISO timestamp
  /** Overrides the default pay style for this bill (see Settings → Pay bills). */
  payStyle?: import('./reminder-plan').PayStyle | null;
  /** Days before the due date to remind ("just in time" style); 0 = on the due date. */
  remindDaysBefore: number;
  /** ISO timestamp of the main reminder once planned; kept after it goes off, so it isn't planned again. */
  remindAt: string | null;
  /** "Remind me later": the main reminder moves here (ISO timestamp). */
  snoozedUntil?: string | null;
  reminderId: string | null;
  /** The "last call" and "overdue" nudges scheduled alongside the main reminder. */
  extraReminderIds?: string[];
  /** The photo the bill was read from (a JPEG kept in the app's files). */
  imageUri: string | null;
  /** The PDF the bill was imported from, when it came as a PDF. */
  pdfUri?: string | null;
  /** Proof of payment the user added once paid (the bank's confirmation): a screenshot or PDF kept in the app's files. */
  proof?: { uri: string; mimeType: string } | null;
};

export type SourcedField = 'payee' | 'amount' | 'currency' | 'dueDate' | 'iban' | 'reference';

/** What a scan produces before the user confirms it. */
export type BillDraft = Omit<Bill, 'id' | 'status' | 'paidAt' | 'paidAmountMinor' | 'createdAt' | 'remindAt' | 'snoozedUntil' | 'reminderId' | 'extraReminderIds' | 'proof'>;

export const emptyPayment = (): Payment => ({
  standard: null,
  raw: null,
  iban: null,
  bic: null,
  creditorName: null,
  creditorAddress: null,
  reference: null,
  referenceType: null,
  message: null,
  accountNumber: null,
  payUrl: null,
});

/** Categories offered for a bill, and for a receipt (everyday spending first). */
export const BILL_CATEGORIES: Category[] = ['insurance', 'telecom', 'utilities', 'housing', 'taxes', 'fees', 'health', 'transport', 'shopping', 'other'];
export const RECEIPT_CATEGORIES: Category[] = ['groceries', 'dining', 'fuel', 'household', 'shopping', 'health', 'kids', 'leisure', 'transport', 'other'];
/** Every category, for filters. */
export const CATEGORIES: Category[] = [...BILL_CATEGORIES.slice(0, -1), ...RECEIPT_CATEGORIES.filter((c) => !BILL_CATEGORIES.includes(c)), 'other'];

export const isReceipt = (b: Pick<Bill, 'kind'>) => b.kind === 'receipt';
export const categoriesFor = (kind: Kind | undefined) => (kind === 'receipt' ? RECEIPT_CATEGORIES : BILL_CATEGORIES);
