/**
 * Prepara os recortes da referência aprovada como matrizes indexadas de arte.
 * Uso na raiz da Forja: npx tsx projects/cleaners/tools/prepare-logo-ogive.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { PALETTES as p } from '../source/_theme';

const reference = resolve(process.argv[2] ?? '../../docs/arte/referencias/030-logo-arco-ogival-esfregao-referencia.png');
const generated = resolve(import.meta.dirname, '../source/ui/_logo_ogive_pixels.ts');

const colors = [
  'abismo1', 'pedraSombra', 'pedraEscuro', 'ferroBase', 'pedraBase', 'ferroLuz',
  'pedraLuz', 'pedraBrilho', 'ferroBrilho', 'ossoSombra', 'ossoEscuro', 'ossoBase',
  'ossoLuz', 'ossoBrilho',
] as const;
const palette = colors.map((color) => [1, 3, 5].map((i) => Number.parseInt(p[color].slice(i, i + 2), 16)));
function paeth(left: number, up: number, diagonal: number) {
  const a = Math.abs(up - diagonal);
  const b = Math.abs(left - diagonal);
  const c = Math.abs(left + up - 2 * diagonal);
  if (a <= b && a <= c) return left;
  return b <= c ? up : diagonal;
}

function readReference(path: string) {
  const png = readFileSync(path);
  if (png.toString('ascii', 1, 4) !== 'PNG' || png[24] !== 8 || png[25] !== 2 || png[28] !== 0) {
    throw new Error('A referência deve ser um PNG RGB de 8 bits, sem entrelaçamento.');
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const tag = png.toString('ascii', offset + 4, offset + 8);
    if (tag === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const stream = inflateSync(Buffer.concat(chunks));
  const stride = width * 3;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const source = y * (stride + 1);
    const filter = stream[source];
    const line = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= 3 ? pixels[line + x - 3] : 0;
      const up = y > 0 ? pixels[line + x - stride] : 0;
      const diagonal = y > 0 && x >= 3 ? pixels[line + x - stride - 3] : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, diagonal)][filter];
      pixels[line + x] = stream[source + x + 1] + predictor;
    }
  }
  return { width, height, pixels };
}

const image = readReference(reference);
if (image.width !== 1376 || image.height !== 768) throw new Error('A área dos recortes depende das medidas da referência original.');

type Crop = { left: number; top: number; width: number; height: number; part: 'mark' | 'word' };
const mark: Crop = { left: 510, top: 53, width: 357, height: 422, part: 'mark' };
const word: Crop = { left: 213, top: 423, width: 949, height: 293, part: 'word' };
const MASK_THRESHOLD = 29;

function regionColor(crop: Crop, x: number, y: number, width: number, height: number) {
  let covered = 0;
  let total = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (let row = y; row < y + height; row++) {
    for (let column = x; column < x + width; column++) {
      total++;
      if (crop.part === 'word' && column >= 510 && column < 867 && row < 472) continue;
      const at = (row * image.width + column) * 3;
      const r = image.pixels[at];
      const g = image.pixels[at + 1];
      const b = image.pixels[at + 2];
      if (Math.max(r, g, b) < MASK_THRESHOLD) continue;
      covered++;
      red += r;
      green += g;
      blue += b;
    }
  }
  if (covered * 2 <= total) return '0';
  let closest = 0;
  let error = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette[i];
    const delta = (red / covered - r) ** 2 + 1.35 * (green / covered - g) ** 2 + (blue / covered - b) ** 2;
    if (delta < error) {
      error = delta;
      closest = i;
    }
  }
  return (closest + 1).toString(16);
}

function sample(crop: Crop, width: number) {
  const height = Math.round(width * crop.height / crop.width);
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    const sy = crop.top + Math.round(y * crop.height / height);
    const sh = crop.top + Math.round((y + 1) * crop.height / height) - sy;
    let line = '';
    for (let x = 0; x < width; x++) {
      const sx = crop.left + Math.round(x * crop.width / width);
      const sw = crop.left + Math.round((x + 1) * crop.width / width) - sx;
      line += regionColor(crop, sx, sy, sw, sh);
    }
    rows.push(line);
  }
  return rows;
}

function encode(rows: string[]): string[] {
  const data = rows.join('');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let packed = '';
  for (let i = 0; i < data.length;) {
    let count = 1;
    while (count < alphabet.length && data[i + count] === data[i]) count++;
    packed += data[i] + alphabet[count - 1];
    i += count;
  }
  return packed.match(/.{1,104}/g) ?? [];
}

const batches = [
  { name: 'OGIVE_MARK', crop: mark, width: 125 },
  { name: 'OGIVE_MARK_COMPACT', crop: mark, width: 95 },
  { name: 'OGIVE_WORD', crop: word, width: 333 },
  { name: 'OGIVE_FINE_MARK', crop: mark, width: 148 },
  { name: 'OGIVE_FINE_MARK_COMPACT', crop: mark, width: 112 },
  { name: 'OGIVE_FINE_WORD', crop: word, width: 393 },
];
const lines = [
  '// Gerado por tools/prepare-logo-ogive.ts a partir da referência 030. Cada par representa cor e comprimento.',
  "import { PALETTES as p } from '../_theme';",
  'export const OGIVE_COLORS = [null, ' + colors.map((color) => 'p.' + color).join(', ') + '] as const;',
  '',
];
for (const { name, crop, width } of batches) {
  const rows = sample(crop, width);
  lines.push('export const ' + name + ' = { width: ' + width + ', height: ' + rows.length + ', runs: [');
  for (const line of encode(rows)) lines.push('  ' + JSON.stringify(line) + ',');
  lines.push('] } as const;', '');
}
writeFileSync(generated, lines.join('\n'));
