/**
 * Files shared into due from other apps arrive as an expo-sharing link; read them on the shared screen.
 * A bill someone sent (due://bill?d=…) opens on the import screen.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path);
    if (url.hostname === 'expo-sharing') return '/shared';
    if (url.hostname === 'bill' && url.searchParams.get('d')) return `/import?d=${url.searchParams.get('d')}`;
    return path;
  } catch {
    return path;
  }
}
