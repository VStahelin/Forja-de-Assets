import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RAMPS } from '../_theme';
import { hash, periodicFbm, rampPick } from './_ui';

/**
 * Duas tábuas cruzadas e pregadas sobre uma ficha do plano de carreira, com uma placa
 * em branco no meio (proposta de 22/11/2026). Marca o jeito "EM OBRA": o sistema dele ainda
 * não existe. A palavra entra pela engine, na fonte de pixel. Do tamanho da ficha na tela
 * (96 × 46 px de arte).
 */
const width = 96;
const height = 46;

export default defineAsset({
  width,
  height,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(width, height);
    const board = (slope: number, offset: number, seed: number): void => {
      // tábua de 9 px de largura que cruza a ficha com inclinação `slope`
      for (let x = 0; x < width; x++) {
        const cy = height / 2 + (x - width / 2) * slope + offset;
        for (let k = -4; k <= 4; k++) {
          const y = Math.round(cy + k);
          if (y < 0 || y >= height) continue;
          const grain = periodicFbm(x, (k + 4) * 6, 48, 4, 2, seed);
          let color = rampPick(RAMPS.madeira, 0.52 + (grain - 0.5) * 0.5 + (hash(x, y, seed) - 0.5) * 0.1, x, y);
          if (k === -4) color = p.madeiraLuz;
          if (k === 4) color = p.madeiraSombra;
          if (k === 3) color = p.madeiraEscuro;
          c.set(x, y, color);
        }
        if (x === 6 || x === width - 7) {
          const ny = Math.round(cy - 1);
          c.set(x, ny, p.ferroLuz).set(x + 1, ny, p.ferroBase).set(x, ny + 1, p.ferroSombra);
        }
      }
    };
    board(0.34, 0, 91);
    board(-0.34, 0, 92);
    // placa em branco para a palavra
    const pw = 52;
    const ph = 14;
    const px = (width - pw) / 2;
    const py = (height - ph) / 2;
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const grain = periodicFbm(x, y * 5, 48, 4, 2, 93);
        let color = rampPick(RAMPS.madeira, 0.68 + (grain - 0.5) * 0.3, px + x, py + y);
        if (y === 0) color = p.madeiraBrilho;
        if (y === ph - 1 || x === pw - 1) color = p.madeiraSombra;
        if (x === 0) color = p.madeiraLuz;
        c.set(px + x, py + y, color);
      }
    }
    for (const nx of [px + 2, px + pw - 4]) c.set(nx, py + 2, p.ferroLuz).set(nx + 1, py + 2, p.ferroBase).set(nx, py + 3, p.ferroSombra);
    c.addOutline(p.abismo1);
    c.render(ctx);
  },
});
