import { defineAsset } from '@core';
import { RULES } from '../_theme';
import { drawGlyph } from './_glyph';

export default defineAsset({
  width: RULES.pxPerMeter,
  height: RULES.pxPerMeter,
  scale: 1,
  antialiasing: 'none',
  render({ ctx }) {
    drawGlyph(false).render(ctx);
  },
});
