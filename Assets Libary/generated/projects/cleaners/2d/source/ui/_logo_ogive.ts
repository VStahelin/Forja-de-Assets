import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import {
  OGIVE_COLORS, OGIVE_MARK, OGIVE_MARK_COMPACT, OGIVE_WORD,
  OGIVE_FINE_MARK, OGIVE_FINE_MARK_COMPACT, OGIVE_FINE_WORD,
} from './_logo_ogive_pixels';

const COUNT_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
type Layer = { readonly width: number; readonly height: number; readonly runs: readonly string[] };

function stamp(canvas: PixelCanvas, data: Layer, left: number, top: number) {
  let pixel = 0;
  for (const line of data.runs) {
    for (let i = 0; i < line.length; i += 2) {
      const color = OGIVE_COLORS[Number.parseInt(line[i], 16)];
      const n = COUNT_DIGITS.indexOf(line[i + 1]) + 1;
      if (color) {
        for (let end = pixel + n; pixel < end; pixel++) {
          const x = pixel % data.width;
          const y = Math.floor(pixel / data.width);
          canvas.set(left + x, top + y, color);
        }
      } else {
        pixel += n;
      }
    }
  }
}

function kit(mark: Layer, compactMark: Layer, word: Layer) {
  const scale = (value: number) => Math.round(value * word.width / OGIVE_WORD.width);
  type Placement = readonly [layer: Layer, left: number, top: number];

  function layout(baseWidth: number, baseHeight: number, placements: readonly Placement[]) {
    const width = scale(baseWidth);
    const height = scale(baseHeight);
    return defineAsset({
      width, height, scale: 1, antialiasing: 'none',
      render({ ctx }) {
        const canvas = new PixelCanvas(width, height);
        for (const [layer, left, top] of placements) stamp(canvas, layer, scale(left), scale(top));
        canvas.render(ctx);
      },
    });
  }

  return {
    main: layout(357, 256, [[mark, 116, 10], [word, 12, 140]]),
    compact: layout(357, 218, [[compactMark, 131, 6], [word, 12, 104]]),
    horizontal: layout(463, 136, [[compactMark, 10, 11], [word, 121, 18]]),
    emblem: layout(166, 166, [[mark, 20, 9]]),
  };
}

export const ogive = kit(OGIVE_MARK, OGIVE_MARK_COMPACT, OGIVE_WORD);
export const ogiveFine = kit(OGIVE_FINE_MARK, OGIVE_FINE_MARK_COMPACT, OGIVE_FINE_WORD);