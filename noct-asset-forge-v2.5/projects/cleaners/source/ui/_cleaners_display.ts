import { PathBuilder } from '@core/brush';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';
import { accents, glyphs } from './_cleaners_display_shapes';

const CELL_WIDTH = 70;
export const CELL_HEIGHT = 84;
const COLUMNS = 12;
const INSET_X = 4;
const INSET_Y = 16;
const SMALL_CAP_SCALE = 0.78;
export const BASELINE = 49 + INSET_Y;
export const FONT_SIZE = 64;
export const LINE_HEIGHT = 79;
export const SPACE_WIDTH = 19;
export const KERNING: readonly (readonly [string, string, number])[] = [
  ['A', 'V', -4], ['A', 'W', -3], ['A', 'Y', -4], ['C', 'L', -1], ['F', 'A', -3],
  ['L', 'T', -3], ['L', 'V', -3], ['L', 'Y', -4], ['P', 'A', -3],
  ['T', 'A', -4], ['T', 'O', -2], ['V', 'A', -4], ['W', 'A', -3], ['Y', 'A', -4], ['Y', 'O', -2],
];

const capitals = Object.keys(glyphs).filter((key) => /^[A-Z]$/.test(key));
const keys = [
  ...capitals, ...capitals.map((key) => key.toLowerCase()),
  ...Object.keys(glyphs).filter((key) => !capitals.includes(key)),
  ...Object.keys(accents), ...Object.keys(accents).map((key) => key.toLowerCase()),
];

export const ATLAS_WIDTH = COLUMNS * CELL_WIDTH;
export const ATLAS_HEIGHT = Math.ceil(keys.length / COLUMNS) * CELL_HEIGHT;

export const cells = keys.map((key, index) => {
  const upper = key.toUpperCase();
  const [letter, accent] = accents[upper] ?? [upper, ''];
  const [advance, face, ...counters] = glyphs[letter];
  const scale = key === upper ? 1 : SMALL_CAP_SCALE;
  return {
    key, face, counters, accent, scale, center: advance / 2,
    x: index % COLUMNS * CELL_WIDTH,
    y: Math.floor(index / COLUMNS) * CELL_HEIGHT,
    width: Math.min(CELL_WIDTH, Math.ceil(advance * scale) + 12),
    advance: Math.round(advance * scale) + 6,
  };
});
type Cell = (typeof cells)[number];

function silhouette(outline: string, cell: Cell, shiftX = 0) {
  const mask = new PixelCanvas(cell.width, CELL_HEIGHT);
  for (const contour of outline.match(/M[^M]+/g) ?? []) {
    const builder = new PathBuilder();
    const tokens = contour.match(/[MLCZ]|-?\d+/g) ?? [];
    let index = 0;
    const point = () => ({
      x: INSET_X + (Number(tokens[index++]) + shiftX) * cell.scale,
      y: BASELINE + (Number(tokens[index++]) - 49) * cell.scale,
    });
    while (index < tokens.length) {
      const command = tokens[index++];
      switch (command) {
        case 'M': builder.moveTo(point()); break;
        case 'L': builder.lineTo(point()); break;
        case 'C': builder.bezierTo(point(), point(), point()); break;
        case 'Z': break;
        default: throw new Error('Comando de contorno desconhecido: ' + command);
      }
    }
    PixelCanvas.fromShape(builder.close(), cell.width, CELL_HEIGHT, { color: p.ossoBrilho, target: mask });
  }
  return mask;
}

export function paintGlyph(cell: Cell, atlas: PixelCanvas, left = cell.x, top = cell.y) {
  const face = silhouette(cell.face, cell);
  const counters = cell.counters.map((outline) => silhouette(outline, cell));
  const accent = cell.accent && silhouette(cell.accent, cell, cell.center);
  const filled = (x: number, y: number) => (
    (accent && accent.get(x, y)) || (face.get(x, y) && !counters.some((mask) => mask.get(x, y)))
  );

  for (let y = 0; y < CELL_HEIGHT; y++) {
    for (let x = 0; x < cell.width; x++) {
      const grain = (31 * x + 73 * y + 7 * x * y) % 97;
      let color: string | null = null;
      if (filled(x, y)) {
        if (!filled(x - 1, y) || !filled(x, y - 1)) {
          color = p.ossoBrilho;
        } else if (!filled(x + 1, y) || !filled(x, y + 1)) {
          color = p.ferroLuz;
        } else if (!filled(x + 2, y + 2)) {
          color = grain % 5 === 0 ? p.pedraLuz : p.ferroBrilho;
        } else if (grain === 2) {
          color = p.ossoEscuro;
        } else if (!filled(x - 2, y - 2) || grain % 8 === 0) {
          color = p.ossoLuz;
        } else {
          color = p.ossoBase;
        }
      } else if (filled(x - 1, y - 2) || filled(x, y - 2) || filled(x - 2, y - 1)) {
        color = p.pedraBase;
      } else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
        color = p.pedraEscuro;
      } else if (filled(x + 1, y + 1) || filled(x - 1, y + 1) || filled(x, y + 2) || filled(x - 2, y - 3) || filled(x - 1, y - 3) || filled(x + 2, y)) {
        color = p.abismo1;
      }
      if (color !== null) atlas.set(left + x, top + y, color);
    }
  }
}
