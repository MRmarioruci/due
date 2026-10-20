import { router } from 'expo-router';

/** Back when there is somewhere to go back to; otherwise home (e.g. after a reload landed on an inner screen). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
