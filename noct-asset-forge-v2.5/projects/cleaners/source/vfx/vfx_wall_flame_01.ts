import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { bayer, rampPick } from '../_masonry';
import { PALETTES as p, RULES } from '../_theme';

const width = RULES.pxPerMeter * 3 / 16;
const height = RULES.pxPerMeter * 9 / 32;
const frames = 48;
const palette = [p.ferrugemBase, p.fogoEscuro, p.ferrugemLuz, p.fogoBase, p.ossoLuz,
  p.fogoLuz, p.fogoBrilho, p.ossoBrilho];

export default defineAsset({
  width,
  height,
  scale: 1,
  frames,
  fps: 60,
  animations: { flicker: Array.from({ length: frames }, (_, index) => index) },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const pixels = new PixelCanvas(width, height);
    const phase = 2 * Math.PI * frameIndex / frames;
    const fireHeight = 27 + 3.3 * Math.sin(phase) + 2 * Math.sin(3 * phase + 0.4);
    const fireWidth = 7.3 + .7 * Math.cos(2 * phase);
    for (let y = 3; y < height; y++) {
      const rise = (height - 1 - y) / fireHeight;
      if (rise < 0 || rise > 1) continue;
      const taper = Math.pow(1 - rise, 0.72);
      const center = width * .5 + rise ** 1.6 *
        (2.4 * Math.sin(phase + rise * 4.7) + 1.7 * Math.sin(2 * phase + rise * 8));
      const breadth = fireWidth * taper * (.74 + .26 * Math.sin(rise * Math.PI));
      for (let x = 1; x < width - 1; x++) {
        const edge = Math.abs(x - center) / Math.max(breadth, .28);
        if (edge > 1 + .12 * Math.sin(y * 1.71 + phase * 2) || (edge > .94 && bayer(x, y) > .55)) continue;
        const core = Math.max(0, 1 - edge) ** .70;
        const tone = .22 + .85 * core - .57 * rise + .12 * Math.sin(phase + y * .38) * rise;
        pixels.set(x, y, rampPick(palette, tone, x, y));
      }
    }
    for (let spark = 0; spark < 2; spark++) {
      const lift = ((frameIndex + spark * 24) % frames) / frames;
      if (lift < 0.62) {
        const x = Math.round(width * 0.5 + (spark * 2 - 1) * (1 + 6 * lift));
        const y = Math.round(15 - 18 * lift);
        pixels.set(x, y, lift < .32 ? p.fogoLuz : p.fogoEscuro);
      }
    }
    pixels.render(ctx);
  },
});
