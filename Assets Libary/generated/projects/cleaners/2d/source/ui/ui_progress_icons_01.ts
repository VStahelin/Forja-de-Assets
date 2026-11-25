import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';

/**
 * Marcas da progressão (proposta de 22/11/2026), 10 × 10, contorno de abismo.
 * 0 mérito (plaqueta de osso rebitada, como a do gerente), 1 moeda, 2 estrela da nota,
 * 3 tachinha que prende as fichas, 4 lacre da memória (roxo: a memória é magia da masmorra).
 */
const size = 10;

type Draw = (c: PixelCanvas) => void;

const MARKS: Draw[] = [
  (c) => {
    c.rect(1, 2, 8, 6, p.ossoBase, true).hSpan(2, 1, 8, p.ossoBrilho).vSpan(1, 2, 7, p.ossoLuz);
    c.hSpan(7, 1, 8, p.ossoEscuro).vSpan(8, 2, 7, p.ossoEscuro);
    c.set(2, 3, p.ferroLuz).set(7, 3, p.ferroLuz).set(2, 6, p.ferroBase).set(7, 6, p.ferroBase);
    c.hSpan(4, 4, 5, p.ossoEscuro).hSpan(5, 3, 6, p.ossoEscuro);
  },
  (c) => {
    c.circle(4.5, 4.5, 4, p.ossoEscuro, true).circle(4.5, 4.5, 3, p.ossoBase, true);
    c.rect(4, 2, 2, 5, p.ossoEscuro, true).set(3, 2, p.ossoBrilho).set(2, 3, p.ossoLuz);
  },
  (c) => {
    c.fillPolygon([[4.5, 0], [6, 3], [9, 3.5], [7, 6], [7.5, 9], [4.5, 7.5], [1.5, 9], [2, 6], [0, 3.5], [3, 3]], p.ossoLuz);
    c.set(4, 2, p.ossoBrilho).set(4, 3, p.ossoBrilho).hSpan(6, 3, 6, p.ossoBase);
  },
  (c) => {
    c.circle(4.5, 3.5, 3, p.ferroBase, true).set(3, 2, p.ferroBrilho).set(4, 2, p.ferroLuz);
    c.vSpan(4, 6, 9, p.ferroEscuro).vSpan(5, 6, 8, p.ferroLuz);
  },
  (c) => {
    c.circle(4.5, 4.5, 4, p.magiaEscuro, true).circle(4.5, 4.5, 3, p.magiaBase, true);
    c.circle(4.5, 4.5, 1.5, p.magiaEscuro, false).set(3, 2, p.magiaLuz).set(2, 3, p.magiaLuz);
    c.set(8, 7, p.magiaBase).set(9, 8, p.magiaEscuro);
  },
];

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  frames: MARKS.length,
  animations: { merit: [0], coin: [1], star: [2], pin: [3], seal: [4] },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(size, size);
    MARKS[frameIndex](c);
    c.addOutline(p.abismo1);
    c.render(ctx);
  },
});
