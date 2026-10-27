import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { daysBetween, fromIso, relativeDays, shortDay, todayIso } from '@/lib/dates';
import { activeDiscount } from '@/lib/discount';
import { formatAmount } from '@/lib/money';
import { planAroundPayday } from '@/lib/plan';
import { dueForReview } from '@/lib/contracts';
import { expectedBills, findSeries, type Series } from '@/lib/recurring';
import { latestBillOf } from '@/lib/reminders';
import { cadenceLabel, categoryLabel } from '@/i18n/labels';
import { locale, t } from '@/i18n/core';
import { getSettings, homeCurrency, updateSettings, useSettings } from '@/lib/settings';
import { Options } from '@/ui/choosers';
import { sheet } from '@/ui/overlay';
import { useBills } from '@/lib/store';
import { CATEGORIES, type Bill, type Category } from '@/lib/types';
import { Amount, Eyebrow, Icon, IconButton, T } from '@/ui/kit';
import { NAV_SPACE } from '@/ui/nav-bar';
import { Animated, enterFade, enterRow, GrowBar, moveRow, useCountUp } from '@/ui/motion';
import { C, F, GUTTER, themed } from '@/ui/theme';

const HORIZON = 30;

type Filter = { category: Category | null; year: number | null };

/** The year a bill belongs to in the list: its due date, else when it was paid or saved. */
const yearOf = (b: Bill) => Number((b.dueDate ?? b.paidAt ?? b.createdAt).slice(0, 4));

