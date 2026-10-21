import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { t } from '@/i18n/core';

import type { WidgetData } from './data';

// Widget fonts are the files in assets/fonts, referenced by file name (see the plugin config in app.json).
const BG = '#0a0a0a';
const FG = '#ededed';
const DIM = '#8f8f8f';
const ACCENT = '#FF5A36';

/** Home-screen widget: 30-day total and the next bill. Tapping it opens the app. */
export function DueWidget({ data }: { data: WidgetData }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 20, padding: 16, flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 2 }}>
          <TextWidget text="due" style={{ fontSize: 17, fontFamily: 'Archivo-SemiBold', color: FG }} />
          <FlexWidget style={{ width: 5, height: 5, backgroundColor: ACCENT, marginBottom: 4 }} />
        </FlexWidget>
        <TextWidget text={t('widget.open', { n: data.count })} style={{ fontSize: 10, fontFamily: 'JetBrainsMono-Regular', color: DIM, letterSpacing: 0.05 }} />
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 6 }}>
        <TextWidget text={data.currency} style={{ fontSize: 13, fontFamily: 'Archivo-Regular', color: DIM }} />
        <TextWidget text={data.total} style={{ fontSize: 30, fontFamily: 'Archivo-SemiBold', color: FG }} />
      </FlexWidget>

      {data.next ? (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TextWidget text={`${data.next.payee} · ${data.next.amount}`} maxLines={1} truncate="END" style={{ fontSize: 13, fontFamily: 'Archivo-Regular', color: FG }} />
          <TextWidget text={data.next.when} style={{ fontSize: 11, fontFamily: 'JetBrainsMono-Regular', color: data.next.urgent ? ACCENT : DIM }} />
        </FlexWidget>
      ) : (
        <TextWidget text={t('widget.nothing')} style={{ fontSize: 13, fontFamily: 'Archivo-Regular', color: DIM }} />
      )}
    </FlexWidget>
  );
}
