/**
 * Exporta o mapa de pedras do chão ou da parede (contorno, altura e inclinação de cada pedra) em JSON,
 * para o gerador 3D montar a malha com relevo exatamente em cima da textura.
 *
 * Uso (na raiz do gerador 2D):
 *   npx tsx projects/cleaners/tools/export-stone-layout.ts floor|wall [saida.json]
 *
 * Coordenadas em pixels da textura (128 px/m). O contorno é a célula de Voronoi da pedra,
 * levada para o espaço da textura com a mesma deformação de borda que a pintura usa e
 * recuada meio sulco para dentro. Pedras que cruzam a borda do tile saem com coordenadas
 * fora de [0, W): o tile é periódico, então quem lê aplica a volta.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FLOOR_PAINT, FLOOR_SEED, WALL_PAINT, WALL_SEED, floorLayout, wallLayout } from '../source/_env_textures';
import { pfbm, type Stone } from '../source/_stones';
import { RULES } from '../source/_theme';

type V = [number, number];

const kind = process.argv[2] === 'wall' ? 'wall' : 'floor';
const seed = kind === 'wall' ? WALL_SEED : FLOOR_SEED;
const L = kind === 'wall' ? wallLayout(seed) : floorLayout(seed);
const PAINT = kind === 'wall' ? WALL_PAINT : FLOOR_PAINT;
const asset = kind === 'wall' ? 'env_wall_stone_block_01' : 'env_floor_stone_slab_01';
const { W, H } = L;
const A = L.aspect;
const warp = PAINT.warp;
const halfGroove = PAINT.groove / 2;

/** Deslocamento que a pintura aplica antes de consultar o layout (ver paintStones). */
const offset = (x: number, y: number): V => [
  (pfbm(x, y, W, H, 16, 16, 2, seed + 1) - 0.5) * 2 * warp,
  (pfbm(x, y, W, H, 16, 16, 2, seed + 2) - 0.5) * 2 * warp,
];

/** Inverso aproximado da deformação: acha x tal que x + offset(x) = v. */
function unwarp(v: V): V {
  let x: V = [v[0], v[1]];
  for (let i = 0; i < 4; i++) {
    const o = offset(x[0], x[1]);
    x = [v[0] - o[0], v[1] - o[1]];
  }
  return x;
}

/** Corta um polígono pelo semiplano (p - m) · n <= 0. */
function clip(poly: V[], m: V, n: V): V[] {
  const out: V[] = [];
  const side = (p: V) => (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) out.push(a);
    if (sa * sb < 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Célula de Voronoi no espaço com y multiplicado por `aspect` (a mesma métrica da pintura). */
function voronoiCell(s: Stone): V[] {
  const R = 160;
  const sy = s.y * A;
  let poly: V[] = [
    [s.x - R, sy - R],
    [s.x + R, sy - R],
    [s.x + R, sy + R],
    [s.x - R, sy + R],
  ];
  for (const c of L.stones) {
    if (c === s) continue;
    let dx = c.x - s.x;
    let dy = c.y - s.y;
    dx -= Math.round(dx / W) * W;
    dy -= Math.round(dy / H) * H;
    dy *= A;
    if (dx * dx + dy * dy > (2 * R) ** 2) continue;
    poly = clip(poly, [s.x + dx / 2, sy + dy / 2], [dx, dy]);
  }
  return poly.map(([x, y]): V => [x, y / A]);
}

const centroid = (p: V[]): V => {
  let x = 0;
  let y = 0;
  for (const v of p) {
    x += v[0];
    y += v[1];
  }
  return [x / p.length, y / p.length];
};

const stones = L.stones.map((s) => {
  const cell = voronoiCell(s);
  // Arestas longas viram duas, para a borda poder entortar como na textura.
  const dense: V[] = [];
  cell.forEach((a, i) => {
    const b = cell[(i + 1) % cell.length];
    dense.push(a);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 24) dense.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  });
  const warped = dense.map(unwarp);
  const c = centroid(warped);
  const inset = warped.map((v): V => {
    const dx = c[0] - v[0];
    const dy = c[1] - v[1];
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(halfGroove, d * 0.4) / d;
    return [+(v[0] + dx * k).toFixed(2), +(v[1] + dy * k).toFixed(2)];
  });
  return {
    id: s.id,
    height: +s.height.toFixed(3),
    tilt: [+s.tiltX.toFixed(3), +s.tiltY.toFixed(3)],
    center: [+c[0].toFixed(2), +c[1].toFixed(2)],
    polygon: inset,
  };
});

const out = {
  schema: 1,
  asset,
  texture: `${asset}.png`,
  aspect: A,
  pxPerMeter: RULES.pxPerMeter,
  tile: [W, H],
  seed,
  groovePx: PAINT.groove,
  note: kind === 'wall' ? 'Coordenadas em px da textura; y = 0 é o topo da parede (4 m). Repete na horizontal.' : 'Coordenadas em px da textura; o tile repete nos dois eixos. Eixo y da textura = +Z do mundo.',
  stones,
};

const target = resolve(process.argv[3] ?? resolve(import.meta.dirname, `../data/${asset}.layout.json`));
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(out));
console.log(`${stones.length} pedras -> ${target}`);