/** Every word typed must appear in the payee, description, category, reference, IBAN or amount. */
function matches(b: Bill, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const amount = b.amountMinor != null ? `${(b.amountMinor / 100).toFixed(2)} ${formatAmount(b.amountMinor, b.currency)}` : '';
  const hay = [b.payee, b.description, categoryLabel(b.category), b.payment.reference, b.payment.iban?.replace(/\s/g, ''), amount, b.currency].join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** The currency most open bills are in; totals are shown in it and other currencies are counted separately. */
function mainCurrency(bills: Bill[]): string {
  const n = new Map<string, number>();
  bills.forEach((b) => n.set(b.currency, (n.get(b.currency) ?? 0) + 1));
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? homeCurrency();
}

/** Every bill: the totals, payday plan and runway, then the list with search, filters and sort. Home links here. */
export default function Bills() {
  const insets = useSafeAreaInsets();
  const bills = useBills();
  const [tab, setTab] = useState<'open' | 'paid'>('open');
  const today = todayIso();
  const settings = useSettings();

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>({ category: null, year: null });
  const narrowed = searching && !!query.trim() ? true : filter.category != null || filter.year != null;

  const open = useMemo(() => bills.filter((b) => b.status === 'open'), [bills]);
  const paid = useMemo(() => bills.filter((b) => b.status === 'paid').sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? '')), [bills]);
  // Search and filters narrow the lists; the totals above stay for everything.
  const keep = (b: Bill) => (!filter.category || b.category === filter.category) && (!filter.year || yearOf(b) === filter.year) && (!searching || matches(b, query));
  const openShown = open.filter(keep);
  const paidShown = paid.filter(keep);
  const ccy = mainCurrency(open);
  const window = open.filter((b) => b.dueDate && daysBetween(today, b.dueDate) <= HORIZON);
  const total = window.filter((b) => b.currency === ccy).reduce((sum, b) => sum + (activeDiscount(b, today)?.payMinor ?? b.amountMinor ?? 0), 0);
  const totalShown = useCountUp(total);
  const otherCcy = window.some((b) => b.currency !== ccy);
  const next = open.find((b) => b.dueDate && daysBetween(today, b.dueDate) >= 0);
  // Paid daily, there's no before/after payday to plan around.
  const plan = settings.pay && settings.pay.every !== 'day' && open.length ? planAroundPayday(open, settings.pay, ccy, today) : null;
  const expected = expectedBills(findSeries(bills, today), today);
  const reviews = dueForReview(settings.contracts, today);

  // Sorted by due date: grouped by when they're due. By name or amount: one list.
  const pay = (b: Bill) => activeDiscount(b, today)?.payMinor ?? (b.status === 'paid' ? b.paidAmountMinor : null) ?? b.amountMinor ?? 0;
  const sortList = (xs: Bill[]) =>
    settings.sortBy === 'name' ? [...xs].sort((a, b) => a.payee.localeCompare(b.payee, locale(), { sensitivity: 'base' })) : [...xs].sort((a, b) => pay(b) - pay(a));
  const groups: { title: string; items: Bill[] }[] =
    settings.sortBy !== 'due'
      ? [{ title: t(`sort.${settings.sortBy}`), items: sortList(tab === 'paid' ? paidShown : openShown) }]
      : tab === 'paid'
      ? [{ title: t('home.paid'), items: paidShown }]
      : [
          { title: t('home.overdue'), items: openShown.filter((b) => b.dueDate && daysBetween(today, b.dueDate) < 0) },
          { title: t('home.thisWeek'), items: openShown.filter((b) => b.dueDate && daysBetween(today, b.dueDate) >= 0 && daysBetween(today, b.dueDate) < 7) },
          { title: t('home.later'), items: openShown.filter((b) => b.dueDate && daysBetween(today, b.dueDate) >= 7) },
          { title: t('home.noDueDate'), items: openShown.filter((b) => !b.dueDate) },
        ];

  /** One sheet with category and year chips; it re-opens on each tap so the ticks stay current. */
  function chooseFilter(current: Filter = filter) {
    const set = (next: Filter) => {
      setFilter(next);
      chooseFilter(next);
    };
    const cats = CATEGORIES.filter((c) => bills.some((b) => b.category === c));
    const years = [...new Set(bills.map(yearOf))].sort((a, b) => b - a);
    const chip = (key: string, label: string, on: boolean, onPress: () => void) => (
      <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[st.chip, on && st.chipOn]}>
        <T style={{ fontSize: 13.5, color: on ? C.bg : C.fg }}>{label}</T>
      </Pressable>
    );
    sheet.show({
      title: t('filter.title'),
      content: (
        <View style={{ gap: 18, marginTop: 8 }}>
          <View style={{ gap: 10 }}>
            <Eyebrow>{t('review.category')}</Eyebrow>
            <View style={st.chips}>
              {chip('all', t('filter.all'), current.category == null, () => set({ ...current, category: null }))}
              {cats.map((c) => chip(c, categoryLabel(c), current.category === c, () => set({ ...current, category: c })))}
            </View>
          </View>
          {years.length > 1 && (
            <View style={{ gap: 10 }}>
              <Eyebrow>{t('filter.year')}</Eyebrow>
              <View style={st.chips}>
                {chip('all', t('filter.all'), current.year == null, () => set({ ...current, year: null }))}
                {years.map((y) => chip(String(y), String(y), current.year === y, () => set({ ...current, year: y })))}
              </View>
            </View>
          )}
        </View>
      ),
      actions: [{ label: t('common.done'), kind: 'primary' }],
    });
  }

  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + NAV_SPACE }}>
        <View style={st.header}>
          <T style={st.title} accessibilityRole="header">{t('nav.bills')}</T>
          <IconButton label={t('search.title')} onPress={() => setSearching(true)} style={{ borderWidth: 0, marginRight: -12 }}>
            <Icon name="search" color={C.muted} />
          </IconButton>
        </View>

        {searching && (
          <Animated.View entering={enterFade(0)} style={st.search}>
            <Icon name="search" size={16} color={C.dim} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={t('search.placeholder')}
              placeholderTextColor={C.dim}
              returnKeyType="search"
              style={st.searchInput}
              accessibilityLabel={t('search.title')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('search.close')}
              hitSlop={10}
              onPress={() => {
                setQuery('');
                setSearching(false);
              }}>
              <Icon name="close" size={16} color={C.muted} />
            </Pressable>
          </Animated.View>
        )}

        {/* While searching, only the results: the totals, plan and runway step aside. */}
        {!searching && (
          <>
          <View style={{ marginTop: 22 }}>
            <Eyebrow>{t('home.nextDays', { n: HORIZON })}</Eyebrow>
            <View style={{ marginTop: 8 }}>
              <Amount currency={ccy} value={formatAmount(totalShown, ccy)} />
            </View>
            <T style={st.sub}>
              {open.length === 0
                ? t('home.empty')
                : [t('home.open', { n: open.length }), next?.dueDate && t('home.nextDue', { date: shortDay(next.dueDate) }), otherCcy && t('home.otherCurrencies')].filter(Boolean).join(' · ')}
            </T>
          </View>

          {plan ? (
            <Animated.View entering={enterFade(150)} style={st.plan}>
              <View style={st.planCol}>
                <Eyebrow>{t('home.beforePayday')}</Eyebrow>
                <T style={st.planAmount}>{formatAmount(plan.beforeMinor, ccy)}</T>
                <T style={st.planSub}>{plan.before.length ? t('home.beforeCount', { n: plan.before.length }) : t('home.nothingUntilPayday')}</T>
              </View>
              <View style={[st.planCol, st.planRight]}>
                <Eyebrow>{t('home.afterPayday', { date: shortDay(plan.payday).toUpperCase() })}</Eyebrow>
                <T style={st.planAmount}>{formatAmount(plan.afterMinor, ccy)}</T>
                <T style={st.planSub}>{t('home.afterCount', { n: plan.after.length })}</T>
              </View>
            </Animated.View>
          ) : (
            open.length > 0 &&
            !settings.pay && (
              <Pressable accessibilityRole="link" onPress={() => router.push('/settings')} style={{ marginTop: 14, alignSelf: 'flex-start', paddingVertical: 6 }}>
                <T style={{ fontSize: 13.5, color: C.muted }}>{t('home.setPayday')}</T>
              </Pressable>
            )
          )}

          {reviews.length > 0 && (
            <Animated.View entering={enterFade(180)} style={st.reviews}>
              <Eyebrow>{t('contract.homeTitle')}</Eyebrow>
              {reviews.map((r) => (
                <Pressable
                  key={r.key}
                  accessibilityRole="button"
                  onPress={() => {
                    const latest = latestBillOf(r.contract.payee);
                    if (latest) router.push({ pathname: '/bill/[id]', params: { id: latest.id } });
                  }}
                  style={st.reviewRow}>
                  <T style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{r.contract.payee}</T>
                  <T style={{ fontFamily: F.mono, fontSize: 11, color: r.daysLeft <= 7 ? C.accent : C.muted }}>
                    {r.daysLeft === 0 ? t('bill.today') : t('bill.daysLeft', { n: r.daysLeft })}
                  </T>
                </Pressable>
              ))}
            </Animated.View>
          )}

          <Runway bills={window} today={today} ccy={ccy} payday={plan?.payday ?? null} expected={expected} />
          </>
        )}

        <View style={st.tabs}>
          {(['open', 'paid'] as const).map((k) => {
            const on = tab === k;
            return (
              <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setTab(k)} style={[st.tab, on && st.tabOn]}>
                <View style={st.tabInner}>
                  <T style={[st.tabText, { color: on ? C.fg : C.dim }]}>{k === 'open' ? t('home.upcoming') : t('home.paid')}</T>
                  <T style={[st.tabCount, on && { color: C.muted }]}>{k === 'open' ? openShown.length : paidShown.length}</T>
                </View>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityLabel={t('filter.title')} onPress={() => chooseFilter()} hitSlop={8} style={[st.sort, { marginLeft: 'auto' }]}>
            <Icon name="filter" size={14} color={filter.category || filter.year ? C.accent : C.dim} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('sort.title')} onPress={chooseSort} hitSlop={8} style={[st.sort, { marginLeft: 0 }]}>
            <Icon name="sort" size={14} color={C.dim} />
            <T style={st.sortText}>{t(`sort.${settings.sortBy}`)}</T>
          </Pressable>
        </View>

        {(filter.category || filter.year) && (
          <View style={[st.chips, { marginTop: 14 }]}>
            {filter.category && (
              <Pressable accessibilityRole="button" accessibilityLabel={t('filter.remove', { what: categoryLabel(filter.category) })} onPress={() => setFilter({ ...filter, category: null })} style={[st.chip, st.chipOn, st.chipRow]}>
                <T style={{ fontSize: 13, color: C.bg }}>{categoryLabel(filter.category)}</T>
                <Icon name="close" size={12} color={C.bg} />
              </Pressable>
            )}
            {filter.year && (
              <Pressable accessibilityRole="button" accessibilityLabel={t('filter.remove', { what: String(filter.year) })} onPress={() => setFilter({ ...filter, year: null })} style={[st.chip, st.chipOn, st.chipRow]}>
                <T style={{ fontSize: 13, color: C.bg }}>{filter.year}</T>
                <Icon name="close" size={12} color={C.bg} />
              </Pressable>
            )}
          </View>
        )}

        {narrowed && groups.every((g) => !g.items.length) && <T style={{ marginTop: 28, fontSize: 14, color: C.muted }}>{t('search.none')}</T>}

        {tab === 'open' && !narrowed && expected.length > 0 && (
          <View>
            <Eyebrow style={{ marginTop: 28, marginBottom: 4 }}>{t('home.expected')}</Eyebrow>
            {expected.map((s, idx) => (
              <Animated.View key={s.key} entering={enterRow(idx)} layout={moveRow}>
                <ExpectedRow series={s} />
              </Animated.View>
            ))}
          </View>
        )}

        {groups
          .filter((g) => g.items.length)
          .map((g) => (
            <View key={g.title}>
              <Eyebrow style={{ marginTop: 28, marginBottom: 4 }}>{g.title}</Eyebrow>
              {g.items.map((b, idx) => (
                <Animated.View key={b.id} entering={enterRow(idx)} layout={moveRow}>
                  <BillRow bill={b} today={today} />
                </Animated.View>
              ))}
            </View>
          ))}
      </ScrollView>

    </View>
  );
}

