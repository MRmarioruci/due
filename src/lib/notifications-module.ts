// expo-notifications sets up push support as soon as it's imported. In Expo Go on Android
// (no push support since SDK 53) that throws and would take the whole app down, even though
// due only uses local notifications. So it's loaded defensively: in Expo Go on Android it's
// null and reminders are off; in development and release builds it's the real module.

type NotificationsModule = typeof import('expo-notifications');

let mod: NotificationsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay a guarded runtime require
  mod = require('expo-notifications') as NotificationsModule;
} catch (err) {
  console.warn('[notifications] expo-notifications can’t load here (Expo Go on Android); reminders are off. Use a development build to test them.', err);
}

export const Notifications = mod;
