import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as P, RULES } from '../_theme';
import { floorStoneSlab, wallStoneBlock } from '../_env_textures';
import { tileGrid } from '../_masonry';

/**
 * Mockup de revisão: parede (8 x 4 m) repetida 2x na horizontal, em cima do chão (8 x 8 m)
 * repetido 2 x 1. Total: 16 m de corredor. Mostra a costura e se os dois combinam.
 */
const W = RULES.floorTile * 2;
const GAP = 8;
const H = RULES.wallHeightPx + GAP + RULES.floorTile;

export default defineAsset({
  width: W,
  height: H,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const wall = tileGrid(wallStoneBlock(), 2, 1);
    const floor = tileGrid(floorStoneSlab(), 2, 1);
    const pc = new PixelCanvas(W, H);
    pc.clear(P.abismo0);
    wall.forEach((row, y) => row.forEach((c, x) => pc.set(x, y, c)));
    floor.forEach((row, y) => row.forEach((c, x) => pc.set(x, y + RULES.wallHeightPx + GAP, c)));
    pc.render(ctx);
  },
});
