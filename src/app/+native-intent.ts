import { requestScanFromLink } from '@/lib/nav';

/**
 * Files shared into due from other apps arrive as an expo-sharing link; read them on the shared screen.
 * A bill someone sent (due://bill?d=…) opens on the import screen, and the widget's Scan square
 * (due://scan) opens the camera.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path);
    if (url.hostname === 'expo-sharing') return '/shared';
    if (url.hostname === 'scan') {
      requestScanFromLink();
      return '/scan';
    }
    if (url.hostname === 'bill' && url.searchParams.get('d')) return `/import?d=${url.searchParams.get('d')}`;
    return path;
  } catch {
    return path;
  }
}
