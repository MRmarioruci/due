import { CameraView, scanFromURLAsync, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setPendingDraft } from '@/lib/draft';
import { buildDraft } from '@/lib/extract';
import { goBack } from '@/lib/nav';
import { decodePaymentCode, type DecodedCode } from '@/lib/payment-codes';
import { Button, Icon, IconButton, T } from '@/ui/kit';
import { C, F, GUTTER } from '@/ui/theme';

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

export default function Scan() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [decoded, setDecoded] = useState<DecodedCode | null>(null);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onBarcode(r: BarcodeScanningResult) {
    if (decoded || busy) return;
    const d = decodePaymentCode(r.data);
    if (d) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDecoded(d);
    }
  }

  async function finish(photoUri: string | null) {
    setBusy(true);
    setError(null);
    try {
      const jpeg = photoUri ? await toJpeg(photoUri) : null;
      const code = decoded ?? (photoUri ? await decodeFromImage(photoUri) : null);
      const result = await buildDraft({ decoded: code, base64Jpeg: jpeg?.base64 ?? null, imageUri: jpeg?.uri ?? null });
      setPendingDraft(result);
      router.replace('/review');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
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
        <IconButton label="Close" onPress={() => goBack()}>
          <Icon name="close" />
        </IconButton>
        <View style={{ gap: 12 }}>
          <T style={{ fontFamily: F.semibold, fontSize: 24, letterSpacing: -0.6 }}>Camera access</T>
          <T style={{ color: C.muted, lineHeight: 22 }}>due reads the QR code and the details straight from a photo of your bill. The photo stays on your phone, apart from the scan itself.</T>
        </View>
        <View style={{ gap: 10 }}>
          <Button title="Allow camera" onPress={requestPermission} />
          <Button title="Choose a photo instead" kind="secondary" onPress={pick} />
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

      <View style={[st.top, { top: insets.top + 12 }]}>
        <IconButton label="Close" onPress={() => goBack()} style={st.glass}>
          <Icon name="close" />
        </IconButton>
        <T style={st.title}>SCAN BILL</T>
        <IconButton label={torch ? 'Turn off flash' : 'Turn on flash'} onPress={() => setTorch((t) => !t)} style={[st.glass, torch && { borderColor: C.accent }]}>
          <Icon name="flash" color={torch ? C.accent : C.fg} />
        </IconButton>
      </View>

      <View style={[st.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <View style={st.status}>
          <View style={[st.dot, { backgroundColor: decoded ? C.accent : C.dim }]} />
          <T style={st.statusText}>
            {busy ? 'READING DETAILS' : decoded ? `QR-BILL FOUND · ${decoded.payee?.toUpperCase() ?? ''}`.slice(0, 40) : 'LOOKING FOR A PAYMENT CODE'}
          </T>
        </View>
        <T style={st.hint}>
          {error ?? (decoded ? 'Now take a photo so the due date can be read too.' : 'Fit the whole bill in view. No QR code? Just take the photo.')}
        </T>
        <View style={st.controls}>
          <IconButton label="Choose from photos" onPress={pick} style={{ width: 52, height: 52, borderColor: C.border }}>
            <Icon name="photo" size={20} />
          </IconButton>
          <Pressable accessibilityRole="button" accessibilityLabel="Take photo" onPress={shoot} disabled={busy} style={st.shutter}>
            {busy ? <ActivityIndicator color={C.fg} /> : <View style={st.shutterInner} />}
          </Pressable>
          <View style={{ width: 52 }} />
        </View>
      </View>
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