function chooseSort() {
  sheet.show({
    title: t('sort.title'),
    content: (
      <Options
        selected={getSettings().sortBy}
        options={(['due', 'name', 'amount'] as const).map((k) => ({
          key: k,
          label: t(`sort.${k}`),
          onPress: () => {
            updateSettings({ sortBy: k });
            sheet.hide();
          },
        }))}
      />
    ),
  });
}

function BillRow({ bill, today }: { bill: Bill; today: string }) {
  const days = bill.dueDate ? daysBetween(today, bill.dueDate) : null;
  const urgent = bill.status === 'open' && days != null && days <= 3;
  const discount = activeDiscount(bill, today);
  const sub = bill.dunning && bill.status === 'open'
    ? [t(`dun.level${bill.dunning.level}`), bill.dueDate && t('row.due', { date: shortDay(bill.dueDate) })].filter(Boolean).join(' · ')
    : discount
    ? t('row.discount', { pct: discount.percent, date: shortDay(discount.until) })
    : [
        bill.description ?? categoryLabel(bill.category),
        bill.status === 'open' && bill.snoozedUntil && new Date(bill.snoozedUntil) > new Date()
          ? t('row.snoozed', { date: shortDay(new Date(bill.snoozedUntil)) })
          : bill.dueDate && t('row.due', { date: shortDay(bill.dueDate) }),
      ].filter(Boolean).join(' · ');
  // A plain Pressable, laid out like ExpectedRow: wrapping it in <Link asChild> merged styles and broke the row layout.
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/bill/[id]', params: { id: bill.id } })}
      style={({ pressed }) => [st.row, pressed && { opacity: 0.6 }]}>
      <View style={st.mono}>
        <T style={st.monoText}>{bill.payee.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <T style={st.rowTitle} numberOfLines={1}>{bill.payee}</T>
        <T style={[st.rowSub, (discount || (bill.dunning && bill.status === 'open')) && { color: C.accent }]} numberOfLines={1}>{sub}</T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <T style={st.rowAmount}>
          {bill.currency !== homeCurrency() ? `${bill.currency} ` : ''}
          {formatAmount(discount?.payMinor ?? (bill.status === 'paid' ? bill.paidAmountMinor : null) ?? bill.amountMinor, bill.currency)}
        </T>
        <T style={[st.rowDays, { color: urgent ? C.accent : C.dim }]}>
          {bill.status === 'paid' ? t('row.paid') : bill.dueDate ? relativeDays(bill.dueDate, today) : '—'}
        </T>
      </View>
    </Pressable>
  );
}

