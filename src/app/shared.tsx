import { getResolvedSharedPayloadsAsync, clearSharedPayloads } from 'expo-sharing';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n/core';
import { setPendingDraft } from '@/lib/draft';
import { openScan } from '@/lib/nav';
import { readPdf, readPhoto } from '@/lib/reading';
import { getSettings } from '@/lib/settings';
import { CapturedPreview, ReadingPanel, stageStyles, type Captured } from '@/ui/reading';

/** A photo or PDF shared into due from another app (mail, chat, the bank's app): read it like a scan. */
export default function Shared() {
  if (!getSettings().onboarded) return <Redirect href="/onboarding" />;
  return <ReadShared />;
}

function ReadShared() {
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const payloads = await getResolvedSharedPayloadsAsync();
        clearSharedPayloads();
        const file = payloads.find((p) => p.contentUri && (p.contentMimeType?.startsWith('image/') || p.contentMimeType === 'application/pdf'));
        if (!file?.contentUri) throw new Error(payloads.length ? t('share.unsupported') : t('share.nothing'));
        const pdf = file.contentMimeType === 'application/pdf';
        if (live) setCaptured(pdf ? { uri: file.contentUri, pdfName: file.originalName ?? 'PDF' } : { uri: file.contentUri });
        const result = pdf ? await readPdf(file.contentUri, file.contentSize) : await readPhoto(file.contentUri);
        if (!live) return;
        setPendingDraft(result);
        router.replace('/review');
      } catch (e) {
        if (!live) return;
        setError((e as Error).message || t('read.failed'));
        setBusy(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <View style={stageStyles.root}>
      {captured && <CapturedPreview captured={captured} />}
      <ReadingPanel
        busy={busy}
        error={error}
        detail={t('scan.readingNoQr')}
        retryLabel={t('share.useCamera')}
        onRetry={() => openScan(true)}
        onFillByHand={() => {
          setPendingDraft(null);
          router.replace('/review');
        }}
      />
    </View>
  );
}
