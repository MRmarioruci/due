import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { addDaysIso, reminderMoment, shortDay, todayIso, daysBetween } from './dates';
import { formatMoney } from './money';
import { Notifications } from './notifications-module';
import { getBill, saveBill } from './store';
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

/** Cancels the bill's current reminder and schedules the next one. Returns the bill with reminder fields updated. */
export async function scheduleReminder(bill: Bill, at?: Date): Promise<Bill> {
  if (!Notifications) return { ...bill, reminderId: null, remindAt: null };
  if (bill.reminderId) await Notifications.cancelScheduledNotificationAsync(bill.reminderId).catch(() => {});
  const when = at ?? (bill.status === 'open' && bill.dueDate ? reminderMoment(bill.dueDate, bill.remindDaysBefore) : null);
  if (!when) return { ...bill, reminderId: null, remindAt: null };

  const days = bill.dueDate ? daysBetween(todayIso(when), bill.dueDate) : null;
  const dueText = bill.dueDate == null ? '' : days === 0 ? 'Due today.' : days === 1 ? 'Due tomorrow.' : `Due ${shortDay(bill.dueDate)}.`;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${bill.payee} · ${formatMoney(bill.amountMinor, bill.currency)}`,
      body: `${dueText} Tap to open the QR code.`.trim(),
      data: { billId: bill.id },
      categoryIdentifier: CATEGORY,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
  });
  return { ...bill, reminderId: id, remindAt: when.toISOString() };
}

export async function markPaid(bill: Bill) {
  if (bill.reminderId) await Notifications?.cancelScheduledNotificationAsync(bill.reminderId).catch(() => {});
  saveBill({ ...bill, status: 'paid', paidAt: new Date().toISOString(), reminderId: null, remindAt: null });
}

export async function markOpen(bill: Bill) {
  saveBill(await scheduleReminder({ ...bill, status: 'open', paidAt: null }));
}

/** Re-reminds tomorrow at 09:00. */
export async function snooze(bill: Bill) {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  saveBill(await scheduleReminder(bill, t));
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

/** Human description of when the reminder fires, for the review screen. */
export function describeReminder(dueDate: string | null, daysBefore: number): { when: string | null; why: string } {
  if (!remindersAvailable) return { when: null, why: 'Reminders don’t run in Expo Go on Android. They work in a development build.' };
  if (!dueDate) return { when: null, why: 'Add a due date to get a reminder.' };
  const m = reminderMoment(dueDate, daysBefore);
  if (!m) return { when: null, why: 'That moment has already passed. Pick a shorter lead time.' };
  const nominal = addDaysIso(dueDate, -daysBefore);
  const moved = todayIso(m) !== nominal;
  return {
    when: shortDay(m),
    why: moved ? 'Weekend reminders move to the Friday before.' : daysBefore >= 2 ? 'Enough time for a bank transfer to arrive.' : 'Instant transfers make this fine.',
  };
}
