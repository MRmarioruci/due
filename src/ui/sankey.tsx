import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

/**
 * A two-column Sankey: one income bar on the left, one bar per destination on the right, and a
 * stream from each part of the income to its destination. Streams pour out of the income bar on
 * load, one after another, and their bars appear as they arrive.
 */
export type SankeyNode = { key: string; minor: number; color: string; streamOpacity: number };
export type SankeyLayout = { x2: number; incomeTop: number; incomeH: number; nodes: (SankeyNode & { y: number; h: number; ya: number; ha: number })[] };

const BAR = 10;
const GAP = 14;
const MIN_H = 2;

/** Where everything sits: income centred on the left, nodes stacked on the right with gaps. */
export function sankeyLayout(nodes: SankeyNode[], totalMinor: number, width: number, height: number): SankeyLayout {
  const total = Math.max(1, totalMinor);
  const scale = (height - GAP * Math.max(0, nodes.length - 1)) / total;
  const incomeH = Math.max(MIN_H, nodes.reduce((s, n) => s + n.minor, 0) * scale);
  const incomeTop = (height - incomeH) / 2;
  let ya = incomeTop;
  let yb = 0;
  const laid = nodes.map((n) => {
    const ha = n.minor * scale;
    const h = Math.max(MIN_H, ha);
    const out = { ...n, y: yb, h, ya, ha };
    ya += ha;
    yb += h + GAP;
    return out;
  });
  return { x2: Math.round(width * 0.46), incomeTop, incomeH, nodes: laid };
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const EASE = Easing.inOut(Easing.cubic);

export function Sankey({ layout, width, height, incomeColor }: { layout: SankeyLayout; width: number; height: number; incomeColor: string }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [grow]);
  const incomeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));

  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {layout.nodes.map((n, i) => (
          <Stream key={n.key} node={n} x1={BAR} x2={layout.x2} delay={250 + i * 110} />
        ))}
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: 0, top: layout.incomeTop, width: BAR, height: layout.incomeH, backgroundColor: incomeColor }, incomeStyle]} />
      {layout.nodes.map((n, i) => (
        <Bar key={n.key} x={layout.x2} y={n.y} h={n.h} color={n.color} delay={250 + i * 110 + 650} />
      ))}
    </View>
  );
}

/** One stream, its far end travelling from the income bar to its destination. */
function Stream({ node, x1, x2, delay }: { node: SankeyLayout['nodes'][number]; x1: number; x2: number; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 750, easing: EASE }));
  }, [p, delay]);
  const { ya, ha, y, h } = node;
  const props = useAnimatedProps(() => {
    // The far end slides out and its edges ease from the source band to the destination band.
    const xe = x1 + (x2 - x1) * p.value;
    const xm = (x1 + xe) / 2;
    const top = ya + (y - ya) * p.value;
    const bottom = ya + ha + (y + h - (ya + ha)) * p.value;
    return { d: `M${x1} ${ya} C${xm} ${ya} ${xm} ${top} ${xe} ${top} L${xe} ${bottom} C${xm} ${bottom} ${xm} ${ya + ha} ${x1} ${ya + ha} Z` };
  });
  return <AnimatedPath fill={node.color} fillOpacity={node.streamOpacity} animatedProps={props} />;
}

function Bar({ x, y, h, color, delay }: { x: number; y: number; h: number; color: string; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration: 260 }));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: y, width: BAR, height: h, backgroundColor: color }, style]} />;
}
