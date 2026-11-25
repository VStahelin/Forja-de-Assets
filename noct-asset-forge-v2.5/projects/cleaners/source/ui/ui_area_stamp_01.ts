import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';
import { hash } from './_ui';

const width = 48;
const height = 24;

// Relevo de carimbo gasto. A prancheta desenha a palavra no miolo vazio.
export default defineAsset({
  width, height, scale: 1, antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(width, height);
    const ink = [
      p.musgoSombra, p.musgoEscuro, p.musgoBase, p.musgoLuz,
      p.musgoBrilho, p.pedraVerdeBase, p.pedraVerdeEscuro, p.ossoEscuro,
    ];
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const left = Math.min(x - 2, width - 3 - x);
        const top = Math.min(y - 2, height - 3 - y);
        const border = Math.min(left, top);
        if (left + top < 3 || border > 3) continue;
        const pressure = hash(x, y, 123);
        if (pressure < (border === 2 ? 0.91 : 0.18)) continue;
        const tone = border < 2 ? Math.floor(pressure * 5) : 5 + Math.floor(hash(x, y, 57) * 3);
        c.set(x, y, ink[tone]);
      }
    }
    c.render(ctx);
  },
});
