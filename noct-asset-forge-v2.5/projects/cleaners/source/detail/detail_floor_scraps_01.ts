import { BAYER_4X4, createNoise2D, defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as colors, RAMPS } from '../_theme';

type Point = [number, number];
type Material = 'wood' | 'cloth';

const width = 128;
const height = 96;
const noise = createNoise2D('cleaners-floor-scraps-01');

function drawFragment(
  canvas: PixelCanvas,
  surface: PixelCanvas,
  center: Point,
  size: Point,
  angle: number,
  material: Material,
) {
  const [cx, cy] = center;
  const [length, breadth] = size;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const cloth = material === 'cloth';
  const outline: Point[] = cloth
    ? [[-1, -0.55], [-0.36, -1], [0.12, -0.74], [0.66, -1], [1, -0.41], [0.78, 0.02], [0.91, 0.57], [0.27, 0.98], [0.01, 0.64], [-0.38, 1], [-0.82, 0.55], [-0.67, 0.13]]
    : [[-1, 0.05], [-0.71, -0.77], [-0.30, -0.44], [0.14, -1], [1, -0.45], [0.48, 0.28], [0.67, 0.71], [-0.36, 1]];
  const profile = outline.map(([x, y]): Point => [
    Math.round(cx + x * length * cosine - y * breadth * sine),
    Math.round(cy + x * length * sine + y * breadth * cosine),
  ]);
  surface.clear().fillPolygon(profile, colors.abismo1);
  const limits = Math.ceil(length + breadth);
  const ramp = cloth ? RAMPS.couro_tecido : RAMPS.madeira;
  for (let y = cy - limits; y <= cy + limits; y++) {
    for (let x = cx - limits; x <= cx + limits; x++) {
      if (!surface.get(x, y)) continue;
      const along = (x - cx) * cosine + (y - cy) * sine;
      const across = -(x - cx) * sine + (y - cy) * cosine;
      const edge = !surface.get(x, y - 1) || !surface.get(x - 1, y) ||
        !surface.get(x + 1, y) || !surface.get(x, y + 1);
      const fibers = noise(along / (cloth ? 7 : 16), across / (cloth ? 3.3 : 1.3));
      const dither = BAYER_4X4[y % 4][x % 4] / 16;
      if (edge) {
        const underside = !surface.get(x, y + 1) || !surface.get(x + 1, y);
        canvas.set(x, y, underside ? ramp[0] : ramp[1]);
        continue;
      }

      const fold = cloth && Math.abs(across + 0.14 * along + 0.8) < 1.0;
      const fray = cloth && !surface.get(x, y - 2) && Math.floor(along) % 3 === 0;
      if (fold && Math.abs(along) < length * 0.76) {
        canvas.set(x, y, fibers > 0 ? colors.ossoLuz : colors.ossoBase);
      } else if (fray) {
        canvas.set(x, y, colors.ossoEscuro);
      } else {
        const brightness = 2.0 + 2.2 * fibers - (Math.abs(across) > breadth * 0.68 ? 0.7 : 0);
        const shade = Math.max(0, Math.min(4, Math.floor(brightness + dither)));
        canvas.set(x, y, ramp[shade]);
      }
    }
  }
}

export default defineAsset({
  width,
  height,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const canvas = new PixelCanvas(width, height);
    const surface = new PixelCanvas(width, height);
    drawFragment(canvas, surface, [40, 52], [18, 10], -0.39, 'cloth');
    drawFragment(canvas, surface, [90, 31], [11, 6], 0.63, 'cloth');
    drawFragment(canvas, surface, [71, 58], [14, 4], -0.94, 'wood');
    drawFragment(canvas, surface, [95, 62], [9, 3], 0.32, 'wood');
    drawFragment(canvas, surface, [20, 32], [8, 2.8], 0.91, 'wood');
    drawFragment(canvas, surface, [49, 75], [11, 3.4], 0.38, 'wood');
    drawFragment(canvas, surface, [105, 48], [6.5, 1.8], -0.55, 'wood');
    drawFragment(canvas, surface, [75, 19], [6.5, 2.4], -0.35, 'wood');
    canvas.render(ctx);
  },
});
