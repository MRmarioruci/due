import { emptyPayment, type Payment } from './types';

/** What we can read exactly from a payment code, before any model looks at the photo. */
export type DecodedCode = {
  payment: Payment;
  payee: string | null;
  amountMinor: number | null;
  currency: string | null;
  dueDate: string | null;
  issueDate: string | null;
  country: string | null;
};

const lines = (s: string) => s.replace(/\r\n?/g, '\n').split('\n');
const orNull = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/** "387.20" -> 38720. Accepts at most two decimals. */
export function toMinor(amount: string): number | null {
  const m = amount.trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/**
 * Swiss QR-bill ("SPC" payload, Swiss Payment Standards v2.x).
 * The due date is not a field of the code; it comes from Swico bill information (/40/ conditions) when present.
 */
export function parseSwissQr(data: string): DecodedCode | null {
  const f = lines(data);
  if (f[0]?.trim() !== 'SPC' || !f[1]?.startsWith('02')) return null;
  const iban = orNull(f[3])?.replace(/\s/g, '') ?? null;
  if (!iban || !/^(CH|LI)\d{2}[0-9A-Z]{17}$/.test(iban)) return null;

  const refType = orNull(f[27]);
  const billInfo = orNull(f[31]);
  const swico = billInfo ? parseSwico(billInfo) : null;

  return {
    payee: orNull(f[5]),
    amountMinor: f[18] ? toMinor(f[18]) : null,
    currency: orNull(f[19]),
    dueDate: swico?.dueDate ?? null,
    issueDate: swico?.issueDate ?? null,
    country: orNull(f[10]),
    payment: {
      ...emptyPayment(),
      standard: 'swiss_qr',
      raw: data,
      iban,
      creditorName: orNull(f[5]),
      referenceType: refType === 'QRR' || refType === 'SCOR' || refType === 'NON' ? refType : null,
      reference: orNull(f[28]),
      message: orNull(f[29]),
    },
  };
}

/**
 * Swico "S1" structured bill information, e.g. //S1/10/10201409/11/200701/40/2:10;0:30
 * /11/ is the invoice date (YYMMDD); /40/ lists "discount%:days" pairs, and the 0% entry is the net due period.
 */
export function parseSwico(info: string): { issueDate: string | null; dueDate: string | null } | null {
  if (!info.startsWith('//S1/')) return null;
  const parts = info.slice(5).split('/');
  const tags: Record<string, string> = {};
  for (let i = 0; i + 1 < parts.length; i += 2) tags[parts[i]] = parts[i + 1];

  const d = tags['11']?.match(/^(\d{2})(\d{2})(\d{2})/);
  const issueDate = d ? `20${d[1]}-${d[2]}-${d[3]}` : null;
  let dueDate: string | null = null;
  if (issueDate && tags['40']) {
    const net = tags['40']
      .split(';')
      .map((p) => p.split(':').map(Number))
      .find(([pct]) => pct === 0);
    if (net && Number.isFinite(net[1])) dueDate = addDays(issueDate, net[1]);
  }
  return { issueDate, dueDate };
}

/** EPC QR / GiroCode ("BCD" payload, EPC069-12) used across the SEPA area. */
export function parseEpc(data: string): DecodedCode | null {
  const f = lines(data);
  if (f[0]?.trim() !== 'BCD' || f[3]?.trim() !== 'SCT') return null;
  const iban = orNull(f[6])?.replace(/\s/g, '').toUpperCase() ?? null;
  if (!iban || !/^[A-Z]{2}\d{2}[0-9A-Z]{8,30}$/.test(iban)) return null;
  const amt = orNull(f[7])?.match(/^([A-Z]{3})(\d+(?:\.\d{1,2})?)$/);
  const structured = orNull(f[9]);
  return {
    payee: orNull(f[5]),
    amountMinor: amt ? toMinor(amt[2]) : null,
    currency: amt ? amt[1] : 'EUR',
    dueDate: null,
    issueDate: null,
    country: iban.slice(0, 2),
    payment: {
      ...emptyPayment(),
      standard: 'epc',
      raw: data,
      iban,
      bic: orNull(f[4]),
      creditorName: orNull(f[5]),
      reference: structured ?? orNull(f[10]),
      referenceType: structured ? 'SCOR' : null,
      message: structured ? orNull(f[10]) : null,
    },
  };
}

export function decodePaymentCode(data: string): DecodedCode | null {
  return parseSwissQr(data) ?? parseEpc(data);
}

/** Builds an EPC QR payload so a bill with printed SEPA details can still be paid by scanning. */
export function buildEpc(p: { name: string; iban: string; bic?: string | null; amountMinor?: number | null; currency?: string; reference?: string | null }): string | null {
  if ((p.currency ?? 'EUR') !== 'EUR') return null;
  const amount = p.amountMinor != null ? `EUR${(p.amountMinor / 100).toFixed(2)}` : '';
  const isRf = !!p.reference && /^RF\d{2}/.test(p.reference.replace(/\s/g, ''));
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    p.bic ?? '',
    p.name.slice(0, 70),
    p.iban.replace(/\s/g, ''),
    amount,
    '',
    isRf ? p.reference!.replace(/\s/g, '') : '',
    !isRf && p.reference ? p.reference.slice(0, 140) : '',
  ].join('\n');
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
