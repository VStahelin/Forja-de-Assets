import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../../_theme';
import { rampPick } from '../_ui';
import { MASK, capsule, cut, ellipse, etch, grain, iconStrip, solid, type Ramp } from './_hud';

/**
 * Ícones de estado do HUD da faxina v2, 24 × 24, contorno de abismo de 1 px.
 * Estrelas da nota, área atual, pontos, bilhete do gerente e os estados da equipe no co-op.
 *
 * v2 (23/11/2026): redesenhados do zero em 24 × 24 (eram 12 × 12) para 1 px de arte = 1 px de
 * tela na base de 720p (VX-11). Mesmo cuidado dos ícones de item: luz de cima à esquerda,
 * realce e sombra de 1 px, Bayer 4 × 4 no miolo e até 16 cores por quadro.
 */
const size = 24;

const FERRO: Ramp = [p.ferroSombra, p.ferroEscuro, p.ferroBase, p.ferroLuz, p.ferroBrilho];
const MADEIRA: Ramp = [p.madeiraSombra, p.madeiraEscuro, p.madeiraBase, p.madeiraLuz, p.madeiraBrilho];
const OSSO: Ramp = [p.ossoSombra, p.ossoEscuro, p.ossoBase, p.ossoLuz, p.ossoBrilho];
const PEDRA: Ramp = [p.pedraSombra, p.pedraEscuro, p.pedraBase, p.pedraLuz, p.pedraBrilho];
const COURO: Ramp = [p.couroSombra, p.couroEscuro, p.couroBase, p.couroLuz, p.couroBrilho];
const AGUA: Ramp = [p.pedraVerdeEscuro, p.pedraVerdeBase, p.pedraVerdeLuz, p.pedraVerdeBrilho];

type Draw = (c: PixelCanvas) => void;

function rivet(c: PixelCanvas, x: number, y: number) {
  c.set(x, y, p.ferroBrilho).set(x + 1, y + 1, p.ferroSombra);
}

// ---------------------------------------------------------------------------
// Estrela facetada: cada braço tem uma face clara e uma escura, conforme a luz
// ---------------------------------------------------------------------------

const SX = 11.5, SY = 12.4;
const starPts = (R: number, r: number): [number, number][] => Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const rad = i % 2 ? r : R;
  return [SX + Math.cos(a) * rad, SY + Math.sin(a) * rad] as [number, number];
});

function facetStar(c: PixelCanvas, ramp: Ramp, R: number, r: number, lift = 0) {
  const m = new PixelCanvas(size, size).fillPolygon(starPts(R, r), MASK);
  const L = [-0.7, -0.72];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m.get(x, y) === null) continue;
    // face: o lado do braço em que o pixel está, com normal entre a ponta e o vale
    const a = Math.atan2(y - SY, x - SX) + Math.PI / 2;
    const k = (((a / (Math.PI / 5)) % 10) + 10) % 10;
    const arm = Math.round(k / 2) * 2;
    const side = k < arm ? -1 : 1;
    const na = -Math.PI / 2 + ((arm + side * 0.5) * Math.PI) / 5;
    const d = Math.cos(na) * L[0] + Math.sin(na) * L[1];
    c.set(x, y, rampPick(ramp, 0.5 + d * 0.42 + lift, x, y));
  }
  return m;
}

