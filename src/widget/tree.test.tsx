import { describe, expect, it, vi } from 'vitest';

// Stand-ins for the library's widgets: marked the way the real ones are, no native code.
vi.mock('react-native-android-widget', () => {
  const widget = (name: string) => Object.assign(() => null, { __name__: name });
  return { FlexWidget: widget('FlexWidget'), OverlapWidget: widget('OverlapWidget'), SvgWidget: widget('SvgWidget'), TextWidget: widget('TextWidget') };
});

import { emptyPayment, type Bill } from '../lib/types';

import { widgetData } from './data';
import { DueWidget } from './DueWidget';
import { checkWidgetTree } from './tree';

const bill = (id: string, dueDate: string): Bill => ({
  id, payee: id, description: null, amountMinor: 6490, currency: 'CHF', dueDate, issueDate: null, category: 'other', country: 'CH',
  payMethod: 'qr_transfer', payment: emptyPayment(), sources: {}, status: 'open', paidAt: null, createdAt: '2026-10-01T08:00:00Z',
  remindDaysBefore: 3, remindAt: null, reminderId: null, imageUri: null,
});

describe('widget tree', () => {
  it('builds for a bill due soon, a calm week and no bills', () => {
    for (const bills of [[bill('Swisscom', '2026-10-29')], [bill('EWZ', '2026-11-20')], []]) {
      expect(() => checkWidgetTree(<DueWidget data={widgetData(bills, '2026-10-27')} size={170} />)).not.toThrow();
    }
  });

  it('catches what the library cannot draw', () => {
    expect(() => checkWidgetTree(<><span /></>)).toThrow();
  });
});
