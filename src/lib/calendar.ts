// Bills in the phone's calendar: one at a time through the calendar app's own form (no
// permission needed), or kept in sync automatically in a calendar the user picks, by default the
// main one of their Google account, so the bills show in Google Calendar everywhere.
// (An earlier version made its own calendar on the phone; Google Calendar never shows those.)
import { createEventInCalendarAsync } from 'expo-calendar/legacy';


import { allDayLocal, allDayUtc, billEvent, calendarLabel, defaultCalendar, eventSig, isOldDueCalendar, writableCalendars, type CalendarInfo } from './calendar-event';
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

type Calendar = Awaited<ReturnType<CalendarModule['getCalendars']>>[number];

/** The phone's event calendars; the old phone-only "due" calendar is removed on the way. */
async function calendars(Cal: CalendarModule): Promise<Calendar[]> {
  const all = await Cal.getCalendars(Cal.EntityTypes.EVENT);
  const old = all.filter((c) => isOldDueCalendar(c as unknown as CalendarInfo));
  for (const c of old) {
    try {
      await c.delete();
    } catch {}
  }
  if (old.length) updateSettings({ calendarEvents: {} });
  return all.filter((c) => !old.includes(c));
}

/** Calendars the user can pick for their bills; empty without access. */
export async function pickableCalendars(): Promise<CalendarInfo[]> {
  const Cal = calendarModule();
  if (!Cal || !(await Cal.getCalendarPermissions()).granted) return [];
  return writableCalendars((await calendars(Cal)) as unknown as CalendarInfo[]);
}

/** The calendar bills go into: the one picked, else the default (remembered from then on). */
async function target(Cal: CalendarModule): Promise<Calendar | null> {
  const all = await calendars(Cal);
  const infos = all as unknown as CalendarInfo[];
  const { calendarId } = getSettings();
  const chosen = writableCalendars(infos).find((c) => c.id === calendarId) ?? defaultCalendar(infos);
  if (!chosen) return null;
  if (chosen.id !== calendarId || getSettings().calendarName !== calendarLabel(chosen)) updateSettings({ calendarId: chosen.id, calendarName: calendarLabel(chosen) });
  return all.find((c) => c.id === chosen.id) ?? null;
}

/** Turns automatic sync on: asks for calendar access and fills the calendar. Resolves its name, or null without access. */
export async function enableCalendarSync(): Promise<string | null> {
  const Cal = calendarModule();
  if (!Cal) return null;
  const perm = await Cal.requestCalendarPermissions();
  if (!perm.granted) return null;
  updateSettings({ calendarSync: true, calendarEvents: {} });
  await syncCalendar();
  return getSettings().calendarName;
}

/** Removes the events due added; the calendar itself is the user's and stays. */
async function removeEvents() {
  const Cal = calendarModule();
  const events = Object.values(getSettings().calendarEvents);
  updateSettings({ calendarEvents: {} });
  if (!Cal) return;
  for (const { eventId } of events) {
    try {
      await (await Cal.ExpoCalendarEvent.get(eventId)).delete();
    } catch {}
  }
}

/** Turns sync off and takes the bills out of the calendar. */
export async function disableCalendarSync() {
  updateSettings({ calendarSync: false });
  await running;
  await removeEvents();
}

/** Moves the bills to another calendar. */
export async function moveToCalendar(cal: CalendarInfo) {
  await running;
  await removeEvents();
  updateSettings({ calendarId: cal.id, calendarName: calendarLabel(cal) });
  await syncCalendar();
}

/**
 * Brings the calendar in line with the bills: an all-day event on the due date of each open
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
  const cal = await target(Cal);
  if (!cal) return;
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
