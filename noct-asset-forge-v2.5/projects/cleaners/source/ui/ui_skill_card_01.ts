import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RAMPS } from '../_theme';
import { edgeDistance, hash, periodicFbm, periodicNoise, rampPick, sliceCoord } from './_ui';

/**
 * Ficha de papel do plano de carreira (proposta de 22/11/2026). 9-slice com margens de 10 px:
 * o miolo de 20 × 12 e as bordas repetem. A tachinha, o ícone, o texto e o contorno de seleção
 * entram pela engine.
 * Quadro 0: normal. Quadro 1: trancada (papel mais escuro e encardido).
 * Quadro 2: memória (papel desbotado com rabiscos apagados, para o nó que pede Knowledge).
 */
const width = 40;
const height = 32;
const margin = 10;

export default defineAsset({
  width,
  height,
  scale: 1,
  frames: 3,
  animations: { normal: [0], locked: [1], memory: [2] },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(width, height);
    const opaque = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const e = edgeDistance(x, y, width, height);
      if (e < 1) return false;
      const sx = sliceCoord(x, width, margin);
      const sy = sliceCoord(y, height, margin);
      if (e < 2 && periodicNoise(sx, sy, 20, 10, 6, 81) > 0.72) return false;
      return true;
    };
    const shade = frameIndex === 1 ? -0.3 : frameIndex === 2 ? -0.12 : 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!opaque(x, y)) continue;
        const sx = sliceCoord(x, width, margin);
        const sy = sliceCoord(y, height, margin);
        const e = edgeDistance(x, y, width, height);
        // Papel mais limpo que o do HUD (pedido do Vitor, 22/11/2026): tom quase liso,
        // só um encardido leve perto da borda.
        let t = 0.97 + (periodicFbm(sx, sy, 20, 2, 2, 82) - 0.5) * 0.05 + shade - Math.max(0, 3 - e) * 0.05;
        if (frameIndex === 1 && periodicNoise(sx, sy, 20, 5, 4, 83) > 0.85) t -= 0.06;
        // Tons chapados em vez de dithering: o miolo fica liso e só a beira encardece.
        const base = frameIndex === 0 ? 4 : 3;
        const step = t < (frameIndex === 0 ? 0.9 : frameIndex === 1 ? 0.62 : 0.8) ? 1 : 0;
        let color = RAMPS.osso[Math.max(0, base - step - (frameIndex === 1 && e < 3 ? 1 : 0))];
        // poucas fibras soltas, para o papel não ficar chapado
        if (hash(sx, sy, 89) > 0.965) color = RAMPS.osso[base - 1];
        const border = !opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1);
        if (border) color = hash(x, y, 84) > 0.5 ? p.ossoBase : p.ossoEscuro;
        if (y === height - 2 && !border) color = frameIndex === 1 ? p.ossoSombra : p.ossoBase;
        c.set(x, y, color);
      }
    }
    if (frameIndex === 2) {
      // rabiscos de tinta apagada, em linhas que repetem com o miolo
      for (const row of [12, 15, 18]) {
        for (let x = margin; x < width - margin; x++) {
          const sx = sliceCoord(x, width, margin);
          if (periodicNoise(sx, row, 20, 6, 1, 85 + row) > 0.42) c.set(x, row, hash(sx, row, 86) > 0.5 ? p.ossoBase : p.ossoEscuro);
        }
      }
      // mancha de borrado
      for (let y = margin; y < height - margin; y++) {
        for (let x = margin; x < width - margin; x++) {
          const sx = sliceCoord(x, width, margin);
          if (periodicNoise(sx, y, 20, 4, 3, 87) > 0.85 && hash(sx, y, 88) > 0.5) c.set(x, y, p.ossoLuz);
        }
      }
    }
    c.render(ctx);
  },
});
