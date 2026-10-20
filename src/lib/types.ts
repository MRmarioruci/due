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
  | 'other';

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
  reference: string | null;
  referenceType: 'QRR' | 'SCOR' | 'NON' | null;
  message: string | null;
  accountNumber: string | null;
  payUrl: string | null;
};

export type Bill = {
  id: string;
  payee: string;
  /** Short line under the payee, e.g. "Health insurance · November premium". */
  description: string | null;
  /** In minor units (Rappen, cents). Null when unknown. */
  amountMinor: number | null;
  currency: string;
  dueDate: string | null; // YYYY-MM-DD
  issueDate: string | null; // YYYY-MM-DD
  category: Category;
  country: string | null; // ISO 3166-1 alpha-2
  payMethod: PayMethod;
  payment: Payment;
  sources: Partial<Record<SourcedField, Source>>;
  status: 'open' | 'paid';
  paidAt: string | null; // ISO timestamp
  createdAt: string; // ISO timestamp
  /** Days before the due date to remind; 0 = on the due date. */
  remindDaysBefore: number;
  remindAt: string | null; // ISO timestamp of the scheduled reminder
  reminderId: string | null;
  imageUri: string | null;
};

export type SourcedField = 'payee' | 'amount' | 'currency' | 'dueDate' | 'iban' | 'reference';

/** What a scan produces before the user confirms it. */
export type BillDraft = Omit<Bill, 'id' | 'status' | 'paidAt' | 'createdAt' | 'remindAt' | 'reminderId'>;

export const emptyPayment = (): Payment => ({
  standard: null,
  raw: null,
  iban: null,
  bic: null,
  creditorName: null,
  reference: null,
  referenceType: null,
  message: null,
  accountNumber: null,
  payUrl: null,
});

export const CATEGORY_LABEL: Record<Category, string> = {
  insurance: 'Insurance',
  telecom: 'Telecom',
  utilities: 'Utilities',
  housing: 'Housing',
  taxes: 'Taxes',
  fees: 'Fees',
  health: 'Health',
  transport: 'Transport',
  shopping: 'Shopping',
  other: 'Other',
};
