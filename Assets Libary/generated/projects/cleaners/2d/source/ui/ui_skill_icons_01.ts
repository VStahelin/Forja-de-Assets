import { defineAsset } from '@core';
import { PixelCanvas } from '@core/pixel';
import { PALETTES as p } from '../_theme';

/**
 * Ícones do plano de carreira (proposta de 22/11/2026), 12 × 12, contorno de abismo.
 * Quadros 0 a 3: os ramos (faxina, carga, mecânica, sobrevivência).
 * Quadros 4 a 11: os jeitos, dois por ramo, na ordem do quadro.
 */
const size = 12;

type Draw = (c: PixelCanvas) => void;

const ICONS: Record<string, Draw> = {
  // Ramos
  faxina: (c) => {
    c.line(10, 0, 4, 6, p.madeiraBase).line(11, 1, 5, 7, p.madeiraLuz);
    c.rect(3, 6, 3, 2, p.ferroLuz, true);
    c.fillPolygon([[1, 8], [7, 8], [8, 11], [0, 11]], p.ossoBase);
    c.hSpan(8, 2, 6, p.ossoLuz).set(2, 10, p.ossoEscuro).set(5, 10, p.ossoEscuro);
  },
  carga: (c) => {
    c.rect(3, 4, 6, 6, p.ossoBase, true);
    for (const fx of [3, 5, 7]) c.vSpan(fx, 1, 4, p.ossoLuz);
    c.vSpan(1, 5, 7, p.ossoLuz).set(2, 5, p.ossoBase);
    c.hSpan(7, 4, 8, p.ossoEscuro).rect(4, 10, 5, 2, p.madeiraBase, true);
  },
  mecanica: (c) => {
    c.circle(5, 5, 4, p.ferroBase, true).circle(5, 5, 2, p.ferroLuz, true).set(5, 5, p.ferroSombra);
    c.line(7, 7, 10, 8, p.ferroLuz).vSpan(10, 8, 11, p.madeiraLuz).vSpan(11, 9, 11, p.madeiraBase);
  },
  sobrevivencia: (c) => {
    // bota: cano à esquerda, bico para a direita
    c.rect(1, 0, 5, 7, p.madeiraBase, true).vSpan(2, 1, 6, p.madeiraLuz).hSpan(0, 1, 5, p.madeiraEscuro);
    c.fillPolygon([[1, 6], [7, 6], [10, 8], [11, 10], [1, 10]], p.madeiraBase);
    c.hSpan(6, 6, 7, p.madeiraLuz).set(9, 8, p.madeiraLuz);
    c.hSpan(11, 1, 11, p.ferroBase);
  },
  // Faxina
  panoTorcido: (c) => {
    c.line(1, 2, 10, 9, p.couroLuz).line(1, 3, 9, 10, p.couroBase).line(2, 2, 10, 8, p.couroBase);
    for (const k of [3, 6]) c.line(k, k + 2, k + 2, k, p.couroEscuro);
    c.set(5, 11, p.pedraLuz).set(8, 11, p.pedraBase);
  },
  faroDeZelador: (c) => {
    c.circle(4, 4, 3, p.ferroLuz, false).circle(4, 4, 2, p.pedraVerdeLuz, true).set(3, 3, p.ossoBrilho);
    c.line(7, 7, 10, 10, p.madeiraBase).line(7, 8, 9, 10, p.madeiraLuz);
  },
  // Carga
  maoCheia: (c) => {
    c.line(1, 3, 6, 1, p.ossoLuz).set(0, 3, p.ossoBrilho).set(6, 0, p.ossoBrilho);
    c.line(5, 4, 10, 2, p.ossoLuz).set(11, 2, p.ossoBrilho);
    c.rect(2, 6, 8, 4, p.ossoBase, true).hSpan(6, 2, 9, p.ossoLuz).rect(3, 10, 6, 2, p.madeiraBase, true);
  },
  pegadaFirme: (c) => {
    c.rect(2, 3, 8, 6, p.ossoBase, true);
    for (const fx of [3, 5, 7]) c.vSpan(fx, 3, 5, p.ossoEscuro);
    c.hSpan(3, 2, 9, p.ossoLuz).rect(3, 9, 6, 3, p.madeiraBase, true);
  },
  // Mecânica
  dardoNoBolso: (c) => {
    c.rect(1, 5, 8, 6, p.couroBase, true).hSpan(5, 1, 8, p.couroLuz);
    c.line(4, 6, 9, 0, p.ferroLuz).set(10, 0, p.ferroBrilho);
    c.line(6, 6, 11, 1, p.ferroBase).set(5, 7, p.ossoBase).set(7, 7, p.ossoBase);
  },
  trancoCerto: (c) => {
    // lâmina pendular em meia-lua presa na haste, com o fio para baixo
    c.vSpan(5, 0, 6, p.madeiraBase).vSpan(6, 0, 6, p.madeiraLuz);
    c.fillPolygon([[1, 5], [10, 5], [11, 7], [9, 10], [6, 11], [3, 10], [0, 7]], p.ferroBase);
    c.hSpan(5, 1, 10, p.ferroLuz).line(1, 8, 4, 10, p.ferroBrilho).line(7, 10, 10, 8, p.ferroBrilho);
  },
  // Sobrevivência
  ouvidoDeCatraca: (c) => {
    c.circle(5, 6, 4, p.ossoBase, true).circle(5, 6, 2, p.ossoEscuro, true).set(5, 6, p.ossoBase);
    c.vSpan(9, 2, 9, p.ossoLuz);
    c.set(11, 1, p.ferroLuz).set(11, 4, p.ferroLuz).set(10, 0, p.ferroBase);
  },
  peDePato: (c) => {
    // bota pequena pisando, e a poça atrás sem nenhuma pegada
    c.rect(5, 0, 3, 5, p.madeiraBase, true).vSpan(6, 1, 4, p.madeiraLuz);
    c.fillPolygon([[5, 4], [9, 4], [11, 6], [11, 7], [5, 7]], p.madeiraBase);
    c.hSpan(8, 5, 11, p.ferroBase);
    c.fillPolygon([[0, 9], [4, 8], [9, 9], [11, 11], [1, 11]], p.couroEscuro);
    c.hSpan(9, 2, 6, p.couroBase);
  },
};

const ORDER = ['faxina', 'carga', 'mecanica', 'sobrevivencia', 'panoTorcido', 'faroDeZelador', 'maoCheia',
  'pegadaFirme', 'dardoNoBolso', 'trancoCerto', 'ouvidoDeCatraca', 'peDePato'];

export default defineAsset({
  width: size,
  height: size,
  scale: 1,
  frames: ORDER.length,
  animations: Object.fromEntries(ORDER.map((name, i) => [name, [i]])),
  antialiasing: 'none',
  render({ ctx, frameIndex = 0 }) {
    const c = new PixelCanvas(size, size);
    ICONS[ORDER[frameIndex]](c);
    c.addOutline(p.abismo1);
    c.render(ctx);
  },
});
