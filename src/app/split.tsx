import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n/core';
import { formatAmount } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { toMinor } from '@/lib/payment-codes';
import { getSettings, homeCurrency, updateSettings } from '@/lib/settings';
import { splitKind, type SplitKind } from '@/lib/sankey-model';
import { newId } from '@/lib/store';
import { T } from '@/ui/kit';
import { Animated, enterFade } from '@/ui/motion';
import { C, F, GUTTER, themed } from '@/ui/theme';

const parse = (text: string) => toMinor(text.replace(/[\s'’]/g, '').replace(',', '.'));

/** Add or change one of the user's own splits of income (savings, investing…), per month. */
export default function SplitEditor() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const existing = getSettings().splits.find((s) => s.id === params.id);
  const [name, setName] = useState(existing?.name ?? params.name ?? '');
  const [amount, setAmount] = useState(existing ? formatAmount(existing.monthlyMinor, homeCurrency()) : '');
  // Spending or saving: guessed from the name until the user picks.
  const [picked, setPicked] = useState<SplitKind | null>(existing?.kind ?? null);
  const kind = picked ?? splitKind({ name });
  const minor = parse(amount) ?? 0;
  const valid = name.trim().length > 0 && minor > 0;

  function save() {
    const splits = getSettings().splits;
    const next = { id: existing?.id ?? newId(), name: name.trim(), monthlyMinor: minor, kind };
    updateSettings({ splits: existing ? splits.map((s) => (s.id === existing.id ? next : s)) : [...splits, next] });
    goBack();
  }

  function remove() {
    updateSettings({ splits: getSettings().splits.filter((s) => s.id !== existing?.id) });
    goBack();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Animated.View entering={enterFade(0)} style={[StyleSheet.absoluteFill, { backgroundColor: C.backdrop }]}>
        <Pressable accessibilityLabel={t('common.close')} style={StyleSheet.absoluteFill} onPress={() => goBack()} />
      </Animated.View>
      <View style={{ flex: 1 }} pointerEvents="box-none" />
      <Animated.View entering={SlideInDown.duration(320)} style={[st.panel, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
        <T style={st.title}>{existing ? t('split.editTitle') : t('split.addTitle')}</T>
        <T style={st.text}>{t('split.textKinds')}</T>

        <T style={[st.eyebrow, { marginTop: 22 }]}>{t('split.name')}</T>
        <TextInput
          autoFocus={!params.name && !existing}
          value={name}
          onChangeText={setName}
          placeholder={t('flow.suggest.savings')}
          placeholderTextColor={C.barMuted}
          style={st.nameInput}
          maxLength={40}
          accessibilityLabel={t('split.name')}
        />

        <View style={st.segment} accessibilityRole="radiogroup">
          {(['spend', 'save'] as const).map((k) => {
            const on = k === kind;
            return (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setPicked(k)} style={[st.segItem, on && { backgroundColor: C.fg }]}>
                <T style={{ fontFamily: F.medium, fontSize: 13.5, color: on ? C.bg : C.dim }}>{k === 'spend' ? t('split.kindSpend') : t('split.kindSave')}</T>
              </Pressable>
            );
          })}
        </View>
        <T style={st.note}>{kind === 'spend' ? t('split.spendNote') : t('split.saveNote')}</T>

        <T style={[st.eyebrow, { marginTop: 18 }]}>{t('split.amount')}</T>
        <View style={st.field}>
          <T style={st.ccy}>{homeCurrency()}</T>
          <TextInput
            autoFocus={!!params.name && !existing}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={C.barMuted}
            style={st.input}
            accessibilityLabel={t('split.amount')}
          />
        </View>

        <Pressable accessibilityRole="button" disabled={!valid} onPress={save} style={({ pressed }) => [st.primary, (!valid || pressed) && { opacity: 0.6 }]}>
          <T style={st.primaryText}>{t('split.save')}</T>
        </Pressable>
        {existing ? (
          <Pressable accessibilityRole="button" onPress={remove} style={st.secondary}>
            <T style={{ fontSize: 13.5, color: C.accent }}>{t('split.remove')}</T>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={st.secondary}>
            <T style={{ fontSize: 13.5, color: C.muted }}>{t('common.cancel')}</T>
          </Pressable>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const st = themed(() => StyleSheet.create({
  panel: { backgroundColor: C.sheet, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: GUTTER, paddingTop: 26 },
  title: { fontFamily: F.medium, fontSize: 22, letterSpacing: -0.4 },
  text: { marginTop: 8, fontSize: 14, lineHeight: 20, color: C.muted },
  segment: { marginTop: 18, flexDirection: 'row', borderWidth: 1, borderColor: C.line, padding: 4 },
  segItem: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 8, fontSize: 12.5, lineHeight: 18, color: C.dim },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.dim },
  nameInput: { marginTop: 8, color: C.fg, fontFamily: F.regular, fontSize: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  field: { marginTop: 10, flexDirection: 'row', alignItems: 'baseline', gap: 10, borderBottomWidth: 1, borderBottomColor: C.fg, paddingBottom: 8 },
  ccy: { fontFamily: F.medium, fontSize: 16, color: C.dim },
  input: { flex: 1, color: C.fg, fontFamily: F.regular, fontSize: 36, letterSpacing: -1.4, padding: 0, fontVariant: ['tabular-nums'] },
  primary: { marginTop: 22, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fg },
  primaryText: { fontFamily: F.semibold, fontSize: 15, color: C.bg },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
}));
