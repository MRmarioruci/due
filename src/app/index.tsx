import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { currentLang, locale, t } from '@/i18n/core';
import { categoryLabel } from '@/i18n/labels';
import { dueForReview } from '@/lib/contracts';
import { daysBetween, fromIso, shortDay, todayIso } from '@/lib/dates';
import { activeDiscount } from '@/lib/discount';
import { DIAL_DAYS, dialPoints, homeState } from '@/lib/home';
import { formatAmount } from '@/lib/money';
import { openScan } from '@/lib/nav';
import { planAroundPayday } from '@/lib/plan';
import { expectedBills, findSeries } from '@/lib/recurring';
import { latestBillOf } from '@/lib/reminders';
import { seedSampleBills } from '@/lib/seed';
import { useSettings } from '@/lib/settings';
import { useBills } from '@/lib/store';
import type { Bill } from '@/lib/types';
import { Dial, type DialPoint } from '@/ui/dial';
import { Eyebrow, Icon, IconButton, T } from '@/ui/kit';
import { Animated, enterFade, enterRow, useCountUp } from '@/ui/motion';
import { ScanButton } from '@/ui/scan-button';
import { C, F, GUTTER, themed } from '@/ui/theme';

const payOf = (b: Bill, today: string) => activeDiscount(b, today)?.payMinor ?? b.amountMinor ?? 0;

function greeting(now = new Date()): string {
  const h = now.getHours();
  return t(h < 5 ? 'home.greetEvening' : h < 12 ? 'home.greetMorning' : h < 18 ? 'home.greetAfternoon' : 'home.greetEvening');
}

