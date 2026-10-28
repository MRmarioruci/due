import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatHour, longDate, shortDay, todayIso, daysBetween } from '@/lib/dates';
import { activeDiscount } from '@/lib/discount';
import { takePendingDraft } from '@/lib/draft';
import { formatMoney } from '@/lib/money';
import { goBack, openScan } from '@/lib/nav';
import { toMinor } from '@/lib/payment-codes';
import { PAY_STYLES } from '@/lib/reminder-plan';
import { describeReminder, markPaid, replan, syncReminders } from '@/lib/reminders';
import { billPaidBy, receiptPaidAt } from '@/lib/kind';
import { pickCategory } from '@/lib/categorize';
import { payeeKey } from '@/lib/recurring';
import { getSettings, homeCurrency, recordKept, updateSettings } from '@/lib/settings';
import { getBill, newId, saveBill, useBills } from '@/lib/store';
import { contractOf, nextReview } from '@/lib/contracts';
import { findDuplicate } from '@/lib/duplicates';
import { alreadyPaid, chasedBill } from '@/lib/dunning';
import { priceChange } from '@/lib/price-change';
import { removeBill } from '@/lib/remove';
import { PriceChangeLine } from '@/ui/price-change';
import { keepOriginals, proofOf } from '@/lib/originals';
import { categoriesFor, emptyPayment, isReceipt, type Bill, type BillDraft, type Kind, type SourcedField } from '@/lib/types';
import { t } from '@/i18n/core';
import { categoryLabel, leadLabel, payStyleLabel } from '@/i18n/labels';
import { pickDate } from '@/ui/calendar';
import { showProof } from '@/ui/proof';
import { billyCameo } from '@/ui/billy';
import { Button, Eyebrow, Icon, IconButton, SourceTag, T } from '@/ui/kit';
import { sheet, toast } from '@/ui/overlay';
import { C, F, GUTTER, themed } from '@/ui/theme';

const REMIND_OPTIONS = [0, 1, 3, 7].map((days) => ({ days }));

const blankDraft = (): BillDraft => ({
  kind: 'bill',
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
  pdfUri: null,
});

