/**
 * Fonte de texto da interface (22/11/2026): maiúsculas, minúsculas, acentos do português e pontuação,
 * proporcional, com contorno de 1 px em abismo para ler sobre qualquer fundo.
 * Pedida pelo Vitor para os menus (pausa e opções) e para as outras telas com problema de leitura.
 * Densidade do menu (VX-08): 1 px de arte = 1 px na base de 1280 × 720, metade do pixel do HUD.
 *
 * Grade de cada glifo (12 linhas, sem o contorno):
 *   0-1  acento das maiúsculas      2  folga
 *   2-3  acento das minúsculas      4  folga (ou topo das hastes de b, d, f, h, k, l, t)
 *   3-9  maiúsculas (7 linhas)      5-9  minúsculas (altura de x = 5)
 *   10-11 descendentes (g, j, p, q, y, ç)
 * Linha de base: embaixo da linha 9. Com o contorno, a célula tem 14 de altura e a base fica na linha 11.
 */
import { G } from './_ui';

export const GLYPH_ROWS = 12;
export const OUTLINE = 1;
export const CELL_W = 9;
export const CELL_H = GLYPH_ROWS + OUTLINE * 2;
export const COLUMNS = 16;
/** Distância do topo da célula até a linha de base. */
export const BASE = 10 + OUTLINE;
export const SPACE_ADVANCE = 4;

