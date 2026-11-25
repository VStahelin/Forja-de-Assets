import { weatheringDecal } from '../_dungeon_weathering';
import { PALETTES as p } from '../_theme';

const damp = [
  p.abismo1, p.pedraVerdeSombra, p.pedraSombra, p.pedraVerdeEscuro,
  p.pedraEscuro, p.pedraVerdeBase, p.pedraBase, p.pedraVerdeLuz,
];

export default weatheringDecal('cleaners-damp-streaks', 144, 176, damp, (x, y, noise) => {
  const head = 19 + 10 * noise(x / 32, 0.8);
  const length = 99 + 27 * noise(x / 8, 3.2) + 18 * noise(x / 20, 5.1);
  const flow = (y - head) / length;
  const drift = 3.5 * noise(y / 32, 9.1);
  const shoulder = 1 - Math.abs(x - 68 - drift) / (54 - 16 * Math.max(0, flow));
  const columns = 0.54 * noise((x + drift) / 6, y / 54) + 0.46 * noise(x / 17, y / 63);
  const crust = noise(x / 3, y / 5);
  const edge = Math.min(flow * 7.5, Math.max(0, 1 - flow) * 2.3, shoulder * 1.45);
  const body = edge + 0.44 * columns + 0.1 * crust;
  const coverage = flow > 0 && flow < 1.16 && shoulder > -0.1 ? Math.max(0, body) * 0.94 : 0;
  const tone = 3.7 + 3.25 * crust + 2.65 * columns - 1.2 * Math.max(0, body);
  return { coverage, tone };
});
