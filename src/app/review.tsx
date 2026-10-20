import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fromIso, longDate, toIso, todayIso, daysBetween } from '@/lib/dates';
import { activeDiscount, targetDate } from '@/lib/discount';
import { takePendingDraft } from '@/lib/draft';
import { formatMoney } from '@/lib/money';
import { toMinor } from '@/lib/payment-codes';
import { describeReminder, scheduleReminder } from '@/lib/reminders';
import { newId, saveBill } from '@/lib/store';
import { CATEGORY_LABEL, emptyPayment, type Bill, type BillDraft, type SourcedField } from '@/lib/types';
import { Button, Eyebrow, Icon, IconButton, SourceTag, T } from '@/ui/kit';
import { C, F, GUTTER } from '@/ui/theme';

const REMIND_OPTIONS = [
  { days: 0, label: 'On the due date' },
  { days: 1, label: '1 day before' },
  { days: 3, label: '3 days before' },
  { days: 7, label: '1 week before' },
];

const blankDraft = (): BillDraft => ({
  payee: '',
  description: null,
  amountMinor: null,
  currency: 'CHF',
  dueDate: null,
  issueDate: null,
  category: 'other',
  country: null,
  payMethod: 'bank_transfer',
  payment: emptyPayment(),
  sources: {},
  remindDaysBefore: 3,
  imageUri: null,
});

