import { weatheringDecal } from '../_dungeon_weathering';
import { PALETTES as p } from '../_theme';

const ash = [
  p.abismo0, p.abismo1, p.ferroSombra, p.pedraSombra,
  p.ferroEscuro, p.pedraEscuro, p.ferroBase, p.pedraBase,
];

export default weatheringDecal('cleaners-torch-soot', 96, 160, ash, (x, y, noise) => {
  const rise = (151 - y) / 144;
  const sway = 9 * rise + 6 * noise(y / 31, 2.6);
  const span = 14 + 23 * rise ** 0.63;
  const drift = (x - 46 - sway) / span;
  const turbulence = noise(x / 8, y / 21);
  const flecks = noise(x / 2.6, y / 3.1);
  const tail = Math.max(0, Math.min(1, rise * 11.5, (1 - rise) * 2.1));
  const density = Math.max(0, (1 - Math.abs(drift)) + turbulence * 0.32);
  const coverage = tail * density * 1.72 + Math.max(0, flecks - 0.52) * density * tail * 0.38;
  const tone = 4.8 - density * tail * 2.7 + 3.4 * flecks + 1.55 * turbulence;
  return { coverage, tone };
});
