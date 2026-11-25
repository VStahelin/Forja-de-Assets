import { createNoise2D } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RULES } from '../_theme';

const size = RULES.pxPerMeter;
const noise = createNoise2D('cleaners-floor-glyph');

export function drawGlyph(armed: boolean): PixelCanvas {
  const pixels = new PixelCanvas(size, size);
  const stone = [p.pedraSombra, p.pedraEscuro, p.pedraBase, p.pedraLuz, p.pedraBrilho];
  const magic = [p.magiaEscuro, p.magiaBase, p.magiaLuz, p.magiaBrilho];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - 63.5);
      const dy = Math.abs(y - 63.5);
      const edge = Math.max(dx, dy, (dx + dy) * 0.7071);
      const grain = noise(x / 6, y / 6) * 0.7 + noise(x / 2, y / 2) * 0.3;
      const ring = edge - 47 + grain * 1.1;
      const inner = Math.abs(edge - 36);
      const diamond = Math.abs(dx + dy - 24);
      const cut = Math.min(dx, dy) < 4.5 && edge > 24 && edge < 45;
      const seal = dx + dy < 7 && Math.max(dx, dy) < 5;
      const carved = Math.abs(ring) < 2.6 || cut || diamond < 1.65 || seal ||
        (inner < 1.4 && Math.min(dx, dy) > 10);
      if (carved) {
        if (armed) {
          const highlight = grain > 0.15 || (y < 57 && ring > 1.55);
          const index = seal || (highlight && Math.abs(ring) < 1.0) ? 3 :
            grain > -0.12 ? 2 : grain > -0.52 ? 1 : 0;
          pixels.set(x, y, magic[index]);
        } else {
          const index = grain > 0.43 ? 2 : grain > -0.15 ? 1 : 0;
          const dull = seal ? (grain > 0.08 ? p.magiaBase : p.magiaEscuro) :
            grain < -0.38 ? p.abismo1 : stone[index];
          pixels.set(x, y, dull);
        }
      } else if ((ring > 2.6 && ring < 4.05) || (diamond >= 1.65 && diamond < 2.55)) {
        const index = grain > 0.36 ? 4 : grain > -0.26 ? 3 : 2;
        pixels.set(x, y, stone[index]);
      } else if (ring > 4.05 && ring < 6.2 && grain > 0.38) {
        pixels.set(x, y, p.pedraEscuro);
      }
    }
  }
  return pixels;
}
