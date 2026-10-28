// The photo or PDF a bill was read from, kept with the bill so it can be opened again later.

import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

import type { Bill } from './types';

const dir = () => new Directory(Paths.document, 'originals');

/** Moves the scan's temporary files next to the app's data, named after the bill. */
export function keepOriginals(bill: Bill): Bill {
  const keep = (uri: string | null | undefined, ext: string): string | null => {
    if (!uri) return null;
    if (uri.startsWith(dir().uri)) return uri;
    try {
      if (!dir().exists) dir().create({ intermediates: true });
      const target = new File(dir(), `${bill.id}.${ext}`);
      if (target.exists) target.delete();
      new File(uri).copy(target);
      return target.uri;
    } catch {
      return null;
    }
  };
  return { ...bill, imageUri: keep(bill.imageUri, 'jpg'), pdfUri: keep(bill.pdfUri, 'pdf') };
}

/** Copies a proof of payment (screenshot or PDF) next to the bill's originals; null when it can't. */
export function keepProof(bill: Bill, uri: string, mimeType: string): Bill['proof'] {
  try {
    if (!dir().exists) dir().create({ intermediates: true });
    const pdf = mimeType === 'application/pdf';
    const target = new File(dir(), `${bill.id}-proof.${pdf ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg'}`);
    removeProof(bill);
    if (target.exists) target.delete();
    new File(uri).copy(target);
    return { uri: target.uri, mimeType: pdf ? 'application/pdf' : mimeType.startsWith('image/') ? mimeType : 'image/jpeg' };
  } catch {
    return null;
  }
}

export function removeProof(bill: Bill) {
  try {
    if (bill.proof && new File(bill.proof.uri).exists) new File(bill.proof.uri).delete();
  } catch {}
}

/** The proof of payment, or null when there is none or the file is gone. */
export function proofOf(bill: Bill): { uri: string; mimeType: string } | null {
  try {
    return bill.proof && new File(bill.proof.uri).exists ? bill.proof : null;
  } catch {
    return null;
  }
}

export function removeOriginals(bill: Bill) {
  removeProof(bill);
  for (const uri of [bill.imageUri, bill.pdfUri]) {
    try {
      if (uri && new File(uri).exists) new File(uri).delete();
    } catch {}
  }
}

/** The kept file, preferring the PDF (it's the whole bill), or null when there is none or it's gone. */
export function originalOf(bill: Bill): { uri: string; mimeType: string } | null {
  for (const [uri, mimeType] of [[bill.pdfUri, 'application/pdf'], [bill.imageUri, 'image/jpeg']] as const) {
    try {
      if (uri && new File(uri).exists) return { uri, mimeType };
    } catch {}
  }
  return null;
}

/** Opens the file in the phone's own viewer (Files, Drive, Gallery…). */
export async function openOriginal(file: { uri: string; mimeType: string }) {
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: new File(file.uri).contentUri,
    type: file.mimeType,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
