import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { C, F, themed, type Palette } from './theme';

export function T({ style, ...p }: TextProps) {
  return <Text {...p} style={[s.text, style]} />;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

/** "CHF 979.25": small muted currency, big tabular number. */
export function Amount({ currency, value, size = 52 }: { currency: string; value: string; size?: number }) {
  return (
    <View style={s.amountRow}>
      <Text style={s.amountCcy}>{currency}</Text>
      <Text style={[s.amount, { fontSize: size, letterSpacing: -size * 0.045 }]} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', loading, disabled, style, icon, palette }: {
  title: string;
  onPress?: PressableProps['onPress'];
  kind?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
  /** Fixed colours, e.g. the always-dark camera screen; defaults to the active theme. */
  palette?: Palette;
}) {
  const primary = kind === 'primary';
  const P = palette ?? C;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.button, primary ? { backgroundColor: P.fg } : { borderWidth: 1, borderColor: P.border }, (pressed || disabled) && { opacity: 0.7 }, style]}>
      {loading ? (
        <ActivityIndicator color={primary ? P.bg : P.fg} />
      ) : (
        <>
          {icon}
          <Text style={[s.buttonText, { color: primary ? P.bg : P.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ label, onPress, children, style }: { label: string; onPress?: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [s.iconButton, pressed && { backgroundColor: C.surface }, style]}>
      {children}
    </Pressable>
  );
}

/** QR / AI provenance tag next to a field. */
export function SourceTag({ source }: { source?: 'qr' | 'ai' | 'user' }) {
  if (!source || source === 'user') return null;
  const qr = source === 'qr';
  return (
    <Text style={[s.tag, { color: qr ? C.accent : C.muted, borderColor: qr ? C.accent : C.axis }]}>{qr ? 'QR' : 'AI'}</Text>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator color={C.fg} />
    </View>
  );
}

type IconName = 'back' | 'close' | 'scan' | 'stats' | 'settings' | 'copy' | 'bell' | 'flash' | 'photo' | 'more' | 'check' | 'share' | 'pin' | 'download' | 'sort' | 'link' | 'search' | 'filter' | 'plus' | 'home' | 'list';

export function Icon({ name, color = C.fg, size = 18 }: { name: IconName; color?: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 1.7, fill: 'none' as const, strokeLinecap: 'square' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'back' && <Path d="M15 5l-7 7 7 7" {...p} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {name === 'scan' && <Path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 12h10" {...p} />}
      {name === 'stats' && <Path d="M5 20V13M12 20V5M19 20v-9" {...p} />}
      {name === 'settings' && (
        <>
          <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...p} />
          <Rect x={14} y={5} width={4} height={4} {...p} />
          <Rect x={6} y={15} width={4} height={4} {...p} />
        </>
      )}
      {name === 'copy' && (
        <>
          <Rect x={8.5} y={8.5} width={11} height={11} {...p} />
          <Path d="M15.5 4.5h-11v11" {...p} />
        </>
      )}
      {name === 'bell' && <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4" {...p} strokeLinecap="butt" />}
      {name === 'flash' && <Path d="M13 3L5 14h6l-1 7 8-11h-6z" {...p} strokeLinejoin="round" />}
      {name === 'photo' && (
        <>
          <Rect x={3.5} y={4.5} width={17} height={15} {...p} />
          <Path d="M3.5 16l5-5 4 4 3-3 5 5" {...p} />
        </>
      )}
      {name === 'more' && <Path d="M5 12h.01M12 12h.01M19 12h.01" {...p} strokeWidth={3} />}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'home' && <Path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" {...p} />}
      {name === 'list' && <Path d="M5 6h14M5 12h14M5 18h9" {...p} />}
      {name === 'pin' && <Path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" {...p} strokeLinecap="butt" />}
      {name === 'link' && <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...p} strokeLinecap="round" />}
      {name === 'search' && <Path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20" {...p} />}
      {name === 'filter' && <Path d="M4 6h16M7 12h10M10 18h4" {...p} />}
      {name === 'sort' && <Path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5" {...p} />}
      {name === 'download' && <Path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5M5 19.5h14" {...p} />}
      {name === 'share' && <Path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12v8.5h14V12" {...p} />}
    </Svg>
  );
}

export const s = themed(() => StyleSheet.create({
  text: { color: C.fg, fontFamily: F.regular, fontSize: 15 },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.dim },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  amountCcy: { fontFamily: F.medium, fontSize: 16, color: C.dim },
  amount: { fontFamily: F.semibold, color: C.fg, fontVariant: ['tabular-nums'], flexShrink: 1 },
  button: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16 },
  buttonPrimary: { backgroundColor: C.fg },
  buttonSecondary: { borderWidth: 1, borderColor: C.border },
  buttonText: { fontFamily: F.semibold, fontSize: 15, letterSpacing: -0.15 },
  iconButton: { width: 44, height: 44, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  tag: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.8, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1.5 },
}));