export default function Review() {
  const insets = useSafeAreaInsets();
  const [initial] = useState(() => takePendingDraft() ?? { draft: blankDraft(), warning: null });
  const [d, setD] = useState<BillDraft>(initial.draft);
  const [amountText, setAmountText] = useState(d.amountMinor != null ? (d.amountMinor / 100).toFixed(2) : '');
  const [iosPicker, setIosPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  /** Editing a field makes it the user's, so its QR/AI tag goes away. */
  function edit<K extends keyof BillDraft>(key: K, value: BillDraft[K], field?: SourcedField) {
    setD((prev) => ({ ...prev, [key]: value, sources: field ? { ...prev.sources, [field]: 'user' } : prev.sources }));
  }
  function editPayment(key: 'iban' | 'reference', value: string) {
    setD((prev) => ({ ...prev, payment: { ...prev.payment, [key]: value || null }, sources: { ...prev.sources, [key]: 'user' } }));
  }

  function pickDate() {
    const value = d.dueDate ? fromIso(d.dueDate) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value, mode: 'date', onChange: (e, date) => e.type === 'set' && date && edit('dueDate', toIso(date), 'dueDate') });
    } else {
      setIosPicker((v) => !v);
    }
  }

  const discount = activeDiscount({ ...d, amountMinor: toMinor(amountText), status: 'open' });
  const reminder = describeReminder(targetDate({ ...d, amountMinor: toMinor(amountText), status: 'open' }), d.remindDaysBefore, !!discount);
  const valid = d.payee.trim().length > 0;

  async function save() {
    setSaving(true);
    const bill: Bill = {
      ...d,
      payee: d.payee.trim(),
      amountMinor: toMinor(amountText),
      currency: d.currency.trim().toUpperCase() || 'CHF',
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
          <IconButton label="Retake photo" onPress={() => router.replace('/scan')}>
            <Icon name="back" />
          </IconButton>
          <T style={st.headerTitle}>CHECK DETAILS</T>
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
              <TextInput value={d.payee} onChangeText={(v) => edit('payee', v, 'payee')} placeholder="Who to pay" placeholderTextColor={C.dim} style={st.payee} accessibilityLabel="Payee" />
              <SourceTag source={d.sources.payee} />
            </View>
            <T style={{ fontSize: 13, color: C.dim }}>{d.description ?? CATEGORY_LABEL[d.category]}</T>
          </View>
        </View>

        <View style={st.amountBlock}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>Amount</Eyebrow>
            <SourceTag source={d.sources.amount} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <TextInput value={d.currency} onChangeText={(v) => edit('currency', v.toUpperCase(), 'currency')} autoCapitalize="characters" maxLength={3} style={st.ccy} accessibilityLabel="Currency" />
            <TextInput
              value={amountText}
              onChangeText={(v) => {
                setAmountText(v);
                setD((p) => ({ ...p, sources: { ...p.sources, amount: 'user' } }));
              }}
              placeholder="0.00"
              placeholderTextColor="#3a3a3a"
              keyboardType="decimal-pad"
              style={st.amount}
              accessibilityLabel="Amount"
            />
          </View>
        </View>

        {discount && (
          <View style={st.discount}>
            <T style={{ fontFamily: F.monoMedium, fontSize: 13, color: C.accent }}>−{discount.percent}%</T>
            <T style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: C.muted }}>
              Early-payment discount: pay <T style={{ fontSize: 13.5, color: C.fg }}>{formatMoney(discount.payMinor, d.currency)}</T> by {longDate(discount.until)} and save {formatMoney(discount.savingMinor, d.currency)}. The reminder aims for this date.
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel="Ignore the discount" hitSlop={10} onPress={() => edit('discount', null)}>
              <Icon name="close" color={C.dim} size={14} />
            </Pressable>
          </View>
        )}

        <Pressable onPress={pickDate} style={st.field} accessibilityRole="button" accessibilityLabel="Change due date">
          <T style={st.label}>Due</T>
          <View style={st.fieldRight}>
            <T style={{ fontSize: 14, color: d.dueDate ? C.fg : C.accent }}>
              {d.dueDate ? `${longDate(d.dueDate)}${daysBetween(todayIso(), d.dueDate) >= 0 ? '' : ' · overdue'}` : 'Add due date'}
            </T>
            <SourceTag source={d.sources.dueDate} />
          </View>
        </Pressable>
        {iosPicker && Platform.OS === 'ios' && (
          <DateTimePicker value={d.dueDate ? fromIso(d.dueDate) : new Date()} mode="date" display="inline" themeVariant="dark" onChange={(_, date) => date && edit('dueDate', toIso(date), 'dueDate')} />
        )}
        <View style={st.field}>
          <T style={st.label}>IBAN</T>
          <View style={st.fieldRight}>
            <TextInput value={d.payment.iban ?? ''} onChangeText={(v) => editPayment('iban', v)} placeholder="—" placeholderTextColor={C.dim} autoCapitalize="characters" style={st.monoInput} accessibilityLabel="IBAN" />
            <SourceTag source={d.sources.iban} />
          </View>
        </View>
        <View style={st.field}>
          <T style={st.label}>Reference</T>
          <View style={st.fieldRight}>
            <TextInput value={d.payment.reference ?? ''} onChangeText={(v) => editPayment('reference', v)} placeholder="—" placeholderTextColor={C.dim} style={st.monoInput} multiline accessibilityLabel="Payment reference" />
            <SourceTag source={d.sources.reference} />
          </View>
        </View>

        <Eyebrow style={{ marginTop: 26, marginBottom: 12 }}>Remind me</Eyebrow>
        <View style={st.chips}>
          {REMIND_OPTIONS.map((o) => {
            const on = o.days === d.remindDaysBefore;
            return (
              <Pressable key={o.days} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => edit('remindDaysBefore', o.days)} style={[st.chip, on && st.chipOn]}>
                <T style={{ fontFamily: F.medium, fontSize: 14, color: on ? C.bg : C.fg }}>{o.label}</T>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Icon name="bell" color={C.accent} />
          <T style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: C.muted }}>
            {reminder.when && <T style={{ fontSize: 13.5, color: C.fg }}>{reminder.when} at 09:00. </T>}
            {reminder.why}
          </T>
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Save bill" onPress={save} loading={saving} disabled={!valid} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
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
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 16, backgroundColor: 'rgba(10,10,10,0.94)' },
});
