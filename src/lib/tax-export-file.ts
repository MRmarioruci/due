import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { currentLang, locale, t } from '@/i18n/core';
import { categoryLabel } from '@/i18n/labels';

import { paidIn, taxCsv, taxHtml } from './tax-export';
import type { Bill } from './types';

/** Writes the year's paid bills as a spreadsheet or a PDF and opens the share sheet to save or send it. */
export async function exportYear(bills: Bill[], year: number, format: 'csv' | 'pdf') {
  const items = paidIn(bills, year);
  const target = new File(Paths.cache, `due-${t('tax.fileName')}-${year}.${format}`);
  if (target.exists) target.delete();
  if (format === 'csv') {
    target.create();
    target.write(taxCsv(items, { categoryLabel, semicolon: currentLang() !== 'en' }));
    await Sharing.shareAsync(target.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: t('tax.title', { year }) });
    return;
  }
  const html = taxHtml(items, year, { categoryLabel, generatedOn: new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) });
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  new File(uri).move(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('tax.title', { year }) });
}