/** The editable part of a saved bill. */
function toDraft(b: Bill): BillDraft {
  const { id: _id, status: _s, paidAt: _p, paidAmountMinor: _pa, createdAt: _c, remindAt: _r, snoozedUntil: _sn, reminderId: _ri, extraReminderIds: _e, ...draft } = b;
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
  const bills = useBills();
  const receipt = d.kind === 'receipt';
  /** What the scan was detected as (or the saved kind), to notice when the user corrects it. */
  const [detectedKind] = useState<Kind>(initial.draft.kind ?? 'bill');
  // The same bill already saved (scanned twice)? Checked live, as the details get corrected.
  const duplicate = existing ? null : findDuplicate({ ...d, amountMinor: toMinor(amountText) }, bills);
  // A receipt that confirms paying an open bill: offer to mark that bill paid rather than count it twice.
  const paysBill = !existing && receipt ? billPaidBy({ payee: d.payee, amountMinor: toMinor(amountText), currency: d.currency }, bills) : null;
  // A payment reminder replaces the open bill it chases, so it isn't paid twice.
  const [keepChased, setKeepChased] = useState(false);
  const chased = existing || receipt ? null : chasedBill({ ...d, amountMinor: toMinor(amountText) }, bills);
  // A reminder for something already marked paid: the biller may not have the payment yet.
  const paidEarlier = existing || chased || receipt ? null : alreadyPaid({ ...d, amountMinor: toMinor(amountText) }, bills);
  const contract = receipt ? null : contractOf(d.payee, getSettings().contracts);
  const reviewBy = contract && nextReview(contract, todayIso());
  const change = receipt ? null : priceChange({ ...d, id: existing?.id ?? '', createdAt: existing?.createdAt ?? new Date().toISOString(), amountMinor: toMinor(amountText) }, bills);

  /** Editing a field makes it the user's, so its QR/AI tag goes away. */
  function edit<K extends keyof BillDraft>(key: K, value: BillDraft[K], field?: SourcedField) {
    setD((prev) => ({ ...prev, [key]: value, sources: field ? { ...prev.sources, [field]: 'user' } : prev.sources }));
  }
  function editPayment(key: 'iban' | 'reference', value: string) {
    setD((prev) => ({ ...prev, payment: { ...prev.payment, [key]: value || null }, sources: { ...prev.sources, [key]: 'user' } }));
  }

  /** Bill or receipt: flipping keeps everything read so far, only the layout changes. */
  function setKind(kind: Kind) {
    if (kind === d.kind) return;
    setD((prev) => ({
      ...prev,
      kind,
      // Re-guess the category for the new kind ("Lidl" turned receipt is groceries), unless the current one fits.
      category: categoriesFor(kind).includes(prev.category) && prev.category !== 'other'
        ? prev.category
        : pickCategory({ kind, payee: prev.payee, description: prev.description, model: prev.category, learned: getSettings().learnedCategories }),
    }));
  }

  async function chooseDate() {
    const picked = await pickDate(t('review.date'), d.issueDate ?? todayIso());
    if (picked) edit('issueDate', picked);
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
          {[...categoriesFor(d.kind), ...(categoriesFor(d.kind).includes(d.category) ? [] : [d.category])].map((c) => (
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
    // Corrected bill ↔ receipt: this shop or biller is that kind from now on.
    if (d.kind !== detectedKind && d.payee.trim()) {
      const learned = getSettings().learnedKinds;
      updateSettings({ learnedKinds: { ...learned, [payeeKey(d.payee)]: d.kind ?? 'bill' } });
    }
    // Remember the category kept for this biller or shop, so its next bills and receipts get it too.
    if (d.category !== 'other' && d.payee.trim()) {
      const learned = getSettings().learnedCategories;
      const key = payeeKey(d.payee);
      if (learned[key] !== d.category) updateSettings({ learnedCategories: { ...learned, [key]: d.category } });
    }
    if (receipt) return saveReceipt();
    if (existing) {
      // A receipt turned into a bill: it's open again, to be paid.
      const reopened = isReceipt(existing) ? { status: 'open' as const, paidAt: null, paidAmountMinor: null } : {};
      const updated: Bill = { ...existing, ...d, ...reopened, kind: 'bill', payee: d.payee.trim(), amountMinor: toMinor(amountText), currency: d.currency.trim().toUpperCase() || homeCurrency() };
      saveBill(replan(updated));
      syncReminders();
      toast(t('review.saved'));
      return goBack();
    }
    const bill: Bill = {
      ...d,
      kind: 'bill',
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
    saveBill(keepOriginals(bill));
    syncReminders();
    if (chased && !keepChased) {
      if (chased.amountMinor != null) recordKept({ kind: 'double', minor: chased.amountMinor, currency: chased.currency });
      await removeBill(chased);
    }
    router.dismissTo('/');
  }

  /** A receipt is saved as already paid, on the day it shows, with no due date and no reminders. */
  async function saveReceipt() {
    const issueDate = d.issueDate ?? todayIso();
    const fields = {
      ...d,
      kind: 'receipt' as const,
      payee: d.payee.trim(),
      amountMinor: toMinor(amountText),
      currency: d.currency.trim().toUpperCase() || homeCurrency(),
      issueDate,
      dueDate: null,
      discount: null,
      dunning: null,
      payStyle: null,
      status: 'paid' as const,
      paidAt: receiptPaidAt(issueDate, d.time),
      paidAmountMinor: null,
      remindAt: null,
      snoozedUntil: null,
      reminderId: null,
      extraReminderIds: [],
    };
    if (existing) {
      saveBill({ ...existing, ...fields });
      syncReminders();
      toast(t('review.saved'));
      return goBack();
    }
    saveBill(keepOriginals({ ...fields, id: newId(), createdAt: new Date().toISOString() }));
    toast(t('review.receiptSaved'));
    router.dismissTo('/');
  }

  /** The receipt is the payment confirmation of an open bill: mark the bill paid on that day, keep no extra entry. */
  async function payBillInstead(bill: Bill) {
    setSaving(true);
    await markPaid(bill, receiptPaidAt(d.issueDate, d.time));
    if (!billyCameo('paid', bill.payee)) toast(t('bill.markedPaid', { payee: bill.payee }));
    router.dismissTo('/');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: duplicate ? 190 : 130 }} keyboardShouldPersistTaps="handled">
        <View style={st.header}>
          <IconButton label={existing ? t('review.closeWithoutSaving') : t('review.retake')} onPress={() => (existing ? goBack() : openScan(true))}>
            <Icon name={existing ? 'close' : 'back'} />
          </IconButton>
          <T style={st.headerTitle}>{existing ? t(receipt ? 'review.titleEditReceipt' : 'review.titleEdit') : t('review.titleCheck')}</T>
          <View style={{ width: 44 }} />
        </View>

        {/* What it is: detected from the scan, one tap to correct. */}
        <View style={[st.segment, { marginTop: 14 }]} accessibilityRole="tablist" accessibilityLabel={t('kind.a11y')}>
          {(['bill', 'receipt'] as const).map((k) => {
            const on = (d.kind ?? 'bill') === k;
            return (
              <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setKind(k)} style={[st.segItem, { height: 36 }, on && st.chipOn]}>
                <T style={{ fontFamily: F.medium, fontSize: 13.5, color: on ? C.bg : C.muted }}>{t(`kind.${k}`)}</T>
              </Pressable>
            );
          })}
        </View>

        {initial.warning && (
          <View style={st.warning}>
            <T style={{ fontSize: 13, color: C.muted, lineHeight: 19 }}>{initial.warning}</T>
          </View>
        )}

        {paysBill && (
          <View style={st.paysBill}>
            <T style={{ fontSize: 13.5, color: C.muted, lineHeight: 19 }}>
              {t('review.paysBill', { payee: paysBill.payee, amount: formatMoney(paysBill.amountMinor, paysBill.currency) })}
            </T>
            <Button title={t('review.markBillPaid')} kind="secondary" style={{ marginTop: 6 }} onPress={() => payBillInstead(paysBill)} />
          </View>
        )}

        <View style={st.hero}>
          {d.imageUri ? (
            <Image source={{ uri: d.imageUri }} style={st.thumb} contentFit="cover" />
          ) : (
            <View style={[st.thumb, { backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }]}>
              {d.pdfUri && <T style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 0.8, color: C.paper, backgroundColor: C.accent, paddingHorizontal: 4, paddingVertical: 1 }}>PDF</T>}
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput value={d.payee} onChangeText={(v) => edit('payee', v, 'payee')} placeholder={t(receipt ? 'review.shopPlaceholder' : 'review.payeePlaceholder')} placeholderTextColor={C.dim} style={st.payee} accessibilityLabel={t('review.payee')} />
              <SourceTag source={d.sources.payee} />
            </View>
            <TextInput
              value={d.description ?? ''}
              onChangeText={(v) => edit('description', v || null)}
              placeholder={t(receipt ? 'review.boughtPlaceholder' : 'review.descriptionPlaceholder')}
              placeholderTextColor={C.barMuted}
              style={st.description}
              accessibilityLabel={t('review.description')}
            />
            {duplicate && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={st.dupDot} />
                <T style={{ fontSize: 12.5, color: C.muted }}>
                  {duplicate.status === 'paid' && duplicate.paidAt
                    ? t('dup.badgePaid', { date: shortDay(duplicate.paidAt.slice(0, 10)) })
                    : t('dup.badgeOpen', { date: shortDay(duplicate.createdAt.slice(0, 10)) })}
                </T>
              </View>
            )}
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

        {discount && !receipt && (
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

        {/* Beside a duplicate, the comparison is with a bill that's already saved. */}
        {change && !duplicate && <PriceChangeLine change={change} currency={d.currency} reviewBy={reviewBy} />}

        {d.dunning && !receipt && (
          <View style={st.discount}>
            <T style={{ fontFamily: F.monoMedium, fontSize: 13, color: C.accent }}>!</T>
            <View style={{ flex: 1, gap: 6 }}>
              <T style={{ fontSize: 13.5, lineHeight: 19, color: C.muted }}>
                <T style={{ fontSize: 13.5, color: C.fg }}>{t(`dun.level${d.dunning.level}`)}.</T>
                {d.dunning.feeMinor ? ` ${t('dun.fee', { fee: formatMoney(d.dunning.feeMinor, d.currency) })}` : ''}
              </T>
              {paidEarlier && (
                <T style={{ fontSize: 13, lineHeight: 18, color: C.fg }}>
                  {t('proof.alreadyPaid', { amount: formatMoney(paidEarlier.paidAmountMinor ?? paidEarlier.amountMinor, paidEarlier.currency), date: longDate(paidEarlier.paidAt!.slice(0, 10)) })}
                  {proofOf(paidEarlier) && (
                    <T style={{ fontSize: 13, color: C.accent, textDecorationLine: 'underline' }} onPress={() => showProof(paidEarlier)}>
                      {' '}{t('proof.show')}
                    </T>
                  )}
                </T>
              )}
              {chased && (
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !keepChased }} onPress={() => setKeepChased((k) => !k)} hitSlop={6}>
                  <T style={{ fontSize: 13, lineHeight: 18, color: keepChased ? C.dim : C.fg }}>
                    {keepChased
                      ? t('dun.keepBoth')
                      : t('dun.replaces', { amount: formatMoney(chased.amountMinor, chased.currency), date: chased.dueDate ? longDate(chased.dueDate) : '—' })}{' '}
                    <T style={{ fontSize: 13, color: C.accent, textDecorationLine: 'underline' }}>{keepChased ? t('dun.replaceIt') : t('dun.keepIt')}</T>
                  </T>
                </Pressable>
              )}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('dun.notReminder')} hitSlop={10} onPress={() => edit('dunning', null)}>
              <Icon name="close" color={C.dim} size={14} />
            </Pressable>
          </View>
        )}

        {receipt ? (
          <>
            <Pressable onPress={chooseDate} style={st.field} accessibilityRole="button" accessibilityLabel={t('review.changeDate')}>
              <T style={st.label}>{t('review.date')}</T>
              <T style={{ fontSize: 14 }}>{longDate(d.issueDate ?? todayIso())}{d.time ? ` · ${d.time}` : ''}</T>
            </Pressable>
            <Pressable onPress={chooseCategory} style={st.field} accessibilityRole="button" accessibilityLabel={t('review.changeCategory')}>
              <T style={st.label}>{t('review.category')}</T>
              <T style={{ fontSize: 14 }}>{categoryLabel(d.category)}</T>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Icon name="check" color={C.accent} />
              <T style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: C.muted }}>{t('review.receiptNote')}</T>
            </View>
          </>
        ) : (
        <>
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
        </>
        )}
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
        {duplicate ? (
          <>
            <T style={{ fontSize: 13.5, color: C.muted, textAlign: 'center', marginBottom: 12 }}>{t('dup.title')}</T>
            <Button
              title={t('dup.show')}
              onPress={() => {
                if (duplicate.amountMinor != null) recordKept({ kind: 'duplicate', minor: duplicate.amountMinor, currency: duplicate.currency });
                router.replace({ pathname: '/bill/[id]', params: { id: duplicate.id } });
              }}
            />
            <Pressable accessibilityRole="button" onPress={save} disabled={saving || !valid} hitSlop={6} style={{ alignSelf: 'center', paddingTop: 14, paddingBottom: 2 }}>
              <T style={{ fontSize: 13.5, color: C.muted, textDecorationLine: 'underline' }}>{t('dup.saveCopy')}</T>
            </Pressable>
          </>
        ) : (
          <Button title={existing ? t('review.saveChanges') : t(receipt ? 'review.saveReceipt' : 'review.saveBill')} onPress={save} loading={saving} disabled={!valid} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const st = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  headerTitle: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.3, color: C.muted },
  dupDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.dim },
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
  paysBill: { marginTop: 16, gap: 4, borderWidth: 1, borderColor: C.accent, padding: 14 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 16, backgroundColor: C.footer },
}));
