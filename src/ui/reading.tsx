// The "reading your bill" stage: the captured photo or PDF, with progress (or the error) below it.
// Used by the scan screen and by bills shared into due from other apps. Always dark, like the camera.

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n/core';
import { Button, Icon, T } from './kit';
import { DARK as C, F, GUTTER } from './theme';

/** Text on the dark stage: light whatever the app theme. */
export function Tx({ style, ...props }: React.ComponentProps<typeof T>) {
  return <T {...props} style={[{ color: C.fg }, style]} />;
}

export type Captured = { uri: string; pdfName?: string };

/** The photo, full screen, or a paper card with the PDF's name. */
export function CapturedPreview({ captured }: { captured: Captured }) {
  if (captured.pdfName != null) {
    return (
      <View style={[StyleSheet.absoluteFill, st.pdfStage]}>
        <View style={st.pdfCard}>
          <Tx style={st.pdfBadge}>PDF</Tx>
          <Tx style={{ fontFamily: F.medium, fontSize: 15, color: C.bg, textAlign: 'center' }} numberOfLines={3}>
            {captured.pdfName}
          </Tx>
        </View>
      </View>
    );
  }
  return <Image source={{ uri: captured.uri }} style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} contentFit="contain" transition={150} />;
}

/** Bottom panel: progress while reading; the error with a way on when it failed. */
export function ReadingPanel(props: { busy: boolean; error: string | null; detail: string; retryLabel: string; onRetry: () => void; onFillByHand: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.bottom, { paddingBottom: insets.bottom + 24 }]}>
      {props.busy && <ProgressSweep />}
      <View style={st.reading}>
        {props.busy ? <ActivityIndicator color={C.fg} /> : <Icon name="close" color={C.accent} />}
        <View style={{ flex: 1, gap: 4 }}>
          <Tx style={{ fontFamily: F.semibold, fontSize: 15 }}>{props.busy ? t('scan.reading') : t('scan.readFailed')}</Tx>
          <Tx style={{ fontSize: 13, color: C.muted, lineHeight: 18 }} numberOfLines={3}>
            {props.busy ? props.detail : props.error}
          </Tx>
        </View>
      </View>
      {!props.busy && (
        <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch', paddingHorizontal: GUTTER }}>
          <Button palette={C} title={props.retryLabel} kind="secondary" style={{ flex: 1 }} onPress={props.onRetry} />
          <Button palette={C} title={t('scan.fillByHand')} style={{ flex: 1 }} onPress={props.onFillByHand} />
        </View>
      )}
    </View>
  );
}

/** An indeterminate bar along the top of the bottom panel while the bill is being read. */
function ProgressSweep() {
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <View style={st.track}>
      <Animated.View style={[st.sweep, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-140, 420] }) }] }]} />
    </View>
  );
}

export const stageStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 12, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.55)' },
});

const st = StyleSheet.create({
  ...stageStyles,
  pdfStage: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', paddingBottom: 160 },
  pdfCard: { width: 200, height: 260, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, transform: [{ rotate: '-2deg' }] },
  pdfBadge: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1.2, color: C.paper, backgroundColor: C.accent, paddingHorizontal: 8, paddingVertical: 3 },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch', marginHorizontal: GUTTER, padding: 16, backgroundColor: 'rgba(10,10,10,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  track: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  sweep: { width: 140, height: 2, backgroundColor: C.accent },
});
