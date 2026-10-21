import type { DecodedCode } from './payment-codes';
import { toMinor } from './payment-codes';
import { todayIso } from './dates';
import { countryByCode } from './regions';
import { deviceId, getSettings, homeCountry, homeCurrency } from './settings';
import { emptyPayment, type BillDraft, type Category, type PayMethod, type SourcedField, type Source } from './types';

// Bills are read by due-api (../due-api), which holds the Gemini key and rate-limits per device.
const API_URL = process.env.EXPO_PUBLIC_DUE_API_URL?.replace(/\/$/, '');
const APP_KEY = process.env.EXPO_PUBLIC_DUE_APP_KEY;

export const hasModel = () => !!API_URL && !!APP_KEY;

const CATEGORIES: Category[] = ['insurance', 'telecom', 'utilities', 'housing', 'taxes', 'fees', 'health', 'transport', 'shopping', 'other'];
const METHODS: PayMethod[] = ['qr_transfer', 'bank_transfer', 'direct_debit', 'portal', 'other'];

/** What due-api returns: every field nullable, dates already ISO, IBAN without spaces. */
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

/** A scanned page or an imported document, as sent to the API. */
export type BillFile = { base64: string; mimeType: 'image/jpeg' | 'application/pdf' };

/** Matches due-api's body limit (Vercel caps requests at 4.5 MB). */
const MAX_BASE64 = 4_400_000;

class ReadError extends Error {}

async function askApi(file: BillFile, decoded: DecodedCode | null): Promise<ModelBill> {
  if (file.base64.length > MAX_BASE64) throw new ReadError('That file is too large to read (over about 3 MB). Try a photo of the bill instead.');
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-key': APP_KEY!, 'x-device-id': deviceId() },
      body: JSON.stringify({
        file,
        today: todayIso(),
        homeCountry: countryByCode(homeCountry())?.name,
        qrHint: decoded ? { payee: decoded.payee, amount: decoded.amountMinor != null ? decoded.amountMinor / 100 : null, currency: decoded.currency } : undefined,
      }),
    });
  } catch {
    throw new ReadError('No connection to due’s server. Check your internet and try again.');
  }
  if (res.status === 429) throw new ReadError('You’ve reached today’s limit for reading bills. It resets tomorrow.');
  if (res.status === 401) throw new ReadError('This version of due can’t reach the server. Update the app.');
  if (!res.ok) throw new ReadError('The bill couldn’t be read this time. Try again in a moment.');
  const json = (await res.json()) as { bill?: ModelBill };
  if (!json.bill) throw new ReadError('The bill couldn’t be read this time. Try again in a moment.');
  return json.bill;
}

/**
 * Turns a scan into a draft bill. Values decoded from a payment code are exact and always win;
 * the model fills in the rest (and everything, when the bill has no code).
 */
export async function buildDraft(opts: { decoded: DecodedCode | null; file: BillFile | null; imageUri: string | null }): Promise<{ draft: BillDraft; warning: string | null }> {
  const { decoded } = opts;
  let ai: ModelBill | null = null;
  let warning: string | null = null;
  if (opts.file && hasModel()) {
    try {
      ai = await askApi(opts.file, decoded);
    } catch (e) {
      const why = e instanceof ReadError ? e.message : 'The bill couldn’t be read this time.';
      warning = `${why} ${decoded ? 'The QR code was read; fill in the rest.' : 'Fill in the details below.'}`;
    }
  } else if (!hasModel()) {
    warning = 'Bill reading isn’t set up in this build (EXPO_PUBLIC_DUE_API_URL). Only the QR code was read.';
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
    currency: pick('currency', decoded?.currency, ai?.currency?.toUpperCase()) ?? homeCurrency(),
    dueDate: pick('dueDate', decoded?.dueDate, ai?.due_date),
    issueDate: decoded?.issueDate ?? ai?.issue_date ?? null,
    discount:
      decoded?.discount ??
      (ai?.discount_percent && ai.discount_until ? { percent: ai.discount_percent, until: ai.discount_until } : null),
    category: ai?.category && CATEGORIES.includes(ai.category) ? ai.category : 'other',
    country: decoded?.country ?? ai?.country ?? null,
    payMethod: decoded ? 'qr_transfer' : ai?.pay_method && METHODS.includes(ai.pay_method) ? ai.pay_method : 'bank_transfer',
    payment: {
      ...payment,
      iban: pick('iban', payment.iban, ai?.iban),
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
    remindDaysBefore: getSettings().remindDaysBefore,
    imageUri: opts.imageUri,
  };
  return { draft, warning };
}
