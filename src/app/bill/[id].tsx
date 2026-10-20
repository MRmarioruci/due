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
import { C, F, GUTTER } from '@/ui/theme';

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
        await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: `Pay ${bill!.payee}` });
      } catch (e) {
        toast(`Couldn’t share the QR code: ${(e as Error).message}`);
      }
    });
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
        { label: 'Edit details', kind: 'secondary', onPress: () => router.push({ pathname: '/review', params: { id: b.id } }) },
        {
          label: 'Delete bill',
          kind: 'secondary',
          onPress: async () => {
            const sure = await sheet.confirm({ title: `Delete ${b.payee}?`, message: 'Its reminders are cancelled too. This can’t be undone.', confirm: 'Delete', destructive: true });
            if (!sure) return;
            await markPaid(b); // cancels its notifications
            deleteBill(b.id);
            toast('Bill deleted');
            goBack();
          },
        },
      ],
    });
  }

  const rows: { label: string; value: string; mono?: boolean }[] = [
    bill.payment.iban && { label: 'IBAN', value: groupIban(bill.payment.iban), mono: true },
    bill.payment.reference && { label: 'Reference', value: bill.payment.reference, mono: true },
    bill.payment.accountNumber && { label: 'Account no.', value: bill.payment.accountNumber, mono: true },
    bill.payment.message && { label: 'Message', value: bill.payment.message },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: 130 }}>
        <View style={st.header}>
          <IconButton label="Back to bills" onPress={() => goBack()}>
            <Icon name="back" />
          </IconButton>
          <T style={st.headerTitle} numberOfLines={1}>{bill.payee}</T>
          <IconButton label="More" onPress={more}>
            <Icon name="more" />
          </IconButton>
        </View>

        <View style={{ marginTop: 22 }}>
          <Amount currency={bill.currency} value={formatAmount(discount?.payMinor ?? bill.paidAmountMinor ?? bill.amountMinor, bill.currency)} size={48} />
          <T style={st.sub}>
            {paid
              ? `Paid ${new Date(bill.paidAt!).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
              : bill.dueDate
                ? `Due ${shortDay(bill.dueDate)} · ${days! < 0 ? `${-days!} days late` : days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'} left`}`
                : 'No due date'}
          </T>
        </View>

        {discount && (
          <Animated.View entering={enterFade(80)} style={st.discount}>
            <T style={st.discountBadge}>−{discount.percent}%</T>
            <T style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: C.muted }}>
              <T style={{ fontSize: 13.5, color: C.fg }}>Pay by {shortDay(discount.until)} and save {formatMoney(discount.savingMinor, bill.currency)}.</T>{' '}
              Full amount {formatAmount(bill.amountMinor, bill.currency)} after that.{code ? ' The QR code already has the discount.' : ''}
            </T>
          </Animated.View>
        )}
        {paid && bill.paidAmountMinor != null && bill.amountMinor != null && bill.paidAmountMinor < bill.amountMinor && (
          <T style={{ marginTop: 10, fontSize: 13.5, color: C.muted }}>Saved {formatMoney(bill.amountMinor - bill.paidAmountMinor, bill.currency)} with the early-payment discount.</T>
        )}

        {!paid && bill.dueDate && <Timeline bill={bill} today={today} />}
        {advice && <T style={{ marginTop: 16, fontSize: 13.5, lineHeight: 19, color: C.muted }}>{advice}</T>}

        {code ? (
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
            <Eyebrow>Scan with your banking app</Eyebrow>
            {!paid && (
              <Pressable accessibilityRole="button" onPress={shareQr} style={st.shareBtn}>
                <Icon name="share" size={16} />
                <T style={{ fontFamily: F.medium, fontSize: 14 }}>Share QR to your bank app</T>
              </Pressable>
            )}
          </Animated.View>
        ) : (
          bill.payment.payUrl && (
            <Button title="Open payment page" kind="secondary" style={{ marginTop: 24 }} onPress={() => { armPayCheck(bill.id); Linking.openURL(bill.payment.payUrl!); }} />
          )
        )}

        {bill.payMethod === 'direct_debit' && (
          <T style={{ marginTop: 18, color: C.muted, fontSize: 13.5, lineHeight: 20 }}>This one is debited automatically. Just make sure the money is in the account by the due date.</T>
        )}

        <View style={{ marginTop: 18, borderTopWidth: rows.length ? 1 : 0, borderTopColor: C.line }}>
          {rows.map((r) => (
            <View key={r.label} style={st.row}>
              <T style={st.rowLabel}>{r.label}</T>
              <T style={[st.rowValue, r.mono && { fontFamily: F.mono, fontSize: 12 }]} selectable>{r.value}</T>
              <Pressable accessibilityRole="button" accessibilityLabel={`Copy ${r.label}`} onPress={() => copy(r.label, r.value)} style={st.copy}>
                <Icon name={copied === r.label ? 'check' : 'copy'} color={copied === r.label ? C.accent : C.muted} size={16} />
              </Pressable>
            </View>
          ))}
          {bill.dueDate && (
            <View style={st.row}>
              <T style={st.rowLabel}>Due</T>
              <T style={st.rowValue}>{longDate(bill.dueDate)}</T>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
        {paid ? (
          <Button title="Mark as unpaid" kind="secondary" style={{ flex: 1 }} onPress={() => markOpen(bill)} />
        ) : (
          <>
            <Button
              title="Snooze"
              kind="secondary"
              style={{ flex: 1 }}
              onPress={async () => {
                await snooze(bill);
                Haptics.selectionAsync();
                toast(`Snoozed until tomorrow, ${formatHour(getSettings().remindHour)}`);
              }}
            />
            <Button
              title="Mark as paid"
              style={{ flex: 2 }}
              onPress={async () => {
                await markPaid(bill);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toast(`${bill.payee} marked paid`);
                goBack();
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}

/** Received → today → reminder → due, on one line. */
function Timeline({ bill, today }: { bill: Bill; today: string }) {
  const start = bill.issueDate ?? bill.createdAt.slice(0, 10);
  const span = Math.max(1, daysBetween(start, bill.dueDate!));
  const pos = (iso: string) => `${Math.min(100, Math.max(0, (daysBetween(start, iso) / span) * 100))}%` as const;
  const remind = bill.remindAt ? bill.remindAt.slice(0, 10) : null;
  const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();
  return (
    <View style={{ marginTop: 22 }} accessibilityLabel="Timeline from bill date to due date">
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
        <T style={[st.tl, { color: C.fg }]}>TODAY</T>
        <T style={st.tl}>{fmt(bill.dueDate!)}</T>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, gap: 12 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.semibold, fontSize: 15 },
  sub: { marginTop: 10, fontSize: 14, color: C.muted },
  discount: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: C.accent },
  discountBadge: { fontFamily: F.monoMedium, fontSize: 13, color: C.accent },
  line: { position: 'absolute', top: 10, height: 1 },
  tl: { fontFamily: F.mono, fontSize: 10, color: C.dim, letterSpacing: 0.4 },
  qrWrap: { marginTop: 24, alignItems: 'center', gap: 12 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  rowLabel: { width: 84, fontSize: 13, color: C.dim },
  rowValue: { flex: 1, fontSize: 14 },
  copy: { width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, paddingHorizontal: GUTTER, paddingTop: 16, backgroundColor: 'rgba(10,10,10,0.94)' },
});
