import { rampPick } from '../../_masonry';
import { PALETTES as p, RAMPS } from '../../_theme';
import { lobbyTexture, meter, noise } from './_surface';

export default lobbyTexture((x, y) => {
  const localX = x % meter;
  const localY = y % meter;
  const squareX = x - localX + meter / 2;
  const squareY = y - localY + meter / 2;
  const family = noise(squareX, squareY, 4, 4, 117);
  const grain = noise(x, y, 88, 94, 53);
  const fray = noise(x, y, 104, 64, 71);
  const grout = Math.min(localX, localY, meter - localX, meter - localY);
  if (grout < 1.6 + 1.4 * fray) return grain > 0.71 ? p.pedraSombra : p.abismo1;

  const ramp = family < 0.54 ? RAMPS.pedra : RAMPS.ferro;
  const bevel = Math.min(localX, localY) > meter - 6 ? -0.14 :
    grout < 4.3 ? (Math.min(localX, localY) < 6 ? 0.17 : -0.13) : 0;
  const slab = noise(squareX, squareY, 6, 6, 219);
  const layers = noise(x, y, 9, 63, 637);
  const worn = noise(x, y, 31, 37, 73);
  const tone = 0.49 + (slab - 0.5) * 0.28 + (layers - 0.5) * 0.22 +
    (worn - 0.5) * 0.20 + (grain - 0.5) * 0.12 + bevel;
  return rampPick(ramp, tone, x, y);
});
