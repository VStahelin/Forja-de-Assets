import { defineAsset } from '@core';

const spriteUrl = new URL('./forge-mark.sprite.png', import.meta.url).href;

export default defineAsset({
  width: 96,
  height: 96,
  scale: 1,
  antialiasing: 'none',
  async render({ ctx }) {
    const sprite = new Image();
    sprite.src = spriteUrl;
    await sprite.decode();
    ctx.drawImage(sprite, 0, 0);
  },
});
