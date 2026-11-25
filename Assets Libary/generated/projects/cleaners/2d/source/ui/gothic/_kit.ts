import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../../_theme';
import { bayer, hash, rampPick } from '../_ui';

export function piece(width: number, height: number, paint: (c: PixelCanvas) => void) {
  return defineAsset({
    width, height, scale: 1, antialiasing: 'none',
    render({ ctx }) {
      const canvas = new PixelCanvas(width, height);
      paint(canvas);
      canvas.render(ctx);
    },
  });
}

export function strip(width: number, height: number, count: number, paint: (c: PixelCanvas, index: number) => void) {
  return defineAsset({
    width: width * count, height, scale: 1, antialiasing: 'none',
    render({ ctx }) {
      for (let index = 0; index < count; index++) {
        const canvas = new PixelCanvas(width, height);
        paint(canvas, index);
        canvas.render(ctx, index * width);
      }
    },
  });
}

type Palette = {
  top: string; side: string; edge: string; shadow: string; face: string; shine: string; recess: string;
};

const steel: Palette = {
  top: p.pedraBrilho, side: p.pedraLuz, edge: p.pedraBase, shadow: p.pedraEscuro,
  face: p.ferroEscuro, shine: p.ferroBase, recess: p.abismo1,
};

const bronze: Palette = {
  top: p.ossoLuz, side: p.ossoBase, edge: p.ossoEscuro, shadow: p.couroBase,
  face: p.ferroEscuro, shine: p.ferroBase, recess: p.abismo1,
};

const pressed: Palette = {
  ...bronze, top: p.ossoBase, side: p.ossoEscuro, edge: p.couroBase,
  shadow: p.couroEscuro, face: p.abismo1, shine: p.ferroSombra, recess: p.abismo0,
};

const inactive: Palette = {
  ...steel, top: p.pedraLuz, side: p.pedraBase, edge: p.pedraEscuro,
  shadow: p.ferroSombra, face: p.abismo1, shine: p.ferroEscuro, recess: p.abismo0,
};

export const finishes = [steel, bronze, pressed, inactive] as const;

function cornerCut(x: number, y: number, w: number, h: number, radius: number) {
  const dx = Math.min(x, w - 1 - x);
  const dy = Math.min(y, h - 1 - y);
  return dx + dy < radius;
}

export function rivet(c: PixelCanvas, x: number, y: number, warm = false) {
  c.circle(x, y, 2, p.abismo0, true);
  c.hSpan(y - 1, x - 1, x + 1, warm ? p.ossoBase : p.pedraLuz);
  c.hSpan(y, x - 1, x + 1, warm ? p.ossoEscuro : p.ferroBase);
  c.set(x - 1, y - 1, warm ? p.ossoBrilho : p.pedraBrilho);
  c.set(x, y + 1, p.pedraEscuro);
}

/** Ferro chanfrado com luz no alto, friso escuro e face rebaixada. */
export function iron(c: PixelCanvas, q = steel, rim = 5, clip = 4) {
  const { width: w, height: h } = c;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      const depth = Math.min(dx, dy, dx + dy - clip);
      if (depth < 0) continue;
      const upper = y === dy;
      const left = x === dx;
      const lit = dx < dy ? left : upper;
      const wear = hash(x, y, 1206);
      let color = q.face;
      if (depth === 0) color = p.abismo0;
      else if (depth === 1) color = lit ? q.side : q.shadow;
      else if (depth < rim - 1) color = lit ? q.edge : q.shadow;
      else if (depth === rim - 1) color = q.recess;
      else if (depth === rim) color = lit ? q.shadow : q.edge;
      else if (depth === rim + 1 && lit) color = q.shadow;
      else if (wear > 0.97 && (x + 2 * y) % 4 < 2) color = q.shine;
      if (depth === 2 && upper && wear < 0.84) color = q.top;
      if (depth === 2 && left && wear < 0.34) color = q.side;
      c.set(x, y, color);
    }
  }
  // Riscos curtos nas faces, distantes da borda externa e dos cortes do 9-slice.
  for (let index = 0; index < Math.floor(w * h / 470); index++) {
    const x = rim + 5 + Math.floor(hash(index, 7, 391) * (w - 2 * rim - 15));
    const y = rim + 3 + Math.floor(hash(index, 8, 391) * (h - 2 * rim - 6));
    c.hSpan(y, x, x + 1 + index % 4, q.shine);
    if (index % 2 === 0) c.hSpan(y + 1, x + 1, x + 2, q.shadow);
  }
}

