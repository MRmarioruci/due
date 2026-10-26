import { t } from '@/i18n/core';
import { contractOf, nextReview, type Contract } from '@/lib/contracts';
import { addDaysIso, longDate, todayIso } from '@/lib/dates';
import { saveContract } from '@/lib/reminders';
import { getSettings } from '@/lib/settings';

import { pickDate } from './calendar';
import { sheet, toast } from './overlay';

const nextFrame = () => new Promise((r) => setTimeout(r, 80));

/** "Review by" for a biller's contract: add one, or change, repeat or remove the one there is. */
export function editContract(payee: string) {
  const current = contractOf(payee, getSettings().contracts);
  if (!current) return pickContract(payee, null);
  sheet.show({
    title: t('contract.section'),
    message: t('contract.manageText', { date: longDate(nextReview(current, todayIso()) ?? current.reviewBy) }),
    actions: [
      { label: t('contract.changeDate'), kind: 'primary', onPress: () => nextFrame().then(() => pickContract(payee, current)) },
      { label: current.yearly ? t('contract.makeOnce') : t('contract.makeYearly'), kind: 'secondary', onPress: () => saveContract(payee, { ...current, yearly: !current.yearly }) },
      {
        label: t('contract.remove'),
        kind: 'destructive',
        onPress: async () => {
          await saveContract(payee, null);
          toast(t('contract.removed'));
        },
      },
    ],
  });
}

/** The date, then (for a new one) whether it comes back every year. */
async function pickContract(payee: string, current: Contract | null) {
  const date = await pickDate(t('contract.pickTitle'), current?.reviewBy ?? addDaysIso(todayIso(), 30));
  if (!date) return;
  const done = async (yearly: boolean) => {
    await saveContract(payee, { reviewBy: date, yearly });
    toast(t('contract.saved', { date: longDate(date) }));
  };
  if (current) return done(current.yearly);
  await nextFrame();
  sheet.show({
    title: t('contract.repeatTitle'),
    message: t('contract.repeatText'),
    actions: [
      { label: t('contract.everyYear'), kind: 'primary', onPress: () => done(true) },
      { label: t('contract.once'), kind: 'secondary', onPress: () => done(false) },
    ],
  });
}
