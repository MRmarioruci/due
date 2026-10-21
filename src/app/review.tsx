import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatHour, longDate, todayIso, daysBetween } from '@/lib/dates';
import { activeDiscount } from '@/lib/discount';
import { takePendingDraft } from '@/lib/draft';
import { formatMoney } from '@/lib/money';
import { goBack, openScan } from '@/lib/nav';
import { toMinor } from '@/lib/payment-codes';
import { PAY_STYLES } from '@/lib/reminder-plan';
import { describeReminder, scheduleReminder } from '@/lib/reminders';
import { payeeKey } from '@/lib/recurring';
import { getSettings, homeCurrency, updateSettings } from '@/lib/settings';
import { getBill, newId, saveBill } from '@/lib/store';
import { CATEGORIES, emptyPayment, type Bill, type BillDraft, type SourcedField } from '@/lib/types';
import { t } from '@/i18n/core';
import { categoryLabel, leadLabel, payStyleLabel } from '@/i18n/labels';
import { pickDate } from '@/ui/calendar';
import { Button, Eyebrow, Icon, IconButton, SourceTag, T } from '@/ui/kit';
import { sheet, toast } from '@/ui/overlay';
import { C, F, GUTTER, themed } from '@/ui/theme';

const REMIND_OPTIONS = [0, 1, 3, 7].map((days) => ({ days }));

const blankDraft = (): BillDraft => ({
  payee: '',
  description: null,
  amountMinor: null,
  currency: homeCurrency(),
  dueDate: null,
  issueDate: null,
  category: 'other',
  country: null,
  payMethod: 'bank_transfer',
  payment: emptyPayment(),
  sources: {},
  remindDaysBefore: getSettings().remindDaysBefore,
  imageUri: null,
});

/** The editable part of a saved bill. */
function toDraft(b: Bill): BillDraft {
  const { id: _id, status: _s, paidAt: _p, paidAmountMinor: _pa, createdAt: _c, remindAt: _r, reminderId: _ri, extraReminderIds: _e, ...draft } = b;
  return draft;
}

