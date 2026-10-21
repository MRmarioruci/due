// Turning a photo or a PDF into a draft bill: shared by the scan screen and bills shared from other apps.

import { scanFromURLAsync } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { t } from '@/i18n/core';

import { buildDraft } from './extract';
import { decodePaymentCode, type DecodedCode } from './payment-codes';

/** Shrinks the photo before it goes to the model: a bill stays readable at 1600 px and the upload stays small. */
async function toJpeg(uri: string): Promise<{ uri: string; base64: string }> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1600 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  return { uri: out.uri, base64: out.base64! };
}

async function decodeFromImage(uri: string): Promise<DecodedCode | null> {
  try {
    const found = await scanFromURLAsync(uri, ['qr']);
    for (const r of found) {
      const d = decodePaymentCode(r.data);
      if (d) return d;
    }
  } catch {}
  return null;
}

/** A photo of a bill; `decoded` is the payment code the live camera already read, if any. */
export async function readPhoto(uri: string, decoded: DecodedCode | null = null) {
  const jpeg = await toJpeg(uri);
  const code = decoded ?? (await decodeFromImage(uri)) ?? (await decodeFromImage(jpeg.uri));
  return buildDraft({ decoded: code, file: { base64: jpeg.base64, mimeType: 'image/jpeg' }, imageUri: jpeg.uri, pdfUri: null });
}

/** PDFs go to the model as they are; the QR code on them is read from its printed details instead. */
export async function readPdf(uri: string, size: number | null) {
  if ((size ?? 0) > 15_000_000) throw new Error(t('scan.pdfTooBig'));
  // Shared files arrive as content:// links that may expire; keep a copy of our own.
  const copy = new File(Paths.cache, `bill-${Date.now()}.pdf`);
  let source = new File(uri);
  try {
    source.copy(copy);
    source = copy;
  } catch {
    // Read it in place; the original just won't be kept.
  }
  if (source.size > 15_000_000) throw new Error(t('scan.pdfTooBig'));
  const base64 = await source.base64();
  return buildDraft({ decoded: null, file: { base64, mimeType: 'application/pdf' }, imageUri: null, pdfUri: source === copy ? copy.uri : null });
}
