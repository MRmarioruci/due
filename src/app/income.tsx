import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n/core';
import { formatAmount } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { toMinor } from '@/lib/payment-codes';
import { describePay } from '@/lib/plan';
import { getSettings, homeCurrency, updateSettings } from '@/lib/settings';
import { Icon, T } from '@/ui/kit';
import { SlideInDown } from 'react-native-reanimated';

import { Animated, enterFade } from '@/ui/motion';
import { C, F, GUTTER, themed } from '@/ui/theme';

/** "6'200.50", "6200,50", "6 200" → minor units. */
const parse = (text: string) => toMinor(text.replace(/[\s'’]/g, '').replace(',', '.'));
const shown = (minor: number | undefined) => (minor ? formatAmount(minor, homeCurrency()) : '');

/** What comes in each month: a salary and, optionally, one other income. Kept on the phone. */
export default function Income() {
  const insets = useSafeAreaInsets();
  const s = getSettings();
  const [salary, setSalary] = useState(shown(s.income[0]?.monthlyMinor));
  const [other, setOther] = useState(shown(s.income[1]?.monthlyMinor));
  const [withOther, setWithOther] = useState(!!s.income[1]);
  const ccy = homeCurrency();
  const valid = (parse(salary) ?? 0) > 0;

  function save() {
    const income = [{ label: null, monthlyMinor: parse(salary) ?? 0 }];
    const extra = withOther ? parse(other) : null;
    if (extra) income.push({ label: null, monthlyMinor: extra });
    updateSettings({ income });
    router.replace('/flow');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Animated.View entering={enterFade(0)} style={[StyleSheet.absoluteFill, { backgroundColor: C.backdrop }]}>
        <Pressable accessibilityLabel={t('common.close')} style={StyleSheet.absoluteFill} onPress={() => goBack()} />
      </Animated.View>
      <View style={{ flex: 1 }} pointerEvents="box-none" />
      <Animated.View entering={SlideInDown.duration(320)} style={[st.panel, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
        <T style={st.title}>{t('income.title')}</T>
        <T style={st.text}>{t('income.text')}</T>

        <T style={[st.eyebrow, { marginTop: 22 }]}>{s.pay ? t('income.salaryWhen', { when: describePay(s.pay).toUpperCase() }) : t('income.salary')}</T>
        <View style={st.field}>
          <T style={st.ccy}>{ccy}</T>
          <TextInput autoFocus value={salary} onChangeText={setSalary} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.barMuted} style={st.input} accessibilityLabel={t('income.salary')} />
        </View>

        {withOther ? (
          <>
            <T style={[st.eyebrow, { marginTop: 18 }]}>{t('income.other')}</T>
            <View style={[st.field, { borderBottomColor: C.border }]}>
              <T style={st.ccy}>{ccy}</T>
              <TextInput value={other} onChangeText={setOther} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.barMuted} style={[st.input, { fontSize: 28 }]} accessibilityLabel={t('income.other')} />
            </View>
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setWithOther(true)} style={st.add}>
            <Icon name="plus" size={16} />
            <T style={{ fontSize: 14.5 }}>
              {t('income.addOther')} <T style={{ fontSize: 12.5, color: C.dim }}>{t('income.addOtherHint')}</T>
            </T>
          </Pressable>
        )}

        <Pressable accessibilityRole="button" disabled={!valid} onPress={save} style={({ pressed }) => [st.primary, (!valid || pressed) && { opacity: 0.6 }]}>
          <T style={st.primaryText}>{t('income.save')}</T>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => goBack()} style={st.notNow}>
          <T style={{ fontSize: 13.5, color: C.muted }}>{t('income.notNow')}</T>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const st = themed(() => StyleSheet.create({
  panel: { backgroundColor: C.sheet, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: GUTTER, paddingTop: 26 },
  title: { fontFamily: F.medium, fontSize: 22, letterSpacing: -0.4 },
  text: { marginTop: 8, fontSize: 14, lineHeight: 20, color: C.muted },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.dim },
  field: { marginTop: 10, flexDirection: 'row', alignItems: 'baseline', gap: 10, borderBottomWidth: 1, borderBottomColor: C.fg, paddingBottom: 8 },
  ccy: { fontFamily: F.medium, fontSize: 16, color: C.dim },
  input: { flex: 1, color: C.fg, fontFamily: F.regular, fontSize: 40, letterSpacing: -1.6, padding: 0, fontVariant: ['tabular-nums'] },
  add: { marginTop: 14, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  primary: { marginTop: 22, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fg },
  primaryText: { fontFamily: F.semibold, fontSize: 15, color: C.bg },
  notNow: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
}));
