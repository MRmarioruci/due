// The film's scenes, one component each. Timing is in frames within the scene (30 fps, a beat is 15).

import { AbsoluteFill, interpolate, random, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { chf, clamp, EASE_IN_OUT, EASE_OUT, Glow, Logo, Phone, QR, Scene, Sfx, Slam, Typed, useShake, useSpring, useVertical, Words } from "./kit";
import { C, FONT, MONO, type SceneId } from "./theme";

/* ------------------------------------------------------------------ Open: Bills. Due dates. Late fees. Stress. */

const RAIN = ["31.10", "CHF 387.20", "15.11", "EUR 64.90", "01.12", "CHF 69.90", "30.11", "OVERDUE", "CHF 1’240.00", "28.10", "REMINDER", "CHF 335.00", "10.11", "LATE FEE", "CHF 20.00", "DUE"];

const Rain: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cols = Math.round(width / 150);
  return (
    <AbsoluteFill style={{ fontFamily: MONO, fontSize: 26, overflow: "hidden" }}>
      {Array.from({ length: cols }, (_, c) => {
        const speed = 4 + random(`sp${c}`) * 9;
        const offset = random(`of${c}`) * height;
        const items = Array.from({ length: 14 }, (_, i) => RAIN[Math.floor(random(`w${c}-${i}`) * RAIN.length)]);
        return (
          <div key={c} style={{ position: "absolute", left: (c + 0.2) * 150, top: ((offset + frame * speed) % (height * 1.2)) - height * 1.2, display: "flex", flexDirection: "column", gap: 70 }}>
            {[...items, ...items].map((w, i) => (
              <span key={i} style={{ color: random(`a${c}-${i}`) > 0.93 ? C.accent : "#262626", whiteSpace: "nowrap" }}>
                {w}
              </span>
            ))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Open: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useVertical();
  const words = ["Bills.", "Due dates.", "Late fees.", "Stress."];
  const i = Math.min(3, Math.floor(frame / 30));
  const shake = useShake([0, 30, 60, 90], 26);
  return (
    <Scene enter="cut" exit="whip" grid={false}>
      <Rain />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...shake }}>
        <Slam key={i} text={words[i]} at={i * 30} size={v ? 190 : 250} color={i === 2 ? C.accent : C.fg} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: v ? 220 : 110 }}>
        <div style={{ display: "flex", gap: 14 }}>
          {words.map((_, k) => (
            <div key={k} style={{ width: 46, height: 4, background: k <= i ? C.accent : "#262626" }} />
          ))}
        </div>
      </AbsoluteFill>
      {[0, 30, 60, 90].map((f) => (
        <Sfx key={f} at={f} src="sub.wav" volume={0.55} />
      ))}
    </Scene>
  );
};

/* ------------------------------------------------------------------ Problem: a pile of bills, overdue stamps */

const PILE = [
  { payee: "Swisscom", sub: "Mobile · October", amount: 6990, due: "28 OCT" },
  { payee: "KPT Health", sub: "Premium · November", amount: 38720, due: "1 NOV" },
  { payee: "EWZ", sub: "Electricity Q3", amount: 21460, due: "30 OCT" },
  { payee: "Serafe AG", sub: "Radio & TV fee", amount: 33500, due: "31 OCT" },
  { payee: "Tax Office Zürich", sub: "Tax instalment", amount: 124000, due: "30 NOV" },
  { payee: "Sunrise", sub: "Internet", amount: 5990, due: "2 NOV" },
  { payee: "Mobiliar", sub: "Household insurance", amount: 41880, due: "15 NOV" },
];

const BillCard: React.FC<{ payee: string; sub: string; amount: number; due: string; scale?: number }> = ({ payee, sub, amount, due, scale = 1 }) => (
  <div
    style={{
      width: 520 * scale,
      padding: `${22 * scale}px ${26 * scale}px`,
      display: "flex",
      alignItems: "center",
      gap: 20 * scale,
      background: C.surface,
      border: `1px solid ${C.border}`,
      boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
    }}
  >
    <div style={{ width: 58 * scale, height: 58 * scale, border: `1px solid ${C.border}`, background: "#101010", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 19 * scale }}>
      {payee.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 27 * scale, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{payee}</div>
      <div style={{ fontSize: 20 * scale, color: C.dim, marginTop: 4 * scale }}>{sub}</div>
    </div>
    <div style={{ textAlign: "right" }}>
      <div style={{ fontWeight: 600, fontSize: 27 * scale, fontVariantNumeric: "tabular-nums" }}>{chf(amount)}</div>
      <div style={{ fontFamily: MONO, fontSize: 17 * scale, color: C.dim, marginTop: 6 * scale }}>{due}</div>
    </div>
  </div>
);

const Stamp: React.FC<{ text: string; at: number; size: number; rotate?: number }> = ({ text, at, size, rotate = -12 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const p = interpolate(t, [0, 4], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div
      style={{
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: size * 0.12,
        color: C.accent,
        border: `${size * 0.12}px solid ${C.accent}`,
        padding: `${size * 0.12}px ${size * 0.4}px`,
        rotate: `${rotate}deg`,
        scale: String(3 - 2 * p),
        opacity: p,
        background: "rgba(10,10,10,0.55)",
        boxShadow: `0 0 ${40 * p}px rgba(255,90,54,0.45)`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = useVertical();
  const hits = [45, 60, 75];
  const shake = useShake(hits, 18);
  const cardScale = v ? 1.25 : 1.05;
  const fee = spring({ frame: frame - 50, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <Scene enter="whip" exit="zoom">
      <AbsoluteFill style={{ ...shake }}>
        <div style={{ position: "absolute", left: v ? 80 : 130, top: v ? 200 : 170, width: v ? 920 : 760 }}>
          <Words text="Bills come from everywhere." at={4} size={v ? 112 : 104} />
          <Typed text="PAPER · PDF · EMAIL · APP" at={20} size={v ? 30 : 28} style={{ marginTop: 34 }} />
        </div>
        <div style={{ position: "absolute", left: v ? "50%" : "66%", top: v ? "64%" : "60%" }}>
          {PILE.map((b, i) => {
            const s = spring({ frame: frame - 3 - i * 5, fps, config: { damping: 15, stiffness: 150, mass: 0.9 } });
            const rot = (random(`r${i}`) - 0.5) * 22;
            const dx = (random(`x${i}`) - 0.5) * (v ? 260 : 300);
            const dy = (i - 3) * (v ? 70 : 62) + (random(`y${i}`) - 0.5) * 30;
            return (
              <div key={i} style={{ position: "absolute", left: 0, top: 0, translate: `${-260 * cardScale + dx}px ${dy - 60 + (1 - s) * -1200}px`, rotate: `${rot * s + (1 - s) * 40}deg`, opacity: Math.min(1, s * 3) }}>
                <BillCard {...b} scale={cardScale} />
              </div>
            );
          })}
          {[
            { at: hits[0], x: -150, y: -170, text: "OVERDUE" },
            { at: hits[1], x: 60, y: 40, text: "OVERDUE" },
            { at: hits[2], x: -230, y: 190, text: "FINAL NOTICE" },
          ].map((s) => (
            <div key={s.at} style={{ position: "absolute", left: s.x * cardScale, top: s.y * cardScale }}>
              <Stamp text={s.text} at={s.at} size={v ? 54 : 50} rotate={-14 + (s.at % 3) * 9} />
            </div>
          ))}
          <div style={{ position: "absolute", left: (v ? 40 : 20) * cardScale, top: -330 * cardScale - fee * 60, opacity: fee * interpolate(frame, [76, 88], [1, 0], clamp), fontFamily: MONO, fontSize: v ? 52 : 46, fontWeight: 700, color: C.accent, whiteSpace: "nowrap" }}>
            + CHF 20.00 FEE
          </div>
        </div>
      </AbsoluteFill>
      {PILE.map((_, i) => (
        <Sfx key={i} at={3 + i * 5 + 5} src="drop_002.ogg" volume={0.35} />
      ))}
      {hits.map((h) => (
        <Sfx key={h} at={h} src="impact.wav" volume={0.45} />
      ))}
    </Scene>
  );
};

/* ------------------------------------------------------------------ Brand: the drop */

const Rings: React.FC<{ at: number; count?: number }> = ({ at, count = 4 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: count }, (_, i) => {
        const t = frame - at - i * 5;
        if (t < 0) return null;
        const p = interpolate(t, [0, 40], [0, 1], { ...clamp, easing: EASE_OUT });
        const size = 200 + p * 1800;
        return <div key={i} style={{ position: "absolute", width: size, height: size, border: `${3 - 2 * p}px solid ${C.accent}`, opacity: (1 - p) * 0.7 }} />;
      })}
    </AbsoluteFill>
  );
};

export const Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useVertical();
  const l1 = useSpring(0, { damping: 11, stiffness: 220 });
  const l2 = useSpring(2, { damping: 11, stiffness: 220 });
  const l3 = useSpring(4, { damping: 11, stiffness: 220 });
  const letters = [l1, l2, l3];
  const dot = useSpring(9, { damping: 9, stiffness: 160, mass: 0.9 });
  const shake = useShake([0, 13], 30);
  const pulse = interpolate(frame, [0, 6, 60], [1, 0.75, 0.3], clamp);
  return (
    <Scene enter="flash" exit="zoom">
      <Glow size={v ? 1400 : 1600} opacity={pulse} />
      <Rings at={12} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...shake }}>
        <div style={{ scale: String(interpolate(frame, [0, 60], [1, 1.08])) }}>
          <Logo size={v ? 330 : 380} dot={dot} letters={letters} />
        </div>
        <Typed text="EVERY BILL, PAID AT THE RIGHT TIME." at={20} size={v ? 30 : 32} color={C.fg} speed={2.2} style={{ marginTop: 50 }} />
      </AbsoluteFill>
      <Sfx at={10} src="whip.wav" volume={0.4} />
    </Scene>
  );
};

/* ------------------------------------------------------------------ Scan: snap it, due reads it */

/** A paper health-insurance bill with a Swiss QR-bill payment part, at phone-screen scale. */
const PaperBill: React.FC = () => {
  const bar = (w: number, op = 0.18) => <div style={{ height: 7, width: w, background: `rgba(0,0,0,${op})`, marginTop: 7 }} />;
  return (
    <div style={{ width: 318, background: C.paper, color: "#111", padding: "22px 20px 18px", fontFamily: FONT, boxShadow: "0 20px 40px rgba(0,0,0,0.6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: -1, color: "#0b6b4a" }}>KPT</div>
        <div style={{ textAlign: "right" }}>
          {bar(90)}
          {bar(70)}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 14 }}>Premium invoice · November 2026</div>
      {bar(220, 0.12)}
      {bar(180, 0.12)}
      <div style={{ marginTop: 14, fontSize: 11.5, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 5 }}>
        <span>Basic health insurance</span>
        <span>312.40</span>
        <span>Supplementary cover</span>
        <span>74.80</span>
        <span style={{ fontWeight: 800 }}>Total CHF</span>
        <span style={{ fontWeight: 800 }}>387.20</span>
      </div>
      <div style={{ fontSize: 11, marginTop: 10 }}>Pay by 1 Nov 2026</div>
      <div style={{ borderTop: "1.5px dashed rgba(0,0,0,0.35)", margin: "16px -20px 12px" }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 12 }}>Payment slip</div>
          {bar(80, 0.14)}
          {bar(96, 0.14)}
          {bar(70, 0.14)}
          <div style={{ fontSize: 10, marginTop: 10, fontWeight: 700 }}>CHF 387.20</div>
        </div>
        <div data-qr style={{ width: 128, height: 128 }}>
          <QR size={128} />
        </div>
      </div>
    </div>
  );
};

const Chip: React.FC<{ label: string; value: string; tag: "QR" | "AI"; at: number; from: { x: number; y: number }; scale: number }> = ({ label, value, tag, at, from, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 140, mass: 0.8 } });
  if (frame < at) return null;
  return (
    <div
      style={{
        translate: `${(1 - s) * from.x}px ${(1 - s) * from.y}px`,
        scale: String((0.4 + 0.6 * s) * scale),
        transformOrigin: "left center",
        filter: s < 0.9 ? `blur(${(1 - s) * 14}px)` : undefined,
        opacity: Math.min(1, s * 2),
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "18px 24px",
        background: "rgba(20,20,20,0.92)",
        border: `1px solid ${C.border}`,
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
        width: 560,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: 2, color: C.dim, width: 120 }}>{label}</div>
      <div style={{ flex: 1, fontWeight: 600, fontSize: 32, letterSpacing: -0.6, whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 1.5, padding: "4px 8px", border: `1px solid ${tag === "QR" ? C.accent : C.barMuted}`, color: tag === "QR" ? C.accent : C.muted }}>{tag}</div>
    </div>
  );
};

