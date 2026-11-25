import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../../_theme';

/**
 * Marca de faixa de estrela na barra de LIMPO (HUD da faxina v2, 23/11/2026), 3 × 10.
 * Um rebite de cabeça redonda com haste, cravado na barra. Quadro 0 apagado (ferro),
 * quadro 1 aceso (osso), quando a faixa da estrela já foi alcançada.
 */
const W = 3, H = 10;

const SHAPE = [
  '.o.',
  'oho',
  'omo',
  '.o.',
  'oso',
  'oso',
  'oso',
  'oso',
  'oso',
  'ooo',
];

export default defineAsset({
  width: W,
  height: H,
  scale: 1,
  frames: 2,
  animations: { off: [0], on: [1] },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const lit = frameIndex === 1;
    const c = new PixelCanvas(W, H);
    c.drawMatrix(SHAPE, {
      o: p.abismo0,
      h: lit ? p.ossoBrilho : p.ferroLuz,
      m: lit ? p.ossoBase : p.ferroBase,
      s: lit ? p.ossoLuz : p.ferroEscuro,
    });
    c.set(1, 7, lit ? p.ossoBase : p.ferroEscuro).set(1, 8, lit ? p.ossoEscuro : p.ferroSombra);
    c.render(ctx);
  },
});
