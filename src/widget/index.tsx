import { Platform } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { todayIso } from '@/lib/dates';
import { syncLanguage } from '@/i18n';
import { homeCurrency } from '@/lib/settings';
import { getBills } from '@/lib/store';
import type { Bill } from '@/lib/types';

import { widgetData } from './data';

export const WIDGET_NAME = 'Due';

// The widget module is native: it's missing in Expo Go, so load it defensively.
type WidgetModule = typeof import('react-native-android-widget');
let mod: WidgetModule | null = null;
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay a guarded runtime require
    mod = require('react-native-android-widget') as WidgetModule;
  } catch {}
}

// Loaded lazily too: the widget components import the native module.
function render(bills: Bill[]) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- only reachable where the native module exists
  const { DueWidget } = require('./DueWidget') as typeof import('./DueWidget');
  return <DueWidget data={widgetData(bills, todayIso(), homeCurrency())} />;
}

/** Runs headless when Android adds, refreshes (every 30 min) or resizes the widget. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  syncLanguage();
  if (props.widgetAction === 'WIDGET_ADDED' || props.widgetAction === 'WIDGET_UPDATE' || props.widgetAction === 'WIDGET_RESIZED') {
    props.renderWidget(render(getBills()));
  }
}

export function registerWidget() {
  try {
    mod?.registerWidgetTaskHandler(widgetTaskHandler);
  } catch {}
}

/** Redraws widgets on the home screen; call whenever bills change. No-op in Expo Go. */
export function updateWidget(bills: Bill[]) {
  mod?.requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => render(bills) }).catch(() => {});
}