export function button(c: PixelCanvas, index: number) {
  const q = finishes[index];
  const w = c.width, h = c.height;
  const inset = 11;
  const warm = index === 1 || index === 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      const depth = Math.min(dx, dy, dx + dy - 10);
      if (depth < 0) continue;
      const grain = bayer(x, y);
      const lit = dy <= dx ? y < h / 2 : x < w / 2;
      let color = q.recess;
      if (depth === 0) color = p.abismo0;
      else if (depth < 3) color = lit ? (grain < 0.40 ? q.top : q.side) : q.shadow;
      else if (depth === 3 || depth === inset - 1) color = p.abismo0;
      else if (depth < inset - 1) {
        const bevel = lit ? (inset - depth) / 9 : 0.19;
        color = rampPick([q.shadow, q.edge, q.side, q.top], bevel, x, y);
      } else if (depth === inset) {
        color = lit ? q.shadow : q.side;
      } else {
        const topFace = Math.max(0, 1 - (y - inset) / (h - 2 * inset));
        const reflected = x > 17 && x < w - 18 ? 0.16 : 0;
        color = rampPick([q.recess, q.face, q.shine], 0.22 + topFace * 0.43 + reflected, x, y);
      }

      // Quatro chapas de canto em bico, com o volume na diagonal e borda rebaixada.
      if (depth >= 2 && dx < 22 && dy < 18 && dx + dy < 31) {
        if (dx + dy >= 29 || dx === 21 || dy === 17) color = q.recess;
        else if (depth === 2 || dx + dy === 28) color = lit ? q.side : q.edge;
        else color = rampPick([q.shadow, q.edge, q.side], 0.45 + (lit ? 0.19 : 0), x, y);
      }
      c.set(x, y, color);
    }
  }
  for (const x of [11, w - 12]) {
    rivet(c, x, 10, warm);
    rivet(c, x, h - 11, warm);
  }
  for (let x = 28; x < w - 26; x += 22) {
    c.hSpan(6, x - 1, x + 1, q.shadow);
    c.set(x, 6, q.side);
    c.set(x, h - 7, q.edge);
  }
}

export function focus(c: PixelCanvas) {
  const w = c.width, h = c.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      const depth = Math.min(dx, dy, dx + dy - 10);
      if (depth !== 1 && depth !== 2) continue;
      const lit = y < h / 2 || (x < 12 && y < h - 12);
      const gold = bayer(x, y) < (lit ? 0.60 : 0.22) ? p.ossoLuz : p.ossoBase;
      c.set(x, y, depth === 1 && !lit ? p.ossoEscuro : gold);
    }
  }
}

function cornerPlate(c: PixelCanvas, sx: number, sy: number) {
  const x = sx > 0 ? 0 : c.width - 1;
  const y = sy > 0 ? 0 : c.height - 1;
  for (let u = 1; u <= 19; u++) {
    for (let v = 1; v <= 19; v++) {
      if (u + v > 22 || u + v < 5) continue;
      let color: string = p.couroBase;
      if (u + v === 22 || u + v === 5) color = p.abismo0;
      else if (u === 1 || v === 1) color = p.ossoEscuro;
      else if (u + v === 21) color = p.couroEscuro;
      else if (hash(u, v, 431) > 0.92) color = p.ferrugemBase;
      c.set(x + sx * u, y + sy * v, color);
    }
  }
  rivet(c, x + sx * 5, y + sy * 5, true);
  rivet(c, x + sx * 14, y + sy * 4);
  rivet(c, x + sx * 4, y + sy * 14);
}

