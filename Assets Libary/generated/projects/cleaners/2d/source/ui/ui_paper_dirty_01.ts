import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RAMPS } from '../_theme';
import { edgeDistance, hash, paperTone, periodicNoise, rampPick } from './_ui';

/**
 * Papel sujo e gasto, 9-slice com margens de 16 px. O miolo de 64 px e as bordas repetem
 * (todo ruído tem período 64). Borda rasgada, beira encardida e canto de cima à direita
 * dobrado. Manchas soltas (caneca, graxa, digital) ficam em `ui_paper_marks_01`; a dobra
 * em cruz é desenhada pela engine, porque depende do tamanho da folha.
 */
const size = 96;
const period = 64;
const dogEar = 9;

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(size, size);
    const opaque = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= size || y >= size) return false;
      const e = edgeDistance(x, y, size, size);
      if (e < 1) return false;
      // dentes da borda rasgada
      const along = y < 3 || y > size - 4 ? x : y;
      const jag = periodicNoise(along, e < 3 ? 0 : 7, period, 22, 1, y < 3 ? 61 : y > size - 4 ? 62 : x < 3 ? 63 : 64);
      if (e < 3 && jag > 0.36 + e * 0.18) return false;
      // mordidas maiores
      if (e < 5 && periodicNoise(x, y, period, 10, 10, 65) > 0.82) return false;
      // canto dobrado (fica transparente; a aba é pintada por cima)
      if (x > size - 1 - dogEar && y < dogEar && (size - 1 - x) + y < dogEar) return false;
      return true;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!opaque(x, y)) continue;
        const e = edgeDistance(x, y, size, size);
        let t = paperTone(x, y, period, 51) - Math.max(0, 7 - e) * 0.035;
        if (periodicNoise(x, y, period, 6, 6, 52) > 0.86) t -= 0.1; // encardido em manchas largas
        let color = rampPick(RAMPS.osso, t, x, y);
        const border = !opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1);
        if (border) color = hash(x, y, 53) > 0.5 ? p.ossoBase : p.ossoEscuro;
        c.set(x, y, color);
      }
    }
    // aba do canto dobrado
    for (let k = 0; k <= dogEar; k++) {
      const x = size - 1 - dogEar + k;
      const y = k;
      c.set(x, y, p.ossoEscuro);
      for (let s = 1; s <= k; s++) c.set(x - s, y, s === 1 ? p.ossoBase : p.ossoLuz);
    }
    c.render(ctx);
  },
});
