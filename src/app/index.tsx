import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { daysBetween, fromIso, relativeDays, shortDay, todayIso } from '@/lib/dates';
import { activeDiscount } from '@/lib/discount';
import { formatAmount } from '@/lib/money';
import { planAroundPayday } from '@/lib/plan';
import { CADENCE_LABEL, expectedBills, findSeries, type Series } from '@/lib/recurring';
import { seedSampleBills } from '@/lib/seed';
import { useSettings } from '@/lib/settings';
import { useBills } from '@/lib/store';
import { CATEGORY_LABEL, type Bill } from '@/lib/types';
import { Amount, Button, Eyebrow, Icon, IconButton, T } from '@/ui/kit';
import { C, F, GUTTER } from '@/ui/theme';

const HORIZON = 30;

/** The currency most open bills are in; totals are shown in it and other currencies are counted separately. */
function mainCurrency(bills: Bill[]): string {
  const n = new Map<string, number>();
  bills.forEach((b) => n.set(b.currency, (n.get(b.currency) ?? 0) + 1));
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'CHF';
}

export default function Bills() {
  const insets = useSafeAreaInsets();
  const bills = useBills();
  const [tab, setTab] = useState<'open' | 'paid'>('open');
  const today = todayIso();
  const settings = useSettings();

  const open = useMemo(() => bills.filter((b) => b.status === 'open'), [bills]);
  const paid = useMemo(() => bills.filter((b) => b.status === 'paid').sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? '')), [bills]);
  const ccy = mainCurrency(open);
  const window = open.filter((b) => b.dueDate && daysBetween(today, b.dueDate) <= HORIZON);
  const total = window.filter((b) => b.currency === ccy).reduce((sum, b) => sum + (activeDiscount(b, today)?.payMinor ?? b.amountMinor ?? 0), 0);
  const otherCcy = window.some((b) => b.currency !== ccy);
  const next = open.find((b) => b.dueDate && daysBetween(today, b.dueDate) >= 0);
  const plan = settings.payday && open.length ? planAroundPayday(open, settings.payday, ccy, today) : null;
  const expected = expectedBills(findSeries(bills, today), today);

  const groups: { title: string; items: Bill[] }[] =
    tab === 'paid'
      ? [{ title: 'Paid', items: paid }]
      : [
          { title: 'Overdue', items: open.filter((b) => b.dueDate && daysBetween(today, b.dueDate) < 0) },
          { title: 'This week', items: open.filter((b) => b.dueDate && daysBetween(today, b.dueDate) >= 0 && daysBetween(today, b.dueDate) < 7) },
          { title: 'Later', items: open.filter((b) => b.dueDate && daysBetween(today, b.dueDate) >= 7) },
          { title: 'No due date', items: open.filter((b) => !b.dueDate) },
        ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: 140 }}>
        <View style={st.header}>
          {/* Long-press the logo in development to load sample bills. */}
          <Pressable onLongPress={__DEV__ ? seedSampleBills : undefined} style={st.logo} accessibilityRole="header">
            <T style={st.logoText}>due</T>
            <View style={st.logoDot} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton label="Stats" onPress={() => router.push('/stats')}>
              <Icon name="stats" color={C.muted} />
            </IconButton>
            <IconButton label="Settings" onPress={() => router.push('/settings')}>
              <Icon name="settings" color={C.muted} />
            </IconButton>
          </View>
        </View>

        <View style={{ marginTop: 22 }}>
          <Eyebrow>Next {HORIZON} days</Eyebrow>
          <View style={{ marginTop: 8 }}>
            <Amount currency={ccy} value={formatAmount(total, ccy)} />
          </View>
          <T style={st.sub}>
            {open.length === 0
              ? 'Nothing to pay. Scan a bill when one arrives.'
              : `${open.length} ${open.length === 1 ? 'bill' : 'bills'} open${next?.dueDate ? ` · next due ${shortDay(next.dueDate)}` : ''}${otherCcy ? ' · plus other currencies' : ''}`}
          </T>
        </View>

        {plan ? (
          <View style={st.plan}>
            <View style={st.planCol}>
              <Eyebrow>Before payday</Eyebrow>
              <T style={st.planAmount}>{formatAmount(plan.beforeMinor, ccy)}</T>
              <T style={st.planSub}>{plan.before.length ? `${plan.before.length} ${plan.before.length === 1 ? 'bill' : 'bills'} from what’s in the account` : 'Nothing until payday'}</T>
            </View>
            <View style={[st.planCol, st.planRight]}>
              <Eyebrow>After · {shortDay(plan.payday).toUpperCase()}</Eyebrow>
              <T style={st.planAmount}>{formatAmount(plan.afterMinor, ccy)}</T>
              <T style={st.planSub}>{plan.after.length} {plan.after.length === 1 ? 'bill waits' : 'bills wait'} for your salary</T>
            </View>
          </View>
        ) : (
          open.length > 0 &&
          !settings.payday && (
            <Pressable accessibilityRole="link" onPress={() => router.push('/settings')} style={{ marginTop: 14, alignSelf: 'flex-start', paddingVertical: 6 }}>
              <T style={{ fontSize: 13.5, color: C.muted }}>Set your payday to plan around it →</T>
            </Pressable>
          )
        )}

        <Runway bills={window} today={today} ccy={ccy} payday={plan?.payday ?? null} expected={expected} />

        <View style={st.tabs}>
          {(['open', 'paid'] as const).map((k) => {
            const on = tab === k;
            return (
              <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setTab(k)} style={[st.tab, on && st.tabOn]}>
                <View style={st.tabInner}>
                  <T style={[st.tabText, { color: on ? C.fg : C.dim }]}>{k === 'open' ? 'Upcoming' : 'Paid'}</T>
                  <T style={[st.tabCount, on && { color: C.muted }]}>{k === 'open' ? open.length : paid.length}</T>
                </View>
              </Pressable>
            );
          })}
        </View>

        {tab === 'open' && expected.length > 0 && (
          <View>
            <Eyebrow style={{ marginTop: 28, marginBottom: 4 }}>Expected</Eyebrow>
            {expected.map((s) => (
              <ExpectedRow key={s.key} series={s} />
            ))}
          </View>
        )}

        {groups
          .filter((g) => g.items.length)
          .map((g) => (
            <View key={g.title}>
              <Eyebrow style={{ marginTop: 28, marginBottom: 4 }}>{g.title}</Eyebrow>
              {g.items.map((b) => (
                <BillRow key={b.id} bill={b} today={today} />
              ))}
            </View>
          ))}
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Link href="/scan" asChild>
          <Button title="Scan a bill" icon={<Icon name="scan" color={C.bg} size={20} />} />
        </Link>
      </View>
    </View>
  );
}

