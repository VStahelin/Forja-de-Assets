import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { vaultStone } from '../_env_textures';

/** Pedra da abóbada: a mesma família da parede, 4 x 4 m a 128 px/m, tileável nos dois eixos. */
export default defineAsset({
  width: 512,
  height: 512,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const grid = vaultStone();
    const pc = new PixelCanvas(512, 512);
    grid.forEach((row, y) => row.forEach((color, x) => pc.set(x, y, color)));
    pc.render(ctx);
  },
});
