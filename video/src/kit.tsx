// Shared pieces: format-aware layout, the scene shell with its cuts, camera shake, grain, kinetic
// type, the phone, the payment QR, and sound cues.

import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, MONO } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const useVertical = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

/** 0→1 spring from frame `from`. */
export const useSpring = (from: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - from, fps, config: { damping: 13, stiffness: 170, mass: 0.7, ...config } });
};

/** A short, decaying jolt after each hit in `hits` (frames). Returns a CSS translate. */
export const useShake = (hits: number[], strength = 22) => {
  const frame = useCurrentFrame();
  let x = 0;
  let y = 0;
  let r = 0;
  for (const h of hits) {
    const t = frame - h;
    if (t < 0 || t > 14) continue;
    const k = Math.exp(-t / 3.2) * strength;
    x += (random(`sx${h}-${frame}`) - 0.5) * 2 * k;
    y += (random(`sy${h}-${frame}`) - 0.5) * 2 * k;
    r += (random(`sr${h}-${frame}`) - 0.5) * k * 0.05;
  }
  return { translate: `${x}px ${y}px`, rotate: `${r}deg` };
};

/** Film grain and a vignette over everything. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)" }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity, mixBlendMode: "overlay" }}>
        <filter id={`g${frame % 6}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 6} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${frame % 6})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Thin grid lines drifting slowly, the app's hairline look as a backdrop. */
export const Grid: React.FC<{ opacity?: number; speed?: number; size?: number }> = ({ opacity = 0.5, speed = 0.4, size = 120 }) => {
  const frame = useCurrentFrame();
  const o = (frame * speed) % size;
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${o}px ${o}px`,
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
      }}
    />
  );
};

/** A soft accent glow that can pulse. */
export const Glow: React.FC<{ x?: string; y?: string; size?: number; opacity?: number; color?: string }> = ({ x = "50%", y = "50%", size = 900, opacity = 0.35, color = C.accent }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      marginLeft: -size / 2,
      marginTop: -size / 2,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 62%)`,
      opacity,
      filter: "blur(40px)",
    }}
  />
);

type Cut = "whip" | "zoom" | "cut" | "flash";

/**
 * The scene shell: background, a hard-hitting entry and exit (a whip pan with motion blur, a zoom
 * punch, or a white flash) so the cuts feel like one continuous, fast film.
 */
export const Scene: React.FC<{ children: React.ReactNode; enter?: Cut; exit?: Cut; bg?: string; grid?: boolean; dir?: 1 | -1 }> = ({
  children,
  enter = "zoom",
  exit = "zoom",
  bg = C.bg,
  grid = true,
  dir = 1,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const IN = 7;
  const OUT = 6;
  const pin = interpolate(frame, [0, IN], [0, 1], { ...clamp, easing: EASE_OUT });
  const pout = interpolate(frame, [durationInFrames - OUT, durationInFrames], [0, 1], { ...clamp, easing: EASE_IN });

  let tx = 0;
  let sc = 1;
  let blur = 0;
  let op = 1;
  if (enter === "whip") {
    tx += (1 - pin) * width * 0.6 * dir;
    blur += (1 - pin) * 30;
  }
  if (enter === "zoom") {
    sc *= 1 + (1 - pin) * 0.35;
    blur += (1 - pin) * 16;
    op *= pin;
  }
  if (exit === "whip") {
    tx -= pout * width * 0.6 * dir;
    blur += pout * 30;
  }
  if (exit === "zoom") {
    sc *= 1 + pout * 0.6;
    blur += pout * 18;
    op *= 1 - pout;
  }
  const flashIn = enter === "flash" ? interpolate(frame, [0, 2, 6], [1, 0.9, 0], clamp) : 0;
  const flashOut = exit === "flash" ? interpolate(frame, [durationInFrames - 3, durationInFrames], [0, 1], clamp) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: FONT, color: C.fg, overflow: "hidden" }}>
      {grid && <Grid />}
      <AbsoluteFill style={{ translate: `${tx}px 0px`, scale: String(sc), filter: blur ? `blur(${blur}px)` : undefined, opacity: op }}>{children}</AbsoluteFill>
      <Grain />
      {(flashIn > 0 || flashOut > 0) && <AbsoluteFill style={{ background: "#fff", opacity: Math.max(flashIn, flashOut) }} />}
    </AbsoluteFill>
  );
};

