import { rampPick } from '../../_masonry';
import { PALETTES as p, RAMPS } from '../../_theme';
import { lobbyTexture, meter, noise } from './_surface';

const boardWidth = meter / 4;
const boardLength = meter * 2;

export default lobbyTexture((x, y) => {
  const board = Math.floor(x / boardWidth);
  const boardCenter = (board + 0.5) * boardWidth;
  const cross = x % boardWidth;
  const end = (y + board * (meter / 2)) % boardLength;
  const split = noise(x, y, 180, 14, 41);
  const grain = noise(x, y, 105, 10, 867);
  const swirls = noise(x, y, 57, 19, 402);
  if (cross === 0 || (cross === 1 && split > 0.53) || end < 1.5) return p.abismo1;
  if (end > 8 && end < 12 && Math.abs(cross - boardWidth / 2) < 2.1) {
    return grain > 0.65 ? p.ferroLuz : grain > 0.33 ? p.ferroBase : p.ferroSombra;
  }

  const boardTone = noise(boardCenter, 173, 16, 2, 733);
  const lip = cross < 3 ? -0.19 : cross > boardWidth - 4 ? 0.18 : 0;
  const score = 0.44 + (boardTone - 0.5) * 0.39 + (grain - 0.5) * 0.48 +
    (swirls - 0.5) * 0.24 - (split > 0.80 ? 0.17 : 0) + lip;
  return rampPick(RAMPS.madeira, score, x, y);
});
