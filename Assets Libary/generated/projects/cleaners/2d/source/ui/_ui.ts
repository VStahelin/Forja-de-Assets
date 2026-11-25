/**
 * Peças comuns da interface do Cleaners (HUD texturizado da leva 2, 21/11/2026).
 * A interface 2D tem densidade própria (VX-06): 1 px de arte = 2 px de tela em 720p.
 * Tudo usa a paleta mestre. Sangue fica fora da interface: alerta em ferrugem.
 */
import { PixelCanvas } from '@core/pixel';
import { bayer, periodicFbm, periodicNoise, rampPick, wrap } from '../_masonry';
import { PALETTES as p, RAMPS } from '../_theme';

export { bayer, periodicFbm, periodicNoise, rampPick, wrap };

/** Hash determinístico em [0, 1) por pixel. */
export function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Distância até a borda mais próxima de um retângulo w × h. */
export const edgeDistance = (x: number, y: number, w: number, h: number): number =>
  Math.min(x, y, w - 1 - x, h - 1 - y);

/**
 * Coordenada "de 9-slice": dentro das margens o valor é o da posição real; no miolo, ela se
 * repete a cada `period`, para que o centro e as bordas possam ser repetidos pela engine.
 */
export function sliceCoord(v: number, size: number, margin: number): number {
  if (v < margin) return v;
  if (v >= size - margin) return v - (size - 2 * margin);
  return margin + wrap(v - margin, size - 2 * margin);
}

// ---------------------------------------------------------------------------
// Placa de ferro rebitada (cronômetro)
// ---------------------------------------------------------------------------

export interface PlateOptions {
  width: number;
  height: number;
  seed: number;
  rust: number;
  rivets?: boolean;
}

export function ironPlate(canvas: PixelCanvas, ox: number, oy: number, o: PlateOptions): void {
  const { width: w, height: h, seed, rust } = o;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = edgeDistance(x, y, w, h);
      let color: string;
      if (e === 0) color = p.abismo0;
      else if (y === 1 && x < w - 1) color = p.ferroBrilho;
      else if (x === 1 && y < h - 1) color = p.ferroLuz;
      else if (y === h - 2 || x === w - 2) color = p.ferroEscuro;
      else {
        const n = periodicFbm(x, y, 64, 4, 3, seed);
        const fine = hash(x, y, seed + 9);
        color = rampPick(RAMPS.ferro, 0.42 + (n - 0.5) * 0.5 + (fine - 0.5) * 0.18, x, y);
        const rustNoise = periodicNoise(x, y, 32, 10, 10, seed + 3);
        if (e < 5 && rustNoise > 1 - rust) color = rampPick(RAMPS.ferrugem, hash(x, y, seed + 4), x, y);
      }
      canvas.set(ox + x, oy + y, color);
    }
  }
  // riscos curtos
  const scratches = Math.max(2, Math.floor((w * h) / 500));
  for (let i = 0; i < scratches; i++) {
    const x0 = 3 + Math.floor(hash(i, 1, seed) * (w - 9));
    const y0 = 3 + Math.floor(hash(i, 2, seed) * (h - 6));
    const length = 2 + Math.floor(hash(i, 3, seed) * 4);
    canvas.line(ox + x0, oy + y0, ox + x0 + length, oy + y0 + Math.round(hash(i, 4, seed) * 2 - 1), p.ferroLuz);
  }
  if (o.rivets !== false) {
    for (const [cx, cy] of [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]]) {
      canvas.set(ox + cx, oy + cy, p.ferroBrilho);
      canvas.set(ox + cx + 1, oy + cy, p.ferroLuz);
      canvas.set(ox + cx, oy + cy + 1, p.ferroLuz);
      canvas.set(ox + cx + 1, oy + cy + 1, p.ferroSombra);
    }
  }
}

/** Janela rebaixada e escura, onde ficam os números. */
export function recess(canvas: PixelCanvas, ox: number, oy: number, w: number, h: number, seed: number): void {
  const ramp = [p.abismo0, p.abismo1, p.ferroSombra, p.ferroEscuro];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let color = rampPick(ramp, 0.25 + (periodicFbm(x, y, 32, 4, 2, seed) - 0.5) * 0.6, x, y);
      if (y === 0 || x === 0) color = p.abismo0;
      if (y === h - 1) color = p.ferroLuz;
      if (x === w - 1 && y > 0) color = p.ferroBase;
      canvas.set(ox + x, oy + y, color);
    }
  }
}

// ---------------------------------------------------------------------------
// Fonte de pixel 5 × 7 com acentos
// ---------------------------------------------------------------------------

export const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  ',': ['.....', '.....', '.....', '.....', '..##.', '...#.', '..#..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '·': ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
};

const MARKS: Record<string, string> = { acute: '..#..', tilde: '.#.#.', circ: '.#.#.', grave: '.#...' };
const ACCENTED: Record<string, [string, keyof typeof MARKS]> = {
  'À': ['A', 'grave'], 'Á': ['A', 'acute'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'],
  'É': ['E', 'acute'], 'Ê': ['E', 'circ'], 'Í': ['I', 'acute'],
  'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'],
};
const CEDILLA = ['.###.', '#...#', '#....', '#....', '#...#', '.###.', '..#..'];
const EMPTY_ROW = '.....';

/** Caracteres da fonte, na ordem das células do atlas (uma linha de 16 por vez). */
export const FONT_CHARS =
  ' !"#%\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'ÀÁÂÃÇÉÊÍÓÔÕÚ·×';

/** Linhas de 9 de altura: 2 para o acento e 7 para a letra. */
export function glyphRows(ch: string): string[] {
  if (ch === 'Ç') return [EMPTY_ROW, EMPTY_ROW, ...CEDILLA];
  const accented = ACCENTED[ch];
  if (accented) return [MARKS[accented[1]], EMPTY_ROW, ...G[accented[0]]];
  return [EMPTY_ROW, EMPTY_ROW, ...(G[ch] ?? G[' '])];
}

/** Desenha o glifo em escala inteira. */
export function drawGlyph(canvas: PixelCanvas, ch: string, ox: number, oy: number, color: string, scale = 1): void {
  glyphRows(ch).forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] !== '#') continue;
      canvas.rect(ox + rx * scale, oy + ry * scale, scale, scale, color, true);
    }
  });
}

// ---------------------------------------------------------------------------
// Papel sujo
// ---------------------------------------------------------------------------

/** Tom de papel osso com fibras e encardido; `t` alto = claro. */
export function paperTone(x: number, y: number, period: number, seed: number): number {
  const n = periodicFbm(x, y, period, 4, 3, seed);
  const fiber = periodicNoise(x, y, period, period / 2, period / 8, seed + 2);
  return 0.95 + (n - 0.5) * 0.2 + (fiber - 0.5) * 0.1;
}
