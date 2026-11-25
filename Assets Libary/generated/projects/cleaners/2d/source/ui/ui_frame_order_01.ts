import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RAMPS } from '../_theme';
import { edgeDistance, hash, periodicFbm, rampPick } from './_ui';

/**
 * Moldura do painel da ordem: madeira escura com cantoneiras de ferro e miolo em abismo
 * encardido. 9-slice com margens de 12 px; miolo e bordas repetem a cada 24 px.
 */
const size = 48;
const period = 24;

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const e = edgeDistance(x, y, size, size);
        let color: string;
        if (e === 0) color = p.abismo0;
        else if (e < 5) {
          const horizontal = Math.min(y, size - 1 - y) <= Math.min(x, size - 1 - x);
          const along = horizontal ? x : y;
          const across = horizontal ? y : x;
          const grain = periodicFbm(along, across * 6, period, 2, 2, 41);
          color = rampPick(RAMPS.madeira, 0.42 + (grain - 0.5) * 0.7 + (e === 1 ? 0.3 : 0), x, y);
          if (e === 4) color = p.madeiraSombra;
        } else if (e === 5) color = p.madeiraEscuro;
        else {
          const n = periodicFbm(x, y, period, 3, 2, 42);
          color = rampPick([p.abismo0, p.abismo1, p.ferroSombra, p.couroSombra], 0.28 + (n - 0.5) * 0.7, x, y);
          // escorrido de sujeira da borda de cima
          if (y >= 6 && y < 6 + Math.floor(hash(x % period, 0, 43) * 6) && hash(x % period, 1, 44) > 0.7) color = p.couroEscuro;
        }
        c.set(x, y, color);
      }
    }
    // cantoneiras de ferro em L, com rebite
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ox = sx > 0 ? 0 : size - 1;
      const oy = sy > 0 ? 0 : size - 1;
      for (let i = 0; i < 11; i++) {
        for (let j = 0; j < 3; j++) {
          const tone = (i + j) % 5 === 0 ? p.ferroBrilho : p.ferroLuz;
          c.set(ox + sx * i, oy + sy * j, j === 2 ? p.ferroBase : tone);
          c.set(ox + sx * j, oy + sy * i, j === 2 ? p.ferroBase : tone);
        }
      }
      c.set(ox + sx * 1, oy + sy * 1, p.ferroBrilho);
      c.set(ox + sx * 8, oy + sy * 1, p.ferroSombra);
      c.set(ox + sx * 1, oy + sy * 8, p.ferroSombra);
    }
    c.render(ctx);
  },
});
