/**
 * Sword of Omens (dark fantasy take on a legendary cat-guard sword).
 *
 * Vertical sword, tip up. Light from the top-left: left halves lit, right halves in shade.
 * Layers, bottom to top: blade, fuller + runes, guard, gem, collar, grip, pommel.
 * Sizes are logical px (export scale 2).
 */

import { defineAsset } from '@core';
import { Polygon, Path, mirror, ShapeStyle, alpha } from '@core/brush';
import { PALETTES, RAMPS, STROKES, TEXTURES, SHAPE_STYLES } from '../_theme';

const CX = 80; // vertical symmetry axis

export default defineAsset({
  width: 160,
  height: 480,
  scale: 2,
  render({ ctx }) {
    // ---------------------------------------------------------------- BLADE
    const bladeHalf = Path.builder({ x: CX, y: 10 })
      .lineTo({ x: CX + 8, y: 40 })
      .bezierTo({ x: CX + 18, y: 90 }, { x: CX + 18, y: 200 }, { x: CX + 15, y: 300 })
      .lineTo({ x: CX, y: 300 })
      .build();
    let blade = mirror(bladeHalf, { axis: 'x', at: CX, close: true }).close();

    // Notches bitten out of both edges in the lower half: a tormented blade.
    const nicks = [];
    for (let i = 0; i < 5; i++) {
      const y = 150 + i * 28;
      const half = 17 + (i % 2) * 2;
      nicks.push(Polygon.triangle(13, 12 + (i % 2) * 4, { cx: CX + half, cy: y }).rotate(-90));
      nicks.push(Polygon.triangle(13, 12 + ((i + 1) % 2) * 4, { cx: CX - half, cy: y + 14 }).rotate(90));
    }
    blade = blade.subtract(nicks);

    const litMask = Polygon.rect(CX, 340, { cx: CX / 2, cy: 160 });
    const shadeMask = Polygon.rect(CX, 340, { cx: CX + CX / 2, cy: 160 });
    const bladeLit = blade.intersect(litMask);
    const bladeShade = blade.intersect(shadeMask);

    bladeLit.draw(ctx, {
      fill: bladeLit.createGradient(ctx, {
        type: 'linear',
        direction: 'vertical',
        stops: [[0, RAMPS.steel.glint], [0.35, RAMPS.steel.lit], [1, RAMPS.steel.base]],
      }),
      texture: [TEXTURES.steelSheen, TEXTURES.scuff],
    });
    bladeShade.draw(ctx, {
      fill: bladeShade.createGradient(ctx, {
        type: 'linear',
        direction: 'vertical',
        stops: [[0, RAMPS.steel.base], [1, RAMPS.steel.dark]],
      }),
      texture: [TEXTURES.steelShade, TEXTURES.wear],
    });

    // Bevel: a lighter ring just inside the edge, sharpened on the lit side.
    const bevel = blade.subtract(blade.offset(-3.5));
    bevel.draw(ctx, { fill: alpha(PALETTES.steelGlint, 0.28) });
    bevel.intersect(litMask).draw(ctx, { fill: alpha(PALETTES.steelGlint, 0.35) });

    // Center ridge above the fuller.
    Path.line({ x: CX, y: 16 }, { x: CX, y: 56 }).stroke(ctx, STROKES.glint);

    // Fuller: a recessed channel that carries the runes.
    const fullerHalf = Path.builder({ x: CX, y: 58 })
      .bezierTo({ x: CX + 3, y: 72 }, { x: CX + 6, y: 90 }, { x: CX + 6, y: 120 })
      .lineTo({ x: CX + 6, y: 252 })
      .lineTo({ x: CX, y: 280 })
      .build();
    const fuller = mirror(fullerHalf, { axis: 'x', at: CX, close: true }).close();
    fuller.draw(ctx, {
      ...SHAPE_STYLES.recess.attrs,
      fill: fuller.createGradient(ctx, {
        type: 'linear',
        direction: 'horizontal',
        stops: [[0, RAMPS.steel.dark], [0.5, RAMPS.steel.abyss], [1, PALETTES.ink]],
      }),
    });

    // Runes: abstract ember glyphs down the fuller, growing from tip to guard.
    for (let i = 0; i < 7; i++) {
      const y = 82 + i * 25;
      const rune =
        i % 3 === 0 ? Polygon.diamond(5, 9, { cx: CX, cy: y })
        : i % 3 === 1 ? Polygon.rect(2.6, 10, { cx: CX, cy: y })
        : Polygon.triangle(7, 9, { cx: CX, cy: y });
      rune.draw(ctx, SHAPE_STYLES.rune);
    }

    // Blade outline, drawn last so notches and tip stay sharp.
    blade.stroke(ctx, STROKES.blade);

    // ---------------------------------------------------------------- GUARD
    // Two sweeping horns that curve up like claws, mirrored around the blade.
    const guardHalf = Path.builder({ x: CX, y: 330 })
      .lineTo({ x: CX + 30, y: 330 })
      .bezierTo({ x: CX + 60, y: 332 }, { x: CX + 78, y: 306 }, { x: CX + 71, y: 254 })
      .bezierTo({ x: CX + 62, y: 282 }, { x: CX + 46, y: 301 }, { x: CX + 26, y: 303 })
      .lineTo({ x: CX + 14, y: 296 })
      .lineTo({ x: CX, y: 296 })
      .build();
    const guard = mirror(guardHalf, { axis: 'x', at: CX, close: true }).close();

    guard.draw(ctx, {
      ...SHAPE_STYLES.gold.attrs,
      stroke: STROKES.blade,
    });

    const guardInset = guard.offset(-5);
    guardInset.draw(ctx, {
      ...SHAPE_STYLES.goldInset.attrs,
      inside: (c) => {
        // Engraved scrollwork on each horn.
        for (const s of [-1, 1]) {
          Path.curve({ x: CX + s * 18, y: 318 }, { x: CX + s * 60, y: 312 }, s * -7).stroke(c, STROKES.engrave);
          Path.curve({ x: CX + s * 26, y: 311 }, { x: CX + s * 64, y: 290 }, s * -5).stroke(c, STROKES.engrave);
          Path.curve({ x: CX + s * 40, y: 322 }, { x: CX + s * 66, y: 300 }, s * 4).stroke(c, STROKES.gilt);
          Path.arc({ x: CX + s * 46, y: 314 }, 5, 0, 300).stroke(c, STROKES.engrave);
        }
        TEXTURES.tarnish.render(c, guardInset);
      },
    });

    // Fangs hanging under the guard.
    for (const s of [-1, 1]) {
      const fang = Polygon.triangle(12, 20, { cx: CX + s * 26, cy: 342 }).rotate(180);
      fang.draw(ctx, { ...SHAPE_STYLES.gold.attrs, stroke: STROKES.blade });
    }

    // ------------------------------------------------------------ EYE GEM
    const eyeBezel = Polygon.diamond(40, 54, { cx: CX, cy: 314 }).roundCorners(5);
    eyeBezel.draw(ctx, SHAPE_STYLES.gold);
    const eye = Polygon.diamond(28, 40, { cx: CX, cy: 314 }).roundCorners(4);
    eye.draw(ctx, {
      ...SHAPE_STYLES.gem.attrs,
      inside: (c) => {
        Polygon.ellipse(2.8, 13, { cx: CX, cy: 314 }).draw(c, { fill: PALETTES.ink });
        Polygon.ellipse(3, 5, { cx: CX - 6, cy: 306 }).draw(c, { fill: alpha(PALETTES.runeLit, 0.75) });
      },
    });

    // ------------------------------------------------------- COLLAR + GRIP
    const collar = Polygon.rect(30, 14, { cx: CX, cy: 350, radius: 4 });
    collar.draw(ctx, SHAPE_STYLES.gold);
    Path.line({ x: CX - 11, y: 350 }, { x: CX + 11, y: 350 }).stroke(ctx, STROKES.engrave);

    const grip = Polygon.rect(18, 80, { cx: CX, cy: 392, radius: 6 });
    grip.draw(ctx, {
      ...SHAPE_STYLES.leather.attrs,
      texture: [TEXTURES.wrap, TEXTURES.grain],
    });

    // Gold binding rings on the grip.
    for (const y of [362, 392, 422]) {
      const ring = Polygon.rect(24, 7, { cx: CX, cy: y, radius: 3 });
      ring.draw(ctx, SHAPE_STYLES.gold);
    }

    // -------------------------------------------------------------- POMMEL
    const pommelBase = Polygon.star(8, 22, 13, { cx: CX, cy: 452, roundness: 1.5 });
    pommelBase.draw(ctx, { ...SHAPE_STYLES.gold.attrs, stroke: STROKES.blade });
    const pommelRing = Polygon.circle(11, { cx: CX, cy: 452 });
    pommelRing.draw(ctx, SHAPE_STYLES.goldInset);
    const pommelGem = Polygon.circle(6.5, { cx: CX, cy: 452 });
    pommelGem.draw(ctx, {
      ...SHAPE_STYLES.gem.attrs,
      inside: (c) => {
        Polygon.circle(2, { cx: CX - 2.2, cy: 449.5 }).draw(c, { fill: alpha(PALETTES.runeLit, 0.8) });
      },
    });
  },
});