/**
 * One word or line that slams in: from big and blurred to sharp, with an RGB split for a few frames.
 */
export const Slam: React.FC<{ text: string; at?: number; size: number; color?: string; weight?: number; mono?: boolean; from?: number; split?: boolean; style?: React.CSSProperties }> = ({
  text,
  at = 0,
  size,
  color = C.fg,
  weight = 900,
  mono,
  from = 2.4,
  split = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const p = interpolate(t, [0, 5], [0, 1], { ...clamp, easing: EASE_OUT });
  const s = from + (1 - from) * p;
  const blur = (1 - p) * 24;
  const rgb = split ? interpolate(t, [0, 3, 9], [18, 10, 0], clamp) : 0;
  return (
    <div
      style={{
        fontFamily: mono ? MONO : FONT,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 0.95,
        letterSpacing: mono ? 0 : -size * 0.045,
        color,
        scale: String(s),
        filter: blur ? `blur(${blur}px)` : undefined,
        opacity: Math.min(1, p * 2),
        textShadow: rgb ? `${rgb}px 0 0 rgba(255,90,54,0.85), ${-rgb}px 0 0 rgba(80,200,255,0.7)` : undefined,
        whiteSpace: "pre",
        ...style,
      }}
    >
      {text}
    </div>
  );
};

/** Words rise in one after another, from behind a mask. `accent` words get the accent colour. */
export const Words: React.FC<{ text: string; at?: number; size: number; stagger?: number; accent?: string[]; color?: string; weight?: number; align?: "left" | "center"; style?: React.CSSProperties }> = ({
  text,
  at = 0,
  size,
  stagger = 3,
  accent = [],
  color = C.fg,
  weight = 800,
  align = "left",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ fontFamily: FONT, fontWeight: weight, fontSize: size, lineHeight: 1.02, letterSpacing: -size * 0.04, color, textAlign: align, textWrap: "balance", ...style }}>
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: frame - at - i * stagger, fps, config: { damping: 16, stiffness: 180, mass: 0.6 } });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", marginRight: "0.22em", paddingBottom: "0.08em" }}>
            <span style={{ display: "inline-block", translate: `0px ${(1 - s) * 110}%`, rotate: `${(1 - s) * 8}deg`, color: accent.includes(w.replace(/[.,!?]/g, "")) ? C.accent : undefined }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

/** A small mono label, typed out letter by letter with a block cursor. */
export const Typed: React.FC<{ text: string; at?: number; size?: number; color?: string; speed?: number; style?: React.CSSProperties }> = ({ text, at = 0, size = 28, color = C.muted, speed = 1.4, style }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.floor((frame - at) * speed));
  if (frame < at) return null;
  const done = n >= text.length;
  return (
    <div style={{ fontFamily: MONO, fontSize: size, letterSpacing: size * 0.08, color, whiteSpace: "pre", ...style }}>
      {text.slice(0, n)}
      <span style={{ display: "inline-block", width: size * 0.6, height: size * 0.95, marginLeft: 4, verticalAlign: "-0.12em", background: C.accent, opacity: done ? (Math.floor(frame / 8) % 2 ? 0 : 1) : 1 }} />
    </div>
  );
};

/** The due mark: "due" with the orange square. `dot` 0→1 drops the square in. */
export const Logo: React.FC<{ size: number; dot?: number; letters?: number[] }> = ({ size, dot = 1, letters = [1, 1, 1] }) => (
  <div style={{ display: "flex", alignItems: "flex-end", fontFamily: FONT, fontWeight: 700, fontSize: size, letterSpacing: -size * 0.04, lineHeight: 1, color: C.fg }}>
    {["d", "u", "e"].map((l, i) => (
      <span key={l} style={{ display: "inline-block", opacity: Math.min(1, letters[i] * 1.5), translate: `0px ${(1 - letters[i]) * -size * 0.8}px`, filter: letters[i] < 1 ? `blur(${(1 - letters[i]) * 10}px)` : undefined }}>
        {l}
      </span>
    ))}
    <span
      style={{
        display: "inline-block",
        width: size * 0.27,
        height: size * 0.27,
        background: C.accent,
        marginLeft: size * 0.07,
        marginBottom: size * 0.2,
        translate: `0px ${(1 - dot) * -size * 2.2}px`,
        boxShadow: `0 0 ${size * 0.5}px rgba(255,90,54,${0.6 * dot})`,
      }}
    />
  </div>
);

