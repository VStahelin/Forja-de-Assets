import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { RULES } from '../_theme';
import { floorStoneSlab } from '../_env_textures';

/** Textura de cenário v2 a 128 px/m, tileável nos dois eixos. */
export default defineAsset({
  width: RULES.floorTile,
  height: RULES.floorTile,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const grid = floorStoneSlab();
    const pc = new PixelCanvas(RULES.floorTile, RULES.floorTile);
    grid.forEach((row, y) => row.forEach((color, x) => pc.set(x, y, color)));
    pc.render(ctx);
  },
});