/** A bill that should come soon (or should have come) from a biller who bills regularly. */
function ExpectedRow({ series: s }: { series: Series }) {
  const when = s.late ? t('expected.late', { date: shortDay(s.expectedArrival) }) : t('expected.around', { cadence: cadenceLabel(s.cadence), date: shortDay(s.nextDue) });
  return (
    <View style={st.row} accessibilityLabel={t('expected.a11y', { payee: s.payee, when })}>
      <View style={[st.mono, { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: C.barMuted }]}>
        <T style={[st.monoText, { color: C.dim }]}>{s.payee.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <T style={[st.rowTitle, { color: C.muted }]} numberOfLines={1}>{s.payee}</T>
        <T style={[st.rowSub, s.late && { color: C.accent }]} numberOfLines={1}>{when}</T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <T style={[st.rowAmount, { color: C.muted }]}>≈ {formatAmount(s.amountMinor, s.currency)}</T>
        <T style={[st.rowDays, { color: s.late ? C.accent : C.dim }]}>{s.late ? t('expected.notArrived') : t('expected.tag')}</T>
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
    <View style={st.runway} accessibilityLabel={t('runway.a11y', { n: HORIZON })}>
      <View style={{ height: 64 }}>
        <View style={st.ticks}>
          {Array.from({ length: HORIZON + 1 }, (_, i) => (
            <View key={i} style={{ width: 1, height: i % 7 === 0 ? 8 : 4, backgroundColor: i % 7 === 0 ? C.barMuted : C.tick }} />
          ))}
        </View>
        <View style={[st.bar, { left: 0, width: 6, height: 6, marginLeft: 0, backgroundColor: C.accent }]} />
        {paydayAt != null && paydayAt <= HORIZON && (
          <View style={[st.payday, { left: `${(paydayAt / HORIZON) * 100}%` }]} accessibilityLabel={t('runway.payday')}>
            <T style={st.paydayLabel}>{t('runway.pay')}</T>
          </View>
        )}
        {expected
          .filter((s) => !s.late && daysBetween(today, s.nextDue) <= HORIZON)
          .map((s) => (
            <GrowBar
              key={'x' + s.key}
              size={s.currency === ccy ? Math.max(8, (s.amountMinor / max) * 48) : 8}
              delay={300 + (daysBetween(today, s.nextDue) / HORIZON) * 300}
              style={[st.bar, { left: `${(daysBetween(today, s.nextDue) / HORIZON) * 100}%`, borderWidth: 1, borderColor: C.barMuted }]}
            />
          ))}
        {bills.map((b) => {
          const d = Math.max(0, daysBetween(today, b.dueDate!));
          const h = b.currency === ccy && b.amountMinor ? Math.max(8, (b.amountMinor / max) * 48) : 8;
          return <GrowBar key={b.id} size={h} delay={(d / HORIZON) * 300} style={[st.bar, { left: `${(d / HORIZON) * 100}%`, backgroundColor: d <= 7 ? C.accent : C.fg }]} />;
        })}
      </View>
      <View style={st.runwayLabels}>
        <T style={[st.runwayLabel, { color: C.fg }]}>{t('common.todayCaps')}</T>
        <T style={st.runwayLabel}>{mid.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }).toUpperCase()}</T>
        <T style={st.runwayLabel}>{end.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }).toUpperCase()}</T>
      </View>
    </View>
  );
}

const st = themed(() => StyleSheet.create({
  title: { fontFamily: F.semibold, fontSize: 24, letterSpacing: -0.7 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48 },
  sub: { marginTop: 10, fontSize: 14, color: C.muted },
  runway: { marginTop: 26, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, paddingTop: 16, paddingBottom: 10 },
  ticks: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  reviews: { marginTop: 22, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
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
  tabs: { flexDirection: 'row', alignItems: 'flex-end', gap: 22, marginTop: 20 },
  search: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, color: C.fg, fontFamily: F.regular, fontSize: 15, paddingVertical: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, height: 34, justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.fg, borderColor: C.fg },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sort: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, minHeight: 32 },
  sortText: { fontSize: 13, color: C.dim },
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
}));
