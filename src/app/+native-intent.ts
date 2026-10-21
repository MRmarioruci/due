/** Files shared into due from other apps arrive as an expo-sharing link; read them on the shared screen. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') return '/shared';
    return path;
  } catch {
    return path;
  }
}
