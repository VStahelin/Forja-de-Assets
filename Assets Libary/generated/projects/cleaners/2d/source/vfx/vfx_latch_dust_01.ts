import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';
import { hash } from '../ui/_ui';

const width = 64;
const height = 48;
const frames = 20;
const grit = [
  p.pedraEscuro, p.pedraBase, p.pedraLuz, p.pedraBrilho,
  p.ossoSombra, p.ossoEscuro, p.ossoBase, p.ossoLuz,
];

export default defineAsset({
  width, height, scale: 1, frames, fps: 40,
  animations: { fall: Array.from({ length: frames }, (_, index) => index) },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(width, height);
    for (let i = 0; i < 25; i++) {
      const age = frameIndex - 1 - (i % 4);
      const life = 13 + Math.round(hash(i, 8, 97) * 3);
      if (age < 0 || age >= life) continue;
      const spread = hash(i, 4, 99) - 0.5;
      const x = 31 + Math.round(spread * (20 + age * 2));
      const y = 4 + Math.round(hash(i, 5, 17) * 4 + age * 0.85 + age * age * 0.078);
      const tone = grit[i % grit.length];
      c.set(x, y, tone);
      if (i % 3 === 0 && age < 7) c.set(x + 1, y, p.pedraLuz);
      if (i % 5 === 0 && age < 4) c.set(x, y + 1, p.ossoEscuro);
    }
    c.render(ctx);
  },
});