export const Scan: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useVertical();
  const phoneH = v ? 1180 : 900;
  // Handheld drift.
  const drift = { x: Math.sin(frame / 22) * 6, y: Math.cos(frame / 27) * 5, r: -3 + Math.sin(frame / 35) * 1.2 };
  const lock = interpolate(frame, [30, 42], [0, 1], { ...clamp, easing: EASE_OUT });
  const found = frame >= 42;
  const flash = interpolate(frame, [56, 58, 70], [0, 1, 0], clamp);
  const after = interpolate(frame, [58, 74], [0, 1], clamp);
  const sweep = ((frame - 8) % 34) / 34;
  const shake = useShake([56], 14);
  const chips = [
    { label: "PAYEE", value: "KPT Health", tag: "QR" as const },
    { label: "AMOUNT", value: "CHF 387.20", tag: "QR" as const },
    { label: "DUE", value: "Sun 1 Nov 2026", tag: "AI" as const },
    { label: "CATEGORY", value: "Health", tag: "AI" as const },
  ];
  // The QR sits at the bottom right of the paper; brackets close in from the screen's corners onto it.
  const qr = { x: 212, y: 372, s: 124 };
  const corner = (cx: number, cy: number) => ({ x: interpolate(lock, [0, 1], [cx === 0 ? 30 : 360, cx === 0 ? qr.x - 10 : qr.x + qr.s - 30]), y: interpolate(lock, [0, 1], [cy === 0 ? 120 : 760, cy === 0 ? qr.y - 10 : qr.y + qr.s - 30]) });
  const phone = (
    <Phone height={phoneH} bg="#000">
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 60%, #3a352c 0%, #0c0b09 75%)" }} />
      <div style={{ position: "absolute", left: 36, top: 150, translate: `${drift.x}px ${drift.y}px`, rotate: `${drift.r}deg`, filter: `blur(${(1 - Math.min(1, frame / 12)) * 6}px)` }}>
        <PaperBill />
      </div>
      {frame >= 8 && frame < 58 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 110 + sweep * 640, height: 3, background: C.accent, boxShadow: `0 0 24px 6px rgba(255,90,54,0.6)` }} />
      )}
      {[
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([cx, cy]) => {
        const p = corner(cx, cy);
        return (
          <div
            key={`${cx}${cy}`}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: 40,
              height: 40,
              borderColor: found ? C.accent : "#fff",
              borderStyle: "solid",
              borderWidth: 0,
              borderTopWidth: cy === 0 ? 4 : 0,
              borderBottomWidth: cy === 1 ? 4 : 0,
              borderLeftWidth: cx === 0 ? 4 : 0,
              borderRightWidth: cx === 1 ? 4 : 0,
            }}
          />
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(10,10,10,0.8)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: MONO, fontSize: 12, letterSpacing: 1.2 }}>
          <div style={{ width: 7, height: 7, background: found ? C.accent : C.dim }} />
          {found ? "PAYMENT CODE FOUND · KPT" : "LOOKING FOR A PAYMENT CODE"}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 76, height: 76, borderRadius: 38, border: "3px solid #ededed", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 30, background: "#ededed", scale: String(1 - flash * 0.15) }} />
        </div>
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.55)", opacity: after }} />
    </Phone>
  );
  const chipScale = v ? 1.25 : 1.05;
  return (
    <Scene enter="zoom" exit="whip">
      <Glow x={v ? "50%" : "70%"} y={v ? "62%" : "50%"} size={1100} opacity={0.18 + flash * 0.4} />
      <AbsoluteFill style={{ ...shake }}>
        <div style={{ position: "absolute", left: v ? 80 : 130, top: v ? 150 : 170, width: v ? 920 : 940 }}>
          {frame < 84 ? <Words key="a" text="Snap it." at={4} size={v ? 150 : 160} /> : <Words key="b" text="due reads it." at={84} size={v ? 150 : 140} accent={["due"]} />}
          <Typed text={frame < 84 ? "SWISS QR-BILL · GIROCODE · ANY PAPER OR PDF" : "PAYEE · AMOUNT · DUE DATE · IBAN · REFERENCE"} key={frame < 84 ? "t1" : "t2"} at={frame < 84 ? 16 : 92} size={v ? 26 : 26} style={{ marginTop: 30 }} />
        </div>
        <div style={{ position: "absolute", left: v ? (1080 - phoneH * 0.477) / 2 : 1100, top: v ? 620 : 90 }}>{phone}</div>
        <div style={{ position: "absolute", left: v ? 120 : 130, top: v ? 900 : 520, display: "flex", flexDirection: "column", gap: 18 * chipScale }}>
          {chips.map((c, i) => (
            <Chip key={c.label} {...c} at={66 + i * 7} from={{ x: v ? 300 : 900, y: v ? 400 : 100 - i * 60 }} scale={chipScale} />
          ))}
        </div>
      </AbsoluteFill>
      <Sfx at={42} src="select_001.ogg" volume={0.6} />
      <Sfx at={56} src="shutter-modern.wav" volume={0.7} />
      {chips.map((_, i) => (
        <Sfx key={i} at={66 + i * 7} src="tick_002.ogg" volume={0.5} />
      ))}
      <Sfx at={84} src="swoosh.wav" volume={0.35} />
    </Scene>
  );
};