/** The phone: a 390×844 screen in a thin black frame, scaled to `height`. */
export const Phone: React.FC<{ children: React.ReactNode; height: number; style?: React.CSSProperties; bg?: string }> = ({ children, height, style, bg = C.bg }) => {
  const W = 390;
  const H = 844;
  const scale = height / (H + 24);
  return (
    <div style={{ width: (W + 24) * scale, height, position: "relative", ...style }}>
      <div
        style={{
          position: "absolute",
          width: W + 24,
          height: H + 24,
          scale: String(scale),
          transformOrigin: "0 0",
          borderRadius: 60,
          background: "linear-gradient(145deg, #2a2a2a, #0d0d0d 40%, #1c1c1c)",
          padding: 12,
          boxShadow: "0 60px 140px rgba(0,0,0,0.8), 0 0 0 1px #333, 0 0 120px rgba(255,90,54,0.12)",
        }}
      >
        <div style={{ width: W, height: H, borderRadius: 48, overflow: "hidden", position: "relative", background: bg, fontFamily: FONT, color: C.fg }}>
          {children}
          <div style={{ position: "absolute", top: 11, left: W / 2 - 58, width: 116, height: 32, borderRadius: 18, background: "#000" }} />
        </div>
      </div>
    </div>
  );
};

/** A payment QR (a stand-in pattern with real finder squares and due's mark), revealed module by module with `reveal` 0→1. */
export const QR: React.FC<{ size: number; reveal?: number; seed?: string }> = ({ size, reveal = 1, seed = "kpt" }) => {
  const n = 29;
  const m = size / (n + 4);
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      const dx = x - fx;
      const dy = y - fy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0;
    }
    return -1;
  };
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const f = finder(x, y);
      const center = Math.abs(x - n / 2 + 0.5) < 3.5 && Math.abs(y - n / 2 + 0.5) < 3.5;
      if (center) continue;
      const on = f === -1 ? random(`${seed}${x}-${y}`) > 0.52 : f === 1;
      if (!on) continue;
      const order = f === -1 ? random(`o${seed}${x}-${y}`) * 0.8 + 0.2 : 0.05 + (x + y) / (n * 12);
      const k = interpolate(reveal, [order - 0.2, order], [0, 1], clamp);
      if (k <= 0) continue;
      cells.push(<rect key={`${x}-${y}`} x={(x + 2) * m + (m * (1 - k)) / 2} y={(y + 2) * m + (m * (1 - k)) / 2} width={m * k + 0.4} height={m * k + 0.4} fill="#000" />);
    }
  }
  const c = (n / 2 + 2) * m;
  const mark = interpolate(reveal, [0.85, 1], [0, 1], clamp);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="#fff" />
      {cells}
      <g opacity={mark} transform={`translate(${c} ${c}) scale(${0.6 + 0.4 * mark}) translate(${-c} ${-c})`}>
        <rect x={c - m * 3} y={c - m * 3} width={m * 6} height={m * 6} fill="#fff" />
        <rect x={c - m * 2.4} y={c - m * 2.4} width={m * 4.8} height={m * 4.8} fill={C.ink} />
        <rect x={c + m * 0.3} y={c + m * 0.3} width={m * 1.3} height={m * 1.3} fill={C.accent} />
      </g>
    </svg>
  );
};

/** Plays a sound from public/sfx at `at` frames into the current scene. */
export const Sfx: React.FC<{ at: number; src: string; volume?: number }> = ({ at, src, volume = 0.6 }) => (
  <Sequence from={Math.max(0, Math.round(at))} layout="none">
    <Audio src={staticFile(`sfx/${src}`)} volume={volume} />
  </Sequence>
);

/** Formats CHF like the app: 1’412.60 */
export const chf = (minor: number) => new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