function BillRow({ bill, today }: { bill: Bill; today: string }) {
  const days = bill.dueDate ? daysBetween(today, bill.dueDate) : null;
  const urgent = bill.status === 'open' && days != null && days <= 3;
  const discount = activeDiscount(bill, today);
  const sub = discount
    ? `${discount.percent}% off until ${shortDay(discount.until)}`
    : [bill.description ?? CATEGORY_LABEL[bill.category], bill.dueDate && shortDay(bill.dueDate)].filter(Boolean).join(' · ');
  return (
    <Link href={{ pathname: '/bill/[id]', params: { id: bill.id } }} asChild>
      <Pressable style={({ pressed }) => [st.row, pressed && { opacity: 0.6 }]}>
        <View style={st.mono}>
          <T style={st.monoText}>{bill.payee.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}</T>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <T style={st.rowTitle} numberOfLines={1}>{bill.payee}</T>
          <T style={[st.rowSub, discount && { color: C.accent }]} numberOfLines={1}>{sub}</T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          <T style={st.rowAmount}>
            {bill.currency !== 'CHF' ? `${bill.currency} ` : ''}
            {formatAmount(discount?.payMinor ?? (bill.status === 'paid' ? bill.paidAmountMinor : null) ?? bill.amountMinor, bill.currency)}
          </T>
          <T style={[st.rowDays, { color: urgent ? C.accent : C.dim }]}>
            {bill.status === 'paid' ? 'PAID' : bill.dueDate ? relativeDays(bill.dueDate, today) : '—'}
          </T>
        </View>
      </Pressable>
    </Link>
  );
}

