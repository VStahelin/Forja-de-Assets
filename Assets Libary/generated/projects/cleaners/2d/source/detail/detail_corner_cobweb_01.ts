import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as colors } from '../_theme';

type Point = readonly [number, number];

const width = 112;
const height = 88;
const hub: Point = [37, 31];

function between(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function strand(canvas: PixelCanvas, start: Point, end: Point, color: string) {
  canvas.line(Math.round(start[0]), Math.round(start[1]), Math.round(end[0]), Math.round(end[1]), color);
}

function point(canvas: PixelCanvas, at: Point, color: string) {
  canvas.set(Math.round(at[0]), Math.round(at[1]), color);
}

export default defineAsset({
  width,
  height,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const canvas = new PixelCanvas(width, height);
    const corner: Point = [9, 7];
    const right: Point = [106, 11];
    const lower: Point = [19, 81];
    const anchors = [
      ...[0, 0.26, 0.57, 0.85, 1].map((t) => between(corner, right, t)),
      ...[0.21, 0.46, 0.75, 1].map((t) => between(right, lower, t)),
      ...[0.27, 0.55, 0.81].map((t) => between(lower, corner, t)),
    ];

    // Short bowed chords reconnect the radial threads on successive turns.
    const turns = [0.18, 0.31, 0.46, 0.61, 0.76, 0.89];
    for (const [ring, span] of turns.entries()) {
      for (let index = 0; index < anchors.length; index++) {
        if (ring >= 4 && (index === 5 || (ring === 5 && index === 8))) continue;
        const next = (index + 1) % anchors.length;
        const start = between(hub, anchors[index], span);
        const end = between(hub, anchors[next], span + 0.01);
        const bow = between(between(start, end, 0.5), hub, 0.14);
        const pale = (ring * 3 + index) % 5 < 2;
        strand(canvas, start, bow, pale ? colors.pedraLuz : colors.ferroBase);
        strand(canvas, bow, end, pale ? colors.pedraBase : colors.pedraEscuro);
        if ((ring + index) % 4 === 0) point(canvas, bow, colors.ferroLuz);
      }
    }

    for (const [index, anchor] of anchors.entries()) {
      const middle = between(hub, anchor, 0.61);
      strand(canvas, hub, middle, index % 3 === 0 ? colors.ossoBase : colors.pedraLuz);
      strand(canvas, middle, anchor, index % 3 === 0 ? colors.ferroLuz : colors.pedraBase);
      point(canvas, between(middle, anchor, 0.41), index % 3 === 0 ? colors.ferroBrilho : colors.pedraBrilho);
      point(canvas, anchor, colors.ossoSombra);
    }
    point(canvas, hub, colors.ossoLuz);
    canvas.render(ctx);
  },
});
