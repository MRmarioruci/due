import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { daysBetween, formatHour, longDate, shortDay, todayIso } from '@/lib/dates';
import { activeDiscount, withSwissAmount } from '@/lib/discount';
import { formatAmount, formatMoney } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { locale, t } from '@/i18n/core';
import { exportBillPdf } from '@/lib/bill-pdf';
import { armPayCheck } from '@/lib/pay-check';
import { buildEpc, buildSwissQr } from '@/lib/payment-codes';
import { paydayAdvice } from '@/lib/plan';
import { markOpen, markPaid, snooze } from '@/lib/reminders';
import { getSettings, useSettings } from '@/lib/settings';
import { deleteBill, useBill } from '@/lib/store';
import type { Bill } from '@/lib/types';
import { Amount, Button, Eyebrow, Icon, IconButton, Loading, T } from '@/ui/kit';
import { Animated, enterFade } from '@/ui/motion';
import { sheet, toast } from '@/ui/overlay';
import { C, F, GUTTER, themed } from '@/ui/theme';

/** due's mark in the middle of the payment code (the code's error correction leaves room for it). */
const CENTER_MARK = '<svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="30" fill="#fff"/><rect x="3" y="3" width="24" height="24" fill="#0a0a0a"/><rect x="16.5" y="16.5" width="6" height="6" fill="#FF5A36"/></svg>';

/** The code a banking app can scan: the original QR-bill / GiroCode, or one built from the printed details. */
function payableCode(b: Bill): { value: string; swiss: boolean } | null {
  const discount = activeDiscount(b);
  if (b.payment.raw && b.payment.standard === 'swiss_qr') return { value: discount ? withSwissAmount(b.payment.raw, discount.payMinor) : b.payment.raw, swiss: true };
  if (b.payment.raw) return { value: b.payment.raw, swiss: false };
  if (discount) b = { ...b, amountMinor: discount.payMinor };
  if (b.payment.iban && /^(CH|LI)/i.test(b.payment.iban)) {
    const qr = buildSwissQr({ iban: b.payment.iban, name: b.payment.creditorName ?? b.payee, address: b.payment.creditorAddress, amountMinor: b.amountMinor, currency: b.currency, reference: b.payment.reference, message: b.payment.message });
    if (qr) return { value: qr, swiss: true };
  }
  if (b.payment.iban && b.currency === 'EUR') {
    const epc = buildEpc({ name: b.payment.creditorName ?? b.payee, iban: b.payment.iban, bic: b.payment.bic, amountMinor: b.amountMinor, currency: b.currency, reference: b.payment.reference });
    if (epc) return { value: epc, swiss: false };
  }
  return null;
}

const groupIban = (iban: string) => iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();

