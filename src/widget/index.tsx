import { Platform } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { todayIso } from '@/lib/dates';
import { syncLanguage } from '@/i18n';
import { getBills } from '@/lib/store';
import type { Bill } from '@/lib/types';

import { widgetData } from './data';

export const WIDGET_NAME = 'Due';

// The widget module is native: it's missing in Expo Go, so load it defensively.
type WidgetModule = typeof import('react-native-android-widget');
let mod: WidgetModule | null = null;
/** Why the widget can't run in this build, if it can't (shown in Settings). Null when it's fine or in Expo Go. */
export let widgetProblem: string | null = null;
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay a guarded runtime require
    mod = require('react-native-android-widget') as WidgetModule;
  } catch (err) {
    // Expected in Expo Go, which lacks the native module; anywhere else it's a real problem.
    if (!isExpoGo()) widgetProblem = `load: ${String((err as Error)?.message ?? err)}`;
  }
}

function isExpoGo(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- tiny optional lookup
    return require('expo-constants').default?.executionEnvironment === 'storeClient';
  } catch {
    return false;
  }
}

/** The widget's size, for drawing the dial to fit: its shorter side, in dp. */
type Size = { width: number; height: number };
const sideOf = (s: Size) => Math.max(110, Math.min(s.width, s.height) || 170);

// Loaded lazily too: the widget components import the native module.
function render(bills: Bill[], size: Size) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- only reachable where the native module exists
  const { DueWidget } = require('./DueWidget') as typeof import('./DueWidget');
  return <DueWidget data={widgetData(bills, todayIso())} size={sideOf(size)} />;
}

/** If drawing fails, show the error on the widget itself instead of leaving an empty box. */
function renderSafely(load: () => Bill[], size: Size) {
  try {
    return render(load(), size);
  } catch (err) {
    console.error('[widget]', err);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- only reachable where the native module exists
    const { WidgetError } = require('./DueWidget') as typeof import('./DueWidget');
    return <WidgetError message={String((err as Error)?.message ?? err)} />;
  }
}

/** Runs headless when Android adds, refreshes (every 30 min) or resizes the widget. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_ADDED' || props.widgetAction === 'WIDGET_UPDATE' || props.widgetAction === 'WIDGET_RESIZED') {
    props.renderWidget(
      renderSafely(() => {
        syncLanguage();
        return getBills();
      }, props.widgetInfo),
    );
  }
}

export function registerWidget() {
  try {
    mod?.registerWidgetTaskHandler(widgetTaskHandler);
  } catch (err) {
    widgetProblem = `register: ${String((err as Error)?.message ?? err)}`;
  }
}

/** Redraws widgets on the home screen; call whenever bills change. No-op in Expo Go. */
export function updateWidget(bills: Bill[]) {
  mod?.requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: (info) => renderSafely(() => bills, info) }).catch((e) => console.warn('[widget] update failed', e));
}
