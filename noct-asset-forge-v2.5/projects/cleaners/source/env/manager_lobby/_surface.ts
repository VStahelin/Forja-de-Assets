import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { periodicNoise } from '../../_masonry';
import { RULES } from '../../_theme';

const tile = RULES.pxPerMeter * 4;
export const meter = RULES.pxPerMeter;

export function noise(x: number, y: number, cellsX: number, cellsY: number, seed: number): number {
  return periodicNoise(x, y, tile, cellsX, cellsY, seed);
}

export function lobbyTexture(paint: (x: number, y: number) => string) {
  return defineAsset({
    width: tile,
    height: tile,
    scale: 1,
    antialiasing: 'none',
    render({ ctx }) {
      const pixels = new PixelCanvas(tile, tile);
      for (let y = 0; y < tile; y++) {
        for (let x = 0; x < tile; x++) pixels.set(x, y, paint(x, y));
      }
      pixels.render(ctx);
    },
  });
}