/* ------------------------------------------------------------------ Lang: any bill, any language */

const BILL_WORDS = ["Insurance.", "Electricity.", "Phone.", "Rent.", "Taxes.", "Internet.", "Doctor.", "Any bill."];
const CURRENCIES = ["CHF", "EUR", "PLN", "GBP", "SEK", "DKK", "CZK", "NOK", "HUF", "USD"];

export const Lang: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useVertical();
  const i = Math.min(BILL_WORDS.length - 1, Math.floor(frame / 15));
  const shake = useShake(BILL_WORDS.map((_, k) => k * 15), 12);
  const ghost = BILL_WORDS[(i + BILL_WORDS.length - 1) % BILL_WORDS.length];
  return (
    <Scene enter="whip" exit="whip" dir={-1}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", fontWeight: 900, fontSize: v ? 300 : 420, letterSpacing: -16, color: "transparent", WebkitTextStroke: "2px #1f1f1f", scale: String(1.15 + (frame % 15) / 60) }}>{ghost}</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...shake }}>
        <Typed text="PAPER, PDF OR SCREENSHOT." at={0} size={v ? 30 : 32} color={C.accent} speed={2} style={{ marginBottom: 50 }} />
        <Slam key={i} text={BILL_WORDS[i]} at={i * 15} size={v ? 150 : 250} color={i === BILL_WORDS.length - 1 ? C.accent : C.fg} from={1.8} />
        <div style={{ display: "flex", gap: 10, marginTop: 50 }}>
          {BILL_WORDS.map((_, k) => (
            <div key={k} style={{ width: 10, height: 10, background: k <= i ? C.accent : "#2a2a2a" }} />
          ))}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: v ? 260 : 120, left: 0, right: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 22, translate: `${-frame * 6}px 0px`, width: "max-content" }}>
          {[...CURRENCIES, ...CURRENCIES, ...CURRENCIES].map((c, k) => (
            <div key={k} style={{ fontFamily: MONO, fontSize: 26, letterSpacing: 2, color: C.dim, border: `1px solid ${C.border}`, padding: "10px 18px" }}>
              {c}
            </div>
          ))}
        </div>
      </div>
      {BILL_WORDS.map((_, k) => (
        <Sfx key={k} at={k * 15} src={k % 2 ? "tick_001.ogg" : "click_003.ogg"} volume={0.45} />
      ))}
    </Scene>
  );
};

