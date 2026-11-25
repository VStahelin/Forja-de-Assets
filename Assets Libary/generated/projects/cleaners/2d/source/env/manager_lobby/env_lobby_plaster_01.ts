import { rampPick } from '../../_masonry';
import { PALETTES as p, RAMPS } from '../../_theme';
import { lobbyTexture, noise } from './_surface';

const plaster = [p.pedraBase, p.ferroLuz, p.pedraLuz, p.pedraBrilho, p.ferroBrilho];

export default lobbyTexture((x, y) => {
  const mottling = noise(x, y, 10, 12, 309);
  const trowel = noise(x, y, 24, 57, 282);
  const sand = noise(x, y, 119, 138, 606);
  const fissure = noise(x, y, 39, 31, 34);
  const chip = mottling * 0.71 + fissure * 0.22 + sand * 0.07;

  // Narrow ragged edges show where the lime coat has flaked away from its base.
  if (chip > 0.775) {
    return rampPick(RAMPS.osso, 0.26 + 0.24 * trowel + 0.10 * sand, x, y);
  }
  if (chip > 0.752) {
    if (sand < 0.36 && trowel < 0.47) return p.pedraEscuro;
    return sand > 0.45 ? p.ossoLuz : p.ferroBrilho;
  }

  const tone = 0.57 + (mottling - 0.5) * 0.23 + (trowel - 0.5) * 0.24 +
    (sand - 0.5) * 0.31;
  return rampPick(plaster, tone, x, y);
});
