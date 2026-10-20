import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, T } from './kit';
import { C, F, GUTTER } from './theme';

/**
 * The app's own dialogs: a bottom sheet for choices and confirmations, and a short toast for
 * "done" messages. Used instead of the system Alert so they match the rest of the app.
 */

export type SheetAction = { label: string; kind?: 'primary' | 'secondary' | 'destructive'; onPress?: () => void };
export type SheetOptions = { title?: string; message?: string; content?: ReactNode; actions?: SheetAction[]; onDismiss?: () => void };

let current: SheetOptions | null = null;
let toastText: { text: string; id: number } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const sheet = {
  show(options: SheetOptions) {
    current = options;
    emit();
  },
  hide() {
    current?.onDismiss?.();
    current = null;
    emit();
  },
  /** Resolves with true when the confirming action is chosen, false when dismissed. */
  confirm(o: { title: string; message?: string; confirm: string; destructive?: boolean }): Promise<boolean> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: boolean) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      sheet.show({
        title: o.title,
        message: o.message,
        onDismiss: () => finish(false),
        actions: [
          { label: o.confirm, kind: o.destructive ? 'destructive' : 'primary', onPress: () => finish(true) },
          { label: 'Cancel', kind: 'secondary' },
        ],
      });
    });
  },
};

/** Closes the sheet without firing onDismiss (the action is the answer), then runs the action. */
function runAction(a: SheetAction) {
  current = null;
  emit();
  a.onPress?.();
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string) {
  toastText = { text, id: Date.now() };
  emit();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastText = null;
    emit();
  }, 2400);
}

/** Mount once, above everything, in the root layout. */
export function OverlayHost() {
  const state = useSyncExternalStore(subscribe, () => current);
  const t = useSyncExternalStore(subscribe, () => toastText);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!state) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      sheet.hide();
      return true;
    });
    return () => sub.remove();
  }, [state]);

  return (
    <>
      {t && (
        <Animated.View key={t.id} entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(200)} pointerEvents="none" style={[st.toastWrap, { bottom: insets.bottom + 96 }]}>
          <View style={st.toast}>
            <View style={st.toastDot} />
            <T style={{ fontSize: 14, flexShrink: 1 }}>{t.text}</T>
          </View>
        </Animated.View>
      )}
      {state && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill}>
            <Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, st.backdrop]} onPress={() => sheet.hide()} />
          </Animated.View>
          <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[st.panel, { paddingBottom: insets.bottom + 20 }]}>
            <View style={st.grabber} />
            {!!state.title?.trim() && <T style={st.title}>{state.title}</T>}
            {state.message && <T style={st.message}>{state.message}</T>}
            {state.content}
            {state.actions && state.actions.length > 0 && (
              <View style={{ gap: 8, marginTop: 20 }}>
                {state.actions.map((a) => (
                  <Button
                    key={a.label}
                    title={a.label}
                    kind={a.kind === 'secondary' ? 'secondary' : 'primary'}
                    style={a.kind === 'destructive' ? { backgroundColor: C.accent } : undefined}
                    onPress={() => runAction(a)}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#111', borderTopWidth: 1, borderColor: C.border, paddingHorizontal: GUTTER, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 36, height: 4, backgroundColor: '#333', marginBottom: 18 },
  title: { fontFamily: F.semibold, fontSize: 19, letterSpacing: -0.4 },
  message: { marginTop: 8, fontSize: 14, lineHeight: 21, color: C.muted },
  toastWrap: { position: 'absolute', left: GUTTER, right: GUTTER, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#161616', borderWidth: 1, borderColor: C.border },
  toastDot: { width: 6, height: 6, backgroundColor: C.accent },
});