/* ------------------------------------------------------------------ Remind: reminded at the right time */

const HomeScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const total = Math.round(interpolate(frame, [4, 40], [0, 141260], { ...clamp, easing: EASE_OUT }));
  const bars = [
    { d: 3, h: 30, hot: true },
    { d: 9, h: 46, hot: false },
    { d: 10, h: 12, hot: false },
    { d: 17, h: 60, hot: false },
    { d: 24, h: 22, hot: false },
  ];
  const rows = [
    { mono: "SW", payee: "Swisscom", sub: "Mobile · Due Wed 28 Oct", amt: "69.90", days: "IN 3 DAYS", hot: true },
    { mono: "KP", payee: "KPT Health", sub: "Health · Due Sun 1 Nov", amt: "387.20", days: "IN 6 DAYS", hot: false },
    { mono: "EW", payee: "EWZ", sub: "Electricity · Due 12 Nov", amt: "214.60", days: "IN 17 DAYS", hot: false },
  ];
  return (
    <div style={{ padding: "64px 22px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, fontWeight: 600, fontSize: 26, letterSpacing: -0.8 }}>
        due<div style={{ width: 7, height: 7, background: C.accent, marginBottom: 6 }} />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.dim, marginTop: 24 }}>NEXT 30 DAYS</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
        <span style={{ fontWeight: 500, fontSize: 16, color: C.dim }}>CHF</span>
        <span style={{ fontWeight: 600, fontSize: 46, letterSpacing: -1.5, fontVariantNumeric: "tabular-nums" }}>{chf(total)}</span>
      </div>
      <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>4 bills open · next Wed 28 Oct</div>
      <div style={{ marginTop: 22, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "16px 0 10px" }}>
        <div style={{ position: "relative", height: 64 }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            {Array.from({ length: 31 }, (_, i) => (
              <div key={i} style={{ width: 1, height: i % 7 === 0 ? 8 : 4, background: i % 7 === 0 ? C.barMuted : "#2a2a2a" }} />
            ))}
          </div>
          <div style={{ position: "absolute", left: `${(12 / 30) * 100}%`, top: -6, bottom: 0, borderLeft: `1px dashed ${C.muted}`, opacity: interpolate(frame, [30, 40], [0, 1], clamp) }}>
            <span style={{ position: "absolute", top: -6, left: 4, fontFamily: MONO, fontSize: 9, color: C.muted }}>PAY</span>
          </div>
          {bars.map((b, i) => {
            const g = interpolate(frame, [10 + i * 4, 26 + i * 4], [0, 1], { ...clamp, easing: EASE_OUT });
            return <div key={i} style={{ position: "absolute", left: `${(b.d / 30) * 100}%`, bottom: 14, width: 7, marginLeft: -3, height: b.h * g, background: b.hot ? C.accent : C.fg }} />;
          })}
        </div>
      </div>
      {rows.map((r, i) => {
        const s = interpolate(frame, [24 + i * 5, 36 + i * 5], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <div key={r.mono} style={{ display: "flex", alignItems: "center", gap: 14, height: 76, borderBottom: `1px solid ${C.line}`, opacity: s, translate: `0px ${(1 - s) * 20}px`, marginTop: i === 0 ? 14 : 0 }}>
            <div style={{ width: 40, height: 40, border: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>{r.mono}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 15.5 }}>{r.payee}</div>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>{r.sub}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 500, fontSize: 15.5 }}>{r.amt}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: r.hot ? C.accent : C.dim, marginTop: 4 }}>{r.days}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Notification: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 13, stiffness: 150, mass: 0.8 } });
  const bell = Math.sin((frame - at) * 1.3) * 18 * Math.exp(-Math.max(0, frame - at) / 10);
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left: 12, right: 12, top: 52, translate: `0px ${(1 - s) * -170}px`, scale: String(0.9 + 0.1 * s), opacity: Math.min(1, s * 2), padding: 14, background: "rgba(34,34,34,0.92)", borderRadius: 24, border: "1px solid #333", boxShadow: "0 20px 50px rgba(0,0,0,0.7)", display: "flex", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: C.bg, border: "1px solid #333", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 9, gap: 1, fontWeight: 700, fontSize: 12 }}>
        due<div style={{ width: 3, height: 3, background: C.accent, marginBottom: 3 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", rotate: `${bell}deg`, color: C.accent }}>●</span> due
          </span>
          <span>now</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>KPT Health · CHF 387.20</div>
        <div style={{ fontSize: 13.5, color: C.muted, marginTop: 3, lineHeight: 1.3 }}>Due Sunday. Pay before payday — tap for the payment QR.</div>
      </div>
    </div>
  );
};