/** A bill that should come soon (or should have come) from a biller who bills regularly. */
function ExpectedRow({ series: s }: { series: Series }) {
  const when = s.late ? `Should have arrived by ${shortDay(s.expectedArrival)}` : `${CADENCE_LABEL[s.cadence]} · due around ${shortDay(s.nextDue)}`;
  return (
    <View style={st.row} accessibilityLabel={`${s.payee}, expected: ${when}`}>
      <View style={[st.mono, { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: C.barMuted }]}>
        <T style={[st.monoText, { color: C.dim }]}>{s.payee.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <T style={[st.rowTitle, { color: C.muted }]} numberOfLines={1}>{s.payee}</T>
        <T style={[st.rowSub, s.late && { color: C.accent }]} numberOfLines={1}>{when}</T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <T style={[st.rowAmount, { color: C.muted }]}>≈ {formatAmount(s.amountMinor, s.currency)}</T>
        <T style={[st.rowDays, { color: s.late ? C.accent : C.dim }]}>{s.late ? 'NOT ARRIVED' : 'EXPECTED'}</T>
      </View>
    </View>
  );
}

/** A 30-day strip: one bar per bill at its due date, height by amount. Shows at a glance how bills are spread out. */
function Runway({ bills, today, ccy, payday, expected }: { bills: Bill[]; today: string; ccy: string; payday: string | null; expected: Series[] }) {
  const paydayAt = payday ? daysBetween(today, payday) : null;
  const max = Math.max(1, ...bills.map((b) => b.amountMinor ?? 0));
  const end = fromIso(today);
  end.setDate(end.getDate() + HORIZON);
  const mid = fromIso(today);
  mid.setDate(mid.getDate() + HORIZON / 2);
  return (
    <View style={st.runway} accessibilityLabel={`Due dates over the next ${HORIZON} days`}>
      <View style={{ height: 64 }}>
        <View style={st.ticks}>
          {Array.from({ length: HORIZON + 1 }, (_, i) => (
            <View key={i} style={{ width: 1, height: i % 7 === 0 ? 8 : 4, backgroundColor: i % 7 === 0 ? C.barMuted : '#2a2a2a' }} />
          ))}
        </View>
        <View style={[st.bar, { left: 0, width: 6, height: 6, marginLeft: 0, backgroundColor: C.accent }]} />
        {paydayAt != null && paydayAt <= HORIZON && (
          <View style={[st.payday, { left: `${(paydayAt / HORIZON) * 100}%` }]} accessibilityLabel="Payday">
            <T style={st.paydayLabel}>PAY</T>
          </View>
        )}
        {expected
          .filter((s) => !s.late && daysBetween(today, s.nextDue) <= HORIZON)
          .map((s) => (
            <View
              key={'x' + s.key}
              style={[st.bar, { left: `${(daysBetween(today, s.nextDue) / HORIZON) * 100}%`, height: s.currency === ccy ? Math.max(8, (s.amountMinor / max) * 48) : 8, borderWidth: 1, borderColor: C.barMuted }]}
            />
          ))}
        {bills.map((b) => {
          const d = Math.max(0, daysBetween(today, b.dueDate!));
          const h = b.currency === ccy && b.amountMinor ? Math.max(8, (b.amountMinor / max) * 48) : 8;
          return <View key={b.id} style={[st.bar, { left: `${(d / HORIZON) * 100}%`, height: h, backgroundColor: d <= 7 ? C.accent : C.fg }]} />;
        })}
      </View>
      <View style={st.runwayLabels}>
        <T style={[st.runwayLabel, { color: C.fg }]}>TODAY</T>
        <T style={st.runwayLabel}>{mid.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase()}</T>
        <T style={st.runwayLabel}>{end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase()}</T>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48 },
  logo: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  logoText: { fontFamily: F.semibold, fontSize: 26, letterSpacing: -0.8, lineHeight: 28 },
  logoDot: { width: 7, height: 7, backgroundColor: C.accent, marginBottom: 6 },
  sub: { marginTop: 10, fontSize: 14, color: C.muted },
  runway: { marginTop: 26, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, paddingTop: 16, paddingBottom: 10 },
  ticks: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  plan: { marginTop: 22, flexDirection: 'row', borderTopWidth: 1, borderColor: C.line, paddingTop: 16 },
  planCol: { flex: 1, gap: 6 },
  planRight: { borderLeftWidth: 1, borderLeftColor: C.line, paddingLeft: 16 },
  planAmount: { fontFamily: F.semibold, fontSize: 20, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  planSub: { fontSize: 12.5, lineHeight: 17, color: C.dim, paddingRight: 8 },
  payday: { position: 'absolute', top: -6, bottom: 0, width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: C.muted },
  paydayLabel: { position: 'absolute', top: -6, left: 4, fontFamily: F.mono, fontSize: 9, letterSpacing: 0.6, color: C.muted },
  bar: { position: 'absolute', bottom: 14, width: 7, marginLeft: -3 },
  runwayLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  runwayLabel: { fontFamily: F.mono, fontSize: 10.5, color: C.dim, letterSpacing: 0.4 },
  tabs: { flexDirection: 'row', gap: 22, marginTop: 20 },
  tab: { paddingBottom: 8, minHeight: 32, justifyContent: 'flex-end' },
  tabOn: { borderBottomWidth: 1.5, borderBottomColor: C.fg },
  tabInner: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  tabText: { fontFamily: F.medium, fontSize: 14 },
  tabCount: { fontFamily: F.mono, fontSize: 11, color: C.dim },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  mono: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  monoText: { fontFamily: F.semibold, fontSize: 12 },
  rowTitle: { fontFamily: F.medium, fontSize: 15.5, lineHeight: 20 },
  rowSub: { fontSize: 13, lineHeight: 17, color: C.dim },
  rowAmount: { fontFamily: F.medium, fontSize: 15.5, fontVariant: ['tabular-nums'] },
  rowDays: { fontFamily: F.mono, fontSize: 11 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 16, backgroundColor: 'rgba(10,10,10,0.94)' },
});
