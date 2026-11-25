/**
 * Project Design System & Theme Tokens
 *
 * Single source of truth for palettes, ramps, strokes, and shape styles.
 * Never hardcode raw hex colors or stroke settings in asset files.
 */

import { StrokeStyle, ShapeStyle, alpha } from '@core/brush';

export const FORGE_MARK = {
  ink: '#100d1b',
  panel: '#202635',
  inlay: '#151c2a',
  steelShade: '#45455f',
  steel: '#8991aa',
  silver: '#e5e8df',
  woodDark: '#592b35',
  wood: '#8c423d',
  woodLight: '#bb684b',
  plum: '#542c52',
  ochre: '#b66c31',
  gold: '#efae50',
  goldLight: '#ffe8a2',
  blueDark: '#2e447c',
  blue: '#567fc3',
  blueLight: '#a6dafa',
};

export const PALETTES = {
  bg: '#111419',
  surface: '#222e22',
  surfaceLit: '#38533b',
  accent: '#b7f478',
  accentLit: '#dbffa9',
  ink: '#101b12',
  white: '#f5f3fa',
};

export const RAMPS = {
  surface: {
    lit: PALETTES.surfaceLit,
    base: PALETTES.surface,
    dark: PALETTES.bg,
  },
  accent: {
    lit: PALETTES.accentLit,
    base: PALETTES.accent,
    dark: '#719947',
  },
};

export const STROKES = {
  bold: new StrokeStyle({
    width: 4,
    color: PALETTES.ink,
    renderer: 'ribbon',
    join: 'round',
  }),

  fine: new StrokeStyle({
    width: 1.5,
    color: PALETTES.ink,
    renderer: 'clean',
  }),

  // A built-in renderer with a join; define custom brushes with defineBrush (guide 03) when needed:
  inkArt: new StrokeStyle({
    width: 3.5,
    color: PALETTES.ink,
    renderer: 'ribbon',
    join: 'round',
  }),
};

export const SHAPE_STYLES = {
  panel: new ShapeStyle({
    fill: PALETTES.surface,
    stroke: STROKES.bold,
    shadow: {
      color: alpha(PALETTES.ink, 0.4),
      x: 0,
      y: 4,
      blur: 8,
    },
  }),

  // Volume with cel-shaded lighting:
  gem: new ShapeStyle({
    fill: RAMPS.accent.base,
    celShade: {
      shade: RAMPS.accent.dark,
      lightPivot: 'topLeft',
      litScale: 0.84,
    },
    stroke: STROKES.fine,
  }),
};
