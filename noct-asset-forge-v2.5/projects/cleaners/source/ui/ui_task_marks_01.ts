import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';

const size = 20;

export default defineAsset({
  width: size, height: size, scale: 1, frames: 4,
  animations: { clean: [0], disposal: [1], restock: [2], rearm: [3] },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(size, size);
    switch (frameIndex) {
      case 0:
        // Cerdas diagonais, separadas do cabo por uma braçadeira de ferro.
        c.line(7, 12, 15, 3, p.madeiraBase).line(8, 12, 16, 3, p.madeiraLuz);
        c.fillPolygon([[7, 10], [10, 14], [6, 17], [2, 13]], p.ossoBase);
        c.line(3, 13, 7, 16, p.ossoLuz).line(6, 11, 9, 14, p.ferroBase);
        c.set(4, 15, p.ossoBrilho).set(7, 16, p.ossoEscuro);
        break;
      case 1:
        c.fillPolygon([[2, 7], [17, 7], [15, 16], [4, 16]], p.madeiraBase);
        c.rect(3, 6, 14, 3, p.ferroLuz).rect(5, 7, 10, 3, p.pedraSombra);
        c.vSpan(3, 10, 14, p.madeiraLuz).vSpan(16, 10, 14, p.madeiraEscuro);
        c.vSpan(9, 2, 7, p.ossoLuz).hSpan(6, 8, 10, p.ossoBrilho);
        break;
      case 2:
        c.rect(3, 7, 14, 9, p.madeiraEscuro).rect(4, 5, 12, 6, p.madeiraBase);
        c.hSpan(5, 5, 14, p.madeiraLuz).hSpan(10, 3, 16, p.ferroBase);
        c.vSpan(6, 6, 15, p.ferroLuz).vSpan(13, 6, 15, p.ferroBase);
        c.rect(9, 9, 3, 4, p.ossoBase).set(10, 11, p.ferroSombra);
        break;
      case 3:
        c.fillPolygon([[6, 2], [13, 2], [17, 6], [17, 13], [13, 17], [6, 17],
          [2, 13], [2, 6]], p.ferroBase);
        c.circle(9, 9, 5, p.ferroSombra, true).circle(9, 9, 2, p.ferroLuz, true);
        c.line(10, 8, 14, 4, p.ossoBase).hSpan(4, 13, 15, p.ossoLuz);
        c.set(3, 7, p.ferroBrilho).set(12, 15, p.ferroEscuro);
        break;
    }
    c.addOutline(p.abismo1);
    c.render(ctx);
  },
});
