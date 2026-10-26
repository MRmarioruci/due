import { decodePaymentCode } from './payment-codes';
import { CATEGORIES, emptyPayment, type Bill, type BillDraft, type Payment } from './types';

/**
 * A bill passed to someone else's due, with no account or server: everything needed to pay it, in a
 * link (sent as a message) that is also shown as a QR code (scanned with due's camera).
 */
export const SHARE_PREFIX = 'due://bill?d=';
const PREFIX = SHARE_PREFIX;

type Shared = {
  v: 1;
  p: string;
  ds?: string;
  a?: number;
  c: string;
  d?: string;
  i?: string;
  cat?: string;
  m?: string;
  dis?: Bill['discount'];
  pay?: Partial<Payment>;
};

/** UTF-8 + base64url, by hand: keeps the link (and its QR code) short without relying on engine extras. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toB64(text: string): string {
  const bytes: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
  }
  return out;
}

function fromB64(b64: string): string {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of b64) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('not base64url');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 255);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    const n = b < 0x80 ? 1 : b < 0xe0 ? 2 : b < 0xf0 ? 3 : 4;
    let c = n === 1 ? b : b & (0xff >> (n + 1));
    for (let k = 1; k < n; k++) c = (c << 6) | (bytes[i + k] & 63);
    out += String.fromCodePoint(c);
    i += n;
  }
  return out;
}

const compact = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '')) as Partial<T>;

export function shareLink(b: Bill): string {
  const s: Shared = compact({
    v: 1 as const,
    p: b.payee,
    ds: b.description ?? undefined,
    a: b.amountMinor ?? undefined,
    c: b.currency,
    d: b.dueDate ?? undefined,
    i: b.issueDate ?? undefined,
    cat: b.category,
    m: b.payMethod,
    dis: b.discount ?? undefined,
    // The original payment code holds the rest of the payment details; send just it when there is one.
    pay: b.payment.raw ? compact({ raw: b.payment.raw, payUrl: b.payment.payUrl, accountNumber: b.payment.accountNumber }) : compact(b.payment),
  }) as Shared;
  return PREFIX + toB64(JSON.stringify(s));
}

/** The shared bill as a draft to check and save, or null when `text` isn't a due bill link. */
export function readShareLink(text: string, defaults: Pick<BillDraft, 'remindDaysBefore'>): BillDraft | null {
  const at = text.indexOf(PREFIX);
  if (at < 0) return null;
  let s: Shared;
  try {
    s = JSON.parse(fromB64(text.slice(at + PREFIX.length).split(/[\s&#]/)[0]));
  } catch {
    return null;
  }
  if (s?.v !== 1 || typeof s.p !== 'string' || typeof s.c !== 'string') return null;
  const iso = (x: unknown) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
  return {
    payee: s.p.slice(0, 200),
    description: typeof s.ds === 'string' ? s.ds.slice(0, 300) : null,
    amountMinor: Number.isInteger(s.a) ? s.a! : null,
    currency: s.c.slice(0, 3).toUpperCase(),
    dueDate: iso(s.d),
    issueDate: iso(s.i),
    category: (CATEGORIES as readonly string[]).includes(s.cat ?? '') ? (s.cat as BillDraft['category']) : 'other',
    country: null,
    payMethod: (['qr_transfer', 'bank_transfer', 'direct_debit', 'portal', 'other'] as const).find((m) => m === s.m) ?? 'bank_transfer',
    discount: s.dis && typeof s.dis.percent === 'number' && iso(s.dis.until) ? s.dis : null,
    payment: withCode({ ...emptyPayment(), ...pickPayment(s.pay) }),
    sources: {},
    remindDaysBefore: defaults.remindDaysBefore,
    imageUri: null,
    pdfUri: null,
  };
}

/** Fills the payment details back in from the original code, when it came along. */
function withCode(p: Payment): Payment {
  const decoded = p.raw ? decodePaymentCode(p.raw) : null;
  return decoded ? { ...decoded.payment, payUrl: p.payUrl, accountNumber: p.accountNumber } : p;
}

/** Only the known payment fields, as strings (the address as given). */
function pickPayment(p: unknown): Partial<Payment> {
  if (!p || typeof p !== 'object') return {};
  const src = p as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(emptyPayment()) as (keyof Payment)[]) {
    const v = src[k];
    if (k === 'creditorAddress') out[k] = v && typeof v === 'object' ? v : null;
    else if (typeof v === 'string') out[k] = v;
  }
  return out as Partial<Payment>;
}
