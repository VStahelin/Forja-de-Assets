import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p, RAMPS } from '../_theme';
import { ironPlate, recess } from './_ui';

/**
 * Placa do cronômetro, no topo central do HUD (leva 2, 21/11/2026).
 * Quadro 0: normal. Quadro 1: alerta dos últimos 30 s, com mais ferrugem.
 * A janela rebaixada fica em x 17..64, y 4..21; os números entram por cima, na engine.
 */
const width = 70;
const height = 26;

function hourglass(c: PixelCanvas, alert: boolean): void {
  const x0 = 5;
  const y0 = 5;
  c.hSpan(y0 - 1, x0 + 1, x0 + 5, p.madeiraBase);
  c.hSpan(y0, x0, x0 + 6, p.madeiraLuz);
  c.hSpan(y0 + 14, x0, x0 + 6, p.madeiraLuz);
  c.hSpan(y0 + 15, x0 + 1, x0 + 5, p.madeiraEscuro);
  for (let i = 0; i < 13; i++) {
    const span = Math.max(0, Math.round(2.6 - Math.abs(i - 6) * 0.42));
    c.set(x0 + 2 - span, y0 + 1 + i, p.ossoBase);
    c.set(x0 + 4 + span, y0 + 1 + i, p.ossoEscuro);
  }
  const sand = alert ? RAMPS.ferrugem : RAMPS.madeira;
  c.hSpan(y0 + 2, x0 + 1, x0 + 5, sand[2]);
  c.hSpan(y0 + 3, x0 + 2, x0 + 4, sand[3]);
  c.set(x0 + 3, y0 + 8, sand[3]);
  c.set(x0 + 3, y0 + 9, sand[3]);
  c.hSpan(y0 + 11, x0 + 2, x0 + 4, sand[3]);
  c.hSpan(y0 + 12, x0 + 1, x0 + 5, sand[2]);
  c.hSpan(y0 + 13, x0 + 1, x0 + 5, sand[2]);
}

export default defineAsset({
  width,
  height,
  scale: 1,
  frames: 2,
  animations: { normal: [0], alert: [1] },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const alert = frameIndex === 1;
    const c = new PixelCanvas(width, height);
    ironPlate(c, 0, 0, { width, height, seed: 31, rust: alert ? 0.42 : 0.16 });
    recess(c, 17, 4, width - 22, height - 8, 32);
    hourglass(c, alert);
    if (alert) {
      for (let x = 20; x < width - 6; x += 7) c.vSpan(x, 2, 3, p.ferrugemBase);
    }
    c.render(ctx);
  },
});
