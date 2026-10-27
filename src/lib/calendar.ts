// Bills in the phone's calendar: one at a time through the calendar app's own form (no
// permission needed), or kept in sync automatically in a separate "due" calendar.
import { createEventInCalendarAsync } from 'expo-calendar/legacy';

import { t } from '@/i18n/core';

import { allDayLocal, allDayUtc, billEvent, eventSig } from './calendar-event';
import { getSettings, updateSettings } from './settings';
import { getBills } from './store';
import type { Bill } from './types';

type CalendarModule = typeof import('expo-calendar');

/** Loaded lazily and defensively: Expo Go and the web don't have the native calendar module. */
function calendarModule(): CalendarModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay a guarded runtime require
    return require('expo-calendar') as CalendarModule;
  } catch {
    return null;
  }
}

/** Opens the calendar app with the bill filled in, for the user to save. Resolves false if it couldn't open. */
export async function addBillToCalendar(bill: Bill): Promise<boolean> {
  const e = billEvent(bill);
  if (!e) return false;
  try {
    await createEventInCalendarAsync({ title: e.title, notes: e.notes, allDay: true, ...allDayLocal(e.date) });
    return true;
  } catch {
    return false;
  }
}

const NAME = 'due';

/** The app's own calendar, made on first use; null without permission. */
async function dueCalendar(Cal: CalendarModule) {
  const { calendarId } = getSettings();
  const all = await Cal.getCalendars();
  const found = all.find((c) => c.id === calendarId) ?? all.find((c) => c.name === NAME && c.ownerAccount === NAME);
  if (found) {
    if (found.id !== calendarId) updateSettings({ calendarId: found.id });
    return found;
  }
  const created = await Cal.createCalendar({
    title: t('calendar.name'),
    name: NAME,
    color: '#FF5A36',
    entityType: Cal.EntityTypes.EVENT,
    source: { isLocalAccount: true, name: NAME, type: 'LOCAL' },
    ownerAccount: NAME,
    accessLevel: Cal.CalendarAccessLevel.OWNER,
    isVisible: true,
    isSynced: true,
  });
  updateSettings({ calendarId: created.id });
  return created;
}

/** Turns automatic sync on: asks for calendar access, makes the "due" calendar and fills it. */
export async function enableCalendarSync(): Promise<boolean> {
  const Cal = calendarModule();
  if (!Cal) return false;
  const perm = await Cal.requestCalendarPermissions();
  if (!perm.granted) return false;
  updateSettings({ calendarSync: true, calendarEvents: {} });
  await syncCalendar();
  return true;
}

/** Turns it off and removes the "due" calendar with every event in it. */
export async function disableCalendarSync() {
  updateSettings({ calendarSync: false, calendarEvents: {} });
  const Cal = calendarModule();
  const { calendarId } = getSettings();
  if (!Cal || !calendarId) return;
  try {
    const cal = await Cal.ExpoCalendar.get(calendarId);
    await cal.delete();
  } catch {}
  updateSettings({ calendarId: null });
}

/**
 * Brings the "due" calendar in line with the bills: an all-day event on the due date of each open
 * bill; paid and deleted bills leave it. Only events whose content changed are rewritten. Runs
 * after every change to the bills (with the reminders) and does nothing while sync is off.
 */
let running: Promise<void> | null = null;
let again = false;
export function syncCalendar(): Promise<void> {
  if (!getSettings().calendarSync) return Promise.resolve();
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
    } catch {
      // A calendar that went away or lost permission: try again on the next change.
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  const Cal = calendarModule();
  if (!Cal) return;
  if (!(await Cal.getCalendarPermissions()).granted) return;
  const cal = await dueCalendar(Cal);
  const have = { ...getSettings().calendarEvents };
  const next: typeof have = {};
  for (const bill of getBills().filter((b) => b.status === 'open')) {
    const e = billEvent(bill);
    if (!e) continue;
    const sig = eventSig(e);
    const old = have[bill.id] as (typeof have)[string] | undefined;
    delete have[bill.id];
    if (old?.sig === sig) {
      next[bill.id] = old;
      continue;
    }
    const details = { title: e.title, notes: e.notes, allDay: true, timeZone: 'UTC', alarms: [], ...allDayUtc(e.date) };
    let id: string | null = old?.eventId ?? null;
    if (id) {
      try {
        await (await Cal.ExpoCalendarEvent.get(id)).update(details);
      } catch {
        id = null; // deleted by hand: make it again
      }
    }
    if (!id) id = (await cal.createEvent(details)).id;
    next[bill.id] = { eventId: id, sig };
  }
  // Whatever is left belonged to bills that were paid or deleted.
  for (const { eventId } of Object.values(have)) {
    try {
      await (await Cal.ExpoCalendarEvent.get(eventId)).delete();
    } catch {}
  }
  updateSettings({ calendarEvents: next });
}
