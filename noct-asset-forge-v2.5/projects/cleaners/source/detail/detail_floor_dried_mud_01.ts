import { weatheringDecal } from '../_dungeon_weathering';
import { PALETTES as p } from '../_theme';

const sediment = [
  p.abismo1, p.madeiraSombra, p.ferroEscuro, p.madeiraEscuro,
  p.ossoSombra, p.madeiraBase, p.ossoEscuro, p.ossoBase,
];

export default weatheringDecal('cleaners-dried-mud-at-base', 176, 72, sediment, (x, y, noise) => {
  const u = (x - 4) / 168;
  if (u <= 0 || u >= 1) return { coverage: 0, tone: 0 };
  const taper = Math.sin(Math.PI * u) ** 0.46;
  const ribbon = 40 + 8 * Math.sin(8 * u) + 4 * noise(u * 9, 1.3);
  const depth = taper * (15 + 7 * noise(u * 7, 2.1));
  const edge = 1 - Math.abs(y - ribbon) / depth;
  const clay = noise(x / 12.3, y / 7.1);
  const grit = noise(x / 3.8, y / 2.4);
  const bed = edge + 0.24 * clay + 0.19 * grit;
  const crack = Math.abs(noise((x + 13) / 8.7, y / 14.2)) < 0.045;
  const coverage = Math.max(0, bed * 1.18) * (crack ? 0.33 : 1.0);
  const tone = 3.8 + 3.6 * grit + 1.8 * clay + Math.max(0, 0.5 - edge);
  return { coverage, tone };
});
