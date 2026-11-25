import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';
import { CELL_H, CELL_W, COLUMNS, OUTLINE, TEXT_FONT_ROWS, textFontCells, textGlyph } from './_text_font';

/**
 * Fonte de texto da interface (22/11/2026), com contorno de 1 px em abismo.
 * Atlas de células 9 × 14, 16 por linha, na ordem de `TEXT_FONT_CHARS`; cada glifo encostado
 * no canto superior esquerdo da célula. O corpo é osso claro (a engine pinta a cor por cima)
 * e o contorno continua escuro em qualquer cor. Larguras e avanços vão no `.fnt`
 * (`tools/export-text-font.ts`). É um atlas de fonte, não texto pintado.
 */
export default defineAsset({
  width: CELL_W * COLUMNS,
  height: CELL_H * TEXT_FONT_ROWS,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    paintTextFont(true).render(ctx);
  },
});

/** Pinta o atlas. Sem contorno, sai a variante para tinta sobre papel (`ui_text_font_plain_01`), com as mesmas células. */
export function paintTextFont(outline: boolean): PixelCanvas {
    const c = new PixelCanvas(CELL_W * COLUMNS, CELL_H * TEXT_FONT_ROWS);
    for (const cell of textFontCells()) {
      const rows = textGlyph(cell.ch);
      const on = (x: number, y: number) => rows[y]?.[x] === '#';
      // contorno: vizinhança de 8 de cada pixel aceso
      for (let y = -OUTLINE; outline && y < rows.length + OUTLINE; y++) {
        for (let x = -OUTLINE; x < rows[0].length + OUTLINE; x++) {
          if (on(x, y)) continue;
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++)
            for (let dx = -1; dx <= 1 && !near; dx++) near = on(x + dx, y + dy);
          if (near) c.rect(cell.x + x + OUTLINE, cell.y + y + OUTLINE, 1, 1, p.abismo0, true);
        }
      }
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++)
          if (row[x] === '#') c.rect(cell.x + x + OUTLINE, cell.y + y + OUTLINE, 1, 1, p.ossoBrilho, true);
      });
    }
    return c;
}