/**
 * Home, kept calm: a 30-day dial with one headline in the middle. With nothing due this week it says
 * so and stops there; otherwise it leads with the one bill to deal with now. The full list is a tap away.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const bills = useBills();
  const settings = useSettings();
  const today = todayIso();

  const state = homeState(bills, today);
  const open = bills.filter((b) => b.status === 'open');
  const ccy = open[0]?.currency ?? settings.currency ?? 'CHF';
  const in30 = open.filter((b) => b.dueDate && daysBetween(today, b.dueDate) <= DIAL_DAYS);
  const total30 = in30.filter((b) => b.currency === ccy).reduce((s, b) => s + payOf(b, today), 0);
  const plan = settings.pay && settings.pay.every !== 'day' && open.length ? planAroundPayday(open, settings.pay, ccy, today) : null;

  // One quiet nudge at most: a contract to review, else a regular bill that hasn't come.
  const review = dueForReview(settings.contracts, today)[0];
  const late = expectedBills(findSeries(bills, today), today).find((s) => s.late);

  const focus = state.kind === 'focus' ? state.focus : null;
  const points = dialPoints(bills, today);
  const biggest = Math.max(1, ...points.map((p) => p.bill.amountMinor ?? 0));
  const dots: DialPoint[] = points.map((p) => ({
    key: p.bill.id,
    day: p.day,
    size: Math.round(5 + 7 * Math.sqrt((p.bill.amountMinor ?? 0) / biggest)),
    color: p.bill.id === focus?.id || p.overdue ? C.accent : focus ? C.barMuted : C.fg,
    pulse: p.bill.id === focus?.id,
  }));

  const amount = useCountUp(focus ? payOf(focus, today) : 0, 700);

  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  const lead = state.kind === 'empty' ? t('home.welcome') : state.kind === 'calm' ? greeting() : state.daysLeft < 0 ? t('home.overdueLead') : t('home.thingsThisWeek', { n: state.more + 1 });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 28 }}>
        <View style={st.header}>
          {/* Long-press the logo in development to load sample bills. */}
          <Pressable onLongPress={__DEV__ ? seedSampleBills : undefined} style={st.logo} accessibilityRole="header">
            <T style={st.logoText}>due</T>
            <View style={st.logoDot} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <IconButton label={t('common.stats')} onPress={() => router.push('/stats')} style={{ borderWidth: 0 }}>
              <Icon name="stats" color={C.muted} />
            </IconButton>
            <IconButton label={t('common.settings')} onPress={() => router.push('/settings')} style={{ borderWidth: 0 }}>
              <Icon name="settings" color={C.muted} />
            </IconButton>
            <View style={{ marginLeft: 6 }}>
              <ScanButton />
            </View>
          </View>
        </View>

        <Animated.View entering={enterFade(0)}>
          <T style={st.lead}>{lead}</T>
        </Animated.View>

        <View style={{ flex: 1, minHeight: 16 }} />

        <View>
          <Dial
            days={DIAL_DAYS}
            points={dots}
            todayColor={focus ? C.fg : C.accent}
            label={t('home.dialA11y', { n: points.length })}>
            {state.kind === 'focus' ? (
              <Animated.View entering={enterFade(250)} style={st.centerCol}>
                <T style={[st.eyebrow, { color: C.accent }]} adjustsFontSizeToFit numberOfLines={1}>{caps(dueLabel(state.focus, state.daysLeft))}</T>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <T style={st.ccy}>{state.focus.currency}</T>
                  <T style={st.big} adjustsFontSizeToFit numberOfLines={1}>{formatAmount(amount, state.focus.currency)}</T>
                </View>
                <T style={{ fontSize: 15, textAlign: 'center' }} numberOfLines={1}>
                  {state.focus.payee}
                  <T style={{ fontSize: 15, color: C.dim }}> · {state.focus.description?.split('·')[0].trim() || categoryLabel(state.focus.category)}</T>
                </T>
              </Animated.View>
            ) : (
              <Animated.View entering={enterFade(250)} style={st.centerCol}>
                <T style={st.eyebrow}>{t('home.thisWeekCaps')}</T>
                <T style={st.headline} adjustsFontSizeToFit numberOfLines={1}>{state.kind === 'empty' ? t('home.nothingYet') : t('home.allHandled')}</T>
                <T style={st.centerSub}>
                  {state.kind === 'calm' && state.next ? (
                    <>
                      {t('home.nothingUntil')}
                      {'\n'}
                      <T style={[st.centerSub, { color: C.fg }]}>{shortDay(state.next.dueDate!)}</T>
                    </>
                  ) : state.kind === 'empty' ? (
                    t('home.firstText')
                  ) : (
                    t('home.nothingAtAll')
                  )}
                </T>
              </Animated.View>
            )}
          </Dial>
          <T style={st.dialFoot}>{t('home.dialFoot', { n: DIAL_DAYS })}</T>
        </View>

        <View style={{ flex: 1.3, minHeight: 24 }} />

        {(review || late) && (
          <Animated.View entering={enterRow(0)}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const b = review ? latestBillOf(review.contract.payee) : null;
                if (b) router.push({ pathname: '/bill/[id]', params: { id: b.id } });
                else router.push('/bills');
              }}
              style={st.nudge}>
              <View style={st.nudgeDot} />
              <T style={{ flex: 1, fontSize: 13.5, color: C.muted }} numberOfLines={1}>
                {review ? t('home.reviewNudge', { payee: review.contract.payee, n: review.daysLeft }) : t('home.lateNudge', { payee: late!.payee })}
              </T>
              <Chevron />
            </Pressable>
          </Animated.View>
        )}

        {state.kind === 'focus' ? (
          <Animated.View entering={enterRow(1)} style={{ gap: 12, marginTop: 14 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Haptics.selectionAsync();
                router.push({ pathname: '/bill/[id]', params: { id: state.focus.id } });
              }}
              style={({ pressed }) => [st.primary, pressed && { opacity: 0.85 }]}>
              <T style={st.primaryText} numberOfLines={1}>{t('home.pay', { payee: state.focus.payee })}</T>
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon name="back" color={C.bg} size={16} />
              </View>
            </Pressable>
            <T style={{ textAlign: 'center', fontSize: 13.5, color: C.dim }}>
              {state.more > 0 ? t('home.thenMore', { n: state.more }) : state.then ? t('home.thenNothing', { date: shortDay(state.then.dueDate!) }) : t('home.thenNone')}
            </T>
            <Pressable accessibilityRole="link" onPress={() => router.push('/bills')} style={st.textLink}>
              <T style={{ fontSize: 13.5, color: C.fg, textDecorationLine: 'underline' }}>{t('home.allBills', { n: open.length })}</T>
            </Pressable>
          </Animated.View>
        ) : state.kind === 'empty' ? (
          <Animated.View entering={enterRow(1)} style={{ marginTop: 14 }}>
            <Pressable accessibilityRole="button" onPress={() => openScan()} style={({ pressed }) => [st.primary, pressed && { opacity: 0.85 }]}>
              <Icon name="scan" color={C.bg} size={18} />
              <T style={st.primaryText}>{t('home.firstBill')}</T>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={enterRow(1)} style={{ gap: 18, marginTop: 14 }}>
            <View style={st.strip}>
              <View style={{ gap: 6 }}>
                <Eyebrow>{t('home.nextDays', { n: DIAL_DAYS })}</Eyebrow>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                  <T style={st.stripCcy}>{ccy}</T>
                  <T style={st.stripAmount}>{formatAmount(total30, ccy)}</T>
                </View>
              </View>
              <View style={{ gap: 6, alignItems: 'flex-end' }}>
                {plan ? (
                  <>
                    <Eyebrow>{t('home.payday')}</Eyebrow>
                    <T style={{ fontSize: 15, lineHeight: 28, textAlign: 'right' }} numberOfLines={2}>
                      {shortDay(plan.payday)}
                      <T style={{ fontSize: 15, color: C.dim }}> · {plan.before.length ? t('home.paydayBefore', { amount: formatAmount(plan.beforeMinor, ccy) }) : t('home.paydayClear')}</T>
                    </T>
                  </>
                ) : (
                  <>
                    <Eyebrow>{t('home.paid')}</Eyebrow>
                    <T style={{ fontSize: 15, lineHeight: 28 }}>{bills.filter((b) => b.status === 'paid').length}</T>
                  </>
                )}
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/bills')} style={({ pressed }) => [st.outline, pressed && { backgroundColor: C.surface }]}>
              <T style={{ fontSize: 15 }}>{open.length ? t('home.comingUp', { n: open.length }) : t('home.paidBills')}</T>
              <Chevron />
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

/** Capitals in the app's language; Greek drops its accents in capitals. */
function caps(text: string): string {
  const up = text.toLocaleUpperCase(locale());
  return currentLang() === 'el' ? up.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : up;
}

/** "Due Friday · 3 days", "Due today", "Overdue · 2 days". */
function dueLabel(bill: Bill, days: number): string {
  if (days < 0) return t('home.overdueBy', { n: -days });
  if (days === 0) return t('home.dueToday');
  const day = fromIso(bill.dueDate!).toLocaleDateString(locale(), { weekday: 'long' });
  return t('home.dueIn', { day, n: days });
}

function Chevron() {
  return (
    <View style={{ transform: [{ rotate: '180deg' }] }}>
      <Icon name="back" size={14} color={C.dim} />
    </View>
  );
}

const st = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48 },
  logo: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  logoText: { fontFamily: F.semibold, fontSize: 26, letterSpacing: -0.8, lineHeight: 28 },
  logoDot: { width: 7, height: 7, backgroundColor: C.accent, marginBottom: 6 },
  lead: { marginTop: 30, fontSize: 15, color: C.muted },
  centerCol: { alignItems: 'center', gap: 10 },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.3, color: C.dim, textAlign: 'center' },
  headline: { fontFamily: F.regular, fontSize: 36, letterSpacing: -1.4, lineHeight: 40, textAlign: 'center' },
  centerSub: { fontSize: 14, lineHeight: 20, color: C.muted, textAlign: 'center' },
  ccy: { fontFamily: F.medium, fontSize: 15, color: C.dim },
  big: { fontFamily: F.regular, fontSize: 46, letterSpacing: -2, lineHeight: 50, fontVariant: ['tabular-nums'], maxWidth: 170 },
  dialFoot: { marginTop: 4, textAlign: 'center', fontFamily: F.mono, fontSize: 10.5, letterSpacing: 0.8, color: C.dim },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginBottom: 4 },
  nudgeDot: { width: 6, height: 6, backgroundColor: C.accent },
  primary: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.fg, paddingHorizontal: 18 },
  primaryText: { fontFamily: F.semibold, fontSize: 15, letterSpacing: -0.15, color: C.bg, flexShrink: 1 },
  textLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  strip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 18 },
  stripAmount: { fontFamily: F.medium, fontSize: 22, lineHeight: 28, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  stripCcy: { fontFamily: F.medium, fontSize: 13, color: C.dim },
  outline: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderWidth: 1, borderColor: C.border },
}));