const ICONS: [string, Draw][] = [
  ['star_full', (c) => {
    facetStar(c, OSSO, 10.4, 4.6, 0.04);
    c.set(11, 11, p.ossoBrilho).set(11, 12, p.ossoBrilho).set(12, 12, p.ossoLuz);
  }],

  ['star_empty', (c) => {
    // contorno de ferro facetado com o miolo vazado em abismo
    facetStar(c, FERRO, 10.4, 4.6, 0.02);
    const hole = new PixelCanvas(size, size).fillPolygon(starPts(6.4, 2.9), MASK);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (hole.get(x, y) === null) continue;
      const lipTop = hole.get(x, y - 1) === null || hole.get(x - 1, y) === null;
      c.set(x, y, lipTop ? p.abismo0 : p.abismo1);
    }
  }],

  ['area', (c) => {
    // arco ogival de pedra com aduelas e porta de tábuas
    const arch = solid(c, PEDRA, (k) => {
      k.fillPolygon([[3, 21], [3, 10], [5, 5], [8, 2.5], [11.5, 1.5], [15, 2.5], [18, 5], [20, 10], [20, 21]], MASK);
    }, { slope: 0.6 });
    // juntas das pedras (aduelas no arco, fiadas nos pés)
    etch(c, arch, (k) => {
      k.line(3, 10, 6, 10, MASK).line(5, 5, 7, 7, MASK).line(11, 1, 11, 4, MASK).line(18, 5, 16, 7, MASK).line(20, 10, 17, 10, MASK);
      k.hSpan(15, 3, 5, MASK).hSpan(15, 18, 20, MASK).hSpan(19, 3, 5, MASK).hSpan(19, 18, 20, MASK);
    }, p.pedraSombra);
    grain(c, arch, 1, 1, p.pedraEscuro, 5, 0.12, 3);
    const door = solid(c, MADEIRA, (k) => k.fillPolygon([[6, 21], [6, 10], [8, 6.5], [11.5, 4.5], [15, 6.5], [17, 10], [17, 21]], MASK), { lift: -0.08 });
    etch(c, door, (k) => k.vSpan(9, 5, 21, MASK).vSpan(12, 4, 21, MASK).vSpan(15, 5, 21, MASK), p.madeiraSombra);
    grain(c, door, 0, 1, p.madeiraEscuro, 6, 0.2, 4);
    // dobradiças e argola
    for (const y of [10, 17]) solid(c, FERRO, (k) => k.rect(6, y, 6, 2, MASK, true), { lift: 0.1 });
    c.set(14, 14, p.ferroLuz).set(15, 14, p.ferroBrilho).set(14, 15, p.ferroEscuro).set(15, 16, p.ferroLuz).set(16, 15, p.ferroEscuro);
    c.hSpan(21, 6, 17, p.abismo1);
  }],

  ['points', (c) => {
    // caixa de descarte de tábuas e cantoneiras, com um rolo de pano em cima
    const box = solid(c, MADEIRA, (k) => k.rect(3, 11, 18, 10, MASK, true), { slope: 0.6 });
    etch(c, box, (k) => k.hSpan(14, 3, 20, MASK).hSpan(17, 3, 20, MASK), p.madeiraSombra);
    grain(c, box, 1, 0, p.madeiraEscuro, 8, 0.22, 4);
    for (const [x, y] of [[3, 11], [19, 11], [3, 19], [19, 19]]) solid(c, FERRO, (k) => k.rect(x, y, 2, 2, MASK, true), { lift: 0.15 });
    c.hSpan(11, 5, 18, p.abismo1);
    // rolo: cilindro deitado com a ponta em espiral
    const roll = solid(c, OSSO, (k) => k.rect(4, 5, 14, 6, MASK, true).set(4, 5, null).set(4, 10, null), { slope: 0.7 });
    etch(c, roll, (k) => k.line(7, 6, 6, 9, MASK).line(11, 6, 10, 9, MASK).line(15, 6, 14, 9, MASK), p.ossoBase);
    const tip = solid(c, OSSO, (k) => ellipse(k, 18.5, 8, 2.4, 3.1), { lift: -0.12 });
    etch(c, tip, (k) => k.set(18, 7, MASK).set(19, 8, MASK).set(18, 9, MASK).set(17, 8, MASK), p.ossoEscuro);
    c.set(18, 8, p.ossoLuz);
    // fita de couro amarrando o rolo
    solid(c, FERRO, (k) => k.rect(9, 4, 2, 8, MASK, true), { lift: 0.05 });
  }],

  ['manager_note', (c) => {
    // folha de osso dobrada, canto virado, rabiscos e clipe de ferro
    const sheet = solid(c, OSSO, (k) => k.fillPolygon([[3, 5], [20, 5], [20, 16], [15, 21], [3, 21]], MASK), { slope: 0.06, lift: 0.24 });
    for (const [y, x1] of [[9, 17], [12, 16], [15, 12], [18, 9]]) {
      etch(c, sheet, (k) => { for (let x = 6; x <= x1; x++) if ((x * 7 + y) % 5 !== 0) k.set(x, y + ((x % 3) === 0 ? 1 : 0), MASK); }, p.ossoSombra);
    }
    etch(c, sheet, (k) => k.hSpan(7, 3, 20, MASK), p.ossoBase);
    solid(c, OSSO, (k) => k.fillPolygon([[15, 21], [15, 16], [20, 16]], MASK), { lift: -0.35 });
    // clipe de dobra
    const clip = solid(c, FERRO, (k) => { k.rect(6, 2, 5, 6, MASK, true); cut(k, (h) => h.rect(7, 3, 3, 3, MASK, true)); }, { lift: 0.1 });
    etch(c, clip, (k) => k.hSpan(7, 6, 10, MASK), p.ferroEscuro);
  }],

  ['carrying', (c) => {
    // luva de osso que agarra um osso longo atravessado
    const ends = [[4, 9.5], [4, 13.5], [19.5, 9.5], [19.5, 13.5]] as const;
    solid(c, OSSO, (k) => capsule(k, 4, 11.5, 19.5, 11.5, 1.8), { lift: -0.2 });
    for (const [x, y] of ends) solid(c, OSSO, (k) => ellipse(k, x, y, 2.2), { lift: -0.15 });
    // dedos por cima do osso, nós em fila
    for (const x of [7, 10, 13]) {
      const f = solid(c, OSSO, (k) => capsule(k, x + 0.5, 8, x + 0.5, 13, 1.4), { lift: 0.15 });
      etch(c, f, (k) => k.hSpan(10, x, x + 1, MASK), p.ossoBase);
    }
    solid(c, OSSO, (k) => capsule(k, 16, 10, 15, 14, 1.5), { lift: 0.05 });
    const back = solid(c, OSSO, (k) => k.fillPolygon([[6, 14], [17, 14], [16, 18], [7, 18]], MASK));
    etch(c, back, (k) => k.line(8, 16, 14, 16, MASK), p.ossoBase);
    const cuff = solid(c, COURO, (k) => k.rect(7, 18, 9, 4, MASK, true));
    etch(c, cuff, (k) => { for (let x = 8; x <= 14; x += 2) k.set(x, 20, MASK); }, p.couroBrilho);
  }],

  ['scrubbing', (c) => {
    // esfregão no chão, com fios abertos e gotas que respingam
    handle(c);
    const strands: [number, number][] = [[3, 16], [5, 18], [8, 18], [11, 18], [14, 17], [16, 15]];
    strands.forEach(([x, y], i) => solid(c, OSSO, (k) => capsule(k, 10, 12, x, y, 1.1), { lift: i % 2 ? -0.12 : 0.05 }));
    const clamp = solid(c, FERRO.slice(1), (k) => capsule(k, 12, 10, 9, 13, 1.9), { lift: 0.1 });
    etch(c, clamp, (k) => k.set(10, 10, MASK), p.ferroBrilho);
    // gotas
    for (const [x, y] of [[3, 19], [8, 20], [14, 19], [18, 17]] as const) {
      solid(c, AGUA.slice(1), (k) => k.rect(x, y, 2, 2, MASK, true).set(x, y - 1, MASK), { lift: 0.1 });
    }
  }],

  ['down', (c) => {
    // o elmo de balde do zelador, tombado de lado: fundo à esquerda, boca escura à direita
    const body = solid(c, MADEIRA, (k) => k.fillPolygon([[4, 8], [17, 5], [17, 19], [4, 16]], MASK), { slope: 0.6 });
    etch(c, body, (k) => k.line(5, 10, 16, 8, MASK).line(5, 14, 16, 16, MASK), p.madeiraSombra);
    grain(c, body, 1, 0, p.madeiraEscuro, 9, 0.18, 4);
    solid(c, MADEIRA, (k) => ellipse(k, 4.5, 12, 1.6, 4.2), { lift: -0.2 });
    // aros de ferro com rebite
    for (const x of [8, 14]) {
      solid(c, FERRO, (k) => k.rect(x, x === 8 ? 7 : 6, 2, x === 8 ? 11 : 13, MASK, true), { lift: 0.08 });
      c.set(x, 12, p.ferroBrilho);
    }
    // fenda dos olhos, entre os aros
    c.hSpan(11, 10, 13, p.abismo0).hSpan(12, 10, 13, p.abismo1);
    // boca do balde
    solid(c, FERRO, (k) => { ellipse(k, 18, 12, 2.8, 7.4); cut(k, (h) => ellipse(h, 18.6, 12, 1.5, 5.8)); }, { lift: 0.15 });
    const mouth = new PixelCanvas(size, size);
    ellipse(mouth, 18.6, 12, 1.5, 5.8);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mouth.get(x, y) !== null) c.set(x, y, x < 19 ? p.abismo0 : p.abismo1);
    // poeira no chão
    c.hSpan(21, 4, 8, p.pedraBase).hSpan(21, 13, 16, p.pedraEscuro);
  }],

  ['disconnected', (c) => {
    // corrente partida: dois elos de ferro abertos frente a frente, com lascas voando
    const link = (cx: number, cy: number, lift: number, gapRight: boolean) => solid(c, FERRO, (k) => {
      ellipse(k, cx, cy, 5.6, 4.2);
      cut(k, (h) => ellipse(h, cx, cy, 3.0, 1.5));
      cut(k, (h) => h.rect(gapRight ? Math.round(cx) + 3 : Math.round(cx) - 5, Math.round(cy) - 1, 3, 2, MASK, true));
    }, { lift });
    link(7.5, 8, 0.1, true);
    link(16, 16, -0.02, false);
    c.set(12, 11, p.ossoBrilho).set(13, 12, p.ossoLuz).set(11, 13, p.ossoLuz).set(14, 10, p.ferroLuz).set(10, 12, p.ossoBase);
  }],
];

/** Cabo do esfregão (usado no ícone de esfregar). */
function handle(c: PixelCanvas) {
  const m = solid(c, [p.madeiraEscuro, p.madeiraBase, p.madeiraLuz], (k) => capsule(k, 19, 3, 12, 10, 1.1), { lift: 0.05 });
  grain(c, m, -1, 1, p.madeiraEscuro, 3, 0.35, 3);
}

export default iconStrip(
  size,
  ICONS.map(([, draw]) => draw),
  Object.fromEntries(ICONS.map(([name], index) => [name, [index]])),
);
