import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';
import { drawGlyph, hash } from './_ui';

/**
 * Números do cronômetro: atlas de 0 a 9 e dois-pontos, em células de 12 × 18.
 * Quadros 0 a 10 em osso; 11 a 21 na ferrugem do alerta. É uma fonte, não texto pintado.
 */
const width = 12;
const height = 18;
const CHARS = '0123456789:';

export default defineAsset({
  width,
  height,
  scale: 1,
  frames: CHARS.length * 2,
  animations: {
    normal: Array.from({ length: CHARS.length }, (_, i) => i),
    alert: Array.from({ length: CHARS.length }, (_, i) => i + CHARS.length),
  },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const alert = frameIndex >= CHARS.length;
    const ch = CHARS[frameIndex % CHARS.length];
    const face = alert ? p.ferrugemLuz : p.ossoBrilho;
    const shade = alert ? p.ferrugemBase : p.ossoBase;
    const body = new PixelCanvas(width, height);
    // glifo 5 × 7 em escala 2; as duas linhas de acento ficam acima da célula
    drawGlyph(body, ch, 1, -2, face, 2);
    const solid = (x: number, y: number) => body.get(x, y) !== null;
    const c = new PixelCanvas(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (solid(x, y)) {
          const bottom = !solid(x, y + 1);
          const lowerHalf = y % 2 === 1 && !solid(x - 1, y);
          const worn = hash(x, y, 77 + frameIndex) > 0.88;
          c.set(x, y, bottom || lowerHalf || worn ? shade : face);
        } else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          c.set(x, y, p.abismo0);
        }
      }
    }
    c.render(ctx);
  },
});
