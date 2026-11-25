import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../../_theme';
import { hash, sliceCoord } from '../_ui';
import { MASK, part } from './_hud';

/**
 * Bilhete do gerente (HUD da faxina v2, 23/11/2026), 40 × 28, 9-slice com margem 6.
 * Papel de osso mais limpo que o papel sujo: fibras soltas, dobra horizontal no meio, canto de
 * baixo à direita dobrado e clipe de ferro preso no topo, à esquerda. O clipe e o canto dobrado
 * ficam dentro das margens, então o 9-slice preserva os dois. O texto é escrito pelo jogo.
 */
const W = 40, H = 28;
const margin = 6;
const top = 2; // o papel começa 2 px abaixo do topo, para o clipe passar por cima
const ear = 5;

export default defineAsset({
  width: W,
  height: H,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(W, H);
    const inPaper = (x: number, y: number) =>
      x >= 0 && x < W && y >= top && y < H && !((W - 1 - x) + (H - 1 - y) < ear);
    for (let y = top; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inPaper(x, y)) continue;
        const e = Math.min(x, y - top, W - 1 - x, H - 1 - y);
        const sx = sliceCoord(x, W, margin), sy = sliceCoord(y, H, margin);
        let color: string;
        if (e === 0 || (W - 1 - x) + (H - 1 - y) === ear) color = p.abismo1;
        else if (e === 1 && (y === top + 1 || x === 1)) color = p.ossoBrilho;
        else if (e === 1) color = p.ossoBase;
        else {
          // papel limpo: osso claro liso, com fibras curtas e soltas
          color = p.ossoLuz;
          const fiber = hash(sx, sy, 2312);
          if (fiber > 0.955) color = p.ossoBase;
          else if (fiber < 0.03) color = p.ossoBrilho;
          if (e === 2 && (x === W - 3 || y === H - 3)) color = p.ossoBase;
        }
        c.set(x, y, color);
      }
    }
    // dobra horizontal no meio: vinco escuro com a aba de baixo pegando luz
    const fold = Math.floor((top + H) / 2);
    for (let x = 2; x < W - 2; x++) {
      c.set(x, fold, p.ossoBase);
      c.set(x, fold + 1, p.ossoBrilho);
    }
    // canto de baixo à direita dobrado: a aba virada para dentro mostra o verso, mais escuro
    for (let y = H - 1 - ear; y < H; y++) {
      for (let x = W - 1 - ear; x < W; x++) {
        const d = (W - 1 - x) + (H - 1 - y);
        if (d <= ear) continue;
        const rim = x === W - 1 - ear || y === H - 1 - ear;
        c.set(x, y, rim ? p.ossoEscuro : d === ear + 1 ? p.ossoLuz : p.ossoBase);
      }
    }
    // clipe de ferro no topo, à esquerda: laço de arame com o laço de dentro
    part(c, [p.ferroEscuro, p.ferroBase, p.ferroLuz, p.ferroBrilho], (m) => {
      m.vSpan(2, 1, 6, MASK).vSpan(5, 1, 7, MASK).hSpan(0, 3, 4, MASK).hSpan(7, 3, 4, MASK);
      m.vSpan(3, 3, 6, MASK);
    }, { lift: 0.1 });
    for (const [x, y] of [[1, 1], [1, 0], [2, 0], [5, 0], [6, 0], [6, 1], [3, 1], [4, 1], [4, 2]] as const) {
      if (y < top || x === 3 || x === 4) c.set(x, y, p.abismo1);
    }
    c.render(ctx);
  },
});
