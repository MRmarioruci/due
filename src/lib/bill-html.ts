// The printable version of a bill, as HTML for the PDF export. Pure, so it can be tested.

import { t } from '../i18n/core';
import { longDate } from './dates';
import { activeDiscount } from './discount';
import { formatMoney } from './money';
import type { Bill } from './types';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const groupIban = (iban: string) => iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();

export function billHtml(bill: Bill, opts: { qrPng?: string | null; photoJpeg?: string | null; category: string; generatedOn: string }): string {
  const discount = activeDiscount(bill);
  const addr = bill.payment.creditorAddress;
  const address = addr ? [[addr.street, addr.buildingNumber].filter(Boolean).join(' '), [addr.postcode, addr.town].filter(Boolean).join(' '), addr.country].filter(Boolean).join(', ') : null;

  const rows: [string, string | null, boolean?][] = [
    [t('review.payee'), bill.payment.creditorName ?? bill.payee],
    [t('pdf.address'), address],
    ['IBAN', bill.payment.iban ? groupIban(bill.payment.iban) : null, true],
    ['BIC', bill.payment.bic, true],
    [t('review.reference'), bill.payment.reference, true],
    [t('bill.accountNo'), bill.payment.accountNumber, true],
    [t('bill.message'), bill.payment.message],
    [t('review.category'), opts.category],
    [t('pdf.issued'), bill.issueDate ? longDate(bill.issueDate) : null],
    [t('review.dueDate'), bill.dueDate ? longDate(bill.dueDate) : null],
    [t('pdf.status'), bill.status === 'paid' ? `${t('home.paid')}${bill.paidAt ? ` · ${new Date(bill.paidAt).toLocaleDateString()}` : ''}` : t('pdf.open')],
  ];

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { margin: 36px; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #0a0a0a; margin: 0; }
  .brand { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
  .brand i { display: inline-block; width: 6px; height: 6px; background: #FF5A36; margin-left: 2px; }
  .eyebrow { font-family: "Roboto Mono", Menlo, monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #71717a; }
  h1 { font-size: 26px; margin: 28px 0 4px; letter-spacing: -0.5px; }
  .sub { color: #52525b; font-size: 13px; }
  .amount { font-size: 38px; font-weight: 700; letter-spacing: -1px; margin: 18px 0 2px; }
  .amount span { font-size: 15px; color: #71717a; font-weight: 500; margin-right: 8px; }
  .discount { border: 1px solid #FF5A36; padding: 10px 12px; font-size: 12px; margin: 14px 0; }
  .grid { display: flex; gap: 28px; margin-top: 22px; align-items: flex-start; }
  table { border-collapse: collapse; flex: 1; font-size: 12.5px; }
  td { padding: 8px 0; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
  td.k { color: #71717a; width: 120px; padding-right: 12px; }
  td.mono { font-family: "Roboto Mono", Menlo, monospace; font-size: 11.5px; }
  .qr { text-align: center; }
  .qr img { width: 180px; height: 180px; }
  .photo { margin-top: 28px; page-break-before: auto; }
  .photo img { max-width: 100%; max-height: 640px; border: 1px solid #e4e4e7; }
  .foot { margin-top: 28px; font-size: 10px; color: #a1a1aa; }
</style></head><body>
  <div class="brand">due<i></i></div>
  <h1>${esc(bill.payee)}</h1>
  <div class="sub">${esc(bill.description ?? opts.category)}</div>
  <div class="amount"><span>${esc(bill.currency)}</span>${esc(formatMoney(bill.amountMinor, bill.currency).replace(`${bill.currency} `, ''))}</div>
  ${bill.dueDate ? `<div class="sub">${esc(t('bill.dueOn', { date: longDate(bill.dueDate) }))}</div>` : ''}
  ${discount ? `<div class="discount">${esc(t('review.discount', { amount: formatMoney(discount.payMinor, bill.currency), date: longDate(discount.until), saving: formatMoney(discount.savingMinor, bill.currency) }))}</div>` : ''}
  <div class="grid">
    <table>${rows
      .filter(([, v]) => v)
      .map(([k, v, mono]) => `<tr><td class="k">${esc(k)}</td><td${mono ? ' class="mono"' : ''}>${esc(v)}</td></tr>`)
      .join('')}</table>
    ${opts.qrPng ? `<div class="qr"><img src="data:image/png;base64,${opts.qrPng}"/><div class="eyebrow" style="margin-top:8px">${esc(t('bill.scanWithBank'))}</div></div>` : ''}
  </div>
  ${opts.photoJpeg ? `<div class="photo"><div class="eyebrow" style="margin-bottom:8px">${esc(t('pdf.original'))}</div><img src="data:image/jpeg;base64,${opts.photoJpeg}"/></div>` : ''}
  <div class="foot">${esc(t('pdf.generated', { date: opts.generatedOn }))}</div>
</body></html>`;
}
