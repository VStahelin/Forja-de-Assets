import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';
import { edgeDistance, hash, periodicNoise } from './_ui';

/**
 * Moldura de carimbo com tinta falhada, 9-slice com margens de 6 px (miolo de 28 × 10 repete).
 * Quadro 0: APROVADO em madeira. Quadro 1: REPROVADO em ferrugem. A palavra entra na engine
 * com a fonte de pixel, na mesma cor, e o conjunto gira alguns graus.
 */
const width = 40;
const height = 22;

export default defineAsset({
  width,
  height,
  scale: 1,
  frames: 2,
  animations: { approved: [0], rejected: [1] },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(width, height);
    const ink = frameIndex === 0 ? p.madeiraLuz : p.ferrugemLuz;
    const thin = frameIndex === 0 ? p.madeiraBase : p.ferrugemBase;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const e = edgeDistance(x, y, width, height);
        if (e !== 0 && e !== 2) continue;
        const along = y === 0 || y === height - 1 || y === 2 || y === height - 3 ? x : y;
        const fail = periodicNoise(along, e, 28, 14, 1, 101 + frameIndex) > 0.74 || hash(x, y, 103) > 0.93;
        if (!fail) c.set(x, y, e === 0 ? ink : thin);
      }
    }
    c.render(ctx);
  },
});
