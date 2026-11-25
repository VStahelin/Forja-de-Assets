/**
 * Helpers de alvenaria tileável para as texturas de cenário do Cleaners.
 *
 * Tudo aqui é periódico no tamanho do tile: o layout dos blocos dá a volta nas bordas
 * e o ruído usa uma grade que fecha nos dois eixos. Assim qualquer textura feita com
 * estes helpers repete sem costura.
 */

import { createRng, type Rng } from '@core';

/** Grade de cores: grid[y][x]. */
export type ColorGrid = string[][];

export const wrap = (v: number, n: number): number => ((v % n) + n) % n;

// ---------------------------------------------------------------------------
// Ruído periódico (value noise numa grade que fecha nas bordas)
// ---------------------------------------------------------------------------

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Value noise periódico em [0, 1]. `cellsX`/`cellsY` células cobrem o tile inteiro,
 * então o resultado repete a cada `size` pixels nos dois eixos.
 */
export function periodicNoise(x: number, y: number, size: number, cellsX: number, cellsY: number, seed: number): number {
  const fx = (wrap(x, size) / size) * cellsX;
  const fy = (wrap(y, size) / size) * cellsY;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const ax = wrap(x0, cellsX);
  const bx = wrap(x0 + 1, cellsX);
  const ay = wrap(y0, cellsY);
  const by = wrap(y0 + 1, cellsY);
  const a = hash2(ax, ay, seed);
  const b = hash2(bx, ay, seed);
  const c = hash2(ax, by, seed);
  const d = hash2(bx, by, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** fBm periódico em [0, 1]: cada oitava dobra o número de células, mantendo a periodicidade. */
export function periodicFbm(
  x: number,
  y: number,
  size: number,
  cells: number,
  octaves: number,
  seed: number,
  stretchY = 1,
): number {
  let total = 0;
  let amp = 1;
  let max = 0;
  let c = cells;
  for (let o = 0; o < octaves; o++) {
    total += periodicNoise(x, y, size, c, Math.max(1, Math.round(c * stretchY)), seed + o * 101) * amp;
    max += amp;
    amp *= 0.5;
    c *= 2;
  }
  return total / max;
}

// ---------------------------------------------------------------------------
// Dithering ordenado
// ---------------------------------------------------------------------------

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export const bayer = (x: number, y: number): number => (BAYER4[wrap(y, 4)][wrap(x, 4)] + 0.5) / 16;

/** Escolhe um tom da rampa para um valor em [0, 1], com dithering Bayer entre tons vizinhos. */
export function rampPick(ramp: readonly string[], value: number, x: number, y: number): string {
  const v = Math.min(0.9999, Math.max(0, value));
  const t = v * (ramp.length - 1);
  const i = Math.floor(t);
  const frac = t - i;
  const idx = frac > bayer(x, y) ? Math.min(ramp.length - 1, i + 1) : i;
  return ramp[idx];
}

// ---------------------------------------------------------------------------
// Layout de blocos em fiadas (dá a volta nas bordas)
// ---------------------------------------------------------------------------

export interface Block {
  id: number;
  /** Retângulo do bloco no espaço do tile (x e y podem passar da borda; use wrap). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Variação de tom própria do bloco, em [-1, 1]. */
  tone: number;
  /** Família de cor: 0 = rampa principal, 1 = rampa alternativa. */
  family: 0 | 1;
}

export interface CourseOptions {
  size: number;
  seed: number;
  rowMin: number;
  rowMax: number;
  blockMin: number;
  blockMax: number;
  /** Chance de um bloco ser partido em duas pedras menores. */
  splitChance: number;
  /** Chance de um bloco usar a rampa alternativa. */
  altChance: number;
}

/** Divide `total` em partes entre `min` e `max` que somam exatamente `total`. */
function partition(rng: Rng, total: number, min: number, max: number): number[] {
  const parts: number[] = [];
  let left = total;
  while (left > 0) {
    if (left <= max) {
      if (left >= min || parts.length === 0) {
        parts.push(left);
      } else {
        parts[parts.length - 1] += left; // sobra pequena vai para o último
      }
      break;
    }
    let p = rng.int(min, max);
    if (left - p < min) p = left - min;
    parts.push(p);
    left -= p;
  }
  return parts;
}

/** Gera blocos em fiadas horizontais desencontradas, cobrindo o tile inteiro. */
export function buildCourses(opts: CourseOptions): Block[] {
  const rng = createRng(opts.seed);
  const blocks: Block[] = [];
  let id = 0;
  let y = 0;
  for (const h of partition(rng, opts.size, opts.rowMin, opts.rowMax)) {
    const offset = rng.int(0, opts.size - 1);
    let x = offset;
    for (const w of partition(rng, opts.size, opts.blockMin, opts.blockMax)) {
      const family: 0 | 1 = rng.boolean(opts.altChance) ? 1 : 0;
      if (rng.boolean(opts.splitChance) && w >= 24 && h >= 24) {
        // Duas pedras menores: lado a lado ou empilhadas.
        if (rng.boolean(0.5) && h >= 36) {
          const h1 = rng.int(Math.floor(h * 0.35), Math.floor(h * 0.65));
          blocks.push({ id: id++, x, y, w, h: h1, tone: rng.float(-1, 1), family });
          blocks.push({ id: id++, x, y: y + h1, w, h: h - h1, tone: rng.float(-1, 1), family });
        } else {
          const w1 = rng.int(Math.floor(w * 0.3), Math.floor(w * 0.7));
          blocks.push({ id: id++, x, y, w: w1, h, tone: rng.float(-1, 1), family });
          blocks.push({ id: id++, x: x + w1, y, w: w - w1, h, tone: rng.float(-1, 1), family });
        }
      } else {
        blocks.push({ id: id++, x, y, w, h, tone: rng.float(-1, 1), family });
      }
      x += w;
    }
    y += h;
  }
  return blocks;
}

export interface Cell {
  block: Block;
  /** Posição dentro do bloco. */
  lx: number;
  ly: number;
}

/** Mapa pixel -> bloco, com a posição local dentro do bloco. */
export function rasterizeBlocks(blocks: Block[], size: number): Cell[][] {
  const map: Cell[][] = Array.from({ length: size }, () => new Array<Cell>(size));
  for (const b of blocks) {
    for (let ly = 0; ly < b.h; ly++) {
      for (let lx = 0; lx < b.w; lx++) {
        map[wrap(b.y + ly, size)][wrap(b.x + lx, size)] = { block: b, lx, ly };
      }
    }
  }
  return map;
}

/** Uma grade vazia preenchida com uma cor. */
export function makeGrid(size: number, color: string): ColorGrid {
  return Array.from({ length: size }, () => new Array<string>(size).fill(color));
}

/**
 * Racha: caminhada aleatória de 1 px que dá a volta nas bordas.
 * Só pinta pixels que pertencem ao mesmo bloco onde a racha começou.
 */
export function crack(
  grid: ColorGrid,
  map: Cell[][],
  rng: Rng,
  size: number,
  sx: number,
  sy: number,
  steps: number,
  color: string,
): void {
  const owner = map[wrap(sy, size)][wrap(sx, size)].block.id;
  let x = sx;
  let y = sy;
  const dir = rng.float(0, Math.PI * 2);
  let ang = dir;
  for (let i = 0; i < steps; i++) {
    const cx = wrap(Math.round(x), size);
    const cy = wrap(Math.round(y), size);
    const cell = map[cy][cx];
    if (cell.block.id !== owner || cell.lx < 3 || cell.ly < 3) break;
    grid[cy][cx] = color;
    ang += rng.float(-0.7, 0.7);
    ang = dir + Math.max(-0.9, Math.min(0.9, ang - dir));
    x += Math.cos(ang);
    y += Math.sin(ang);
  }
}

/** Repete uma grade `nx` x `ny` vezes (para mockups de costura). */
export function tileGrid(grid: ColorGrid, nx: number, ny: number): ColorGrid {
  const h = grid.length;
  const w = grid[0].length;
  return Array.from({ length: h * ny }, (_, y) => Array.from({ length: w * nx }, (_, x) => grid[y % h][x % w]));
}