/** Minúsculas: 9 linhas, da linha 3 à 11 da grade. */
const LOWER: Record<string, string[]> = {
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####', '.....', '.....'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.', '.....', '.....'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###', '....', '....'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####', '.....', '.....'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.', '.....', '.....'],
  f: ['..##', '.#..', '###.', '.#..', '.#..', '.#..', '.#..', '....', '....'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#', '.....', '.....'],
  i: ['#', '.', '#', '#', '#', '#', '#', '.', '.'],
  j: ['.#', '..', '.#', '.#', '.#', '.#', '.#', '.#', '#.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#', '....', '....'],
  l: ['#.', '#.', '#.', '#.', '#.', '#.', '.#', '..', '..'],
  m: ['.....', '.....', '####.', '#.#.#', '#.#.#', '#.#.#', '#.#.#', '.....', '.....'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#', '.....', '.....'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.', '.....', '.....'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['....', '....', '#.##', '##..', '#...', '#...', '#...', '....', '....'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.', '....', '....'],
  t: ['.#..', '.#..', '###.', '.#..', '.#..', '.#..', '..##', '....', '....'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '.....', '.....'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..', '.....', '.....'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.', '.....', '.....'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....', '.....'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####', '.....', '.....'],
};

/** Sinais novos (7 linhas, da linha 3 à 9, como as maiúsculas). */
const EXTRA: Record<string, string[]> = {
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  '°': ['.#.', '#.#', '.#.', '...', '...', '...', '...'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'],
  '&': ['.##..', '#..#.', '.##..', '.#..#', '#.##.', '#..#.', '.##.#'],
  '_': ['....', '....', '....', '....', '....', '....', '####'],
  '|': ['#', '#', '#', '#', '#', '#', '#'],
  '–': ['....', '....', '....', '####', '....', '....', '....'],
};

/** Acentos de duas linhas, centrados num glifo de largura 5 (cortados para os mais estreitos). */
const MARKS: Record<string, [string, string]> = {
  acute: ['...#.', '..#..'],
  grave: ['.#...', '..#..'],
  circ: ['..#..', '.#.#.'],
  tilde: ['.##.#', '#.##.'],
};
const ACCENTS: Record<string, [string, keyof typeof MARKS]> = {
  'À': ['A', 'grave'], 'Á': ['A', 'acute'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'],
  'É': ['E', 'acute'], 'Ê': ['E', 'circ'], 'Í': ['I', 'acute'],
  'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'],
  'à': ['a', 'grave'], 'á': ['a', 'acute'], 'â': ['a', 'circ'], 'ã': ['a', 'tilde'],
  'é': ['e', 'acute'], 'ê': ['e', 'circ'], 'í': ['i', 'acute'],
  'ó': ['o', 'acute'], 'ô': ['o', 'circ'], 'õ': ['o', 'tilde'], 'ú': ['u', 'acute'],
};

const UPPER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const PUNCT = '!"#%\'()*+,-./:;<=>?@·×' + Object.keys(EXTRA).join('');

/** Caracteres do atlas, na ordem das células (16 por linha). O espaço não tem célula. */
export const TEXT_FONT_CHARS =
  UPPER_CHARS + LOWER_CHARS + DIGITS + PUNCT + 'ÀÁÂÃÇÉÊÍÓÔÕÚàáâãçéêíóôõú';

const blank = (w: number) => '.'.repeat(w);

/** Corta colunas vazias dos dois lados, mantendo a mesma largura em todas as linhas. */
function trim(rows: string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => r.padEnd(w, '.'));
  let left = 0;
  let right = w - 1;
  while (left < w && padded.every((r) => r[left] === '.')) left++;
  while (right > left && padded.every((r) => r[right] === '.')) right--;
  if (left > right) return padded.map(() => '');
  return padded.map((r) => r.slice(left, right + 1));
}

/** Cabe um acento de 5 colunas num glifo de largura `w`, centrado. */
function fitMark(mark: string, w: number): string {
  if (w >= 5) return mark.padEnd(w, '.');
  const cols = [...mark].map((c, i) => (c === '#' ? i : -1)).filter((i) => i >= 0);
  const center = Math.round((Math.min(...cols) + Math.max(...cols)) / 2);
  const shift = center - Math.floor((w - 1) / 2);
  return [...blank(w)].map((_, i) => mark[i + shift] ?? '.').join('');
}

/** Glifo completo de 12 linhas, sem contorno, já cortado na largura. */
export function textGlyph(ch: string): string[] {
  const accent = ACCENTS[ch];
  if (accent) {
    const base = textGlyph(accent[0]);
    const w = base[0].length;
    const [m0, m1] = MARKS[accent[1]];
    const rows = [...base];
    const upper = UPPER_CHARS.includes(accent[0]);
    const at = upper ? 0 : 2;
    rows[at] = fitMark(m0, w);
    rows[at + 1] = fitMark(m1, w);
    if (!upper) rows[4] = blank(w); // tira o pingo do i
    return rows;
  }
  if (ch === 'Ç' || ch === 'ç') {
    const base = textGlyph(ch === 'Ç' ? 'C' : 'c');
    const w = base[0].length;
    const rows = [...base];
    rows[10] = [...blank(w)].map((_, i) => (i === Math.floor(w / 2) ? '#' : '.')).join('');
    rows[11] = [...blank(w)].map((_, i) => (i === Math.floor(w / 2) - 1 ? '#' : '.')).join('');
    return rows;
  }
  let body: string[];
  let top: number;
  if (LOWER[ch]) {
    body = LOWER[ch];
    top = 3;
  } else {
    body = EXTRA[ch] ?? G[ch];
    if (!body) throw new Error(`Glifo sem desenho: ${ch}`);
    top = 3;
  }
  const cut = trim(body);
  const w = Math.max(1, cut[0].length);
  const rows = Array.from({ length: GLYPH_ROWS }, () => blank(w));
  cut.forEach((r, i) => (rows[top + i] = r || blank(w)));
  return rows;
}

export interface GlyphCell {
  ch: string;
  x: number;
  y: number;
  /** Largura do glifo com o contorno. */
  w: number;
  /** Avanço: o contorno do próximo glifo encosta no deste, sobrando 1 px escuro entre as letras. */
  advance: number;
}

export function textFontCells(): GlyphCell[] {
  return [...TEXT_FONT_CHARS].map((ch, i) => {
    const w = textGlyph(ch)[0].length;
    return {
      ch,
      x: (i % COLUMNS) * CELL_W,
      y: Math.floor(i / COLUMNS) * CELL_H,
      w: w + OUTLINE * 2,
      advance: w + OUTLINE,
    };
  });
}

export const TEXT_FONT_ROWS = Math.ceil(TEXT_FONT_CHARS.length / COLUMNS);
