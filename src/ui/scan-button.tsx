import { Pressable, StyleSheet } from 'react-native';

import { t } from '@/i18n/core';
import { openScan } from '@/lib/nav';

import { Icon } from './kit';
import { C, themed } from './theme';

/** The one filled square in the header: scanning is always a tap away without taking the screen. */
export function ScanButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('home.scan')} onPress={() => openScan()} style={({ pressed }) => [st.button, pressed && { opacity: 0.8 }]}>
      <Icon name="scan" color={C.bg} size={18} />
    </Pressable>
  );
}

const st = themed(() => StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fg },
}));