export function masonry(c: PixelCanvas) {
  iron(c, { ...steel, face: p.abismo1, shine: p.ferroSombra }, 12, 4);
  const { width: w, height: h } = c;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (cornerCut(x, y, w, h, 4)) continue;
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      const across = Math.min(dx, dy);
      if (across < 3 || across > 9) continue;
      const horizontal = dy <= dx;
      const along = horizontal ? x : y;
      const seam = (along + (horizontal ? 5 : 8)) % (horizontal ? 23 : 21);
      const worn = hash(x, y, 821);
      if (seam === 0 || (seam === 1 && across > 6)) c.set(x, y, p.abismo1);
      else if (seam === 2 && across < 8) c.set(x, y, p.pedraLuz);
      else if ((seam > 18 || seam === 2) && along % 4 < 3 && worn > 0.32) {
        c.set(x, y, worn > 0.81 ? p.pedraVerdeBase : p.pedraVerdeEscuro);
      } else {
        const light = (9 - across) / 11 + (horizontal && y < h / 2 ? 0.18 : 0);
        c.set(x, y, rampPick([p.pedraEscuro, p.pedraBase, p.pedraLuz, p.pedraBrilho], light, x, y));
      }
    }
  }
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) cornerPlate(c, sx, sy);
  }
}

export function ogive(c: PixelCanvas) {
  const { width: w, height: h } = c;
  const axis = (w - 1) / 2;
  for (let y = 0; y < h; y++) {
    const opening = 28 * Math.sqrt(y / (h - 2));
    for (let x = 0; x < w; x++) {
      const dist = opening - Math.abs(axis - x);
      if (dist < 0 || (y < h - 4 && dist > 9)) continue;
      const wear = hash(x, y, 135);
      let color: string = p.pedraBase;
      if (dist < 1 || y === h - 1) color = p.abismo0;
      else if (dist < 2) color = p.pedraBrilho;
      else if (dist > 7 || y > h - 4) color = p.pedraEscuro;
      else if ((y + Math.floor(dist / 3)) % 10 === 0) color = p.abismo1;
      else if (wear > 0.79) color = p.pedraLuz;
      else if (wear < 0.08) color = p.ferroLuz;
      c.set(x, y, color);
    }
  }
  for (const x of [8, w - 9]) {
    c.rect(x - 4, h - 8, 9, 7, p.abismo1);
    c.rect(x - 3, h - 7, 7, 5, p.pedraBase);
    rivet(c, x, h - 5);
  }
}

export function meter(c: PixelCanvas, index: number) {
  if (index === 0) {
    iron(c, { ...steel, face: p.abismo0, shine: p.abismo1 }, 3, 2);
    return;
  }
  const shades = index === 1
    ? [p.ossoBrilho, p.ossoLuz, p.ossoBase, p.ossoBase, p.ossoEscuro, p.couroEscuro]
    : [p.pedraBrilho, p.pedraLuz, p.pedraBase, p.pedraBase, p.pedraEscuro, p.ferroSombra];
  for (let y = 3; y < 9; y++) {
    c.hSpan(y, 4, c.width - 5, shades[y - 3]);
    for (let x = 9; x < c.width - 8; x++) {
      if (hash(x, y, 163) > 0.97) c.set(x, y, shades[Math.min(y - 2, 5)]);
    }
  }
}

export function symbol(c: PixelCanvas, index: number) {
  iron(c, index === 1 || index === 3 ? bronze : steel, 4, 3);
  const ink = p.ossoLuz;
  if (index < 2) {
    for (let i = -1; i <= 1; i++) {
      c.line(7 + i, 7, 16 + i, 16, ink);
      c.line(16 + i, 7, 7 + i, 16, ink);
    }
    c.set(7, 7, p.ossoBrilho);
    c.set(16, 7, p.ossoBrilho);
  }
  if (index === 3) {
    for (let i = -1; i <= 1; i++) {
      c.line(6, 11 + i, 10, 15 + i, ink);
      c.line(10, 15 + i, 17, 8 + i, ink);
    }
    c.set(17, 7, p.ossoBrilho);
  }
}

export function timer(c: PixelCanvas, state: number) {
  iron(c, state === 0 ? steel : { ...bronze, top: p.ossoLuz, side: p.ferrugemLuz, edge: p.ferrugemBase }, 4, 5);
  rivet(c, 4, c.height / 2, state === 1);
  rivet(c, c.width - 5, c.height / 2, state === 1);
  const x = 11;
  c.hSpan(7, x - 2, x + 3, p.ossoLuz);
  c.hSpan(18, x - 2, x + 3, p.ossoBase);
  c.line(x - 2, 8, x + 3, 17, p.pedraBrilho);
  c.line(x + 3, 8, x - 2, 17, p.ossoEscuro);
  c.set(x, 16, state === 0 ? p.ossoBrilho : p.ferrugemLuz);
  c.set(x + 1, 16, state === 0 ? p.ossoLuz : p.ferrugemLuz);
}
