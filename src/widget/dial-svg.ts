/**
 * The home screen's 30-day dial as an SVG string, for the widget (which draws SVG but can't run
 * the app's animated components). Same geometry as src/ui/dial.tsx: an open 300° ring, today at
 * the lower left, a mark per day (longer each week), and a square per bill on its day.
 */
export type WidgetDot = { day: number; size: number; color: string };

const SPAN = 300;

export function dialSvg(dots: WidgetDot[], todayColor: string, days = 30, size = 200): string {
  const c = size / 2;
  const tickR = size * 0.46;
  const dotR = size * 0.4;
  const angle = (day: number) => ((-SPAN / 2 + (day / days) * SPAN) * Math.PI) / 180;
  const at = (day: number, r: number) => [c + r * Math.sin(angle(day)), c - r * Math.cos(angle(day))];
  const f = (n: number) => n.toFixed(1);
  let s = '';
  for (let i = 0; i <= days; i++) {
    const week = i % 7 === 0;
    const h = size * (week ? 0.05 : 0.025);
    const [x1, y1] = at(i, tickR - h / 2);
    const [x2, y2] = at(i, tickR + h / 2);
    s += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${week ? '#5f5f5f' : '#2a2a2a'}" stroke-width="${f(size / 200)}"/>`;
  }
  for (const d of dots) {
    const [x, y] = at(d.day, dotR);
    const w = (d.size * size) / 200;
    const deg = -SPAN / 2 + (d.day / days) * SPAN;
    s += `<rect x="${f(x - w / 2)}" y="${f(y - w / 2)}" width="${f(w)}" height="${f(w)}" fill="${d.color}" transform="rotate(${f(deg)} ${f(x)} ${f(y)})"/>`;
  }
  const [t1x, t1y] = at(0, tickR - size * 0.045);
  const [t2x, t2y] = at(0, tickR + size * 0.045);
  s += `<line x1="${f(t1x)}" y1="${f(t1y)}" x2="${f(t2x)}" y2="${f(t2y)}" stroke="${todayColor}" stroke-width="${f(size / 100)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${s}</svg>`;
}

/** The scan icon from the app, drawn dark for the white square. */
export const SCAN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 12h10" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="square"/></svg>';
