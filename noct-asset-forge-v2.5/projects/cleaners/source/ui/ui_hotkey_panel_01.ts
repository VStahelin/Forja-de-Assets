import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';
import { edgeDistance, hash, periodicFbm, periodicNoise, rampPick, sliceCoord } from './_ui';

/**
 * Fundo do bloco de atalhos (canto inferior esquerdo). 9-slice com margens de 8 px; o miolo
 * de 32 px repete. A engine aplica cerca de 60% de opacidade. Bordas comidas e um filete de
 * ferro gasto em cima e à esquerda.
 */
const size = 48;
const margin = 8;

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(size, size);
    const ramp = [p.abismo0, p.abismo1, p.ferroSombra];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = sliceCoord(x, size, margin);
        const sy = sliceCoord(y, size, margin);
        const e = edgeDistance(x, y, size, size);
        const bite = periodicNoise(sx, sy, 32, 16, 16, 12);
        if (e < 1 || (e < 2 && bite > 0.45)) continue;
        let color = rampPick(ramp, 0.3 + (periodicFbm(sx, sy, 32, 4, 2, 13) - 0.5) * 0.7, x, y);
        if (y === 2 && x > 2 && x < size - 3 && hash(sx, 0, 14) > 0.2) color = hash(sx, 1, 15) > 0.3 ? p.ferroBase : p.ferroLuz;
        if (x === 2 && y > 2 && y < size - 3 && hash(0, sy, 16) > 0.25) color = p.ferroEscuro;
        c.set(x, y, color);
      }
    }
    c.render(ctx);
  },
});
