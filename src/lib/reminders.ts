import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { planReviewReminders, type Contract } from './contracts';
import { longDate, shortDay, toIso } from './dates';
import { activeDiscount } from './discount';
import { Notifications } from './notifications-module';
import { mainReminder, NOTIFICATION_CAP, planDigest, planReminders, withinBudget } from './reminder-plan';
import { t } from '@/i18n/core';
import { getSettings, updateSettings } from './settings';
import { priceChange } from './price-change';
import { findSeries, payeeKey, planMissingAlerts } from './recurring';
import { openScan } from './nav';
import { getBill, getBills, saveBill } from './store';
import type { Bill } from './types';

const CHANNEL = 'bills';
const CATEGORY = 'bill';

/** False in Expo Go on Android, where the notifications module can't load. */
export const remindersAvailable = Notifications != null;

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: t('notify.channel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'tomorrow', buttonTitle: t('notify.actionTomorrow'), options: { opensAppToForeground: false } },
    { identifier: 'paid', buttonTitle: t('notify.actionPaid'), options: { opensAppToForeground: false } },
  ]);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Cancels every notification scheduled for the bill. */
export async function cancelFor(bill: Bill) {
  if (!Notifications) return;
  for (const id of [bill.reminderId, ...(bill.extraReminderIds ?? [])]) {
    if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

/**
 * Brings the phone's scheduled notifications in line with the bills: plans every open bill, keeps the
 * soonest within the phone's limit, cancels what's no longer wanted and schedules what's missing.
 * Runs after every change to the bills and when the app comes back to the foreground (which also
 * moves the window on, so bills further out get theirs in time).
 */
let running: Promise<void> | null = null;
let again = false;
export function syncReminders(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  const N = Notifications;
  if (!N) return;
  const now = new Date();
  const prefs = (({ remindHour, extraNudges, payStyle }) => ({ remindHour, extraNudges, payStyle }))(getSettings());
  const open = getBills().filter((b) => b.status === 'open');

  const planned = open.flatMap((bill) => planReminders(bill, prefs, now).map((r) => ({ ...r, bill, key: `${bill.id}|${r.kind}|${r.at.getTime()}` })));
  const cap = Platform.OS === 'ios' ? NOTIFICATION_CAP.ios : NOTIFICATION_CAP.android;
  const wanted = withinBudget(planned, cap);
  const wantedKeys = new Set(wanted.map((r) => r.key));

  // Bill notifications carry their key; the weekly summary has none and is left alone.
  const scheduled = await N.getAllScheduledNotificationsAsync();
  await syncExtra(scheduled, 'review', reviewNotifications(now));
  await syncExtra(scheduled, 'missing', missingNotifications(now));
  const have = new Map<string, string>();
  for (const n of scheduled) {
    const data = n.content.data as { billId?: string; key?: string } | undefined;
    if (!data?.billId) continue;
    if (data.key && wantedKeys.has(data.key) && !have.has(data.key)) have.set(data.key, n.identifier);
    else await N.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
  }
  for (const r of wanted) {
    if (have.has(r.key)) continue;
    const id = await N.scheduleNotificationAsync({
      content: {
        title: r.title,
        body: r.kind === 'main' ? `${r.body} ${t('notify.openQr')}` : r.body,
        data: { billId: r.bill.id, key: r.key },
        categoryIdentifier: CATEGORY,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
    });
    have.set(r.key, id);
  }

  // Record on each bill when its main reminder is (shown on the bill screen) and which ids are its.
  for (const bill of open) {
    const mine = wanted.filter((r) => r.bill.id === bill.id);
    const main = planned.find((r) => r.bill.id === bill.id && r.kind === 'main');
    const mainId = main && have.get(main.key);
    const next = {
      remindAt: main ? main.at.toISOString() : bill.remindAt && new Date(bill.remindAt) <= now ? bill.remindAt : null,
      snoozedUntil: bill.snoozedUntil && new Date(bill.snoozedUntil) > now ? bill.snoozedUntil : null,
      reminderId: mainId ?? null,
      extraReminderIds: mine.filter((r) => r.kind !== 'main').map((r) => have.get(r.key)!),
    };
    const same =
      next.remindAt === bill.remindAt &&
      next.snoozedUntil === (bill.snoozedUntil ?? null) &&
      next.reminderId === bill.reminderId &&
      JSON.stringify(next.extraReminderIds) === JSON.stringify(bill.extraReminderIds ?? []);
    const current = getBill(bill.id);
    if (!same && current && current.status === 'open') saveBill({ ...current, ...next });
  }
}

type Scheduled = Awaited<ReturnType<NonNullable<typeof Notifications>['getAllScheduledNotificationsAsync']>>;
type Extra = { key: string; at: Date; title: () => string; body: () => string; payee: string };

/**
 * Notifications that aren't about one bill (contract reviews, missing bills), tagged by `kind` and keyed
 * by what and when, so they're only replaced when they change.
 */
async function syncExtra(scheduled: Scheduled, kind: 'review' | 'missing', wanted: Extra[]) {
  const N = Notifications!;
  const byKey = new Map(wanted.map((x) => [`${kind}|${x.key}|${x.at.getTime()}`, x]));
  const have = new Set<string>();
  for (const n of scheduled) {
    const key = (n.content.data as Record<string, string> | undefined)?.[kind];
    if (!key) continue;
    if (byKey.has(key) && !have.has(key)) have.add(key);
    else await N.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
  }
  for (const [key, x] of byKey) {
    if (have.has(key)) continue;
    await N.scheduleNotificationAsync({
      content: { title: x.title(), body: x.body(), data: { [kind]: key, payee: x.payee } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: x.at, channelId: CHANNEL },
    });
  }
}

/** Contract review reminders, with the last price rise when there was one. */
function reviewNotifications(now: Date): Extra[] {
  const { contracts, remindHour } = getSettings();
  return planReviewReminders(contracts, remindHour, now).map((r) => ({
    key: r.key,
    at: r.at,
    payee: r.contract.payee,
    title: () => t('contract.notifyTitle', { payee: r.contract.payee, n: r.daysLeft }),
    body: () => {
      const latest = latestBillOf(r.contract.payee);
      const change = latest && priceChange(latest, getBills());
      return [t('contract.notifyBody', { date: longDate(r.date) }), change && change.pct > 0 && t('contract.notifyRise', { pct: Math.round(change.pct) })].filter(Boolean).join(' ');
    },
  }));
}

/** A regular bill that hasn't come a week after it usually does (part of the extra nudges). */
function missingNotifications(now: Date): Extra[] {
  const { extraNudges, remindHour } = getSettings();
  if (!extraNudges) return [];
  return planMissingAlerts(findSeries(getBills(), toIso(now)), remindHour, now).map((m) => ({
    key: m.series.key,
    at: m.at,
    payee: m.series.payee,
    title: () => t('missing.title', { payee: m.series.payee }),
    body: () => t('missing.body', { date: shortDay(m.series.expectedArrival) }),
  }));
}

/** The biller's most recent bill, to open from a contract reminder. */
export function latestBillOf(payee: string): Bill | undefined {
  const key = payeeKey(payee);
  return getBills()
    .filter((b) => payeeKey(b.payee) === key)
    .sort((a, b) => (b.dueDate ?? b.createdAt).localeCompare(a.dueDate ?? a.createdAt))[0];
}

/** Sets (or with null, removes) the review date for a biller's contract, and its reminders. */
export async function saveContract(payee: string, contract: Omit<Contract, 'payee'> | null) {
  const key = payeeKey(payee);
  if (!key) return;
  const { [key]: _old, ...rest } = getSettings().contracts;
  updateSettings({ contracts: contract ? { ...rest, [key]: { ...contract, payee: payee.trim() } } : rest });
  await syncReminders();
}

/** For saving an edited or new bill: forget the old plan so the next sync plans it afresh. */
export function replan(bill: Bill): Bill {
  return { ...bill, remindAt: null, snoozedUntil: null };
}

/** Replaces the Monday summary with one for the coming week. */
export async function scheduleDigest(bills: Bill[]) {
  if (!Notifications) return;
  const { weeklyDigest, remindHour, digestId } = getSettings();
  if (digestId) await Notifications.cancelScheduledNotificationAsync(digestId).catch(() => {});
  const d = weeklyDigest ? planDigest(bills, remindHour) : null;
  const id = d
    ? await Notifications.scheduleNotificationAsync({
        content: { title: d.title, body: d.body, data: {} },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d.at, channelId: CHANNEL },
      })
    : null;
  updateSettings({ digestId: id });
}

/** `at`: when it was paid, if not now (a receipt shows the bill was paid earlier). */
export async function markPaid(bill: Bill, at?: string) {
  await cancelFor(bill);
  const discount = activeDiscount(bill);
  saveBill({ ...bill, status: 'paid', paidAt: at ?? new Date().toISOString(), paidAmountMinor: discount?.payMinor ?? null, reminderId: null, remindAt: null, snoozedUntil: null, extraReminderIds: [] });
  await syncReminders();
}

export async function markOpen(bill: Bill) {
  saveBill(replan({ ...bill, status: 'open', paidAt: null, paidAmountMinor: null }));
  await syncReminders();
}

/** Snooze: no reminders for the bill until `at` (tomorrow at the usual time when not given), then one. */
export async function snooze(bill: Bill, at?: Date) {
  if (!at) {
    at = new Date();
    at.setDate(at.getDate() + 1);
    at.setHours(getSettings().remindHour, 0, 0, 0);
  }
  saveBill({ ...bill, snoozedUntil: at.toISOString() });
  await syncReminders();
}

/** Ends a snooze early: the bill's reminders are planned again as usual. */
export async function unsnooze(bill: Bill) {
  saveBill({ ...bill, snoozedUntil: null, remindAt: null });
  await syncReminders();
}

/** Re-plans every open bill's reminder, e.g. after the reminder time or pay style changed. */
export async function rescheduleAll() {
  for (const b of getBills().filter((x) => x.status === 'open')) saveBill({ ...b, remindAt: null });
  await syncReminders();
}

/** Handles taps and the notification's action buttons. Call once from the root layout. */
export function listenForResponses(): () => void {
  const N = Notifications;
  if (!N) return () => {};
  const handle = async (response: NotificationResponse) => {
    const data = response.notification.request.content.data as { billId?: string; review?: string; missing?: string; payee?: string } | undefined;
    if (data?.review && data.payee) {
      const latest = latestBillOf(data.payee);
      if (latest) router.push({ pathname: '/bill/[id]', params: { id: latest.id } });
      return;
    }
    // A missing bill: straight to scanning, for when it turns up.
    if (data?.missing) return openScan();
    const billId = data?.billId;
    const bill = billId ? getBill(billId) : undefined;
    if (!bill) return;
    if (response.actionIdentifier === 'paid') await markPaid(bill);
    else if (response.actionIdentifier === 'tomorrow') await snooze(bill);
    else router.push({ pathname: '/bill/[id]', params: { id: bill.id } });
  };
  const sub = N.addNotificationResponseReceivedListener(handle);
  N.getLastNotificationResponseAsync().then((r) => {
    if (r) {
      handle(r);
      N.clearLastNotificationResponseAsync();
    }
  });
  return () => sub.remove();
}

/** When the bill's reminder goes off and why, for the review screen. */
export function describeReminder(bill: Bill): { when: string | null; why: string } {
  if (!remindersAvailable) return { when: null, why: t('remind.expoGo') };
  if (!bill.dueDate) return { when: null, why: t('remind.noDate') };
  const s = getSettings();
  const m = mainReminder(bill, { remindHour: s.remindHour, extraNudges: s.extraNudges, payStyle: s.payStyle });
  if (!m) return { when: null, why: t('remind.passed') };
  const style = bill.payStyle ?? s.payStyle;
  const why =
    activeDiscount(bill) ? t('remind.why.discount')
    : style === 'early' ? t('remind.why.early')
    : style === 'midway' ? t('remind.why.midway')
    : m.getDay() === 5 && bill.remindDaysBefore < 3 ? t('remind.why.weekend')
    : t('remind.why.transfer');
  return { when: shortDay(m), why };
}

