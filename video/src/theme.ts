// Look and timing of the film. Colours are the app's dark theme (src/ui/theme.ts in the app).
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const { fontFamily: FONT } = loadArchivo("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: MONO } = loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

export const C = {
  bg: "#0a0a0a",
  surface: "#141414",
  fg: "#ededed",
  muted: "#a1a1a1",
  dim: "#8f8f8f",
  line: "#1f1f1f",
  border: "#262626",
  barMuted: "#5f5f5f",
  accent: "#FF5A36",
  paper: "#f3f1ec",
  ink: "#0a0a0a",
};

/**
 * The track (public/music.mp3, "Product Launch" by lnplusmusic) runs at 100 BPM: a beat every 0.5995 s.
 * At 25 fps that is 15 frames, so every scene is a whole number of beats and the cuts land on the beat.
 */
export const FPS = 25;
export const BEAT = 15;
/** Where the film starts in the track, in seconds: 14 beats before its drop at 38.42 s, so the drop lands on Brand. */
export const MUSIC_START = 38.423 - 14 * 0.5995;

/** The film, scene by scene, in beats. */
export const SCENES = [
  { id: "Open", beats: 8 }, //      0.0 –  4.8 s  Bills. Due dates. Late fees. Stress. (the track's break)
  { id: "Problem", beats: 6 }, //   4.8 –  8.4 s  a pile of bills, stamps on the build
  { id: "Brand", beats: 4 }, //     8.4 – 10.8 s  the drop: due.
  { id: "Scan", beats: 12 }, //    10.8 – 18.0 s  snap it, due reads it
  { id: "Lang", beats: 8 }, //     18.0 – 22.8 s  insurance, electricity, … any bill
  { id: "Remind", beats: 8 }, //   22.8 – 27.6 s  reminded at the right time
  { id: "Pay", beats: 8 }, //      27.6 – 32.4 s  pay in seconds ("Paid." in the track's dip)
  { id: "Montage", beats: 8 }, //  32.4 – 37.2 s  discounts, payment reminders, price changes, tax export
  { id: "Outro", beats: 10 }, //   37.2 – 43.2 s  due. Every bill, paid at the right time. (on the next big accent)
] as const;

export type SceneId = (typeof SCENES)[number]["id"];
export const DURATION = SCENES.reduce((s, x) => s + x.beats * BEAT, 0);
