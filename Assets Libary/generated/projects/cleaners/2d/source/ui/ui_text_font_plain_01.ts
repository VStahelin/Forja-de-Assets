import { defineAsset } from '@core';
import { CELL_H, CELL_W, COLUMNS, TEXT_FONT_ROWS } from './_text_font';
import { paintTextFont } from './ui_text_font_01';

/**
 * Fonte de texto sem contorno (22/11/2026): mesmos glifos, células e métricas de `ui_text_font_01`.
 * Serve à tinta sobre papel, onde o contorno escuro embola as letras. Usa o mesmo `.fnt`.
 */
export default defineAsset({
  width: CELL_W * COLUMNS,
  height: CELL_H * TEXT_FONT_ROWS,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    paintTextFont(false).render(ctx);
  },
});
