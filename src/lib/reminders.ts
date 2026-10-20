import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { shortDay } from './dates';
import { activeDiscount } from './discount';
import { Notifications } from './notifications-module';
import { mainReminder, PAY_STYLES, planDigest, planReminders } from './reminder-plan';
import { getSettings, updateSettings } from './settings';
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
      name: 'Bill reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'tomorrow', buttonTitle: 'Tomorrow', options: { opensAppToForeground: false } },
    { identifier: 'paid', buttonTitle: 'Paid', options: { opensAppToForeground: false } },
  ]);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Cancels every notification scheduled for the bill. */
async function cancelFor(bill: Bill) {
  if (!Notifications) return;
  for (const id of [bill.reminderId, ...(bill.extraReminderIds ?? [])]) {
    if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

/** Replaces the bill's notifications with a fresh plan. Returns the bill with reminder fields updated. */
export async function scheduleReminder(bill: Bill, snoozedTo?: Date): Promise<Bill> {
  const cleared = { ...bill, reminderId: null, remindAt: null, extraReminderIds: [] };
  if (!Notifications) return cleared;
  await cancelFor(bill);
  const { remindHour, extraNudges, payStyle } = getSettings();
  const plan = planReminders(bill, { remindHour, extraNudges, payStyle }, new Date(), snoozedTo);
  const ids: { kind: string; id: string; at: Date }[] = [];
  for (const r of plan) {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.kind === 'main' ? `${r.body} Tap to open the QR code.` : r.body, data: { billId: bill.id }, categoryIdentifier: CATEGORY },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
    });
    ids.push({ kind: r.kind, id, at: r.at });
  }
  const main = ids.find((x) => x.kind === 'main');
  return {
    ...cleared,
    reminderId: main?.id ?? null,
    remindAt: main?.at.toISOString() ?? null,
    extraReminderIds: ids.filter((x) => x !== main).map((x) => x.id),
  };
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

export async function markPaid(bill: Bill) {
  await cancelFor(bill);
  const discount = activeDiscount(bill);
  saveBill({ ...bill, status: 'paid', paidAt: new Date().toISOString(), paidAmountMinor: discount?.payMinor ?? null, reminderId: null, remindAt: null, extraReminderIds: [] });
}

export async function markOpen(bill: Bill) {
  saveBill(await scheduleReminder({ ...bill, status: 'open', paidAt: null, paidAmountMinor: null }));
}

/** Re-reminds tomorrow at the usual reminder time. */
export async function snooze(bill: Bill) {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(getSettings().remindHour, 0, 0, 0);
  saveBill(await scheduleReminder(bill, t));
}

/** Re-plans every open bill's reminder, e.g. after the reminder time changed. */
export async function rescheduleAll() {
  for (const b of getBills().filter((x) => x.status === 'open')) saveBill(await scheduleReminder(b));
}

/** Handles taps and the notification's action buttons. Call once from the root layout. */
export function listenForResponses(): () => void {
  const N = Notifications;
  if (!N) return () => {};
  const handle = async (response: NotificationResponse) => {
    const billId = response.notification.request.content.data?.billId as string | undefined;
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
  if (!remindersAvailable) return { when: null, why: 'Reminders don’t run in Expo Go on Android. They work in the installed app.' };
  if (!bill.dueDate) return { when: null, why: 'Add a due date to get a reminder.' };
  const s = getSettings();
  const m = mainReminder(bill, { remindHour: s.remindHour, extraNudges: s.extraNudges, payStyle: s.payStyle });
  if (!m) return { when: null, why: 'The due date has passed. Pay it as soon as you can.' };
  const style = bill.payStyle ?? s.payStyle;
  const why =
    activeDiscount(bill) ? 'Before the early-payment discount runs out.'
    : style === 'early' ? 'You pay bills right away.'
    : style === 'midway' ? 'Halfway to the due date.'
    : m.getDay() === 5 && bill.remindDaysBefore < 3 ? 'Weekend reminders move to the Friday before.'
    : 'Enough time for a bank transfer to arrive.';
  return { when: shortDay(m), why };
}

export const payStyleLabel = (style: Bill['payStyle']) => PAY_STYLES.find((p) => p.key === style)?.label ?? '';
