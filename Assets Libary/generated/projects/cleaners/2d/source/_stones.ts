/**
 * Gerador de superfícies de pedra irregular, tileável, para o Cleaners.
 *
 * As pedras são células de Voronoi num toro (o layout dá a volta nas bordas), com as bordas
 * deformadas por ruído, tamanhos variados, sulcos fundos entre elas e sombreamento de
 * "almofada" (bisel iluminado em cima e escuro embaixo). Cada pedra tem altura e inclinação
 * próprias, então umas parecem levantadas e outras tortas.
 *
 * Tudo é periódico em W x H: o resultado repete sem costura.
 */

import { createRng } from '@core';
import { bayer, wrap, type ColorGrid } from './_masonry';

// ---------------------------------------------------------------------------
// Ruído periódico retangular
// ---------------------------------------------------------------------------

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Value noise em [0, 1], periódico em W x H. `cx` células na largura; `cy` é dado na mesma
 * escala (células por W pixels) e convertido para a altura, então as células são sempre
 * quadradas, mesmo num tile retangular como a parede (1024 x 512). Sem isso o ruído esticava 2x.
 */
export function pnoise(x: number, y: number, W: number, H: number, cx: number, cyPerW: number, seed: number): number {
  const cy = Math.max(1, Math.round((cyPerW * H) / W));
  const fx = (wrap(x, W) / W) * cx;
  const fy = (wrap(y, H) / H) * cy;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const ax = wrap(x0, cx);
  const bx = wrap(x0 + 1, cx);
  const ay = wrap(y0, cy);
  const by = wrap(y0 + 1, cy);
  const a = hash2(ax, ay, seed);
  const b = hash2(bx, ay, seed);
  const c = hash2(ax, by, seed);
  const d = hash2(bx, by, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** fBm periódico em [0, 1]. `cx`/`cy` são as células da primeira oitava. */
export function pfbm(x: number, y: number, W: number, H: number, cx: number, cy: number, octaves: number, seed: number): number {
  let total = 0;
  let amp = 1;
  let max = 0;
  for (let o = 0; o < octaves; o++) {
    total += pnoise(x, y, W, H, cx << o, cy << o, seed + o * 101) * amp;
    max += amp;
    amp *= 0.5;
  }
  return total / max;
}

// ---------------------------------------------------------------------------
// Layout de pedras (Voronoi num toro)
// ---------------------------------------------------------------------------

export interface Stone {
  id: number;
  x: number;
  y: number;
  /** Variação de tom em [-1, 1]. */
  tone: number;
  /** Altura em [0, 1]: pedras altas ficam mais claras e com bisel mais largo. */
  height: number;
  /** Inclinação: direção para onde a pedra "desce" (gradiente de luz na face). */
  tiltX: number;
  tiltY: number;
  /** Usa a rampa alternativa (manchas verde-azuladas). */
  green: boolean;
  /** Tem uma rachadura atravessando. */
  cracked: boolean;
}

export interface StoneLayoutOptions {
  W: number;
  H: number;
  seed: number;
  /** Tamanho médio da célula em px (largura e altura). */
  cellW: number;
  cellH: number;
  /** Quanto o ponto pode andar dentro da célula, em [0, 1], por eixo. */
  jitterX: number;
  jitterY: number;
  /** Desloca linhas ímpares em meia célula (aparelho de alvenaria). */
  stagger: boolean;
  /** Chance de a célula ganhar uma segunda pedra (pedras pequenas). */
  extraChance: number;
  /** Chance de a célula ficar sem pedra (as vizinhas crescem: pedras grandes). */
  dropChance: number;
  greenChance: number;
  crackChance: number;
  /** Peso da distância vertical (>1 deixa as juntas horizontais retas, como fiadas). Padrão 1. */
  aspect?: number;
}

export interface StoneLayout {
  W: number;
  H: number;
  gx: number;
  gy: number;
  cellW: number;
  cellH: number;
  aspect: number;
  /** Pedras de cada célula da grade, indexadas por gy * gx. */
  buckets: Stone[][];
  stones: Stone[];
}

export function buildStoneLayout(o: StoneLayoutOptions): StoneLayout {
  const rng = createRng(o.seed);
  const gx = Math.round(o.W / o.cellW);
  const gy = Math.round(o.H / o.cellH);
  const cellW = o.W / gx;
  const cellH = o.H / gy;
  const buckets: Stone[][] = Array.from({ length: gx * gy }, () => []);
  const stones: Stone[] = [];
  let id = 0;
  const make = (x: number, y: number): Stone => {
    const ang = rng.float(0, Math.PI * 2);
    const tilt = rng.float(0, 1);
    const s: Stone = {
      id: id++,
      x,
      y,
      tone: rng.float(-1, 1),
      height: Math.pow(rng.float(0, 1), 1.6),
      tiltX: Math.cos(ang) * tilt,
      tiltY: Math.sin(ang) * tilt,
      green: rng.boolean(o.greenChance),
      cracked: rng.boolean(o.crackChance),
    };
    stones.push(s);
    return s;
  };
  for (let j = 0; j < gy; j++) {
    const shift = o.stagger && j % 2 === 1 ? 0.5 : 0;
    for (let i = 0; i < gx; i++) {
      const bucket = buckets[j * gx + i];
      if (rng.boolean(o.dropChance)) continue;
      const count = rng.boolean(o.extraChance) ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const jx = count === 2 ? 0.9 : o.jitterX;
        const jy = count === 2 ? 0.9 : o.jitterY;
        const px = (i + shift + 0.5 + rng.float(-0.5, 0.5) * jx) * cellW;
        const py = (j + 0.5 + rng.float(-0.5, 0.5) * jy) * cellH;
        bucket.push(make(wrap(px, o.W), wrap(py, o.H)));
      }
    }
  }
  return { W: o.W, H: o.H, gx, gy, cellW, cellH, aspect: o.aspect ?? 1, buckets, stones };
}

export interface StoneSample {
  stone: Stone;
  /** Distância (px) até a borda da pedra. */
  edge: number;
  /** Vetor do centro da pedra até o ponto, já com a volta nas bordas. */
  rx: number;
  ry: number;
}

/** Pedra mais próxima de (x, y) e a distância até a borda dela (bissetriz com a vizinha). */
export function sampleStone(L: StoneLayout, x: number, y: number): StoneSample {
  const ci = Math.floor(wrap(x, L.W) / L.cellW);
  const cj = Math.floor(wrap(y, L.H) / L.cellH);
  const cand: { s: Stone; dx: number; dy: number; d2: number }[] = [];
  for (let dj = -2; dj <= 2; dj++) {
    for (let di = -2; di <= 2; di++) {
      const bucket = L.buckets[wrap(cj + dj, L.gy) * L.gx + wrap(ci + di, L.gx)];
      for (const s of bucket) {
        let dx = s.x - x;
        let dy = s.y - y;
        dx -= Math.round(dx / L.W) * L.W;
        dy -= Math.round(dy / L.H) * L.H;
        dy *= L.aspect;
        cand.push({ s, dx, dy, d2: dx * dx + dy * dy });
      }
    }
  }
  let best = cand[0];
  for (const c of cand) if (c.d2 < best.d2) best = c;
  // Distância até a bissetriz mais próxima entre a pedra dona e cada vizinha.
  let edge = Infinity;
  for (const c of cand) {
    if (c === best) continue;
    const bx = c.dx - best.dx;
    const by = c.dy - best.dy;
    const len = Math.hypot(bx, by);
    if (len < 1e-6) continue;
    // Ponto relativo ao meio do segmento entre as duas pedras.
    const mx = -(best.dx + c.dx) / 2;
    const my = -(best.dy + c.dy) / 2;
    const d = -(mx * bx + my * by) / len;
    if (d < edge) edge = d;
  }
  return { stone: best.s, edge, rx: -best.dx, ry: -best.dy / L.aspect };
}

// ---------------------------------------------------------------------------
// Pintura
// ---------------------------------------------------------------------------

export interface StonePaint {
  /** Rampa da face, sombra -> brilho (5 tons). */
  ramp: readonly string[];
  /** Rampa alternativa (manchas verdes), mesmo número de tons. */
  rampGreen: readonly string[];
  /** Cor do fundo do sulco e cor do meio do sulco. */
  grooveDeep: string;
  grooveMid: string;
  /** Terra nas frestas. */
  dirt: string;
  /** Musgo: escuro e base. */
  mossDark: string;
  mossBase: string;
  /** Largura média do sulco (px) e variação. */
  groove: number;
  grooveVar: number;
  /** Deformação das bordas (px). */
  warp: number;
  /** Largura do bisel (px). */
  bevel: number;
  /** Quanto de musgo (0 a 1) e de terra nas frestas. */
  moss: number;
  dirtAmount: number;
  /** Valor médio da face (0 a 1): mais baixo = mais escuro. */
  baseValue: number;
  /** Escurece por baixo (parede: 1 = base mais escura e úmida). */
  verticalDamp: number;
}

const pick = (ramp: readonly string[], value: number, x: number, y: number): string => {
  const v = Math.min(0.9999, Math.max(0, value));
  const t = v * (ramp.length - 1);
  const i = Math.floor(t);
  return t - i > bayer(x, y) ? ramp[Math.min(ramp.length - 1, i + 1)] : ramp[i];
};

/** Luz vinda de cima à esquerda (no plano da textura). */
const LX = -0.55;
const LY = -0.83;

export function paintStones(L: StoneLayout, p: StonePaint, seed: number): ColorGrid {
  const { W, H } = L;
  const grid: ColorGrid = Array.from({ length: H }, () => new Array<string>(W));
  const rng = createRng(seed + 999);

  // Rachaduras: uma linha reta-torta por pedra rachada, guardada como ângulo.
  const crackAng = new Map<number, number>();
  for (const s of L.stones) if (s.cracked) crackAng.set(s.id, rng.float(0, Math.PI));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Deformação das bordas: amostra o layout num ponto deslocado por ruído.
      const wx = x + (pfbm(x, y, W, H, 16, 16, 2, seed + 1) - 0.5) * 2 * p.warp;
      const wy = y + (pfbm(x, y, W, H, 16, 16, 2, seed + 2) - 0.5) * 2 * p.warp;
      const { stone, edge, rx, ry } = sampleStone(L, wx, wy);

      const gw = p.groove + (pnoise(x, y, W, H, 32, 32, seed + 3) - 0.5) * 2 * p.grooveVar;
      const half = gw / 2;
      const macro = pfbm(x, y, W, H, 2, 2, 3, seed + 4); // variação grande, quebra a repetição
      const damp = p.verticalDamp * Math.pow(y / H, 2.2);

      if (edge < half) {
        // Sulco: fundo escuro, meio um pouco menos.
        const deep = edge < half * 0.55;
        let c = deep ? p.grooveDeep : p.grooveMid;
        const dn = pfbm(x, y, W, H, 32, 32, 2, seed + 5);
        if (dn > 1 - p.dirtAmount) c = p.dirt;
        const mn = pfbm(x, y, W, H, 8, 8, 3, seed + 6) + damp * 0.3;
        if (mn > 1 - p.moss) c = mn > 1 - p.moss * 0.5 ? p.mossBase : p.mossDark;
        grid[y][x] = c;
        continue;
      }

      const e = edge - half; // distância dentro da face
      const r = Math.hypot(rx, ry) || 1;
      const nx = rx / r;
      const ny = ry / r;
      const bevelW = p.bevel * (0.7 + stone.height * 0.9);

      let v = p.baseValue + stone.tone * 0.1 + stone.height * 0.14;
      v += (macro - 0.5) * 0.35;
      v -= damp * 0.3;
      // Face: grão de pedra.
      v += (pfbm(x, y, W, H, 32, 32, 4, seed + 7) - 0.5) * 0.45;
      const grain = pnoise(x, y, W, H, 512, 512, seed + 8);
      if (grain > 0.9) v -= 0.22;
      else if (grain < 0.06) v += 0.15;
      // Inclinação da pedra: um lado mais claro que o outro.
      v += (rx * stone.tiltX + ry * stone.tiltY) / 40 * -0.12;
      // Bisel de almofada: borda virada para a luz clareia, a oposta escurece.
      if (e < bevelW) {
        const k = 1 - e / bevelW;
        const lit = nx * LX + ny * LY; // >0 quando a borda olha para a luz
        v += lit * k * 0.55;
        v -= k * 0.12; // oclusão geral perto do sulco
      }
      // Rachadura.
      const ang = crackAng.get(stone.id);
      if (ang !== undefined) {
        const cx = Math.cos(ang);
        const cy = Math.sin(ang);
        const along = rx * cx + ry * cy;
        const across = -rx * cy + ry * cx + (pnoise(x, y, W, H, 64, 64, seed + stone.id) - 0.5) * 6;
        if (Math.abs(across) < 0.8 && Math.abs(along) < r + 40 && e > 2) {
          grid[y][x] = p.grooveMid;
          continue;
        }
      }
      // Musgo subindo pela borda baixa das pedras.
      const mn = pfbm(x, y, W, H, 8, 8, 3, seed + 6) + damp * 0.3;
      if (e < 4 && mn > 1 - p.moss * 0.6) {
        grid[y][x] = p.mossDark;
        continue;
      }
      grid[y][x] = pick(stone.green && pfbm(x, y, W, H, 16, 16, 2, seed + 9) > 0.45 ? p.rampGreen : p.ramp, v, x, y);
    }
  }
  return grid;
}
