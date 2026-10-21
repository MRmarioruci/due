import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { locale, t } from '@/i18n/core';
import { categoryLabel } from '@/i18n/labels';

import { billHtml } from './bill-html';
import type { Bill } from './types';

/** "due-helsana-2026-11-01.pdf" */
function fileName(bill: Bill): string {
  const slug = bill.payee.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'bill';
  return `due-${slug}${bill.dueDate ? `-${bill.dueDate}` : ''}.pdf`;
}

/** Renders the bill (with its payment QR and the scanned photo, if any) to a PDF and opens the share sheet to save or send it. */
export async function exportBillPdf(bill: Bill, qrPng: string | null): Promise<void> {
  let photoJpeg: string | null = null;
  if (bill.imageUri) {
    try {
      photoJpeg = await new File(bill.imageUri).base64();
    } catch {
      // The photo may have been cleared from the cache; the PDF works without it.
    }
  }
  const html = billHtml(bill, {
    qrPng,
    photoJpeg,
    category: categoryLabel(bill.category),
    generatedOn: new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }),
  });
  // A4 at 72 dpi.
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const named = new File(Paths.cache, fileName(bill));
  if (named.exists) named.delete();
  new File(uri).move(named);
  await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('pdf.shareTitle', { payee: bill.payee }) });
}
