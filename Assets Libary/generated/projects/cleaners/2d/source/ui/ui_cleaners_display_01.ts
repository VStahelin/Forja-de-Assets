import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { ATLAS_HEIGHT, ATLAS_WIDTH, cells, paintGlyph } from './_cleaners_display';

export default defineAsset({
  width: ATLAS_WIDTH, height: ATLAS_HEIGHT, scale: 1, antialiasing: 'none',
  render({ ctx }) {
    const atlas = new PixelCanvas(ATLAS_WIDTH, ATLAS_HEIGHT);
    for (const cell of cells) paintGlyph(cell, atlas);
    atlas.render(ctx);
  },
});