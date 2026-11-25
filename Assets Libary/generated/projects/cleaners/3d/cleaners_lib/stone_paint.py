"""Pintura procedural de pedra para peças de arquitetura (Cleaners).

Para blocos (aduelas de arco, fiadas de pilar, tambores de coluna) e para a abóbada de tijolo.
Tudo em numpy, por texel, com as cores da paleta mestre da bible (seção 4) e dithering Bayer
entre tons vizinhos, igual ao gerador 2D. Densidade: 8 px por unidade = 128 px/m.
"""
from __future__ import annotations

import numpy as np

# Paleta mestre (docs/arte/direcao-de-arte.md, seção 4). Sombra -> brilho.
PEDRA = ["#1a202b", "#283041", "#3b4558", "#5a6577", "#8590a0"]
PEDRA_VERDE = ["#13211f", "#1e3532", "#2f504b", "#4a7268", "#6f9a8c"]
MUSGO = ["#18240f", "#263a18", "#3a5424", "#577434"]
ABISMO = "#0d1018"


def _rgb(hexes):
    return np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] + [255] for h in hexes], dtype=np.uint8)


RAMP_STONE = _rgb(PEDRA[1:])          # face das pedras: 4 tons
RAMP_GREEN = _rgb(PEDRA_VERDE[1:4] + [PEDRA[3]])
JOINT = _rgb([PEDRA[0]])[0]
JOINT_DEEP = _rgb([ABISMO])[0]
MOSS = _rgb(MUSGO[1:3])

BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0
PX_PER_M = 128.0


