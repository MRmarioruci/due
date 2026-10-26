import { Redirect, useLocalSearchParams } from 'expo-router';

import { t } from '@/i18n/core';
import { readShareLink, SHARE_PREFIX } from '@/lib/bill-share';
import { setPendingDraft } from '@/lib/draft';
import { getSettings } from '@/lib/settings';

/** A bill someone sent from their due: check it like a scan, then save it. */
export default function Import() {
  const { d } = useLocalSearchParams<{ d?: string }>();
  if (!getSettings().onboarded) return <Redirect href="/onboarding" />;
  const draft = d ? readShareLink(SHARE_PREFIX + d, getSettings()) : null;
  if (!draft) return <Redirect href="/" />;
  setPendingDraft({ draft, warning: t('share.received') });
  return <Redirect href="/review" />;
}
