import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RAMPS } from '../_theme';
import { edgeDistance, hash, paperTone, periodicNoise, rampPick } from './_ui';

/**
 * Etiqueta de papel rasgada para o aviso de pontos ("+10 Poça limpa"). 9-slice com margens
 * de 6 px; o miolo de 20 × 10 repete. Pontas rasgadas à esquerda e à direita.
 */
const width = 32;
const height = 22;
const margin = 6;

export default defineAsset({
  width,
  height,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(width, height);
    const opaque = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const e = edgeDistance(x, y, width, height);
      if (e < 1) return false;
      const side = Math.min(x, width - 1 - x);
      if (side < 4 && periodicNoise(y, side, 20, 10, 1, x < margin ? 31 : 32) > 0.3 + side * 0.18) return false;
      if (e < 2 && periodicNoise(x, y, 20, 10, 10, 33) > 0.6) return false;
      return true;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!opaque(x, y)) continue;
        const e = edgeDistance(x, y, width, height);
        let color = rampPick(RAMPS.osso, paperTone(x, y, 20, 34) - Math.max(0, 4 - e) * 0.04, x, y);
        const border = !opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1);
        if (border) color = hash(x, y, 35) > 0.5 ? p.ossoBase : p.ossoEscuro;
        if (y === height - 2 && !border) color = p.ossoBase;
        c.set(x, y, color);
      }
    }
    c.render(ctx);
  },
});
