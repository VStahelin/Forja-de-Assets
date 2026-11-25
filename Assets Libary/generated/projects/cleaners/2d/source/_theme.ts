/**
 * Cleaners - Design System & Theme Tokens
 *
 * Fonte única da paleta do jogo. Os valores vêm da seção 4 da bible de arte:
 * C:\Users\Dicks\projects\cleaners\Cleaners\docs\arte\direcao-de-arte.md
 * Nunca escreva hex solto num asset: use RAMPS e PALETTES daqui.
 *
 * Cada rampa vai da sombra para o brilho (índice 0 = mais escuro).
 */

export const PALETTES = {
  // Base fria
  abismo0: '#07080c',
  abismo1: '#0d1018',

  pedraSombra: '#1a202b',
  pedraEscuro: '#283041',
  pedraBase: '#3b4558',
  pedraLuz: '#5a6577',
  pedraBrilho: '#8590a0',

  pedraVerdeSombra: '#13211f',
  pedraVerdeEscuro: '#1e3532',
  pedraVerdeBase: '#2f504b',
  pedraVerdeLuz: '#4a7268',
  pedraVerdeBrilho: '#6f9a8c',

  ferroSombra: '#16181d',
  ferroEscuro: '#262a31',
  ferroBase: '#3c414b',
  ferroLuz: '#5e6470',
  ferroBrilho: '#9aa1ad',

  musgoSombra: '#18240f',
  musgoEscuro: '#263a18',
  musgoBase: '#3a5424',
  musgoLuz: '#577434',
  musgoBrilho: '#7f9a4a',

  // Materiais quentes neutros
  madeiraSombra: '#1e140f',
  madeiraEscuro: '#33221a',
  madeiraBase: '#4f3524',
  madeiraLuz: '#734d31',
  madeiraBrilho: '#9a6c44',

  ossoSombra: '#3d362e',
  ossoEscuro: '#615647',
  ossoBase: '#8f826b',
  ossoLuz: '#b9ab8f',
  ossoBrilho: '#e3d9c0',

  couroSombra: '#22181a',
  couroEscuro: '#3a2828',
  couroBase: '#563c37',
  couroLuz: '#7a5a4c',
  couroBrilho: '#a08068',

  ferrugemSombra: '#2a140c',
  ferrugemEscuro: '#4a2412',
  ferrugemBase: '#73391b',
  ferrugemLuz: '#9c5426',

  // Luz e acentos
  fogoEscuro: '#6e2a0c',
  fogoBase: '#d4651c',
  fogoLuz: '#f5a63a',
  fogoBrilho: '#ffe3a0',

  magiaEscuro: '#24143a',
  magiaBase: '#4d2a73',
  magiaLuz: '#7f4bb3',
  magiaBrilho: '#b88ae6',

  sangueEscuro: '#33070c',
  sangueBase: '#6e1018',
  sangueLuz: '#9c1f24',

  slimeEscuro: '#1f3a14',
  slimeBase: '#4f8a24',
  slimeLuz: '#8fcf3a',
  slimeBrilho: '#d4f27a',
} as const;

const P = PALETTES;

/** Rampas ordenadas da sombra para o brilho. */
export const RAMPS = {
  abismo: [P.abismo0, P.abismo1],
  pedra: [P.pedraSombra, P.pedraEscuro, P.pedraBase, P.pedraLuz, P.pedraBrilho],
  pedra_verde: [P.pedraVerdeSombra, P.pedraVerdeEscuro, P.pedraVerdeBase, P.pedraVerdeLuz, P.pedraVerdeBrilho],
  ferro: [P.ferroSombra, P.ferroEscuro, P.ferroBase, P.ferroLuz, P.ferroBrilho],
  musgo: [P.musgoSombra, P.musgoEscuro, P.musgoBase, P.musgoLuz, P.musgoBrilho],
  madeira: [P.madeiraSombra, P.madeiraEscuro, P.madeiraBase, P.madeiraLuz, P.madeiraBrilho],
  osso: [P.ossoSombra, P.ossoEscuro, P.ossoBase, P.ossoLuz, P.ossoBrilho],
  couro_tecido: [P.couroSombra, P.couroEscuro, P.couroBase, P.couroLuz, P.couroBrilho],
  ferrugem: [P.ferrugemSombra, P.ferrugemEscuro, P.ferrugemBase, P.ferrugemLuz],
  fogo: [P.fogoEscuro, P.fogoBase, P.fogoLuz, P.fogoBrilho],
  magia: [P.magiaEscuro, P.magiaBase, P.magiaLuz, P.magiaBrilho],
  sangue: [P.sangueEscuro, P.sangueBase, P.sangueLuz],
  slime: [P.slimeEscuro, P.slimeBase, P.slimeLuz, P.slimeBrilho],
} as const;

/** Regras numéricas compartilhadas por todos os assets do Cleaners. */
export const RULES = {
  /** Densidade de texel: pixels por metro. */
  pxPerMeter: 128,
  /** Lado de uma textura tileável pequena, em px (cobre 2 x 2 m). */
  tileSize: 256,
  /** Lado do tile de chão e largura do tile de parede, em px (cobre 8 m). */
  floorTile: 1024,
  /** Altura do tile de parede, em px: a altura inteira do corredor (4 m). */
  wallHeightPx: 512,
} as const;