def _hash3(ix, iy, iz, seed):
    h = (ix * 374761393 + iy * 668265263 + iz * 1274126177 + seed * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def value_noise(p, cell, seed):
    """Value noise 3D em [0, 1]; `p` em metros (N, 3), `cell` em metros."""
    q = p / cell
    i = np.floor(q).astype(np.int64)
    f = q - i
    f = f * f * (3 - 2 * f)
    total = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                total = total + w * _hash3(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return total


def fbm(p, cell, octaves, seed):
    total = np.zeros(len(p))
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        total += value_noise(p, cell / (2 ** o), seed + o * 101) * amp
        norm += amp
        amp *= 0.5
    return total / norm


def pick(ramp, value, px, py):
    """Tom da rampa com dithering Bayer entre vizinhos (px, py = texel do atlas)."""
    v = np.clip(value, 0, 0.9999) * (len(ramp) - 1)
    i = np.floor(v).astype(int)
    frac = v - i
    thr = BAYER4[py % 4, px % 4]
    idx = np.where(frac > thr, np.minimum(i + 1, len(ramp) - 1), i)
    return ramp[idx]


def texel_xy(rows, n):
    """Coordenadas do texel no atlas (para o padrão do dithering)."""
    return np.asarray(rows.x, dtype=int).reshape(n), np.asarray(rows.y, dtype=int).reshape(n)


def stone_block_colors(rows, local, half, seed, green=False, light_up=None):
    """Cor de um bloco de pedra.

    local: posição do texel no referencial do bloco, em metros (N, 3), centrada no bloco.
    half: meia-dimensão do bloco nesse referencial (3,).
    light_up: vetor (3,) no referencial do bloco que aponta "para cima" no mundo (realce em cima).
    """
    n = len(local)
    px, py = texel_xy(rows, n)
    pos = np.asarray(rows.model_position, dtype=float) / 16.0
    # Distância até a aresta mais próxima da face: o eixo da normal é o que está mais perto do limite.
    rel = np.abs(local) / half
    normal_axis = np.argmax(rel, axis=1)
    dist = np.full(n, 9.0)
    for a in range(3):
        d = half[a] - np.abs(local[:, a])
        d = np.where(normal_axis == a, 9.0, d)
        dist = np.minimum(dist, d)

    v = 0.5 + (fbm(pos, 0.25, 3, seed) - 0.5) * 0.8
    v += (_hash3(np.zeros(1, np.int64) + seed, 0, 0, 7) - 0.5) * 0.25
    grain = value_noise(pos, 1 / 64, seed + 9)
    v -= np.where(grain > 0.9, 0.22, 0.0)
    v += np.where(grain < 0.06, 0.15, 0.0)
    # Bisel: borda escurece; a borda de cima clareia.
    bevel = 0.04
    k = np.clip(1 - dist / bevel, 0, 1)
    v -= k * 0.28
    if light_up is not None:
        up = local @ np.asarray(light_up, dtype=float)
        top = (up > 0) & (k > 0)
        v += np.where(top, k * 0.45, 0.0)
    colors = pick(RAMP_STONE, v, px, py)
    if green:
        g = fbm(pos, 0.2, 2, seed + 3) > 0.55
        colors = np.where(g[:, None], pick(RAMP_GREEN, v, px, py), colors)
    # Junta: a última faixa de 1 texel da borda fica escura, como a junta da parede.
    colors = np.where((dist < 1.5 / PX_PER_M)[:, None], JOINT, colors)
    return colors


def brick_vault_colors(rows, s, t, seed, brick=(0.30, 0.12), mortar=1.5):
    """Tijolos/pedras pequenas em fiadas, no plano (s, t) em metros ao longo da superfície."""
    n = len(s)
    px, py = texel_xy(rows, n)
    bw, bh = brick
    row = np.floor(t / bh).astype(np.int64)
    s_off = s + (row % 2) * bw * 0.5 + _hash3(row, 0, 0, seed) * 0.0
    col = np.floor(s_off / bw).astype(np.int64)
    ls = s_off - col * bw
    lt = t - row * bh
    edge = np.minimum(np.minimum(ls, bw - ls), np.minimum(lt, bh - lt)) * PX_PER_M
    pos = np.stack([s, t, np.zeros(n)], axis=1)
    tone = _hash3(col, row, 0, seed + 5)
    v = 0.42 + (tone - 0.5) * 0.3 + (fbm(pos, 0.12, 3, seed) - 0.5) * 0.5
    v += np.where(lt * PX_PER_M < 3, 0.18, 0.0) - np.where((bh - lt) * PX_PER_M < 3, 0.15, 0.0)
    colors = pick(RAMP_STONE, v, px, py)
    green = (_hash3(col, row, 1, seed + 8) > 0.95)
    colors = np.where(green[:, None], pick(RAMP_GREEN, v, px, py), colors)
    colors = np.where((edge < mortar)[:, None], JOINT, colors)
    colors = np.where((edge < mortar * 0.4)[:, None], JOINT_DEEP, colors)
    return colors


def _hash_vec(i, seed):
    """Três números em [0, 1) por célula inteira (N, 3)."""
    return np.stack([_hash3(i[:, 0], i[:, 1], i[:, 2], seed + k * 17) for k in range(3)], axis=1)


def surface_stone_colors(rows, p, cell=0.42, stretch=(1.0, 1.0, 1.0), seed=71, groove=4.0, bevel=7.0):
    """Pedras irregulares desenhadas direto no espaço 3D (Voronoi 3D na posição do texel).

    Como o desenho vem da posição no mundo e não de um UV, as pedras atravessam arestas e
    emendas sem quebrar. Mesmo visual da parede: sulco escuro, bisel, tons da rampa pedra.
    p: posição em metros (N, 3). cell: tamanho médio da pedra (m). groove/bevel em px (128 px/m).
    """
    n = len(p)
    px, py = texel_xy(rows, n)
    q = p * np.asarray(stretch, float) / cell
    base = np.floor(q).astype(np.int64)
    best = np.full(n, np.inf)
    second = np.full(n, np.inf)
    best_pt = np.zeros((n, 3))
    second_pt = np.zeros((n, 3))
    best_id = np.zeros((n, 3), np.int64)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                c = base + np.array([dx, dy, dz])
                site = c + 0.15 + 0.7 * _hash_vec(c, seed)
                d = np.sum((q - site) ** 2, axis=1)
                closer = d < best
                mid = (~closer) & (d < second)
                second = np.where(closer, best, np.where(mid, d, second))
                second_pt = np.where(closer[:, None], best_pt, np.where(mid[:, None], site, second_pt))
                best = np.where(closer, d, best)
                best_pt = np.where(closer[:, None], site, best_pt)
                best_id = np.where(closer[:, None], c, best_id)
    # Distância até a bissetriz entre a pedra dona e a vizinha mais próxima, em metros.
    ab = second_pt - best_pt
    mid = (best_pt + second_pt) / 2
    edge = np.abs(np.sum((q - mid) * ab, axis=1)) / np.maximum(np.linalg.norm(ab, axis=1), 1e-9) * cell
    edge_px = edge * PX_PER_M

    tone = _hash3(best_id[:, 0], best_id[:, 1], best_id[:, 2], seed + 3)
    v = 0.36 + (tone - 0.5) * 0.25 + (fbm(p, 0.25, 3, seed + 5) - 0.5) * 0.6
    grain = value_noise(p, 1 / 64, seed + 9)
    v -= np.where(grain > 0.9, 0.2, 0.0)
    v += np.where(grain < 0.06, 0.14, 0.0)
    k = np.clip(1 - (edge_px - groove / 2) / bevel, 0, 1)
    # Bisel: o lado da pedra mais perto do chão recebe a luz das tochas, o de cima fica escuro.
    toward = (q - best_pt) @ np.array([0.0, -1.0, 0.0])
    v += np.where(toward > 0, k * 0.3, -k * 0.25)
    colors = pick(RAMP_STONE, v, px, py)
    green = _hash3(best_id[:, 0], best_id[:, 1], best_id[:, 2], seed + 8) > 0.93
    gmask = green & (fbm(p, 0.15, 2, seed + 11) > 0.5)
    colors = np.where(gmask[:, None], pick(RAMP_GREEN, v, px, py), colors)
    colors = np.where((edge_px < groove / 2)[:, None], JOINT, colors)
    colors = np.where((edge_px < groove / 4)[:, None], JOINT_DEEP, colors)
    return colors
