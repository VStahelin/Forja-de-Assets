/**
 * Dark Fantasy - Design System & Theme Tokens
 *
 * Single source of truth for palettes, ramps, strokes, textures and shape styles.
 * Never hardcode raw hex colors or stroke settings in asset files.
 */

import { StrokeStyle, ShapeStyle, Hatch, Grit, Stipple, alpha } from '@core/brush';

export const PALETTES = {
  ink: '#07060a',
  abyss: '#12141d',
  steelDeep: '#262a38',
  steel: '#4b5266',
  steelLit: '#8a93a6',
  steelGlint: '#d7deea',
  goldDeep: '#4d300f',
  goldDark: '#7a4f17',
  gold: '#b8862f',
  goldLit: '#e8c566',
  bloodDeep: '#3a050b',
  blood: '#a3121c',
  bloodLit: '#ff6b52',
  leatherDark: '#1d1015',
  leather: '#3a2429',
  leatherLit: '#5a3a3d',
  rune: '#ff9a3c',
  runeLit: '#ffe0a0',
};

export const RAMPS = {
  steel: { glint: PALETTES.steelGlint, lit: PALETTES.steelLit, base: PALETTES.steel, dark: PALETTES.steelDeep, abyss: PALETTES.abyss },
  gold: { lit: PALETTES.goldLit, base: PALETTES.gold, dark: PALETTES.goldDark, deep: PALETTES.goldDeep },
  blood: { lit: PALETTES.bloodLit, base: PALETTES.blood, deep: PALETTES.bloodDeep },
  leather: { lit: PALETTES.leatherLit, base: PALETTES.leather, dark: PALETTES.leatherDark },
};

export const STROKES = {
  /** Heavy ink outline with sharp corners: blades, horns, spikes. */
  blade: new StrokeStyle({ width: 3, color: PALETTES.ink, renderer: 'ribbon', join: 'miter', miterLimit: 4 }),
  /** Heavy ink outline with soft corners: grip, gems, rings. */
  bold: new StrokeStyle({ width: 3, color: PALETTES.ink, renderer: 'ribbon', join: 'round' }),
  /** Thin ink line for engraved detail. */
  fine: new StrokeStyle({ width: 1.2, color: PALETTES.ink, renderer: 'clean', join: 'round' }),
  /** Thin metal glint line for edge highlights. */
  glint: new StrokeStyle({ width: 1.2, color: PALETTES.steelGlint, renderer: 'clean', join: 'round' }),
  /** Dark gold engraving line for scrollwork. */
  engrave: new StrokeStyle({ width: 1.4, color: PALETTES.goldDeep, renderer: 'clean', join: 'round' }),
  /** Light gold line for scrollwork highlights. */
  gilt: new StrokeStyle({ width: 1, color: PALETTES.goldLit, renderer: 'clean', join: 'round' }),
};

export const TEXTURES = {
  /** Cross-hatched shade on the dark side of steel. */
  steelShade: new Hatch({ angle: 62, spacing: 3.2, jitter: 0.5, lengthVariation: 0.25, seed: 11, color: alpha(PALETTES.ink, 0.45), width: 1 }),
  /** Fine light hatching on lit steel. */
  steelSheen: new Hatch({ angle: -62, spacing: 4.5, jitter: 0.6, lengthVariation: 0.4, seed: 5, color: alpha(PALETTES.steelGlint, 0.18), width: 0.8 }),
  /** Battle wear: scratches and pits. */
  wear: new Grit({ count: 90, scratches: 26, size: 1.4, color: alpha(PALETTES.ink, 0.6), seed: 23 }),
  /** Light scratches that catch the light. */
  scuff: new Grit({ count: 30, scratches: 14, size: 1, color: alpha(PALETTES.steelGlint, 0.35), seed: 41 }),
  /** Tarnish pooling near the guard. */
  tarnish: new Stipple({ count: 160, minRadius: 0.5, maxRadius: 1.4, color: alpha(PALETTES.goldDeep, 0.55), gradient: 'bottom-to-top', seed: 7 }),
  /** Leather wrap diagonal ribs. */
  wrap: new Hatch({ angle: 38, spacing: 5, jitter: 0.1, color: alpha(PALETTES.ink, 0.75), width: 1.6, seed: 3 }),
  /** Worn leather grain. */
  grain: new Grit({ count: 60, scratches: 6, size: 1.1, color: alpha(PALETTES.ink, 0.5), seed: 19 }),
};

export const SHAPE_STYLES = {
  /** Cast gold fittings with cel shading. */
  gold: new ShapeStyle({
    fill: RAMPS.gold.base,
    celShade: { shade: RAMPS.gold.dark, lightPivot: 'topLeft', litScale: 0.78 },
    stroke: STROKES.bold,
    texture: TEXTURES.tarnish,
    shadow: { color: alpha(PALETTES.ink, 0.45), x: 0, y: 3, blur: 5 },
  }),
  /** Raised gold inset plate sitting on a gold body. */
  goldInset: new ShapeStyle({
    fill: RAMPS.gold.lit,
    celShade: { shade: RAMPS.gold.base, lightPivot: 'topLeft', litScale: 0.7 },
    stroke: STROKES.fine,
  }),
  /** Dark recessed metal (engraved channels). */
  recess: new ShapeStyle({
    fill: RAMPS.steel.abyss,
    stroke: STROKES.fine,
  }),
  /** Glowing blood-red gem. */
  gem: new ShapeStyle({
    fill: RAMPS.blood.base,
    celShade: { shade: RAMPS.blood.deep, lightPivot: 'topLeft', litScale: 0.72 },
    stroke: STROKES.bold,
    shadow: { color: alpha(PALETTES.blood, 0.8), x: 0, y: 0, blur: 12 },
  }),
  /** Leather-wrapped grip. */
  leather: new ShapeStyle({
    fill: RAMPS.leather.base,
    celShade: { shade: RAMPS.leather.dark, lightPivot: 'topLeft', litScale: 0.8 },
    stroke: STROKES.bold,
  }),
  /** Glowing rune mark. */
  rune: new ShapeStyle({
    fill: PALETTES.rune,
    shadow: { color: alpha(PALETTES.rune, 0.9), x: 0, y: 0, blur: 7 },
  }),
};
