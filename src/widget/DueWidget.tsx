import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { t } from '@/i18n/core';

import type { WidgetData } from './data';
import { dialSvg, SCAN_ICON } from './dial-svg';

// Widget fonts are the files in assets/fonts, referenced by file name (see the plugin config in app.json).
const BG = '#0a0a0a';
const FG = '#ededed';
const DIM = '#8f8f8f';
const ACCENT = '#FF5A36';

/**
 * Home-screen widget: the app's 30-day dial, with the bill to deal with (or "All handled") in the
 * middle and a Scan square under it that opens straight into the camera. Anywhere else opens the app.
 * `size` is the widget's shorter side in dp; text scales with it.
 */
export function DueWidget({ data, size }: { data: WidgetData; size: number }) {
  const k = Math.max(0.8, Math.min(1.5, size / 170));
  const c = data.centre;
  return (
    <OverlapWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 24 }}>
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', justifyContent: 'center', alignItems: 'center' }}>
        <SvgWidget svg={dialSvg(data.dots, data.todayColor, 30, 200)} style={{ height: Math.round(size - 8), width: Math.round(size - 8) }} />
      </FlexWidget>
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGap: Math.round(3 * k) }}>
        <TextWidget
          text={c.label}
          maxLines={1}
          style={{ fontSize: Math.round(8 * k), fontFamily: 'JetBrainsMono-Regular', letterSpacing: 0.1, color: c.kind === 'focus' && c.urgent ? ACCENT : DIM }}
        />
        {c.kind === 'focus' ? (
          <>
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 3 }}>
              <TextWidget text={c.currency} style={{ fontSize: Math.round(9 * k), fontFamily: 'Archivo-Regular', color: DIM, marginBottom: Math.round(3 * k) }} />
              <TextWidget text={c.amount} maxLines={1} style={{ fontSize: Math.round(22 * k), fontFamily: 'Archivo-Regular', color: FG }} />
            </FlexWidget>
            <TextWidget text={c.payee} maxLines={1} truncate="END" style={{ fontSize: Math.round(10 * k), fontFamily: 'Archivo-Regular', color: FG }} />
          </>
        ) : (
          <>
            <TextWidget text={c.headline} maxLines={1} style={{ fontSize: Math.round(17 * k), fontFamily: 'Archivo-Regular', color: FG }} />
            {c.sub && <TextWidget text={c.sub} maxLines={1} style={{ fontSize: Math.round(9 * k), fontFamily: 'Archivo-Regular', color: DIM }} />}
          </>
        )}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'due://scan' }}
          accessibilityLabel={t('home.scan')}
          style={{ marginTop: Math.round(5 * k), height: Math.round(30 * k), width: Math.round(30 * k), backgroundColor: FG, justifyContent: 'center', alignItems: 'center' }}>
          <SvgWidget svg={SCAN_ICON} style={{ height: Math.round(16 * k), width: Math.round(16 * k) }} />
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}

/** Shown when the widget can't be drawn, so a problem is visible instead of an empty box. */
export function WidgetError({ message }: { message: string }) {
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 24, padding: 16, flexDirection: 'column', flexGap: 6 }}>
      <TextWidget text="due · widget error" style={{ fontSize: 12, color: ACCENT }} />
      <TextWidget text={message.slice(0, 300)} maxLines={5} style={{ fontSize: 11, color: FG }} />
    </FlexWidget>
  );
}
