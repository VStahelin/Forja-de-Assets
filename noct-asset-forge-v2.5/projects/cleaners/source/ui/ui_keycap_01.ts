import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RAMPS } from '../_theme';
import { hash, periodicNoise, rampPick, sliceCoord } from './_ui';

/**
 * Tecla de osso gasto, 9-slice (margens de 4 px nas laterais, 3 em cima e 4 embaixo).
 * O rótulo entra na engine com a fonte de pixel, em tinta.
 */
const width = 16;
const height = 13;

export default defineAsset({
  width,
  height,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
        if (corner) continue;
        const sx = sliceCoord(x, width, 4);
        let color = rampPick(RAMPS.osso, 0.74 + (periodicNoise(sx, y, 8, 4, 4, 21) - 0.5) * 0.3, x, y);
        if (y === 0) color = p.ossoBrilho;
        else if (y === height - 1) color = p.ossoSombra;
        else if (y === height - 2) color = p.ossoEscuro;
        else if (x === 0) color = p.ossoBase;
        else if (x === width - 1) color = p.ossoEscuro;
        else if (hash(sx, y, 22) > 0.84) color = p.ossoBase;
        c.set(x, y, color);
      }
    }
    c.render(ctx);
  },
});
