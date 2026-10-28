import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { t } from '@/i18n/core';
import { keepProof, openOriginal, proofOf, removeProof } from '@/lib/originals';
import { getBill, saveBill } from '@/lib/store';
import type { Bill } from '@/lib/types';

import { sheet, toast } from './overlay';

const open = (p: { uri: string; mimeType: string }) => openOriginal(p).catch(() => toast(t('bill.originalFailed')));

/** Proof of payment on a paid bill: add one (a screenshot or a PDF from the bank), or open, replace or remove it. */
export function editProof(bill: Bill) {
  const proof = proofOf(bill);
  if (!proof) return addProof(bill);
  sheet.show({
    title: t('proof.title'),
    actions: [
      { label: t('proof.open'), kind: 'primary', onPress: () => open(proof) },
      { label: t('proof.replace'), kind: 'secondary', onPress: () => setTimeout(() => addProof(bill), 80) },
      {
        label: t('proof.remove'),
        kind: 'destructive',
        onPress: () => {
          removeProof(bill);
          saveBill({ ...(getBill(bill.id) ?? bill), proof: null });
        },
      },
    ],
  });
}

function addProof(bill: Bill) {
  const keep = (uri: string, mimeType: string) => {
    const current = getBill(bill.id) ?? bill;
    const proof = keepProof(current, uri, mimeType);
    if (!proof) return toast(t('proof.failed'));
    saveBill({ ...current, proof });
    toast(t('proof.added'));
  };
  sheet.show({
    title: t('proof.add'),
    message: t('proof.addText'),
    actions: [
      {
        label: t('proof.screenshot'),
        kind: 'primary',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
          const a = res.canceled ? null : res.assets[0];
          if (a) keep(a.uri, a.mimeType ?? 'image/jpeg');
        },
      },
      {
        label: t('proof.file'),
        kind: 'secondary',
        onPress: async () => {
          const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
          const a = res.canceled ? null : res.assets[0];
          if (a) keep(a.uri, a.mimeType ?? 'application/pdf');
        },
      },
    ],
  });
}

/** Opens the proof of payment, for showing a biller who sent a reminder anyway. */
export function showProof(bill: Bill) {
  const proof = proofOf(bill);
  if (proof) open(proof);
}
