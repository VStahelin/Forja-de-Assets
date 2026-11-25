import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../../_theme';
import { bayer } from '../_ui';

/**
 * Dígitos de hodômetro do placar (HUD da faxina v2, 23/11/2026), 8 × 12.
 * Cada dígito é de osso sobre um rolo de ferro, com faixa escura em cima e embaixo, como o
 * contador mecânico de pontos. Quadros 0 a 9: normal. Quadros 10 a 19: os mesmos dígitos em
 * musgo, para o instante em que os pontos sobem. É um atlas funcional, como o do cronômetro.
 */
const W = 8, H = 12;

// Glifos 6 × 8 de traço 2, chanfrados nos cantos.
const GLYPHS: string[][] = [
  ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  ['..##..', '.###..', '####..', '..##..', '..##..', '..##..', '..##..', '######'],
  ['.####.', '##..##', '....##', '...##.', '..##..', '.##...', '##....', '######'],
  ['.####.', '##..##', '....##', '..###.', '....##', '....##', '##..##', '.####.'],
  ['...##.', '..###.', '.####.', '##.##.', '######', '...##.', '...##.', '...##.'],
  ['######', '##....', '#####.', '....##', '....##', '....##', '##..##', '.####.'],
  ['.####.', '##....', '##....', '#####.', '##..##', '##..##', '##..##', '.####.'],
  ['######', '....##', '...##.', '...##.', '..##..', '..##..', '.##...', '.##...'],
  ['.####.', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '.####.'],
  ['.####.', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '.####.'],
];

function drum(c: PixelCanvas) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let color: string;
      if (y === 0 || y === H - 1) color = p.abismo0;
      else if (y === 1 || y === H - 2) color = p.abismo1;
      else {
        // rolo: mais claro no meio, escurece para as faixas
        const t = 1 - Math.abs(y - 5.5) / 4.5;
        color = t > 0.55 ? p.ferroBase : t > 0.3 ? (bayer(x, y) < 0.5 ? p.ferroBase : p.ferroEscuro) : p.ferroEscuro;
      }
      if (x === W - 1 && y > 0 && y < H - 1) color = p.ferroSombra;
      c.set(x, y, color);
    }
  }
}

function digit(c: PixelCanvas, n: number, gain: boolean) {
  const [hi, mid, lo] = gain ? [p.musgoBrilho, p.musgoBrilho, p.musgoLuz] : [p.ossoBrilho, p.ossoLuz, p.ossoBase];
  const g = GLYPHS[n];
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 6; gx++) {
      if (g[gy][gx] !== '#') continue;
      const x = gx + 1, y = gy + 2;
      const up = gy === 0 || g[gy - 1][gx] !== '#';
      const left = gx === 0 || g[gy][gx - 1] !== '#';
      const down = gy === 7 || g[gy + 1][gx] !== '#';
      let color: string = gy < 4 ? mid : lo;
      if (up || left && gy < 4) color = hi;
      else if (down) color = lo;
      c.set(x, y, color);
      // sombra projetada de 1 px abaixo e à direita, no rolo
      if (c.get(x + 1, y + 1) !== p.abismo0) {
        const below = gy === 7 || g[gy + 1][gx + 1] !== '#';
        if (below && y + 1 < H - 2 && (gx === 5 || g[gy + 1]?.[gx + 1] !== '#')) c.set(x + 1, y + 1, p.abismo1);
      }
    }
  }
  // repinta o glifo por cima das sombras que caíram dentro dele
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 6; gx++) {
      if (g[gy][gx] !== '#') continue;
      const x = gx + 1, y = gy + 2;
      if (c.get(x, y) === p.abismo1) c.set(x, y, gy < 4 ? mid : lo);
    }
  }
}

export default defineAsset({
  width: W,
  height: H,
  scale: 1,
  frames: 20,
  animations: {
    normal: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    gain: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  },
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(W, H);
    drum(c);
    digit(c, frameIndex % 10, frameIndex >= 10);
    c.render(ctx);
  },
});
