import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ATLAS_HEIGHT, ATLAS_WIDTH, BASELINE, CELL_HEIGHT, FONT_SIZE, KERNING, LINE_HEIGHT, SPACE_WIDTH, cells,
} from '../source/ui/_cleaners_display';

const dir = resolve(process.argv[2] ?? resolve(import.meta.dirname, '../assets/ui'));
const name = process.argv[3] ?? 'ui_cleaners_display_01';
const output = resolve(dir, name + '.fnt');
const lines = [
  'info face="Cleaners Display" size=' + FONT_SIZE + ' bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=0,0 outline=0',
  'common lineHeight=' + LINE_HEIGHT + ' base=' + BASELINE + ' scaleW=' + ATLAS_WIDTH + ' scaleH=' + ATLAS_HEIGHT + ' pages=1 packed=0',
  'page id=0 file="' + name + '.png"',
  'chars count=' + (cells.length + 1),
  'char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=' + SPACE_WIDTH + ' page=0 chnl=15',
  ...cells.map((c) => 'char id=' + c.key.codePointAt(0) + ' x=' + c.x + ' y=' + c.y + ' width=' + c.width + ' height=' + CELL_HEIGHT + ' xoffset=0 yoffset=0 xadvance=' + c.advance + ' page=0 chnl=15'),
  'kernings count=' + KERNING.length,
  ...KERNING.map(([first, second, amount]) => 'kerning first=' + first.codePointAt(0) + ' second=' + second.codePointAt(0) + ' amount=' + amount),
];
writeFileSync(output, lines.join('\n') + '\n', 'utf8');
console.log((cells.length + 1) + ' caracteres em ' + output);
