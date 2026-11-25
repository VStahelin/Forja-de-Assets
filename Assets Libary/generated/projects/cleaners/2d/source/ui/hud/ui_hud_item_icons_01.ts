import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../../_theme';
import { hash } from '../_ui';
import { MASK, axis, capsule, cut, ellipse, etch, grain, iconStrip, solid, type Ramp } from './_hud';

/**
 * Ícones do item na mão (HUD da faxina v2), 32 × 32, contorno de abismo de 1 px.
 *
 * v2 (23/11/2026): o Vitor reprovou os de 16 × 16 por falta de densidade. Estes foram
 * redesenhados do zero em 32 × 32 para 1 px de arte = 1 px de tela na base de 720p (VX-11),
 * com o mesmo tamanho na tela que os de 16 a 2×. Cada peça é uma máscara com volume próprio
 * (`solid`): luz de cima à esquerda, realce de 1 px, sombra de 1 px embaixo à direita e miolo
 * em Bayer 4 × 4. Veios, fibras, rachaduras, rebites e amarras são gravados dentro da peça.
 * Cada quadro fica em até 16 cores da paleta mestre. Roxo só na chama do lampião.
 */
const size = 32;

const FERRO: Ramp = [p.ferroSombra, p.ferroEscuro, p.ferroBase, p.ferroLuz, p.ferroBrilho];
const MADEIRA: Ramp = [p.madeiraSombra, p.madeiraEscuro, p.madeiraBase, p.madeiraLuz, p.madeiraBrilho];
const OSSO: Ramp = [p.ossoSombra, p.ossoEscuro, p.ossoBase, p.ossoLuz, p.ossoBrilho];
const COURO: Ramp = [p.couroSombra, p.couroEscuro, p.couroBase, p.couroLuz, p.couroBrilho];
const AGUA: Ramp = [p.pedraVerdeEscuro, p.pedraVerdeBase, p.pedraVerdeLuz, p.pedraVerdeBrilho];
const MAGIA: Ramp = [p.magiaEscuro, p.magiaBase, p.magiaLuz, p.magiaBrilho];

type Draw = (c: PixelCanvas) => void;

/** Rebite: cabeça clara com sombra embaixo à direita. */
function rivet(c: PixelCanvas, x: number, y: number, head = p.ferroBrilho, shade = p.ferroSombra) {
  c.set(x, y, head).set(x + 1, y + 1, shade);
}

/** Cabo de madeira de (ax, ay) a (bx, by) com veio ao longo. */
function handle(c: PixelCanvas, ax: number, ay: number, bx: number, by: number, r = 1.3, seed = 1) {
  const m = solid(c, MADEIRA, (k) => capsule(k, ax, ay, bx, by, r), { lift: 0.05 });
  grain(c, m, bx - ax, by - ay, p.madeiraEscuro, seed, 0.35, 4);
  return m;
}

// ---------------------------------------------------------------------------
// Balde de aduelas, visto um pouco de cima
// ---------------------------------------------------------------------------

const BX = 15.5;
/** Curva de uma faixa do balde: desce no meio, como um aro visto de cima. */
const hoopY = (x: number, y0: number, rx: number) => y0 + 2.2 * (1 - ((x - BX) / rx) ** 2);

