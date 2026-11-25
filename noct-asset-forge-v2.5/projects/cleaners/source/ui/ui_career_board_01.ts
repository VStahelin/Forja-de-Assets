import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RAMPS } from '../_theme';
import { hash, periodicFbm, periodicNoise, rampPick } from './_ui';

/**
 * Fundo de tábuas do plano de carreira (quadro do gerente, proposta de 22/11/2026).
 * Ladrilho de 64 × 64 que repete nos dois eixos: quatro tábuas de 16 px, junta escura,
 * realce de 1 px em cima, emenda de topo deslocada em cada tábua e pregos.
 * Fica dentro da moldura `ui_frame_order_01`; as fichas de papel são pregadas por cima.
 */
const size = 64;
const plank = 16;

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(size, size);
    for (let y = 0; y < size; y++) {
      const row = Math.floor(y / plank);
      const v = y % plank;
      // emenda de topo: uma por tábua, em posição diferente
      const joint = Math.floor(hash(row, 0, 71) * size);
      for (let x = 0; x < size; x++) {
        const grain = periodicFbm(x, y * 5, size, 4, 3, 72 + row);
        const knot = periodicNoise(x, y, size, 8, 4, 73);
        let t = 0.5 + (row % 2 === 0 ? 0.04 : -0.04) + (grain - 0.5) * 0.55 - (hash(x, y, 74) - 0.5) * 0.12;
        if (knot > 0.9) t -= 0.25;
        let color = rampPick(RAMPS.madeira, t, x, y);
        if (v === 0) color = p.madeiraSombra;
        else if (v === 1) color = p.madeiraEscuro;
        else if (v === 2) color = p.madeiraLuz;
        else if (v === plank - 1) color = p.madeiraEscuro;
        const dx = (x - joint + size) % size;
        if (dx === 0 && v > 0) color = p.madeiraSombra;
        else if (dx === 1 && v > 0) color = p.madeiraLuz;
        c.set(x, y, color);
      }
      // pregos dos dois lados da emenda
      if (v === 7) {
        for (const nx of [(joint + size - 3) % size, (joint + 3) % size]) {
          c.set(nx, y, p.ferroLuz);
          c.set((nx + 1) % size, y, p.ferroBase);
          c.set(nx, y + 1, p.ferroSombra);
          c.set((nx + 1) % size, y + 1, p.madeiraSombra);
        }
      }
    }
    c.render(ctx);
  },
});
