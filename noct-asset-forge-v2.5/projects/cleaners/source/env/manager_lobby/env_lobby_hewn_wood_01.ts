import { rampPick } from '../../_masonry';
import { PALETTES as p, RAMPS, RULES } from '../../_theme';
import { lobbyTexture, noise } from './_surface';

const period = RULES.pxPerMeter * 4;
const knots = [[69, 134], [188, 414], [345, 65], [443, 324]] as const;

function wrapDistance(value: number, center: number): number {
  const displacement = Math.abs(value - center);
  return Math.min(displacement, period - displacement);
}

export default lobbyTexture((x, y) => {
  const fibers = noise(x, y, 160, 13, 928);
  const weather = noise(x, y, 19, 38, 481);
  const sway = noise(x, y, 20, 7, 376);
  let distance = Number.POSITIVE_INFINITY;
  for (const [cx, cy] of knots) {
    distance = Math.min(distance, Math.hypot(wrapDistance(x, cx), wrapDistance(y, cy) * 0.39));
  }

  const knot = Math.exp(-distance / 18);
  const rings = Math.sin(distance * 0.76 + sway * 2);
  const split = weather > 0.72 && fibers < 0.32;
  if (distance < 3.1 || (split && fibers < 0.21)) return p.abismo1;
  if (split) return p.couroSombra;
  if (weather < 0.27 && fibers < 0.49) return p.couroEscuro;

  const wave = Math.sin((x / period * 107 + sway * 0.54 + knot * rings * 0.46) * Math.PI * 2);
  const grade = 0.45 + (fibers - 0.5) * 0.47 + (weather - 0.5) * 0.35 +
    wave * 0.115 - knot * 0.12;
  return rampPick(RAMPS.madeira, grade, x, y);
});