function bucket(c: PixelCanvas, inside: (c: PixelCanvas) => void) {
  // alça de ferro por trás, presa nas orelhas
  solid(c, FERRO, (k) => {
    for (let a = 0; a <= 180; a += 2) {
      const t = (a * Math.PI) / 180;
      const x = BX - Math.cos(t) * 10.5, y = 11 - Math.sin(t) * 6.5;
      k.set(Math.round(x), Math.round(y), MASK);
      k.set(Math.round(x), Math.round(y) + 1, MASK);
    }
  }, { lift: 0.1 });
  // corpo de aduelas: tronco de cone com fundo curvo
  const body = solid(c, MADEIRA, (k) => {
    k.fillPolygon([[4, 12], [27, 12], [24, 26], [7, 26]], MASK);
    ellipse(k, BX, 26, 8.6, 2.6);
  }, { slope: 0.7 });
  // aduelas: veio leve e juntas que acompanham a perspectiva
  grain(c, body, 0, 1, p.madeiraEscuro, 11, 0.14, 6);
  for (const f of [-0.62, -0.22, 0.2, 0.6]) {
    etch(c, body, (k) => k.line(Math.round(BX + f * 11.5), 13, Math.round(BX + f * 8.6), 28, MASK), p.madeiraSombra);
    etch(c, body, (k) => k.line(Math.round(BX + f * 11.5) + 1, 13, Math.round(BX + f * 8.6) + 1, 28, MASK), p.madeiraLuz);
  }
  // aros de ferro com rebites
  for (const [y0, rx] of [[14, 11.2], [22, 9.6]] as const) {
    const hoop = solid(c, FERRO, (k) => {
      for (let x = 0; x < size; x++) {
        const y = Math.round(hoopY(x, y0, rx));
        if (body.get(x, y) !== null) k.set(x, y, MASK).set(x, y + 1, MASK);
      }
    }, { lift: 0.05 });
    for (const x of [8, 15, 22]) if (hoop.get(x, Math.round(hoopY(x, y0, rx))) !== null) rivet(c, x, Math.round(hoopY(x, y0, rx)));
  }
  // boca: aro de cima e parede de dentro
  solid(c, FERRO, (k) => {
    ellipse(k, BX, 11.5, 11.6, 3.6);
    cut(k, (h) => ellipse(h, BX, 11.5, 9.6, 2.3));
  }, { lift: 0.2 });
  const mouth = new PixelCanvas(size, size);
  ellipse(mouth, BX, 11.5, 9.6, 2.3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (mouth.get(x, y) === null) continue;
    c.set(x, y, y <= 10 ? p.madeiraEscuro : p.abismo1);
  }
  // orelhas da alça
  for (const x of [4, 26]) c.set(x, 11, p.ferroBrilho).set(x, 12, p.ferroLuz);
  inside(c);
}

// ---------------------------------------------------------------------------
// Os 14 itens
// ---------------------------------------------------------------------------

