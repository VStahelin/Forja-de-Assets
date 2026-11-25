/**
 * Ajudantes do HUD da faxina v2 (lote hud-faxina-v2-01, 23/11/2026).
 *
 * `part` pinta uma peça a partir de uma máscara: a luz vem de cima à esquerda, então a borda
 * de cima e a da esquerda clareiam, a de baixo e a da direita escurecem, e o miolo desce em
 * gradiente pelo Bayer 4 × 4. Cada peça tem a própria máscara, então peças vizinhas ficam
 * separadas pela luz e pela sombra, sem traço desenhado à mão.
 */
import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../../_theme';
import { hash, rampPick } from '../_ui';

export type Ramp = readonly string[];

/** Marca usada só nas máscaras, que nunca são desenhadas na tela. */
export const MASK = 'mask';

export interface PartOptions {
  /** Soma ao valor de luz de toda a peça (positivo clareia). */
  lift?: number;
  /** Força do gradiente de cima à esquerda para baixo à direita. */
  slope?: number;
  /** Cor fixa do realce de 1 px nas bordas de cima e da esquerda (sem Bayer). */
  hi?: string;
  /** Cor fixa da sombra de 1 px nas bordas de baixo e da direita (sem Bayer). */
  lo?: string;
}

export function part(c: PixelCanvas, ramp: Ramp, draw: (m: PixelCanvas) => void, o: PartOptions = {}): PixelCanvas {
  const m = new PixelCanvas(c.width, c.height);
  draw(m);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (m.get(x, y) === null) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return m;
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  const slope = o.slope ?? 0.5;
  const out = (x: number, y: number) => m.get(x, y) === null;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (out(x, y)) continue;
      const t = 1 - ((x - x0) / bw + (y - y0) / bh) / 2;
      let v = 0.5 - slope / 2 + slope * t + (o.lift ?? 0);
      const litEdge = out(x, y - 1) || out(x - 1, y);
      const darkEdge = out(x, y + 1) || out(x + 1, y);
      if (litEdge && !darkEdge && o.hi) { c.set(x, y, o.hi); continue; }
      if (darkEdge && !litEdge && o.lo) { c.set(x, y, o.lo); continue; }
      if (litEdge && !darkEdge) v += 0.34;
      if (darkEdge && !litEdge) v -= 0.3;
      c.set(x, y, rampPick(ramp, v, x, y));
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
// Ajudantes dos ícones de alta densidade (v2 do lote, 23/11/2026)
// ---------------------------------------------------------------------------

/**
 * `solid` é o `part` com realce e sombra de 1 px fixos: o topo e a esquerda recebem o tom mais
 * claro da rampa e a base e a direita o mais escuro. É o padrão dos ícones de 32 e 24 px.
 */
export function solid(c: PixelCanvas, ramp: Ramp, draw: (m: PixelCanvas) => void, o: PartOptions = {}): PixelCanvas {
  return part(c, ramp, draw, { hi: ramp[ramp.length - 1], lo: ramp[0], ...o });
}

/** Cápsula: todo pixel a até `r` do segmento a-b (cabos, ossos, dedos, fios). */
export function capsule(m: PixelCanvas, ax: number, ay: number, bx: number, by: number, r: number): PixelCanvas {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      const ex = x - (ax + t * dx), ey = y - (ay + t * dy);
      if (ex * ex + ey * ey <= r * r) m.set(x, y, MASK);
    }
  }
  return m;
}

/** Elipse cheia de centro (cx, cy) e raios rx, ry. */
export function ellipse(m: PixelCanvas, cx: number, cy: number, rx: number, ry = rx): PixelCanvas {
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const u = (x - cx) / rx, v = (y - cy) / ry;
      if (u * u + v * v <= 1) m.set(x, y, MASK);
    }
  }
  return m;
}

/** Apaga da máscara os pixels de outra máscara (furos, recortes). */
export function cut(m: PixelCanvas, draw: (k: PixelCanvas) => void): PixelCanvas {
  const k = new PixelCanvas(m.width, m.height);
  draw(k);
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (k.get(x, y) !== null) m.set(x, y, null);
  return m;
}

/**
 * Grava um detalhe só dentro de uma peça: o desenho de `draw` vira `color` onde a máscara
 * `region` tem pixel. Serve para veios, rachaduras, costuras e frestas sem vazar da peça.
 */
export function etch(c: PixelCanvas, region: PixelCanvas, draw: (k: PixelCanvas) => void, color: string): void {
  const k = new PixelCanvas(c.width, c.height);
  draw(k);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (k.get(x, y) !== null && region.get(x, y) !== null) c.set(x, y, color);
  }
}

/** Ponto local (u ao longo do eixo, v de lado) girado por `deg` em torno de (cx, cy). */
export function axis(cx: number, cy: number, deg: number) {
  const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
  return (u: number, v: number): [number, number] => [cx + u * cs - v * sn, cy + u * sn + v * cs];
}

/**
 * Veio ao longo da direção (dx, dy): trechos curtos de `color` no miolo da peça (a borda de
 * 1 px fica livre para o realce e a sombra). Madeira, fibra de pano e o fio do ferro.
 */
export function grain(c: PixelCanvas, region: PixelCanvas, dx: number, dy: number, color: string, seed: number, density = 0.28, run = 5): void {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const inR = (x: number, y: number) => region.get(x, y) !== null;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (!inR(x, y) || !inR(x - 1, y) || !inR(x + 1, y) || !inR(x, y - 1) || !inR(x, y + 1)) continue;
    const s = Math.round(-uy * x + ux * y);
    const along = ux * x + uy * y;
    if (hash(s, Math.floor(along / run + hash(s, 7, seed) * run), seed) < density) c.set(x, y, color);
  }
}

/** Atlas em faixa horizontal, um quadro por desenho, com contorno de abismo em cada quadro. */
export function iconStrip(size: number, draws: ((c: PixelCanvas) => void)[], animations: Record<string, number[]>, outline = true) {
  return defineAsset({
    width: size,
    height: size,
    scale: 1,
    frames: draws.length,
    animations,
    antialiasing: 'none',
    render({ ctx, frameIndex = 0 }) {
      const c = new PixelCanvas(size, size);
      draws[frameIndex](c);
      if (outline) c.addOutline(p.abismo1, false);
      c.render(ctx);
    },
  });
}