/** Checks a new scan before saving it, or edits a saved bill (`/review?id=…`). */
export default function Review() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [existing] = useState(() => (id ? getBill(id) : undefined));
  const [initial] = useState(() => (existing ? { draft: toDraft(existing), warning: null } : (takePendingDraft() ?? { draft: blankDraft(), warning: null })));
  const [d, setD] = useState<BillDraft>(initial.draft);
  const [amountText, setAmountText] = useState(d.amountMinor != null ? (d.amountMinor / 100).toFixed(2) : '');
  const [saving, setSaving] = useState(false);

  /** Editing a field makes it the user's, so its QR/AI tag goes away. */
  function edit<K extends keyof BillDraft>(key: K, value: BillDraft[K], field?: SourcedField) {
    setD((prev) => ({ ...prev, [key]: value, sources: field ? { ...prev.sources, [field]: 'user' } : prev.sources }));
  }
  function editPayment(key: 'iban' | 'reference', value: string) {
    setD((prev) => ({ ...prev, payment: { ...prev.payment, [key]: value || null }, sources: { ...prev.sources, [key]: 'user' } }));
  }

  async function chooseDueDate() {
    const picked = await pickDate(t('review.dueDate'), d.dueDate);
    if (picked) edit('dueDate', picked, 'dueDate');
  }

  function chooseCategory() {
    sheet.show({
      title: t('review.category'),
      content: (
        <View style={st.chips}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityState={{ selected: c === d.category }}
              onPress={() => {
                edit('category', c);
                sheet.hide();
              }}
              style={[st.chip, c === d.category && st.chipOn]}>
              <T style={{ fontFamily: F.medium, fontSize: 14, color: c === d.category ? C.bg : C.fg }}>{categoryLabel(c)}</T>
            </Pressable>
          ))}
        </View>
      ),
    });
  }

  const discount = activeDiscount({ ...d, amountMinor: toMinor(amountText), status: 'open' });
  const style = d.payStyle ?? getSettings().payStyle;
  const reminder = describeReminder({
    ...d,
    amountMinor: toMinor(amountText),
    id: 'draft',
    status: 'open',
    paidAt: null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    remindAt: null,
    reminderId: null,
  });
  const valid = d.payee.trim().length > 0;

  async function save() {
    setSaving(true);
    // Remember the category kept for this biller, so its next bills get it too.
    if (d.category !== 'other' && d.payee.trim()) {
      const learned = getSettings().learnedCategories;
      const key = payeeKey(d.payee);
      if (learned[key] !== d.category) updateSettings({ learnedCategories: { ...learned, [key]: d.category } });
    }
    if (existing) {
      const updated: Bill = { ...existing, ...d, payee: d.payee.trim(), amountMinor: toMinor(amountText), currency: d.currency.trim().toUpperCase() || homeCurrency() };
      saveBill(await scheduleReminder(updated));
      toast(t('review.saved'));
      return goBack();
    }
    const bill: Bill = {
      ...d,
      payee: d.payee.trim(),
      amountMinor: toMinor(amountText),
      currency: d.currency.trim().toUpperCase() || homeCurrency(),
      id: newId(),
      status: 'open',
      paidAt: null,
      createdAt: new Date().toISOString(),
      remindAt: null,
      reminderId: null,
    };
    saveBill(await scheduleReminder(bill));
    router.dismissTo('/');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <View style={st.header}>
          <IconButton label={existing ? t('review.closeWithoutSaving') : t('review.retake')} onPress={() => (existing ? goBack() : openScan(true))}>
            <Icon name={existing ? 'close' : 'back'} />
          </IconButton>
          <T style={st.headerTitle}>{existing ? t('review.titleEdit') : t('review.titleCheck')}</T>
          <View style={{ width: 44 }} />
        </View>

        {initial.warning && (
          <View style={st.warning}>
            <T style={{ fontSize: 13, color: C.muted, lineHeight: 19 }}>{initial.warning}</T>
          </View>
        )}

        <View style={st.hero}>
          {d.imageUri ? <Image source={{ uri: d.imageUri }} style={st.thumb} contentFit="cover" /> : <View style={[st.thumb, { backgroundColor: C.paper }]} />}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput value={d.payee} onChangeText={(v) => edit('payee', v, 'payee')} placeholder={t('review.payeePlaceholder')} placeholderTextColor={C.dim} style={st.payee} accessibilityLabel={t('review.payee')} />
              <SourceTag source={d.sources.payee} />
            </View>
            <TextInput
              value={d.description ?? ''}
              onChangeText={(v) => edit('description', v || null)}
              placeholder={t('review.descriptionPlaceholder')}
              placeholderTextColor={C.barMuted}
              style={st.description}
              accessibilityLabel={t('review.description')}
            />
          </View>
        </View>

        <View style={st.amountBlock}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>{t('review.amount')}</Eyebrow>
            <SourceTag source={d.sources.amount} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <TextInput value={d.currency} onChangeText={(v) => edit('currency', v.toUpperCase(), 'currency')} autoCapitalize="characters" maxLength={3} style={st.ccy} accessibilityLabel={t('review.currency')} />
            <TextInput
              value={amountText}
              onChangeText={(v) => {
                setAmountText(v);
                setD((p) => ({ ...p, sources: { ...p.sources, amount: 'user' } }));
              }}
              placeholder="0.00"
              placeholderTextColor={C.barMuted}
              keyboardType="decimal-pad"
              style={st.amount}
              accessibilityLabel={t('review.amount')}
            />
          </View>
        </View>

        {discount && (
          <View style={st.discount}>
            <T style={{ fontFamily: F.monoMedium, fontSize: 13, color: C.accent }}>−{discount.percent}%</T>
            <T style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: C.muted }}>
              {t('review.discount', { amount: formatMoney(discount.payMinor, d.currency), date: longDate(discount.until), saving: formatMoney(discount.savingMinor, d.currency) })}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel={t('review.ignoreDiscount')} hitSlop={10} onPress={() => edit('discount', null)}>
              <Icon name="close" color={C.dim} size={14} />
            </Pressable>
          </View>
        )}

        <Pressable onPress={chooseDueDate} style={st.field} accessibilityRole="button" accessibilityLabel={t('review.changeDueDate')}>
          <T style={st.label}>{t('review.due')}</T>
          <View style={st.fieldRight}>
            <T style={{ fontSize: 14, color: d.dueDate ? C.fg : C.accent }}>
              {d.dueDate ? `${longDate(d.dueDate)}${daysBetween(todayIso(), d.dueDate) >= 0 ? '' : ` · ${t('review.overdue')}`}` : t('review.addDueDate')}
            </T>
            <SourceTag source={d.sources.dueDate} />
          </View>
        </Pressable>
        <Pressable onPress={chooseCategory} style={st.field} accessibilityRole="button" accessibilityLabel={t('review.changeCategory')}>
          <T style={st.label}>{t('review.category')}</T>
          <T style={{ fontSize: 14 }}>{categoryLabel(d.category)}</T>
        </Pressable>
        <View style={st.field}>
          <T style={st.label}>IBAN</T>
          <View style={st.fieldRight}>
            <TextInput value={d.payment.iban ?? ''} onChangeText={(v) => editPayment('iban', v)} placeholder="—" placeholderTextColor={C.dim} autoCapitalize="characters" style={st.monoInput} accessibilityLabel="IBAN" />
            <SourceTag source={d.sources.iban} />
          </View>
        </View>
        <View style={st.field}>
          <T style={st.label}>{t('review.reference')}</T>
          <View style={st.fieldRight}>
            <TextInput value={d.payment.reference ?? ''} onChangeText={(v) => editPayment('reference', v)} placeholder="—" placeholderTextColor={C.dim} style={st.monoInput} multiline accessibilityLabel={t('review.reference')} />
            <SourceTag source={d.sources.reference} />
          </View>
        </View>

        <Eyebrow style={{ marginTop: 26, marginBottom: 12 }}>{t('review.whenToPay')}</Eyebrow>
        <View style={st.segment}>
          {PAY_STYLES.map((p) => {
            const on = p.key === style;
            return (
              <Pressable key={p.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => edit('payStyle', p.key)} style={[st.segItem, on && st.chipOn]}>
                <T style={{ fontFamily: F.medium, fontSize: 13.5, color: on ? C.bg : C.fg }}>{payStyleLabel(p.key)}</T>
              </Pressable>
            );
          })}
        </View>

        {style === 'last' && (
          <View style={[st.chips, { marginTop: 10 }]}>
            {REMIND_OPTIONS.map((o) => {
              const on = o.days === d.remindDaysBefore;
              return (
                <Pressable key={o.days} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => edit('remindDaysBefore', o.days)} style={[st.chip, on && st.chipOn]}>
                  <T style={{ fontFamily: F.medium, fontSize: 14, color: on ? C.bg : C.fg }}>{leadLabel(o.days)}</T>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Icon name="bell" color={C.accent} />
          <T style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: C.muted }}>
            {reminder.when && <T style={{ fontSize: 13.5, color: C.fg }}>{t('review.reminderAt', { date: reminder.when, time: formatHour(getSettings().remindHour) })} </T>}
            {reminder.why}
          </T>
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title={existing ? t('review.saveChanges') : t('review.saveBill')} onPress={save} loading={saving} disabled={!valid} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  headerTitle: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.3, color: C.muted },
  warning: { marginTop: 16, borderWidth: 1, borderColor: C.border, padding: 12 },
  hero: { marginTop: 22, flexDirection: 'row', gap: 14, alignItems: 'center' },
  thumb: { width: 46, height: 62, transform: [{ rotate: '-3deg' }] },
  payee: { flexShrink: 1, color: C.fg, fontFamily: F.semibold, fontSize: 16, padding: 0 },
  discount: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: C.accent },
  amountBlock: { marginTop: 26, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: C.line },
  ccy: { fontFamily: F.medium, fontSize: 16, color: C.dim, padding: 0, minWidth: 34 },
  amount: { flex: 1, fontFamily: F.semibold, fontSize: 48, letterSpacing: -2, color: C.fg, padding: 0, fontVariant: ['tabular-nums'] },
  field: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 54, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  fieldRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  label: { fontSize: 13, color: C.dim },
  monoInput: { fontFamily: F.mono, fontSize: 12.5, color: C.fg, textAlign: 'right', padding: 0, flexShrink: 1, minWidth: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { width: '48.8%', height: 46, borderWidth: 1, borderColor: C.border, justifyContent: 'center', paddingHorizontal: 14 },
  chipOn: { backgroundColor: C.fg, borderColor: C.fg },
  description: { color: C.dim, fontSize: 13, padding: 0 },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: C.line, padding: 3 },
  segItem: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 16, backgroundColor: C.footer },
}));