export const Remind: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useVertical();
  const phoneH = v ? 1160 : 920;
  const pop = interpolate(frame, [45, 49, 63], [1, 1.035, 1], clamp);
  const shake = useShake([45], 10);
  return (
    <Scene enter="zoom" exit="whip">
      <Glow x={v ? "50%" : "30%"} y={v ? "65%" : "45%"} size={1000} opacity={interpolate(frame, [43, 53, 120], [0.12, 0.45, 0.2], clamp)} />
      <AbsoluteFill style={{ ...shake }}>
        <div style={{ position: "absolute", left: v ? (1080 - phoneH * 0.477) / 2 : 260, top: v ? 640 : 80, scale: String(pop) }}>
          <Phone height={phoneH}>
            <HomeScreen frame={frame} />
            <Notification at={45} />
          </Phone>
        </div>
        <div style={{ position: "absolute", left: v ? 80 : 900, top: v ? 160 : 300, width: v ? 920 : 900 }}>
          <Words text="Reminded at the right time." at={6} size={v ? 120 : 132} accent={["right", "time"]} />
          <Typed text="BEFORE PAYDAY · BEFORE THE DEADLINE" at={30} size={26} style={{ marginTop: 34 }} />
        </div>
      </AbsoluteFill>
      <Sfx at={45} src="ding.wav" volume={0.7} />
    </Scene>
  );
};

