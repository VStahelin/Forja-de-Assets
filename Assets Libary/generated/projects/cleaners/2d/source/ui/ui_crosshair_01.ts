import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';

/**
 * Mira do HUD em 13 × 13. Quadro 0: ponto de 2 × 2 em osso com contorno de abismo.
 * Quadro 1: anel de 11 px com quatro aberturas, para quando há algo interagível.
 */
const size = 13;

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  frames: 2,
  animations: { dot: [0], ring: [1] },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(size, size);
    if (frameIndex === 1) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const r = Math.hypot(x - 6, y - 6);
          if (r > 4.4 && r < 5.5 && x !== 6 && y !== 6) c.set(x, y, p.ossoBrilho);
        }
      }
      c.addOutline(p.abismo0, false);
    }
    c.rect(5, 5, 2, 2, p.ossoBrilho, true);
    if (frameIndex === 0) c.addOutline(p.abismo0, false);
    c.render(ctx);
  },
});
