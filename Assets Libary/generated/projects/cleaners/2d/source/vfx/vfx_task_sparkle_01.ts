import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';

const size = 32;
const frames = 16;

function sparkle(c: PixelCanvas, x: number, y: number, radius: number) {
  const waist = Math.max(1, Math.round(radius * 0.19));
  const side = Math.max(1, Math.round(radius * 0.68));
  c.fillPolygon([[x, y - radius], [x + waist, y - waist], [x + side, y],
    [x + waist, y + waist], [x, y + radius], [x - waist, y + waist],
    [x - side, y], [x - waist, y - waist]], p.ossoBase);
  c.vSpan(x, y - radius + 1, y + radius - 1, p.ossoLuz);
  c.hSpan(y, x - side + 1, x + side - 1, p.ossoLuz);
  c.circle(x, y, waist, p.ossoBrilho, true);
}

export default defineAsset({
  width: size, height: size, scale: 1, frames, fps: 36,
  animations: { confirm: Array.from({ length: frames }, (_, index) => index) },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(size, size);
    const impulse = Math.sin(Math.PI * (frameIndex + 0.5) / frames);
    const peak = Math.round(10 * impulse);
    if (peak > 1) sparkle(c, 15, 16, peak);
    const flecks = [p.ossoSombra, p.ossoEscuro, p.ferroBase, p.ferroLuz, p.ferroBrilho];
    for (let i = 0; i < flecks.length; i++) {
      const angle = (i + 0.3) * Math.PI * 2 / flecks.length;
      const reach = 4 + frameIndex * 0.5 + i * 0.55;
      if (frameIndex > i + 1 && frameIndex < frames - 1 - (i % 2)) {
        const x = 15 + Math.round(Math.cos(angle) * reach);
        const y = 16 + Math.round(Math.sin(angle) * reach);
        c.set(x, y, flecks[i]);
        if (impulse > 0.8) c.set(x, y - 1, p.ossoLuz);
      }
    }
    c.render(ctx);
  },
});
