import { BAYER_4X4, createNoise2D, defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as colors, RULES } from '../_theme';

const size = RULES.pxPerMeter;
const noise = createNoise2D('cleaners-blood-pool-01');

function puddleColor(x: number, y: number, dx: number, dy: number, edge: number) {
  const mottling = noise(x / 15, y / 13) * 0.6 + noise(x / 5, y / 5) * 0.4;
  const threshold = BAYER_4X4[y % 4][x % 4] / 16;
  if (edge > 0.974) return mottling > 0.16 ? colors.couroSombra : colors.abismo1;
  if (edge > 0.89 + mottling * 0.04) {
    return mottling > 0.22 ? colors.couroEscuro : colors.sangueEscuro;
  }

  // Broken glints follow the lobes of the puddle instead of shading it like a solid object.
  const glint = edge + mottling * 0.045;
  if (glint > 0.68 && glint < 0.735 && dx < 11 && dy < 1 && mottling > 0.08) {
    return mottling > 0.47 ? colors.couroLuz : colors.sangueLuz;
  }
  if (mottling > 0.29 && edge < 0.73) {
    return mottling > 0.5 && threshold < 0.5 ? colors.couroBase : colors.sangueLuz;
  }
  if (mottling < -0.29 && threshold < 0.65) return colors.sangueEscuro;
  return colors.sangueBase;
}

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const pixels = new PixelCanvas(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dy = y - 65;
        const dx = x - 59 + 0.22 * dy;
        const angle = Math.atan2(dy / 31, dx / 42);
        const edge = Math.hypot(dx / 42, dy / 31) +
          0.11 * Math.sin(3 * angle + 0.5) +
          0.075 * Math.cos(7 * angle) +
          0.045 * noise(x / 8, y / 8);
        if (edge < 1) pixels.set(x, y, puddleColor(x, y, dx, dy, edge));
      }
    }

    for (let drop = 0; drop < 5; drop++) {
      const x = 102 + drop * 4;
      const y = 43 - drop * 5 + Math.round(noise(drop + 4, 6) * 4);
      const radius = Math.max(1, 4 - drop);
      pixels.circle(x, y, radius, colors.sangueEscuro);
      if (radius > 1) pixels.circle(x, y, radius - 1, colors.sangueBase);
    }
    pixels.render(ctx);
  },
});
