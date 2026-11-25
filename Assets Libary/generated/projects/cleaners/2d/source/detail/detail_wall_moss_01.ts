import { BAYER_4X4, createNoise2D, defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as colors, RAMPS } from '../_theme';

const width = 144;
const height = 56;
const noise = createNoise2D('cleaners-wall-moss-01');

export default defineAsset({
  width,
  height,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const canvas = new PixelCanvas(width, height);
    for (let x = 4; x < width - 4; x++) {
      const u = (x - 4) / (width - 8);
      const mass = Math.sin(Math.PI * u) ** 0.63;
      const gully = Math.exp(-((x - 83) ** 2) / 221);
      const tuft = 0.54 + 0.32 * noise(x / 30, 7.5) + 0.18 * noise(x / 11, 2.3);
      const crest = 46 - mass * (18 + 37 * tuft - 16 * gully);
      const base = 50 - Math.round(3.5 * noise(x / 14, 11.55));
      for (let y = Math.max(3, Math.floor(crest - 5)); y <= base; y++) {
        const cells = noise(x / 5, y / 4) * 0.72 + noise(x / 2.7, y / 2.3) * 0.28;
        const edge = Math.min(y - crest, base - y, x - 4, width - 5 - x);
        const dither = BAYER_4X4[y % 4][x % 4] / 16;
        if (edge + 4.2 * cells < (dither - 0.5) * 2.0) continue;

        const coverage = noise(x / 12, y / 9);
        const crevice = y > base - 2 || (coverage < -0.38 && cells < -0.16);
        if (crevice) {
          const rim = coverage > 0.1 ? colors.pedraVerdeSombra : colors.musgoSombra;
          canvas.set(x, y, edge < 1 && cells < -0.05 ? colors.abismo1 : rim);
          continue;
        }
        if (coverage < -0.23 && cells < 0.11) {
          canvas.set(x, y, cells < -0.30 ? colors.pedraVerdeEscuro : colors.pedraVerdeBase);
          continue;
        }

        const ridge = noise(x / 7, y / 5 + 0.35) - noise(x / 7, y / 5 - 0.35);
        const light = 2.1 + cells * 1.8 + ridge * 1.0 - (edge < 2 ? 0.7 : 0);
        const shade = Math.min(4, Math.max(0, Math.floor(light + dither)));
        canvas.set(x, y, RAMPS.musgo[shade]);
      }
    }
    canvas.render(ctx);
  },
});