/* ------------------------------------------------------------------ Pay: pay in seconds */

export const Pay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = useVertical();
  const size = v ? 620 : 540;
  const reveal = interpolate(frame, [4, 50], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const swing = interpolate(frame, [0, 30], [28, 0], { ...clamp, easing: EASE_OUT });
  const laser = interpolate(frame, [54, 86], [0, 1], clamp);
  const done = spring({ frame: frame - 90, fps, config: { damping: 12, stiffness: 160 } });
  const draw = interpolate(frame, [92, 104], [1, 0], { ...clamp, easing: EASE_OUT });
  const shake = useShake([90], 20);
  return (
    <Scene enter="whip" exit="zoom">
      <Glow size={1300} opacity={0.15 + done * 0.4} />
      <AbsoluteFill style={{ ...shake }}>
        <div style={{ position: "absolute", left: v ? 80 : 130, top: v ? 160 : 200, width: v ? 920 : 700 }}>
          <Words text="Pay in seconds." at={4} size={v ? 140 : 150} accent={["seconds"]} />
          <Typed text={frame < 90 ? "SCAN WITH YOUR BANK APP" : "CHF 387.20 · PAID 3 DAYS EARLY"} key={frame < 90 ? "a" : "b"} at={frame < 90 ? 20 : 94} size={26} style={{ marginTop: 30 }} />
        </div>
        <div style={{ position: "absolute", left: v ? (1080 - size) / 2 : 1020, top: v ? 760 : (1080 - size) / 2, perspective: 1600 }}>
          <div style={{ rotate: `y ${swing}deg`, scale: String(1 - done * 0.25), opacity: 1 - done, filter: done > 0.05 ? `blur(${done * 20}px)` : undefined, boxShadow: "0 50px 120px rgba(0,0,0,0.7), 0 0 80px rgba(255,90,54,0.15)", position: "relative" }}>
            <QR size={size} reveal={reveal} />
            {laser > 0 && laser < 1 && <div style={{ position: "absolute", left: -20, right: -20, top: laser * size, height: 4, background: C.accent, boxShadow: "0 0 30px 10px rgba(255,90,54,0.55)" }} />}
          </div>
          {frame >= 90 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", scale: String(0.6 + 0.4 * done) }}>
              <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 100 100">
                <rect x="4" y="4" width="92" height="92" fill="none" stroke={C.accent} strokeWidth="5" />
                <path d="M26 52 L43 68 L75 34" fill="none" stroke={C.accent} strokeWidth="9" strokeDasharray="80" strokeDashoffset={80 * draw} strokeLinecap="square" />
              </svg>
              <Slam text="Paid." at={92} size={v ? 150 : 140} from={1.6} style={{ marginTop: 30 }} />
            </div>
          )}
        </div>
      </AbsoluteFill>
      <Sfx at={54} src="scroll_002.ogg" volume={0.4} />
      <Sfx at={90} src="confirmation_001.ogg" volume={0.7} />
      <Sfx at={90} src="sub.wav" volume={0.5} />
    </Scene>
  );
};

