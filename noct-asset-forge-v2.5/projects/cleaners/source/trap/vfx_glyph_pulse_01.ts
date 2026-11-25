import { BAYER_4X4, createNoise2D, defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RULES } from '../_theme';

const size = RULES.pxPerMeter * 1.25;
const frames = 29;
const grain = createNoise2D('cleaners-glyph-pulse');
const hues = [p.pedraBase, p.pedraLuz, p.pedraBrilho, p.magiaEscuro, p.magiaBase, p.magiaLuz, p.magiaBrilho,
  p.pedraVerdeBrilho];

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  frames,
  fps: 60,
  animations: { pulse: Array.from({ length: frames }, (_, i) => i) },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const pixels = new PixelCanvas(size, size);
    const phase = frameIndex / (frames - 1);
    const radius = 22 + 49 * (1 - (1 - phase) ** 1.5);
    const coverage = Math.min(1, phase * 14) * (1 - phase ** 2.7);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - (size - 1) / 2;
        const dy = y - (size - 1) / 2;
        const distance = Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * 0.7071);
        const angle = Math.atan2(dy, dx);
        const noise = grain(x / 8, y / 8);
        const crest = distance - radius + 1.3 * noise;
        const flare = Math.cos(angle * 8) * 0.5 + 0.5;
        const trail = crest >= -9 - flare * 5 && crest < -3 && phase > 0.1 && (flare + noise * 0.24) > 0.83;
        const rim = Math.abs(crest) < 1.25 + flare * (1 - phase) * 3.2;
        if (!rim && !trail) continue;
        const threshold = (BAYER_4X4[y % 4][x % 4] + 1 / 32);
        if (threshold > coverage * (rim ? 1 : 0.61)) continue;
        const index = trail ? (noise > 0.22 ? 7 : noise > -0.52 ? 4 : 3) :
          Math.abs(crest) < 1.25 ? (noise > 0.14 ? 6 : noise > -0.41 ? 5 : 2) :
            crest > 0 ? (noise > -0.26 ? 5 : 1) : (noise > -0.23 ? 4 : 0);
        pixels.set(x, y, hues[index]);
      }
    }
    pixels.render(ctx);
  },
});
