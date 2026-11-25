import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../../_theme';
import { bayer } from '../_ui';
import { MASK, solid } from './_hud';

/**
 * Quadro do item na mão (HUD da faxina v2), 40 × 40, 9-slice com margem 8.
 * Ferro chanfrado com cantoneiras em L de metal quente (ferrugem) e rebites, como a referência
 * 031, e miolo rebaixado em abismo. Quadro 0 normal, quadro 1 destaque (filete de osso por dentro).
 *
 * v2 (23/11/2026): refeito em 40 × 40 (era 28 × 28, margem 6) para caber o ícone de item de
 * 32 × 32 com 4 px de folga de cada lado, a 1 px de arte = 1 px de tela na base de 720p (VX-11).
 * As bordas entre as margens só variam com a profundidade e com o Bayer 4 × 4 (o miolo do
 * 9-slice tem 24 px, múltiplo de 4), então repetem sem emenda.
 */
const size = 40;
const margin = 8;

function slot(c: PixelCanvas, lit: boolean) {
  const w = c.width, h = c.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      const depth = Math.min(dx, dy);
      // lado iluminado: de cima e da esquerda
      const top = dy <= dx ? y < h / 2 : x < w / 2;
      const b = bayer(x, y);
      let color: string;
      if (depth === 0) color = p.abismo0;
      else if (depth === 1) color = top ? p.ferroBrilho : p.ferroSombra;
      else if (depth === 2) color = top ? p.ferroLuz : p.ferroEscuro;
      else if (depth === 3) color = top ? (b < 0.5 ? p.ferroLuz : p.ferroBase) : (b < 0.5 ? p.ferroEscuro : p.ferroBase);
      else if (depth === 4) color = top ? p.ferroBase : (b < 0.25 ? p.ferroEscuro : p.ferroBase);
      else if (depth === 5) color = top ? p.ferroSombra : p.ferroLuz; // chanfro de dentro: desce para o miolo
      else if (depth === 6) color = lit ? (top ? p.ossoBrilho : p.ossoBase) : (top ? p.ferroEscuro : p.ferroBase);
      else if (depth === 7) color = p.abismo0;
      else {
        // miolo rebaixado: a sombra cai na borda de cima e da esquerda
        const inner = Math.min(x - margin, y - margin);
        color = inner < 3 ? (inner === 0 ? p.abismo0 : (b < 0.75 - inner * 0.25 ? p.abismo0 : p.abismo1)) : p.abismo1;
      }
      c.set(x, y, color);
    }
  }
  // cantoneiras de metal quente em L, dentro da margem, com rebites de cabeça redonda
  const warm = [p.ferrugemSombra, p.ferrugemEscuro, p.ferrugemBase, p.ferrugemLuz];
  for (const [flipX, flipY] of [[false, false], [true, false], [false, true], [true, true]]) {
    const fx = (v: number) => (flipX ? w - 1 - v : v);
    const fy = (v: number) => (flipY ? h - 1 - v : v);
    solid(c, warm, (m) => {
      for (let i = 1; i <= 7; i++) for (let j = 1; j <= 3; j++) m.set(fx(i), fy(j), MASK).set(fx(j), fy(i), MASK);
      m.set(fx(4), fy(4), MASK);
    }, { lift: 0.1, hi: p.ferrugemLuz });
    // rebite do canto: 2 × 2 com brilho, meio-tom e sombra
    const rx = flipX ? fx(3) : fx(2), ry = flipY ? fy(3) : fy(2);
    c.set(rx, ry, lit ? p.ossoBrilho : p.ossoLuz).set(rx + 1, ry, p.ossoBase).set(rx, ry + 1, p.ossoBase).set(rx + 1, ry + 1, p.ossoSombra);
    // pregos nas pontas do L
    c.set(fx(6), fy(2), p.ferroBrilho).set(fx(2), fy(6), p.ferroBrilho);
    c.set(fx(7), fy(3), p.ferrugemSombra).set(fx(3), fy(7), p.ferrugemSombra);
  }
}
export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  frames: 2,
  animations: { normal: [0], highlight: [1] },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(size, size);
    slot(c, frameIndex === 1);
    c.render(ctx);
  },
});