export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useBill(id);
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const qrRef = useRef<{ toDataURL: (cb: (base64: string) => void) => void } | null>(null);

  if (!bill) return <Loading />;

  const today = todayIso();
  const days = bill.dueDate ? daysBetween(today, bill.dueDate) : null;
  const code = payableCode(bill);
  const discount = activeDiscount(bill, today);
  const advice = settings.pay && settings.pay.every !== 'day' ? paydayAdvice(bill, settings.pay, today) : null;
  const paid = bill.status === 'paid';

  /** Most Swiss banking apps can read a QR code from an image, so share it as a PNG. */
  function shareQr() {
    qrRef.current?.toDataURL(async (base64) => {
      try {
        const file = new File(Paths.cache, `due-${bill!.id}.png`);
        file.create({ overwrite: true });
        file.write(base64, { encoding: 'base64' });
        armPayCheck(bill!.id);
        await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: t('bill.shareTitle', { payee: bill!.payee }) });
      } catch (e) {
        toast(t('bill.shareFailed', { error: (e as Error).message }));
      }
    });
  }

  /** The QR as a PNG for the PDF, when the bill has one on screen. */
  const qrPng = () => new Promise<string | null>((resolve) => (qrRef.current ? qrRef.current.toDataURL((b) => resolve(b)) : resolve(null)));
  async function downloadPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await exportBillPdf(bill!, code ? await qrPng() : null);
    } catch (e) {
      toast(t('pdf.failed', { error: (e as Error).message }));
    } finally {
      setPdfBusy(false);
    }
  }

  async function copy(label: string, value: string) {
    await Clipboard.setStringAsync(value.replace(/\s/g, label === 'IBAN' ? '' : ' '));
    armPayCheck(bill!.id);
    Haptics.selectionAsync();
    setCopied(label);
    setTimeout(() => setCopied(null), 1400);
  }

  function more() {
    const b = bill!;
    sheet.show({
      title: b.payee,
      actions: [
        { label: t('bill.edit'), kind: 'secondary', onPress: () => router.push({ pathname: '/review', params: { id: b.id } }) },
        { label: t('pdf.download'), kind: 'secondary', onPress: downloadPdf },
        {
          label: t('bill.delete'),
          kind: 'secondary',
          onPress: async () => {
            const sure = await sheet.confirm({ title: t('bill.deleteTitle', { payee: b.payee }), message: t('bill.deleteText'), confirm: t('bill.deleteConfirm'), destructive: true });
            if (!sure) return;
            await markPaid(b); // cancels its notifications
            deleteBill(b.id);
            toast(t('bill.deleted'));
            goBack();
          },
        },
      ],
    });
  }

  const rows: { label: string; value: string; mono?: boolean }[] = [
    bill.payment.iban && { label: 'IBAN', value: groupIban(bill.payment.iban), mono: true },
    bill.payment.reference && { label: t('review.reference'), value: bill.payment.reference, mono: true },
    bill.payment.accountNumber && { label: t('bill.accountNo'), value: bill.payment.accountNumber, mono: true },
    bill.payment.message && { label: t('bill.message'), value: bill.payment.message },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: 130 }}>
        <View style={st.header}>
          <IconButton label={t('common.backToBills')} onPress={() => goBack()}>
            <Icon name="back" />
          </IconButton>
          <T style={st.headerTitle} numberOfLines={1}>{bill.payee}</T>
          <IconButton label={t('common.more')} onPress={more}>
            <Icon name="more" />
          </IconButton>
        </View>

        <View style={{ marginTop: 22 }}>
          <Amount currency={bill.currency} value={formatAmount(discount?.payMinor ?? bill.paidAmountMinor ?? bill.amountMinor, bill.currency)} size={48} />
          <T style={st.sub}>
            {paid
              ? t('bill.paidOn', { date: new Date(bill.paidAt!).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) })
              : bill.dueDate
                ? `${t('bill.dueOn', { date: shortDay(bill.dueDate) })} · ${days! < 0 ? t('bill.daysLate', { n: -days! }) : days === 0 ? t('bill.today') : t('bill.daysLeft', { n: days! })}`
                : t('home.noDueDate')}
          </T>
        </View>

        {discount && (
          <Animated.View entering={enterFade(80)} style={st.discount}>
            <T style={st.discountBadge}>−{discount.percent}%</T>
            <T style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: C.muted }}>
              <T style={{ fontSize: 13.5, color: C.fg }}>{t('bill.discountHead', { date: shortDay(discount.until), saving: formatMoney(discount.savingMinor, bill.currency) })}</T>{' '}
              {t('bill.discountAfter', { amount: formatAmount(bill.amountMinor, bill.currency) })}
              {code ? ` ${t('bill.discountInQr')}` : ''}
            </T>
          </Animated.View>
        )}
        {paid && bill.paidAmountMinor != null && bill.amountMinor != null && bill.paidAmountMinor < bill.amountMinor && (
          <T style={{ marginTop: 10, fontSize: 13.5, color: C.muted }}>{t('bill.savedWithDiscount', { saving: formatMoney(bill.amountMinor - bill.paidAmountMinor, bill.currency) })}</T>
        )}

        {!paid && bill.dueDate && <Timeline bill={bill} today={today} />}
        {advice && <T style={{ marginTop: 16, fontSize: 13.5, lineHeight: 19, color: C.muted }}>{advice}</T>}

        {code && (
          <Animated.View entering={enterFade(180)} style={st.qrWrap}>
            <QRCode
              value={code.value}
              size={232}
              ecl="M"
              quietZone={16}
              backgroundColor="#fff"
              color="#000"
              logoSVG={CENTER_MARK}
              logoSize={32}
              logoBackgroundColor="transparent"
              logoMargin={0}
              getRef={(r) => (qrRef.current = r)}
            />
            <Eyebrow>{t('bill.scanWithBank')}</Eyebrow>
          </Animated.View>
        )}

        {/* Every action for the bill, in one row of equal tiles. */}
        <Animated.View entering={enterFade(240)} style={st.actions}>
          {code && !paid && <ActionTile icon="share" label={t('bill.shareQrShort')} onPress={shareQr} />}
          {bill.payment.payUrl && (
            <ActionTile
              icon="link"
              label={t('bill.payOnline')}
              onPress={() => {
                armPayCheck(bill.id);
                Linking.openURL(bill.payment.payUrl!);
              }}
            />
          )}
          <ActionTile icon="download" label={pdfBusy ? t('pdf.making') : t('pdf.short')} onPress={downloadPdf} busy={pdfBusy} />
        </Animated.View>

        {bill.payMethod === 'direct_debit' && (
          <T style={{ marginTop: 18, color: C.muted, fontSize: 13.5, lineHeight: 20 }}>{t('bill.directDebit')}</T>
        )}

        <Eyebrow style={{ marginTop: 28, marginBottom: 6 }}>{t('bill.details')}</Eyebrow>
        <View style={{ borderTopWidth: 1, borderTopColor: C.line }}>
          {rows.map((r) => (
            <View key={r.label} style={st.row}>
              <T style={st.rowLabel}>{r.label}</T>
              <T style={[st.rowValue, r.mono && { fontFamily: F.mono, fontSize: 12 }]} selectable>{r.value}</T>
              <Pressable accessibilityRole="button" accessibilityLabel={t('bill.copy', { label: r.label })} onPress={() => copy(r.label, r.value)} style={st.copy}>
                <Icon name={copied === r.label ? 'check' : 'copy'} color={copied === r.label ? C.accent : C.muted} size={16} />
              </Pressable>
            </View>
          ))}
          {bill.dueDate && (
            <View style={st.row}>
              <T style={st.rowLabel}>{t('review.due')}</T>
              <T style={st.rowValue}>{longDate(bill.dueDate)}</T>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
        {paid ? (
          <Button title={t('bill.markUnpaid')} kind="secondary" style={{ flex: 1 }} onPress={() => markOpen(bill)} />
        ) : (
          <>
            <Button
              title={t('bill.snooze')}
              kind="secondary"
              style={{ flex: 1 }}
              onPress={async () => {
                await snooze(bill);
                Haptics.selectionAsync();
                toast(t('bill.snoozed', { time: formatHour(getSettings().remindHour) }));
              }}
            />
            <Button
              title={t('bill.markPaid')}
              style={{ flex: 2 }}
              onPress={async () => {
                await markPaid(bill);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toast(t('bill.markedPaid', { payee: bill.payee }));
                goBack();
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}

/** One action for the bill: icon over a short label, all the same size. */
function ActionTile({ icon, label, onPress, busy }: { icon: 'share' | 'link' | 'download'; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy} style={({ pressed }) => [st.tile, (pressed || busy) && { backgroundColor: C.surface }]}>
      <Icon name={icon} size={18} />
      <T style={st.tileLabel} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

/** Received → today → reminder → due, on one line. */
function Timeline({ bill, today }: { bill: Bill; today: string }) {
  const start = bill.issueDate ?? bill.createdAt.slice(0, 10);
  const span = Math.max(1, daysBetween(start, bill.dueDate!));
  const pos = (iso: string) => `${Math.min(100, Math.max(0, (daysBetween(start, iso) / span) * 100))}%` as const;
  const remind = bill.remindAt ? bill.remindAt.slice(0, 10) : null;
  const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' }).toUpperCase();
  return (
    <View style={{ marginTop: 22 }} accessibilityLabel={t('bill.timeline')}>
      <View style={{ height: 22 }}>
        <View style={[st.line, { left: 0, right: 0, backgroundColor: C.border }]} />
        <View style={[st.line, { left: 0, width: pos(today), backgroundColor: C.fg }]} />
        <View style={{ position: 'absolute', left: 0, top: 7, width: 7, height: 7, backgroundColor: C.fg }} />
        <View style={{ position: 'absolute', left: pos(today), top: 3, width: 2, height: 15, marginLeft: -1, backgroundColor: C.fg }} />
        {remind && (
          <View style={{ position: 'absolute', left: pos(remind), top: 3, marginLeft: -8, backgroundColor: C.bg, width: 16, alignItems: 'center' }}>
            <Icon name="bell" color={C.accent} size={14} />
          </View>
        )}
        <View style={{ position: 'absolute', right: 0, top: 6, width: 9, height: 9, borderWidth: 1.5, borderColor: C.fg }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <T style={st.tl}>{fmt(start)}</T>
        <T style={[st.tl, { color: C.fg }]}>{t('common.todayCaps')}</T>
        <T style={st.tl}>{fmt(bill.dueDate!)}</T>
      </View>
    </View>
  );
}

const st = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, gap: 12 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.semibold, fontSize: 15 },
  sub: { marginTop: 10, fontSize: 14, color: C.muted },
  discount: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: C.accent },
  discountBadge: { fontFamily: F.monoMedium, fontSize: 13, color: C.accent },
  line: { position: 'absolute', top: 10, height: 1 },
  tl: { fontFamily: F.mono, fontSize: 10, color: C.dim, letterSpacing: 0.4 },
  qrWrap: { marginTop: 24, alignItems: 'center', gap: 12 },
  actions: { marginTop: 20, flexDirection: 'row', gap: 8 },
  tile: { flex: 1, height: 68, alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: C.border },
  tileLabel: { fontFamily: F.medium, fontSize: 12.5, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  rowLabel: { width: 84, fontSize: 13, color: C.dim },
  rowValue: { flex: 1, fontSize: 14 },
  copy: { width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, paddingHorizontal: GUTTER, paddingTop: 16, backgroundColor: C.footer },
}));
