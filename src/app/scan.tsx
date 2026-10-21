import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setPendingDraft } from '@/lib/draft';
import { t } from '@/i18n/core';
import { goBack, takeScanRequest } from '@/lib/nav';
import { decodePaymentCode, type DecodedCode } from '@/lib/payment-codes';
import { readPdf, readPhoto } from '@/lib/reading';
import { Button, Icon, IconButton } from '@/ui/kit';
import { CapturedPreview, ReadingPanel, Tx, type Captured } from '@/ui/reading';
// The camera screen stays dark in both themes.
import { DARK as C, F, GUTTER } from '@/ui/theme';

export default function Scan() {
  // Only open when the user asked for it; a relaunch that lands here goes home instead.
  const [requested] = useState(takeScanRequest);
  if (!requested) return <Redirect href="/" />;
  return <ScanCamera />;
}

function ScanCamera() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [decoded, setDecoded] = useState<DecodedCode | null>(null);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What's being read: a photo (shown in place of the camera) or an imported PDF (shown by name). */
  const [captured, setCaptured] = useState<Captured | null>(null);

  function onBarcode(r: BarcodeScanningResult) {
    if (decoded || busy) return;
    const d = decodePaymentCode(r.data);
    if (d) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDecoded(d);
    }
  }

  async function read(work: () => Promise<Parameters<typeof setPendingDraft>[0]>) {
    setBusy(true);
    setError(null);
    try {
      setPendingDraft(await work());
      router.replace('/review');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function finish(photoUri: string) {
    setCaptured({ uri: photoUri });
    read(() => readPhoto(photoUri, decoded));
  }

  async function importDocument() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    const doc = res.canceled ? null : res.assets[0];
    if (!doc) return;
    if (doc.mimeType !== 'application/pdf') return finish(doc.uri);
    setCaptured({ uri: doc.uri, pdfName: doc.name });
    read(() => readPdf(doc.uri, doc.size ?? null));
  }

  async function shoot() {
    const photo = await camera.current?.takePictureAsync({ quality: 0.8, shutterSound: false });
    if (photo) finish(photo.uri);
  }

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets[0]) finish(res.assets[0].uri);
  }

  if (!permission) return <View style={st.root} />;

  if (!permission.granted) {
    return (
      <View style={[st.root, { padding: GUTTER, paddingTop: insets.top + 12, justifyContent: 'space-between', paddingBottom: insets.bottom + 16 }]}>
        <IconButton label={t('common.close')} onPress={() => goBack()}>
          <Icon name="close" color={C.fg} />
        </IconButton>
        <View style={{ gap: 12 }}>
          <Tx style={{ fontFamily: F.semibold, fontSize: 24, letterSpacing: -0.6 }}>{t('scan.cameraTitle')}</Tx>
          <Tx style={{ color: C.muted, lineHeight: 22 }}>{t('scan.cameraText')}</Tx>
        </View>
        <View style={{ gap: 10 }}>
          <Button palette={C} title={t('scan.allowCamera')} onPress={requestPermission} />
          <Button palette={C} title={t('scan.choosePhoto')} kind="secondary" onPress={pick} />
        </View>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={decoded ? undefined : onBarcode}
      />

      {captured && <CapturedPreview captured={captured} />}

      <View style={[st.top, { top: insets.top + 12 }]}>
        <IconButton label={t('common.close')} onPress={() => goBack()} style={st.glass}>
          <Icon name="close" color={C.fg} />
        </IconButton>
        <Tx style={st.title}>{t('scan.title')}</Tx>
        <IconButton label={torch ? t('scan.flashOff') : t('scan.flashOn')} onPress={() => setTorch((on) => !on)} style={[st.glass, torch && { borderColor: C.accent }]}>
          <Icon name="flash" color={torch ? C.accent : C.fg} />
        </IconButton>
      </View>

      {captured ? (
        <ReadingPanel
          busy={busy}
          error={error}
          detail={decoded ? t('scan.readingWithQr') : t('scan.readingNoQr')}
          retryLabel={t('scan.retake')}
          onRetry={() => {
            setCaptured(null);
            setError(null);
          }}
          onFillByHand={() => {
            setPendingDraft(null);
            router.replace('/review');
          }}
        />
      ) : (
      <View style={[st.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <View style={st.status}>
          <View style={[st.dot, { backgroundColor: decoded ? C.accent : C.dim }]} />
          <Tx style={st.statusText}>
            {busy ? t('scan.statusReading') : decoded ? `${t('scan.statusFound')} · ${decoded.payee?.toUpperCase() ?? ''}`.slice(0, 40) : t('scan.statusLooking')}
          </Tx>
        </View>
        <Tx style={st.hint}>
          {error ?? (decoded ? t('scan.hintAfterQr') : t('scan.hint'))}
        </Tx>
        <View style={st.controls}>
          <IconButton label={t('scan.fromPhotos')} onPress={pick} style={{ width: 52, height: 52, borderColor: C.border }}>
            <Icon name="photo" size={20} color={C.fg} />
          </IconButton>
          <Pressable accessibilityRole="button" accessibilityLabel={t('scan.takePhoto')} onPress={shoot} disabled={busy} style={st.shutter}>
            {busy ? <ActivityIndicator color={C.fg} /> : <View style={st.shutterInner} />}
          </Pressable>
          <IconButton label={t('scan.importDoc')} onPress={importDocument} style={{ width: 52, height: 52, borderColor: C.border }}>
            <Tx style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 0.6 }}>PDF</Tx>
          </IconButton>
        </View>
        <Pressable accessibilityRole="button" onPress={() => { setPendingDraft(null); router.replace('/review'); }} hitSlop={8} style={{ paddingVertical: 6 }}>
          <Tx style={{ fontSize: 13.5, color: C.muted, textDecorationLine: 'underline' }}>{t('scan.enterByHand')}</Tx>
        </Pressable>
      </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', left: GUTTER, right: GUTTER, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  glass: { backgroundColor: 'rgba(10,10,10,0.6)', borderColor: 'rgba(255,255,255,0.08)' },
  title: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.3, color: C.muted },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 12, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.55)' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(10,10,10,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  dot: { width: 6, height: 6 },
  statusText: { fontFamily: F.mono, fontSize: 11, letterSpacing: 0.9 },
  hint: { fontSize: 13, color: C.muted, textAlign: 'center', paddingHorizontal: 40, lineHeight: 19 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', alignSelf: 'stretch', paddingHorizontal: 28, marginTop: 8 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: C.fg, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.fg },
});
