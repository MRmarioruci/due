import { router } from 'expo-router';

/** Back when there is somewhere to go back to; otherwise home (e.g. after a reload landed on an inner screen). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * The scan screen opens only when the user asks for it. Expo can relaunch the app on the last
 * screen it showed; the scan screen checks this flag and sends a relaunch home instead.
 */
let scanRequested = false;

export function openScan(replace = false) {
  scanRequested = true;
  if (replace) router.replace('/scan');
  else router.push('/scan');
}

/** True once per request: the scan screen calls it when it mounts. */
export function takeScanRequest(): boolean {
  const r = scanRequested;
  scanRequested = false;
  return r;
}
