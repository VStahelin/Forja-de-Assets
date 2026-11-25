import { BAYER_4X4, createNoise2D, defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';

type Noise = ReturnType<typeof createNoise2D>;
type Mark = (x: number, y: number, noise: Noise) => { coverage: number; tone: number };

export function weatheringDecal(
  seed: string, width: number, height: number, ramp: readonly string[], mark: Mark
) {
  const noise = createNoise2D(seed);
  return defineAsset({
    width,
    height,
    scale: 1,
    antialiasing: 'none',
    render({ ctx }) {
      const canvas = new PixelCanvas(width, height);
      for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
          const { coverage, tone } = mark(x, y, noise);
          const threshold = (BAYER_4X4[y % 4][x % 4] + 0.5) / 16;
          if (coverage <= threshold) continue;
          const shade = Math.max(0, Math.min(ramp.length - 1, Math.floor(tone + threshold)));
          canvas.set(x, y, ramp[shade]);
        }
      }
      canvas.render(ctx);
    },
  });
}
