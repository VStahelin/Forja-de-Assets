/**
 * Geradores das texturas de cenário do Cleaners (chão e parede), versão 2.
 *
 * Pedras irregulares (Voronoi deformado) em vez de retângulos, com sulcos fundos,
 * pedras levantadas e tortas, e variação grande ao longo do tile para esconder a repetição.
 * Chão: 1024 x 1024 px = 8 x 8 m. Parede: 1024 x 512 px = 8 m de largura x 4 m (altura inteira).
 */

import { PALETTES as P, RAMPS, RULES } from './_theme';
import { buildStoneLayout, paintStones, type StoneLayout, type StonePaint } from './_stones';
import type { ColorGrid } from './_masonry';

const STONE = RAMPS.pedra;
// Verde só nas manchas e um tom abaixo, para não virar pedra verde de verdade.
const STONE_GREEN = [RAMPS.pedra[0], RAMPS.pedra_verde[0], RAMPS.pedra_verde[1], RAMPS.pedra_verde[2], RAMPS.pedra[3]];

// ---------------------------------------------------------------------------
// Chão: lajotas irregulares de pedra (prompt 1)
// ---------------------------------------------------------------------------

export const FLOOR_SEED = 1907;

/** Layout das pedras do chão. Usado pela textura e pela malha 3D (via tools/export-stone-layout.ts). */
export function floorLayout(seed = FLOOR_SEED): StoneLayout {
  const W = RULES.floorTile;
  const H = RULES.floorTile;
  // Células de ~70 px (0,55 m); com pedras extras e vazias, vão de ~0,3 a ~1 m.
  return buildStoneLayout({
    W,
    H,
    seed,
    cellW: 70,
    cellH: 70,
    jitterX: 0.85,
    jitterY: 0.85,
    stagger: false,
    extraChance: 0.25,
    dropChance: 0.18,
    greenChance: 0.12,
    crackChance: 0.12,
  });
}

/** Pintura do chão. `warp` e `groove` também são usados pela malha 3D. */
export const FLOOR_PAINT: StonePaint = {
    ramp: STONE,
    rampGreen: STONE_GREEN,
    grooveDeep: P.abismo1,
    grooveMid: P.pedraSombra,
    dirt: P.madeiraSombra,
    mossDark: P.musgoEscuro,
    mossBase: P.musgoBase,
    groove: 6,
    grooveVar: 2.5,
    warp: 7,
    bevel: 7,
    moss: 0.1,
    dirtAmount: 0.3,
    baseValue: 0.44,
    verticalDamp: 0,
};

export function floorStoneSlab(seed = FLOOR_SEED): ColorGrid {
  return paintStones(floorLayout(seed), FLOOR_PAINT, seed);
}

// ---------------------------------------------------------------------------
// Parede: blocos em fiadas tortas, altura inteira do corredor (prompt 2)
// ---------------------------------------------------------------------------

export const WALL_SEED = 2611;

/** Layout dos blocos da parede. Usado pela textura e pela malha 3D (via tools/export-stone-layout.ts). */
export function wallLayout(seed = WALL_SEED): StoneLayout {
  const W = RULES.floorTile;
  const H = RULES.wallHeightPx;
  // Células de 96 x 51 px (0,75 x 0,4 m) em aparelho desencontrado.
  return buildStoneLayout({
    W,
    H,
    seed,
    cellW: 96,
    cellH: 51,
    jitterX: 0.5,
    jitterY: 0.25,
    stagger: true,
    extraChance: 0.12,
    dropChance: 0.1,
    greenChance: 0.1,
    crackChance: 0.1,
    aspect: 2.4,
  });
}

/** Pintura da parede. `warp` e `groove` também são usados pela malha 3D. */
export const WALL_PAINT: StonePaint = {
  ramp: STONE,
  rampGreen: STONE_GREEN,
  grooveDeep: P.abismo1,
  grooveMid: P.pedraSombra,
  dirt: P.pedraSombra,
  mossDark: P.musgoEscuro,
  mossBase: P.musgoBase,
  groove: 5,
  grooveVar: 1.5,
  warp: 5,
  bevel: 6,
  moss: 0.12,
  dirtAmount: 0,
  baseValue: 0.4,
  verticalDamp: 1,
};

export function wallStoneBlock(seed = WALL_SEED): ColorGrid {
  return paintStones(wallLayout(seed), WALL_PAINT, seed);
}

// ---------------------------------------------------------------------------
// Abóbada: a mesma pedra irregular da parede, sem umidade de baixo e quase sem musgo.
// 512 x 512 px = 4 x 4 m, repete nos dois eixos (a abóbada dá a volta).
// ---------------------------------------------------------------------------

export const VAULT_SEED = 3307;

export const VAULT_PAINT: StonePaint = { ...WALL_PAINT, moss: 0.03, verticalDamp: 0, baseValue: 0.38 };

export function vaultLayout(seed = VAULT_SEED): StoneLayout {
  return buildStoneLayout({
    W: 512,
    H: 512,
    seed,
    cellW: 96,
    cellH: 51,
    jitterX: 0.5,
    jitterY: 0.25,
    stagger: true,
    extraChance: 0.12,
    dropChance: 0.1,
    greenChance: 0.06,
    crackChance: 0.08,
    aspect: 2.4,
  });
}

export function vaultStone(seed = VAULT_SEED): ColorGrid {
  return paintStones(vaultLayout(seed), VAULT_PAINT, seed);
}
