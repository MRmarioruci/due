import type { DecodedCode } from './payment-codes';
import { toMinor } from './payment-codes';
import { todayIso } from './dates';
import { emptyPayment, type BillDraft, type Category, type PayMethod, type SourcedField, type Source } from './types';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.5-flash-lite';

export const hasModel = () => !!API_KEY;

const CATEGORIES: Category[] = ['insurance', 'telecom', 'utilities', 'housing', 'taxes', 'fees', 'health', 'transport', 'shopping', 'other'];
const METHODS: PayMethod[] = ['qr_transfer', 'bank_transfer', 'direct_debit', 'portal', 'other'];

/** What the model returns. Every field is nullable: the model must leave out what it cannot read. */
type ModelBill = {
  payee: string | null;
  description: string | null;
  amount: string | null;
  currency: string | null;
  due_date: string | null;
  issue_date: string | null;
  category: Category | null;
  country: string | null;
  pay_method: PayMethod | null;
  iban: string | null;
  bic: string | null;
  reference: string | null;
  account_number: string | null;
  pay_url: string | null;
  creditor_street: string | null;
  creditor_building_number: string | null;
  creditor_postcode: string | null;
  creditor_town: string | null;
  discount_percent: number | null;
  discount_until: string | null;
};

const str = { type: 'STRING', nullable: true };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    payee: { ...str, description: 'Company or person to pay, short trading name (e.g. "Swisscom", not the legal suffix).' },
    description: { ...str, description: 'Up to 5 words on what the bill is for, in English, e.g. "Mobile subscription · October".' },
    amount: { ...str, description: 'Total amount due, digits with a dot as decimal separator, e.g. "1412.60".' },
    currency: { ...str, description: 'ISO 4217 code.' },
    due_date: { ...str, description: 'Payment due date, YYYY-MM-DD. If only a payment term is given (e.g. "30 days net"), compute it from the bill date.' },
    issue_date: { ...str, description: 'Bill date, YYYY-MM-DD.' },
    category: { type: 'STRING', nullable: true, enum: CATEGORIES },
    country: { ...str, description: 'ISO 3166-1 alpha-2 country of the biller.' },
    pay_method: { type: 'STRING', nullable: true, enum: METHODS, description: 'direct_debit if the bill says the amount will be debited automatically; portal if it must be paid online; qr_transfer if it has a payment QR code.' },
    iban: str,
    bic: str,
    reference: { ...str, description: 'Payment reference / remittance number to quote with the transfer.' },
    account_number: { ...str, description: 'Customer or account number at the biller.' },
    pay_url: { ...str, description: 'URL where the bill can be paid, if printed.' },
    creditor_street: { ...str, description: "Biller's street name (from the payment slip's 'Account / Payable to' block if there is one), without the number." },
    creditor_building_number: str,
    creditor_postcode: str,
    creditor_town: str,
    discount_percent: { type: 'NUMBER', nullable: true, description: 'Early-payment discount (Skonto / escompte / sconto) in percent, e.g. 2 for "2% if paid within 10 days".' },
    discount_until: { ...str, description: 'Last day the discount applies, YYYY-MM-DD; compute it from the bill date if only a number of days is given.' },
  },
};

const PROMPT = `You read a photo or PDF of a bill or invoice from any country and language and return its payment details as JSON.
Rules: read only what is printed; use null for anything you cannot read with confidence. Dates must be YYYY-MM-DD; read day/month order from the bill's country conventions. Today is ${todayIso()}.`;

/** A scanned page or an imported document, as sent to the model. */
export type BillFile = { base64: string; mimeType: 'image/jpeg' | 'application/pdf' };

async function askModel(file: BillFile, decoded: DecodedCode | null): Promise<ModelBill> {
  const hint = decoded ? `\nThe bill's payment QR code was already decoded: payee "${decoded.payee}", amount ${decoded.amountMinor != null ? decoded.amountMinor / 100 : 'open'} ${decoded.currency}. Focus on the due date, description and category.` : '';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY! },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT + hint }, { inline_data: { mime_type: file.mimeType, data: file.base64 } }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const parts: { text?: string; thought?: boolean }[] = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('');
  if (!text) throw new Error('Gemini returned no content');
  return JSON.parse(text) as ModelBill;
}

/** Accepts YYYY-MM-DD, and DD.MM.YYYY / DD/MM/YYYY in case the model copies the printed form. */
function isoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/**
 * Turns a scan into a draft bill. Values decoded from a payment code are exact and always win;
 * the model fills in the rest (and everything, when the bill has no code).
 */
export async function buildDraft(opts: { decoded: DecodedCode | null; file: BillFile | null; imageUri: string | null }): Promise<{ draft: BillDraft; warning: string | null }> {
  const { decoded } = opts;
  let ai: ModelBill | null = null;
  let warning: string | null = null;
  if (opts.file && API_KEY) {
    try {
      ai = await askModel(opts.file, decoded);
    } catch (e) {
      warning = `Couldn't read the rest of the bill (${(e as Error).message}). Fill in what's missing.`;
    }
  } else if (!API_KEY) {
    warning = 'No Gemini key set, so only the QR code was read. Add EXPO_PUBLIC_GEMINI_API_KEY to .env.local.';
  }

  const sources: Partial<Record<SourcedField, Source>> = {};
  function pick<T>(field: SourcedField | null, fromCode: T | null | undefined, fromAi: T | null | undefined): T | null {
    if (fromCode != null) {
      if (field) sources[field] = 'qr';
      return fromCode;
    }
    if (fromAi != null) {
      if (field) sources[field] = 'ai';
      return fromAi;
    }
    return null;
  }

  const payment = decoded?.payment ?? emptyPayment();
  const draft: BillDraft = {
    payee: pick('payee', decoded?.payee, ai?.payee) ?? 'Unknown biller',
    description: ai?.description ?? null,
    amountMinor: pick('amount', decoded?.amountMinor, ai?.amount ? toMinor(ai.amount) : null),
    currency: pick('currency', decoded?.currency, ai?.currency?.toUpperCase()) ?? 'CHF',
    dueDate: pick('dueDate', decoded?.dueDate, isoDate(ai?.due_date)),
    issueDate: decoded?.issueDate ?? isoDate(ai?.issue_date),
    discount:
      decoded?.discount ??
      (ai?.discount_percent && ai.discount_percent > 0 && ai.discount_percent < 50 && isoDate(ai.discount_until)
        ? { percent: ai.discount_percent, until: isoDate(ai.discount_until)! }
        : null),
    category: ai?.category && CATEGORIES.includes(ai.category) ? ai.category : 'other',
    country: decoded?.country ?? ai?.country ?? null,
    payMethod: decoded ? 'qr_transfer' : ai?.pay_method && METHODS.includes(ai.pay_method) ? ai.pay_method : 'bank_transfer',
    payment: {
      ...payment,
      iban: pick('iban', payment.iban, ai?.iban?.replace(/\s/g, '').toUpperCase()),
      bic: payment.bic ?? ai?.bic ?? null,
      reference: pick('reference', payment.reference, ai?.reference),
      accountNumber: ai?.account_number ?? null,
      payUrl: ai?.pay_url ?? null,
      creditorName: payment.creditorName ?? ai?.payee ?? null,
      creditorAddress:
        payment.creditorAddress ??
        (ai?.creditor_town
          ? { street: ai.creditor_street, buildingNumber: ai.creditor_building_number, postcode: ai.creditor_postcode, town: ai.creditor_town, country: ai.country }
          : null),
    },
    sources,
    remindDaysBefore: 3,
    imageUri: opts.imageUri,
  };
  return { draft, warning };
}
