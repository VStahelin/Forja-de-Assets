import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';
import { FONT_CHARS, drawGlyph } from './_ui';

/**
 * Fonte de pixel do HUD: maiúsculas 5 × 7 com acentos do português, em células de 6 × 10,
 * 16 colunas por linha, na ordem de `FONT_CHARS`. Glifos em osso claro: a engine pinta a cor.
 * É um atlas de fonte (importado como fonte de imagem no Godot), não texto pintado.
 */
const cellW = 6;
const cellH = 10;
const columns = 16;
const rows = Math.ceil(FONT_CHARS.length / columns);

export default defineAsset({
  width: cellW * columns,
  height: cellH * rows,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    const c = new PixelCanvas(cellW * columns, cellH * rows);
    [...FONT_CHARS].forEach((ch, i) => {
      drawGlyph(c, ch, (i % columns) * cellW, Math.floor(i / columns) * cellH, p.ossoBrilho);
    });
    c.render(ctx);
  },
});