/* ------------------------------------------------------------------ Montage: the rest, fast */

const Beat: React.FC<{ visual: React.ReactNode; title: string; sub: string; accent?: string[] }> = ({ visual, title, sub, accent }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const v = useVertical();
  const pin = interpolate(frame, [0, 6], [0, 1], { ...clamp, easing: EASE_OUT });
  const pout = interpolate(frame, [26, 30], [0, 1], clamp);
  const shake = useShake([2], 16);
  return (
    <AbsoluteFill style={{ translate: `${(1 - pin) * width * 0.5 - pout * width * 0.5}px 0px`, filter: pin < 1 || pout > 0 ? `blur(${(1 - pin) * 26 + pout * 26}px)` : undefined }}>
      <AbsoluteFill style={{ ...shake, flexDirection: v ? "column" : "row", alignItems: "center", justifyContent: "center", gap: v ? 70 : 110, padding: v ? 80 : 120 }}>
        <div style={{ flex: v ? "0 0 auto" : "0 0 46%", display: "flex", justifyContent: "center" }}>{visual}</div>
        <div style={{ flex: v ? "0 0 auto" : 1, width: v ? "100%" : undefined }}>
          <Words text={title} at={3} size={v ? 104 : 104} accent={accent} align={v ? "center" : "left"} stagger={2} />
          <Typed text={sub} at={10} size={24} speed={3} style={{ marginTop: 28, textAlign: v ? "center" : "left" }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CsvRows: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = ["2026-01-28;KPT;Health;387.20", "2026-02-10;Swisscom;Telecom;68.50", "2026-03-02;Dentist;Health;240.00", "2026-03-31;Tax Office;Taxes;1240.00", "2026-04-30;EWZ;Utilities;214.60"];
  return (
    <div style={{ fontFamily: MONO, fontSize: 26, border: `1px solid ${C.border}`, background: C.surface, padding: 26, width: 640, boxShadow: "0 30px 70px rgba(0,0,0,0.6)" }}>
      <div style={{ color: C.accent, marginBottom: 16, letterSpacing: 2 }}>paid-bills-2026.csv</div>
      {rows.map((r, i) => {
        const s = interpolate(frame, [2 + i * 3, 8 + i * 3], [0, 1], clamp);
        return (
          <div key={r} style={{ opacity: s, translate: `${(1 - s) * 60}px 0px`, color: i % 2 ? C.muted : C.fg, padding: "6px 0", borderTop: `1px solid ${C.line}` }}>
            {r}
          </div>
        );
      })}
    </div>
  );
};

export const Montage: React.FC = () => {
  const v = useVertical();
  const big = v ? 300 : 340;
  const beats = [
    { visual: <Slam text="−2%" at={1} size={big} color={C.accent} />, title: "Early-payment discounts, caught.", sub: "PAY BY 10 NOV · SAVE CHF 7.74", accent: ["discounts"] },
    {
      visual: (
        <div style={{ scale: v ? "1.4" : "1.6" }}>
          <Stamp text="FINAL NOTICE" at={1} size={v ? 46 : 52} rotate={-8} />
        </div>
      ),
      title: "Payment reminders, flagged.",
      sub: "REPLACES THE OPEN BILL · NO DOUBLE PAY",
      accent: ["flagged"],
    },
    { visual: <Slam text="▲ 6.4%" at={1} size={v ? 220 : 240} color={C.accent} />, title: "Price hikes, spotted.", sub: "KPT · CHF 23.20 MORE THAN LAST BILL", accent: ["spotted"] },
    { visual: <CsvRows />, title: "Tax year, one tap.", sub: "CSV · PDF · BY CATEGORY", accent: ["one", "tap"] },
  ];
  return (
    <Scene enter="cut" exit="flash">
      <Glow size={1200} opacity={0.12} />
      {beats.map((b, i) => (
        <Sequence key={i} from={i * 30} durationInFrames={30}>
          <Beat {...b} />
          <Sfx at={0} src="whip.wav" volume={0.35} />
          <Sfx at={2} src="sub.wav" volume={0.35} />
        </Sequence>
      ))}
    </Scene>
  );
};

/* ------------------------------------------------------------------ Outro */

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const v = useVertical();
  const l1 = useSpring(2, { damping: 10, stiffness: 200 });
  const l2 = useSpring(5, { damping: 10, stiffness: 200 });
  const l3 = useSpring(8, { damping: 10, stiffness: 200 });
  const letters = [l1, l2, l3];
  const dot = useSpring(14, { damping: 8, stiffness: 150, mass: 0.9 });
  const shake = useShake([2, 16], 28);
  const streak = interpolate(frame, [26, 46], [-0.4, 1.4], clamp);
  const end = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], clamp);
  return (
    <Scene enter="cut" exit="cut">
      <AbsoluteFill style={{ opacity: end }}>
        <Glow size={v ? 1500 : 1700} opacity={interpolate(frame, [0, 14, 60, 150], [0.9, 0.55, 0.35, 0.28], clamp)} />
        <Rings at={16} count={5} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", scale: String(interpolate(frame, [0, durationInFrames], [1, 1.07])), ...shake }}>
          <div style={{ position: "relative", overflow: "hidden", padding: "0 30px" }}>
            <Logo size={v ? 320 : 400} dot={dot} letters={letters} />
            <div style={{ position: "absolute", top: 0, bottom: 0, width: "30%", left: `${streak * 100}%`, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)", rotate: "12deg", mixBlendMode: "overlay" }} />
          </div>
          <div style={{ marginTop: 40, width: v ? 900 : 1400 }}>
            <Words text="Every bill, paid at the right time." at={30} size={v ? 74 : 80} accent={["right", "time"]} align="center" />
          </div>
          <Typed text="SCAN · REMIND · PAY" at={120} size={28} color={C.dim} speed={1.6} style={{ marginTop: 40 }} />
        </AbsoluteFill>
      </AbsoluteFill>
      <Sfx at={30} src="swoosh.wav" volume={0.3} />
    </Scene>
  );
};

export const SCENE_COMPONENTS: Record<SceneId, React.FC> = { Open, Problem, Brand, Scan, Lang, Remind, Pay, Montage, Outro };
