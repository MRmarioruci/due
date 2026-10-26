import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { SankeyLink, SankeyModel, SankeyNode } from '@/lib/sankey-model';

import { T } from './kit';
import { C, F, themed } from './theme';

/**
 * Draws a SankeyModel left to right: a bar per node, a stream per link, and each node's name and
 * amount beside it. Animated, the streams pour out column by column; still (for the share image),
 * it draws in one go.
 */
const BAR = 8;
const GAP = 12;
const LABEL_H = 30;

export type NodeStyle = { label: string; value: string; color: string; strong?: boolean };
type Placed = SankeyNode & { x: number; y: number; h: number };
type Laid = { nodes: Placed[]; links: (SankeyLink & { x1: number; x2: number; y1: number; y2: number; h: number; col: number; color: string })[]; labels: Record<string, number> };

function layout(model: SankeyModel, width: number, height: number, labelW: number, colorOf: (n: SankeyNode) => string): Laid {
  const cols = Array.from({ length: model.columns }, (_, c) => model.nodes.filter((n) => n.col === c));
  const span = width - labelW - BAR;
  const xOf = (c: number) => (model.columns === 1 ? 0 : (c * span) / (model.columns - 1));
  const scale = Math.min(...cols.map((ns) => (height - GAP * Math.max(0, ns.length - 1)) / Math.max(1, ns.reduce((s, n) => s + n.minor, 0))));
  const nodes: Placed[] = [];
  for (const [c, ns] of cols.entries()) {
    const used = ns.reduce((s, n) => s + Math.max(2, n.minor * scale), 0) + GAP * Math.max(0, ns.length - 1);
    let y = (height - used) / 2;
    for (const n of ns) {
      const h = Math.max(2, n.minor * scale);
      nodes.push({ ...n, x: xOf(c), y, h });
      y += h + GAP;
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outY = new Map(nodes.map((n) => [n.id, n.y]));
  const inY = new Map(nodes.map((n) => [n.id, n.y]));
  const links = model.links.map((l) => {
    const a = byId.get(l.from)!;
    const b = byId.get(l.to)!;
    const h = l.minor * scale;
    const y1 = outY.get(a.id)!;
    const y2 = inY.get(b.id)!;
    outY.set(a.id, y1 + h);
    inY.set(b.id, y2 + h);
    return { ...l, x1: a.x + BAR, x2: b.x, y1, y2, h, col: a.col, color: colorOf(b) };
  });
  // Labels centre on their bar but never overlap within a column.
  const labels: Record<string, number> = {};
  for (const ns of cols) {
    let prev = -Infinity;
    const placed = ns.map((n) => byId.get(n.id)!);
    for (const n of placed) {
      const top = Math.max(n.y + n.h / 2 - LABEL_H / 2, prev + LABEL_H, -4);
      labels[n.id] = top;
      prev = top;
    }
    const over = prev - (height - LABEL_H + 4);
    if (over > 0) for (const n of placed) labels[n.id] -= over;
  }
  return { nodes, links, labels };
}

export function Sankey({
  model,
  width,
  height,
  labelW,
  styleOf,
  selected,
  onPress,
  animate = true,
}: {
  model: SankeyModel;
  width: number;
  height: number;
  labelW: number;
  styleOf: (n: SankeyNode) => NodeStyle;
  selected?: string | null;
  onPress?: (n: SankeyNode) => void;
  animate?: boolean;
}) {
  const { nodes, links, labels } = layout(model, width, height, labelW, (n) => styleOf(n).color);
  const lastCol = model.columns - 1;
  const colX = (c: number) => nodes.find((n) => n.col === c)?.x ?? 0;
  const delayOf = (col: number, i: number) => (animate ? 150 + col * 520 + i * 50 : 0);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {links.map((l, i) => {
          const on = !selected || selected === l.to || selected === l.from;
          return <Stream key={`${l.from}>${l.to}`} link={l} opacity={on ? 0.42 : 0.12} delay={delayOf(l.col, i)} animate={animate} />;
        })}
      </Svg>
      {nodes.map((n) => (
        <Bar key={n.id} node={n} color={styleOf(n).color} delay={n.col === 0 ? 0 : delayOf(n.col - 1, 0) + 520} animate={animate} />
      ))}
      {nodes.map((n) => {
        const s = styleOf(n);
        const maxW = n.col === lastCol ? labelW - 6 : colX(n.col + 1) - n.x - BAR - 12;
        const on = selected === n.id;
        return (
          <Label key={n.id} delay={n.col === 0 ? 300 : delayOf(n.col - 1, 0) + 650} animate={animate} style={{ left: n.x + BAR + 6, top: labels[n.id], width: maxW }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${s.label}, ${s.value}`} disabled={!onPress} onPress={() => onPress?.(n)} style={st.label}>
              <T style={[st.name, n.col < lastCol && st.over, (s.strong || on) && { fontFamily: F.semibold, color: C.fg }]} numberOfLines={1}>
                {s.label}
              </T>
              <T style={[st.value, n.col < lastCol && st.over, n.col < lastCol && { color: C.muted }, on && { color: C.fg }]} numberOfLines={1}>
                {s.value}
              </T>
            </Pressable>
          </Label>
        );
      })}
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const EASE = Easing.inOut(Easing.cubic);

/** One stream; animated, its far end travels from the source to its destination. */
function Stream({ link, opacity, delay, animate }: { link: Laid['links'][number]; opacity: number; delay: number; animate: boolean }) {
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) p.value = withDelay(delay, withTiming(1, { duration: 650, easing: EASE }));
  }, [p, delay, animate]);
  const { x1, x2, y1, y2, h } = link;
  const props = useAnimatedProps(() => {
    const xe = x1 + (x2 - x1) * p.value;
    const xm = (x1 + xe) / 2;
    const top = y1 + (y2 - y1) * p.value;
    return { d: `M${x1} ${y1} C${xm} ${y1} ${xm} ${top} ${xe} ${top} L${xe} ${top + h} C${xm} ${top + h} ${xm} ${y1 + h} ${x1} ${y1 + h} Z` };
  });
  return <AnimatedPath fill={link.color} fillOpacity={opacity} animatedProps={props} />;
}

function Bar({ node, color, delay, animate }: { node: Placed; color: string; delay: number; animate: boolean }) {
  const v = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) v.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, [v, delay, animate]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scaleY: 0.3 + 0.7 * v.value }] }));
  return <Animated.View style={[{ position: 'absolute', left: node.x, top: node.y, width: BAR, height: node.h, backgroundColor: color }, style]} />;
}

function Label({ delay, animate, style, children }: { delay: number; animate: boolean; style: object; children: React.ReactNode }) {
  const v = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) v.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, [v, delay, animate]);
  const a = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[{ position: 'absolute', height: LABEL_H, justifyContent: 'center' }, style, a]}>{children}</Animated.View>;
}

const st = themed(() => StyleSheet.create({
  label: { alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: 1 },
  name: { fontSize: 11.5, lineHeight: 14, color: C.muted },
  value: { fontFamily: F.mono, fontSize: 10, lineHeight: 13, color: C.dim },
  // Labels that sit on top of streams get a soft halo in the background colour, to stay readable.
  over: { textShadowColor: C.bg, textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
}));
