/**
 * Escreve o descritor BMFont (texto) da fonte de texto da interface, a partir da mesma tabela de glifos
 * que pinta o atlas `ui_text_font_01.png`. O Godot importa o `.fnt` como fonte proporcional.
 *
 * Uso (na raiz do gerador 2D):
 *   npx tsx projects/cleaners/tools/export-text-font.ts [pasta]
 *
 * Escreve `ui_text_font_01.fnt` (com contorno) e `ui_text_font_plain_01.fnt` (sem contorno), com as mesmas métricas.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { BASE, CELL_H, CELL_W, COLUMNS, SPACE_ADVANCE, TEXT_FONT_ROWS, textFontCells } from '../source/ui/_text_font';

const dir = resolve(process.argv[2] ?? resolve(import.meta.dirname, '../assets/ui'));
const cells = textFontCells();
for (const [name, face, outline] of [['ui_text_font_01', 'Cleaners Text 01', 1], ['ui_text_font_plain_01', 'Cleaners Text Plain 01', 0]] as const) {
const out = resolve(dir, `${name}.fnt`);
const page = `${name}.png`;
const lines = [
  `info face="${face}" size=${CELL_H} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=0,0 outline=${outline}`,
  `common lineHeight=${CELL_H} base=${BASE} scaleW=${CELL_W * COLUMNS} scaleH=${CELL_H * TEXT_FONT_ROWS} pages=1 packed=0`,
  `page id=0 file="${page}"`,
  `chars count=${cells.length + 1}`,
  `char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=${SPACE_ADVANCE} page=0 chnl=15`,
  ...cells.map(
    (c) =>
      `char id=${c.ch.codePointAt(0)} x=${c.x} y=${c.y} width=${c.w} height=${CELL_H} xoffset=0 yoffset=0 xadvance=${c.advance} page=0 chnl=15`,
  ),
];
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join('\n') + '\n', 'utf8');
console.log(`${cells.length + 1} caracteres em ${out}`);
}