const ICONS: [string, Draw][] = [
  ['hand', (c) => {
    // luva de osso aberta, palma de frente, punho de couro costurado
    solid(c, COURO, (k) => k.fillPolygon([[9, 24], [23, 24], [24, 29], [8, 29]], MASK));
    for (let x = 10; x <= 22; x += 2) c.set(x, 27, p.couroBrilho);
    c.hSpan(25, 9, 23, p.couroSombra);
    // polegar, depois a palma, depois os dedos
    solid(c, OSSO, (k) => capsule(k, 9, 19, 4, 12, 2.1), { lift: 0.05 });
    const palm = solid(c, OSSO, (k) => k.fillPolygon([[8, 14], [24, 14], [24, 19], [22, 24], [10, 24], [8, 20]], MASK), { slope: 0.6 });
    const fingers: [number, number][] = [[10, 6], [14, 3], [18, 4], [22, 8]];
    fingers.forEach(([x, top], i) => {
      const f = solid(c, OSSO, (k) => capsule(k, x, top + 1, x, 15, 1.6), { lift: 0.08 - i * 0.04 });
      etch(c, f, (k) => k.hSpan(top + 5, x - 1, x, MASK), p.ossoBase);
      etch(c, f, (k) => k.set(x, top + 1, MASK), p.ossoBrilho);
    });
    // linhas da palma e costura do dorso
    etch(c, palm, (k) => k.line(10, 18, 15, 20, MASK).line(16, 20, 21, 17, MASK), p.ossoEscuro);
    etch(c, palm, (k) => k.line(12, 22, 19, 22, MASK), p.ossoBase);
    for (const x of [10, 14, 18, 22]) c.set(x, 15, p.ossoBase);
  }],

  ['mop', (c) => {
    // fios do esfregão abertos em leque, um a um, saindo da braçadeira
    const ends: [number, number][] = [[3, 21], [3, 25], [5, 28], [9, 28], [13, 28], [17, 27], [19, 24]];
    ends.forEach(([x, y], i) => {
      const s = solid(c, OSSO, (k) => capsule(k, 13, 19, x, y, 1.2), { lift: i % 2 ? -0.12 : 0.04 });
      etch(c, s, (k) => k.set(x, y, MASK), p.ossoSombra);
    });
    // braçadeira de ferro com rebite
    const clamp = solid(c, FERRO, (k) => capsule(k, 16, 15, 11, 20, 2.4), { lift: 0.1 });
    etch(c, clamp, (k) => k.line(15, 14, 10, 19, MASK), p.ferroLuz);
    rivet(c, 13, 17);
    handle(c, 27, 4, 16, 15, 1.3, 3);
  }],

  ['bucket_empty', (c) => bucket(c, (k) => {
    // fundo seco à vista, com um anel de sujeira velha
    k.hSpan(12, 9, 21, p.madeiraSombra).hSpan(11, 12, 18, p.madeiraEscuro);
  })],

  ['bucket_water', (c) => bucket(c, (k) => {
    // água até a boca, com reflexo e respingo escorrendo
    const water = new PixelCanvas(size, size);
    ellipse(water, BX, 11.8, 9.4, 2.0);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (water.get(x, y) === null) continue;
      const v = 0.35 + (BX - x) * 0.02 + (11.8 - y) * 0.08;
      k.set(x, y, v + (hash(x, y, 5) - 0.5) * 0.2 > 0.42 ? AGUA[2] : AGUA[1]);
    }
    k.hSpan(11, 12, 15, AGUA[3]).hSpan(12, 18, 20, AGUA[2]).set(10, 12, AGUA[3]);
    k.set(26, 15, AGUA[2]).set(26, 16, AGUA[1]).set(25, 17, AGUA[0]);
  })],

  ['dart', (c) => {
    // dardo da armadilha: ponta farpada de ferro, haste com amarra de couro, penas de osso
    const at = axis(16, 16, -45);
    const vanes = [-1, 1].map((sg, i) => solid(c, OSSO, (k) => k.fillPolygon([at(-6, 0.6 * sg), at(-13.5, 0.6 * sg), at(-14, 4.6 * sg), at(-8.5, 3.6 * sg)], MASK), { lift: i ? -0.1 : 0.05 }));
    vanes.forEach((v, i) => etch(c, v, (k) => {
      for (const u of [-8, -10, -12]) { const a = at(u, 0.8 * (i ? 1 : -1)), b = at(u - 2, 3.8 * (i ? 1 : -1)); k.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), MASK); }
    }, p.ossoBase));
    const sh = at(-13, 0), st = at(5, 0);
    handle(c, sh[0], sh[1], st[0], st[1], 1.1, 7);
    const wrap = solid(c, OSSO, (k) => k.fillPolygon([at(2, -1.9), at(6, -1.9), at(6, 1.9), at(2, 1.9)], MASK), { lift: 0.05 });
    etch(c, wrap, (k) => { for (const u of [3, 5]) { const a = at(u, -2), b = at(u + 1, 2); k.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), MASK); } }, p.ossoSombra);
    const head = solid(c, FERRO, (k) => {
      k.fillPolygon([at(14.5, 0), at(9, -3.2), at(6, -1.4), at(6, 1.4), at(9, 3.2)], MASK);
      k.fillPolygon([at(9, -3.2), at(5, -4.6), at(7, -1.6)], MASK).fillPolygon([at(9, 3.2), at(5, 4.6), at(7, 1.6)], MASK);
    }, { lift: 0.1 });
    // fio da lâmina no meio da ponta
    etch(c, head, (k) => { const a = at(13, 0), b = at(7, 0); k.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), MASK); }, p.ferroLuz);
  }],

  ['skull', (c) => {
    const cranium = solid(c, OSSO, (k) => {
      ellipse(k, 15.5, 12.5, 11.2, 10.2);
      k.fillPolygon([[8, 18], [23, 18], [22, 24], [9, 24]], MASK);
    }, { slope: 0.7 });
    // dentes de cima, um a um
    for (let i = 0; i < 6; i++) {
      const x = 9 + i * 2.4;
      if (i === 4) continue; // um dente faltando
      solid(c, OSSO, (k) => k.rect(Math.round(x), 24, 2, 3 + (i % 2), MASK, true), { lift: 0.1 });
    }
    c.rect(19, 24, 2, 2, p.abismo1, true);
    // órbitas fundas: borda de cima em sombra, fundo em abismo
    for (const ex of [10.8, 20.2]) {
      const eye = new PixelCanvas(size, size);
      ellipse(eye, ex, 15, 3.3, 3.0);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (eye.get(x, y) === null) continue;
        c.set(x, y, y < 14 ? p.abismo0 : p.abismo1);
      }
      etch(c, cranium, (k) => k.hSpan(11, Math.round(ex - 2), Math.round(ex + 2), MASK), p.ossoBrilho);
      etch(c, cranium, (k) => k.hSpan(19, Math.round(ex - 1), Math.round(ex + 2), MASK), p.ossoEscuro);
    }
    // nariz e maçã do rosto
    c.fillPolygon([[15, 18], [13, 22], [15, 21], [16, 22], [18, 22], [16, 18]], p.abismo1);
    etch(c, cranium, (k) => k.line(7, 20, 9, 23, MASK).line(24, 20, 22, 23, MASK), p.ossoEscuro);
    // rachadura que desce do topo, com a beira de cima clara
    etch(c, cranium, (k) => k.line(19, 3, 21, 6, MASK).line(21, 6, 20, 8, MASK).line(20, 8, 22, 10, MASK).set(22, 5, MASK), p.ossoSombra);
    etch(c, cranium, (k) => k.line(18, 3, 20, 6, MASK).set(19, 8, MASK), p.ossoBrilho);
    // sutura no topo
    etch(c, cranium, (k) => k.line(9, 6, 11, 5, MASK).line(11, 5, 13, 6, MASK).line(13, 6, 15, 4, MASK), p.ossoBase);
  }],

  ['long_bone', (c) => {
    // fêmur na diagonal, com as duas cabeças de cada ponta
    const ends = (cx: number, cy: number, sg: number, lift: number) => solid(c, OSSO, (k) => {
      ellipse(k, cx - 2.2 * sg, cy, 2.9);
      ellipse(k, cx, cy + 2.2 * sg, 2.9);
    }, { lift });
    ends(7.5, 23.5, -1, -0.08);
    const shaft = solid(c, OSSO, (k) => capsule(k, 8, 23, 23, 8, 2.1));
    ends(24, 7.5, 1, 0.08);
    // realce ao longo do fuste, poros e uma lasca
    etch(c, shaft, (k) => k.line(10, 19, 19, 10, MASK), p.ossoLuz);
    etch(c, shaft, (k) => k.line(12, 22, 22, 12, MASK), p.ossoBase);
    c.set(14, 17, p.ossoEscuro).set(18, 14, p.ossoEscuro);
    etch(c, shaft, (k) => k.line(15, 19, 17, 17, MASK), p.ossoSombra);
  }],

  ['dented_helm', (c) => {
    // elmo fechado de frente, com crista, viseira, furos de respiro e um amassado
    const helm = solid(c, FERRO, (k) => {
      ellipse(k, 15.5, 13, 11, 10.5);
      k.fillPolygon([[5, 13], [26, 13], [25, 28], [6, 28]], MASK);
    }, { slope: 0.8 });
    grain(c, helm, 0, 1, p.ferroBase, 21, 0.16, 6);
    // faixa da testa com rebites
    const band = solid(c, FERRO, (k) => k.fillPolygon([[5, 11], [26, 11], [26, 13], [5, 13]], MASK), { lift: 0.1 });
    for (let x = 7; x <= 24; x += 4) if (band.get(x, 11) !== null) rivet(c, x, 11);
    // crista central
    solid(c, FERRO, (k) => capsule(k, 15.5, 3, 15.5, 27, 0.9), { lift: 0.2 });
    // viseira
    for (const [x0, x1] of [[7, 13], [18, 24]]) {
      c.hSpan(16, x0, x1, p.abismo0).hSpan(17, x0, x1, p.abismo1);
      c.hSpan(15, x0, x1, p.ferroSombra).hSpan(18, x0, x1, p.ferroLuz);
    }
    // furos de respiro
    for (let y = 21; y <= 25; y += 2) for (let x = 19; x <= 23; x += 2) c.set(x, y, p.abismo1).set(x + 1, y + 1, p.ferroLuz);
    // amassado: borda de cima à esquerda escura, de baixo à direita clara (a luz bate dentro)
    const dent = new PixelCanvas(size, size);
    ellipse(dent, 9.5, 6.8, 3.4, 2.4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (dent.get(x, y) === null || helm.get(x, y) === null) continue;
      const t = (x - 9.5) / 3.4 + (y - 6.8) / 2.4;
      c.set(x, y, t < -0.4 ? p.ferroSombra : t < 0.5 ? p.ferroEscuro : p.ferroLuz);
    }
    c.set(12, 8, p.ferroBrilho).set(11, 9, p.ferroBrilho);
    // riscos e ferrugem
    etch(c, helm, (k) => k.line(21, 5, 23, 8, MASK).line(8, 21, 10, 24, MASK), p.ferroLuz);
    c.set(7, 26, p.ferrugemBase).set(8, 27, p.ferrugemEscuro).set(24, 14, p.ferrugemBase);
  }],

  ['wrapped_body', (c) => {
    // corpo enrolado num lençol, cabeça à esquerda, botas para fora à direita, três amarras
    for (const y of [12, 18]) {
      const boot = solid(c, COURO, (k) => k.fillPolygon([[24, y], [28, y - 1], [29, y + 1], [29, y + 4], [24, y + 4]], MASK), { lift: 0.05 });
      etch(c, boot, (k) => k.vSpan(27, y, y + 4, MASK), p.couroSombra);
    }
    const shroud = solid(c, OSSO, (k) => {
      ellipse(k, 7, 16, 4.6, 5.4);
      k.fillPolygon([[9, 12], [16, 9], [24, 10], [26, 13], [26, 21], [24, 23], [16, 23], [9, 21]], MASK);
      // o pano aperta nas amarras
      cut(k, (h) => { for (const x of [11, 17, 22]) h.set(x, 9, MASK).set(x, 10, MASK).set(x, 23, MASK).set(x, 22, MASK); });
    }, { slope: 0.6, lift: -0.04 });
    // dobras do pano entre as amarras
    etch(c, shroud, (k) => k.line(13, 12, 15, 18, MASK).line(19, 13, 20, 20, MASK).line(24, 14, 24, 19, MASK).line(5, 13, 6, 19, MASK), p.ossoEscuro);
    etch(c, shroud, (k) => k.line(14, 11, 16, 17, MASK).line(20, 12, 21, 18, MASK).line(4, 12, 4, 15, MASK), p.ossoBrilho);
    // amarras de corda torcida
    for (const x of [11, 17, 22]) {
      const rope = solid(c, MADEIRA, (k) => k.rect(x - 1, 9, 3, 15, MASK, true).set(x - 1, 9, null).set(x + 1, 23, null), { lift: 0.1 });
      etch(c, rope, (k) => { for (let y = 10; y <= 22; y += 3) k.line(x - 1, y + 1, x + 1, y - 1, MASK); }, p.madeiraEscuro);
    }
    // nó solto na amarra do meio
    solid(c, MADEIRA, (k) => capsule(k, 18, 23, 20, 27, 0.8), { lift: 0.05 });
  }],

  ['chest_bait', (c) => {
    // baú de isca com a tampa entreaberta e um brilho de osso na fresta
    const body = solid(c, MADEIRA, (k) => k.rect(4, 16, 24, 13, MASK, true), { slope: 0.6 });
    etch(c, body, (k) => k.hSpan(20, 4, 27, MASK).hSpan(24, 4, 27, MASK), p.madeiraSombra);
    grain(c, body, 1, 0, p.madeiraEscuro, 31, 0.3, 5);
    const lid = solid(c, MADEIRA, (k) => k.fillPolygon([[4, 13], [5, 8], [8, 5], [23, 5], [26, 8], [27, 13]], MASK), { lift: 0.1 });
    etch(c, lid, (k) => k.line(5, 9, 26, 9, MASK), p.madeiraEscuro);
    grain(c, lid, 1, 0, p.madeiraEscuro, 32, 0.25, 5);
    // fresta: escuro com o brilho saindo
    c.hSpan(14, 5, 26, p.abismo0).hSpan(15, 5, 26, p.abismo1);
    for (let x = 9; x <= 22; x++) {
      const v = 1 - Math.abs(x - 15.5) / 7;
      c.set(x, 14, v > 0.55 ? p.ossoBrilho : v > 0.2 ? p.ossoLuz : p.ossoBase);
      if (v > 0.35) c.set(x, 15, hash(x, 15, 4) < v ? p.ossoLuz : p.ossoEscuro);
    }
    // cintas de ferro, cantoneiras e fechadura
    for (const x of [7, 24]) {
      solid(c, FERRO, (k) => k.rect(x - 1, 5, 2, 9, MASK, true), { lift: 0.1 });
      solid(c, FERRO, (k) => k.rect(x - 1, 16, 2, 13, MASK, true));
      rivet(c, x - 1, 7); rivet(c, x - 1, 18); rivet(c, x - 1, 25);
    }
    const lock = solid(c, FERRO, (k) => k.rect(13, 16, 6, 7, MASK, true), { lift: 0.15 });
    etch(c, lock, (k) => k.set(15, 18, MASK).set(16, 18, MASK).set(15, 19, MASK).set(16, 19, MASK).set(15, 20, MASK), p.abismo0);
    for (const [x, y] of [[4, 28], [27, 28]]) c.set(x, y, p.ferroLuz);
  }],

  ['shovel', (c) => {
    // pá: punho em T, cabo de madeira, alvado de ferro e lâmina com nervura
    const at = axis(12, 20, -45);
    const blade = solid(c, FERRO, (k) => k.fillPolygon([at(0, -4.8), at(0, 4.8), at(-8, 4.8), at(-12, 2.4), at(-13.5, 0), at(-12, -2.4), at(-8, -4.8)], MASK), { slope: 0.7 });
    etch(c, blade, (k) => { const a = at(-1, 0), b = at(-10, 0); k.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), MASK); }, p.ferroLuz);
    etch(c, blade, (k) => { const a = at(-1, 1), b = at(-10, 1); k.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), MASK); }, p.ferroEscuro);
    // fio gasto da lâmina
    etch(c, blade, (k) => { const a = at(-12, -2.4), b = at(-13.5, 0), d = at(-12, 2.4); k.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), MASK).line(Math.round(b[0]), Math.round(b[1]), Math.round(d[0]), Math.round(d[1]), MASK); }, p.ferroBrilho);
    const s0 = at(-0.5, 0), s1 = at(4.5, 0);
    const socket = solid(c, FERRO, (k) => capsule(k, s0[0], s0[1], s1[0], s1[1], 1.9), { lift: 0.1 });
    etch(c, socket, (k) => k.set(Math.round(s1[0]) - 1, Math.round(s1[1]) + 1, MASK), p.ferroSombra);
    rivet(c, Math.round((s0[0] + s1[0]) / 2), Math.round((s0[1] + s1[1]) / 2) - 1);
    handle(c, 25, 6, s1[0], s1[1], 1.2, 9);
    solid(c, MADEIRA, (k) => capsule(k, 23, 5, 28, 5, 1.2), { lift: 0.1 });
  }],

  ['inspection_lantern', (c) => {
    // lampião de inspeção: armação de ferro, vidro escuro e chama roxa (magia)
    solid(c, FERRO, (k) => { ellipse(k, 15.5, 4.4, 3.4, 2.4); cut(k, (h) => ellipse(h, 15.5, 4.4, 1.6, 0.9)); }, { lift: 0.1 });
    const cap = solid(c, FERRO, (k) => k.fillPolygon([[8, 10], [12, 6], [19, 6], [23, 10]], MASK), { lift: 0.1 });
    etch(c, cap, (k) => k.hSpan(9, 9, 22, MASK), p.ferroEscuro);
    // vidro: escuro nas bordas, aceso de roxo perto da chama
    for (let y = 10; y <= 23; y++) for (let x = 9; x <= 22; x++) {
      const d = Math.hypot((x - 15.5) / 6.5, (y - 17.5) / 7.5);
      c.set(x, y, d < 0.55 ? (hash(x, y, 2) < 0.6 - d ? p.magiaLuz : p.magiaBase) : d < 0.85 ? p.magiaBase : d < 1.05 ? p.magiaEscuro : p.abismo1);
    }
    // chama
    const flame = solid(c, MAGIA, (k) => k.fillPolygon([[16, 11], [19, 16], [19, 19], [17, 21], [14, 21], [12, 19], [12, 16], [14, 14]], MASK), { lift: 0.25, hi: p.magiaBrilho, lo: p.magiaBase });
    etch(c, flame, (k) => k.rect(14, 17, 3, 3, MASK, true).set(15, 16, MASK), p.magiaBrilho);
    etch(c, flame, (k) => k.set(15, 18, MASK).set(15, 19, MASK), p.ossoBrilho);
    // pavio e reflexo no vidro
    c.rect(14, 21, 3, 2, p.ferroEscuro, true).set(14, 21, p.ferroLuz);
    c.line(10, 13, 10, 17, p.ossoLuz).set(11, 12, p.ossoLuz).line(21, 12, 21, 13, p.magiaLuz);
    // montantes de ferro e base
    for (const x of [8, 22]) solid(c, FERRO, (k) => k.rect(x, 9, 2, 16, MASK, true));
    solid(c, FERRO, (k) => k.rect(15, 9, 1, 2, MASK, true));
    const base = solid(c, FERRO, (k) => k.fillPolygon([[6, 24], [25, 24], [24, 28], [7, 28]], MASK), { lift: 0.05 });
    etch(c, base, (k) => k.hSpan(26, 7, 24, MASK), p.ferroEscuro);
    rivet(c, 9, 25); rivet(c, 21, 25);
  }],

  ['wide_mop', (c) => {
    // rodo de franja larga: travessa de ferro e franja comprida
    for (let i = 0; i < 13; i++) {
      const x = 4 + i * 2;
      const len = 24 + Math.round(hash(i, 3, 7) * 4);
      const sway = Math.round((hash(i, 4, 7) - 0.5) * 2);
      const s = solid(c, OSSO, (k) => capsule(k, x, 17, x + sway, len, 0.9), { lift: i % 2 ? -0.15 : 0.05, hi: i % 2 ? p.ossoBase : p.ossoBrilho });
      etch(c, s, (k) => k.set(x + sway, len, MASK), p.ossoSombra);
    }
    const bar = solid(c, FERRO, (k) => k.rect(3, 14, 26, 4, MASK, true), { lift: 0.05 });
    etch(c, bar, (k) => k.hSpan(16, 4, 27, MASK), p.ferroEscuro);
    for (const x of [5, 25]) rivet(c, x, 15);
    solid(c, FERRO, (k) => k.fillPolygon([[16, 13], [19, 10], [21, 11], [19, 14]], MASK), { lift: 0.15 });
    handle(c, 27, 4, 19, 11, 1.3, 13);
  }],

  ['stiff_brush', (c) => {
    // escova dura: bloco de madeira, cabo com ponteira de ferro e cerdas em tufos
    for (let i = 0; i < 8; i++) {
      const x = 4 + i * 3;
      const t = solid(c, OSSO, (k) => k.rect(x, 19, 2, 9 - (i % 2), MASK, true), { lift: i % 2 ? -0.1 : 0.05 });
      etch(c, t, (k) => k.hSpan(27 - (i % 2), x, x + 1, MASK), p.ossoSombra);
    }
    const block = solid(c, MADEIRA, (k) => k.fillPolygon([[3, 15], [5, 12], [26, 12], [28, 15], [28, 19], [3, 19]], MASK), { slope: 0.6 });
    etch(c, block, (k) => k.hSpan(15, 4, 27, MASK), p.madeiraEscuro);
    grain(c, block, 1, 0, p.madeiraEscuro, 41, 0.3, 5);
    for (let x = 6; x <= 26; x += 5) c.set(x, 17, p.ferroLuz).set(x, 18, p.madeiraSombra);
    const fer = solid(c, FERRO, (k) => capsule(k, 21, 11, 19, 13, 1.8), { lift: 0.1 });
    etch(c, fer, (k) => k.set(20, 11, MASK), p.ferroBrilho);
    handle(c, 27, 4, 21, 10, 1.3, 17);
  }],
];

export default iconStrip(
  size,
  ICONS.map(([, draw]) => draw),
  Object.fromEntries(ICONS.map(([name], index) => [name, [index]])),
);
