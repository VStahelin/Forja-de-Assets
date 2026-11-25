import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RAMPS } from '../_theme';
import { hash, periodicNoise, rampPick } from './_ui';

/**
 * Manchas soltas para o papel sujo, em quadros de 28 × 28:
 * 0 anel de caneca (madeira), 1 mancha de graxa, 2 digital encardida.
 * A engine espalha um ou dois por folha, com semente fixa por tela.
 */
const size = 28;

function coffeeRing(c: PixelCanvas): void {
  const cx = 13.5;
  const cy = 13.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - cx, y - cy);
      const gap = periodicNoise(Math.atan2(y - cy, x - cx) * 8 + 32, 0, 64, 16, 1, 71) > 0.72;
      if (Math.abs(r - 10.5) < 1.1 && !gap) c.set(x, y, hash(x, y, 72) > 0.35 ? p.madeiraLuz : p.madeiraBase);
      else if (Math.abs(r - 9.3) < 0.6 && hash(x, y, 73) > 0.6) c.set(x, y, p.ossoBase);
      else if (r < 3 && hash(x, y, 74) > 0.8) c.set(x, y, p.madeiraBrilho);
    }
  }
}

function grease(c: PixelCanvas): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((x - 14) / 1.25, y - 14);
      const n = periodicNoise(x, y, 28, 5, 5, 81);
      if (r + n * 6 > 12) continue;
      const tone = 0.32 + (12 - r) * 0.012 + (n - 0.5) * 0.3;
      c.set(x, y, rampPick([p.ossoEscuro, p.ossoBase, p.ossoLuz], tone, x, y));
    }
  }
}

function fingerprint(c: PixelCanvas): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - 14) / 0.82;
      const dy = y - 14;
      const r = Math.hypot(dx, dy);
      if (r > 11.5) continue;
      const ridge = Math.floor(r + 0.4 * Math.sin(Math.atan2(dy, dx) * 3)) % 2 === 0;
      if (ridge && hash(x, y, 91) > 0.18 + r * 0.03) c.set(x, y, r < 6 ? p.ossoEscuro : p.ossoBase);
    }
  }
}

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  frames: 3,
  animations: { ring: [0], grease: [1], fingerprint: [2] },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(size, size);
    if (frameIndex === 0) coffeeRing(c);
    else if (frameIndex === 1) grease(c);
    else fingerprint(c);
    void RAMPS;
    c.render(ctx);
  },
});
