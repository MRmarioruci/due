import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { t } from '@/i18n/core';
import { goBack } from '@/lib/nav';
import { Icon, IconButton, T } from '@/ui/kit';
import { parsePeriod, useMoneyFlow } from '@/ui/money-flow';
import { toast } from '@/ui/overlay';
import { Sankey } from '@/ui/sankey';
import { C, F, GUTTER, themed } from '@/ui/theme';

/** The image is 4:5 at 1080 × 1350, the size feeds and Reddit show without cropping. */
const OUT_W = 1080;
const OUT_H = 1350;

/** A postable picture of "Where it goes": a still Sankey with a title, amounts or percentages only. */
export default function FlowShare() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { period } = useLocalSearchParams<{ period?: string }>();
  const m = useMoneyFlow(parsePeriod(period));
  const [amounts, setAmounts] = useState(true);
  const [busy, setBusy] = useState(false);
  const card = useRef<View>(null);
  const w = Math.min(width - GUTTER * 2, 400);
  const h = (w * OUT_H) / OUT_W;
  const pad = Math.round(w * 0.06);

  async function share() {
    setBusy(true);
    try {
      const uri = await captureRef(card, { format: 'png', width: OUT_W, height: OUT_H, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('flow.share') });
    } catch (e) {
      toast(t('flow.shareFailed', { error: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  const facts = [
    amounts && t('flow.cardIncome', { amount: `${m.ccy} ${m.short(m.total)}` }),
    t('flow.cardSpent', { pct: m.pct(m.spent) }),
    m.saved > 0 && t('flow.cardSaved', { pct: m.pct(m.saved) }),
    m.free > 0 && t('flow.cardLeft', { pct: m.pct(m.free) }),
  ].filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 24 }}>
        <View style={st.header}>
          <IconButton label={t('common.close')} onPress={() => goBack()} style={{ marginLeft: -12, borderWidth: 0 }}>
            <Icon name="close" />
          </IconButton>
          <T style={{ fontFamily: F.semibold, fontSize: 15 }}>{t('flow.share')}</T>
          <View style={{ width: 44 }} />
        </View>

        {/* What gets captured: everything inside this box, scaled up to 1080 × 1350. */}
        <View ref={card} collapsable={false} style={[st.card, { width: w, height: h, padding: pad }]}>
          <T style={st.cardEyebrow}>{t('flow.cardEyebrow')}</T>
          <T style={[st.cardTitle, { fontSize: w * 0.075, lineHeight: w * 0.085 }]}>{m.label}</T>
          <T style={st.cardFacts} numberOfLines={2}>{facts.join('  ·  ')}</T>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Sankey model={m.model} width={w - pad * 2} height={h * 0.6} labelW={Math.round(w * 0.3)} styleOf={m.styleOf(amounts)} animate={false} />
          </View>
          <View style={st.cardFoot}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              <T style={st.logo}>due</T>
              <View style={st.logoDot} />
            </View>
            <T style={st.footText}>{t('flow.cardFoot')}</T>
          </View>
        </View>

        <View style={st.segment} accessibilityRole="tablist">
          {[true, false].map((a) => {
            const on = a === amounts;
            return (
              <Pressable key={String(a)} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setAmounts(a)} style={[st.segItem, on && { backgroundColor: C.fg }]}>
                <T style={{ fontFamily: F.medium, fontSize: 13.5, color: on ? C.bg : C.dim }}>{a ? t('flow.withAmounts') : t('flow.percentOnly')}</T>
              </Pressable>
            );
          })}
        </View>
        <T style={st.note}>{t('flow.shareNote')}</T>

        <Pressable accessibilityRole="button" disabled={busy} onPress={share} style={({ pressed }) => [st.primary, (busy || pressed) && { opacity: 0.7 }]}>
          <Icon name="share" color={C.bg} size={18} />
          <T style={st.primaryText}>{t('flow.shareImage')}</T>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  card: { marginTop: 14, alignSelf: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  cardEyebrow: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: C.dim },
  cardTitle: { marginTop: 6, fontFamily: F.regular, letterSpacing: -1, color: C.fg },
  cardFacts: { marginTop: 8, fontSize: 12, lineHeight: 17, color: C.muted },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  logo: { fontFamily: F.semibold, fontSize: 16, letterSpacing: -0.5, lineHeight: 18, color: C.fg },
  logoDot: { width: 5, height: 5, backgroundColor: C.accent, marginBottom: 4 },
  footText: { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.8, color: C.dim },
  segment: { marginTop: 18, flexDirection: 'row', borderWidth: 1, borderColor: C.line, padding: 3 },
  segItem: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 10, fontSize: 12.5, lineHeight: 18, color: C.dim, textAlign: 'center' },
  primary: { marginTop: 18, height: 56, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fg },
  primaryText: { fontFamily: F.semibold, fontSize: 15, color: C.bg },
}));
