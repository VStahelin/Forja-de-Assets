"""Tocha de parede (Cleaners), prompt 6 de docs/arte/prompts/prompts-iniciais.md.

Chapa de ferro presa na parede, braço, anel, bastão de madeira inclinado ~20 graus para fora
e a cabeça de pano queimado com uma faixa de brasa. Sem chama modelada: a luz é do Unity e a
chama vira efeito depois. Pivô no centro de baixo da chapa, parede em z = 0, frente em +Z.
Medidas em metros (16 u = 1 m); 0,60 m de altura no total.
"""
from __future__ import annotations

import math

import numpy as np

U = 16.0


def m(*v):
    return tuple(float(c) * U for c in v)


TILT = math.radians(20)
STICK_BASE = (0.0, 0.0, 0.11)
STICK_LEN = 0.50


def stick_point(t):
    """Ponto ao longo do bastão (t em metros a partir da base)."""
    x, y, z = STICK_BASE
    return (x, y + t * math.cos(TILT), z + t * math.sin(TILT))


def build_torch(b, *, dropped=False):
    from lib import Profile, SegmentSection

    def seg(name, a, c, sections, tag, seg=6, square=False):
        secs = []
        for i, (t, r) in enumerate(sections):
            prof = Profile.rectangle(2 * r * U, 2 * r * U) if square else Profile.circle(r * U, segments=seg)
            secs.append(SegmentSection(f"s{i}", profile=prof, t=t))
        across = (0, 1, 0) if dropped else (0, 0, 1)
        b.add_segment(name, "root", start=m(*a), end=m(*c), y_hint=across, no_overlap_check=True,
                      tags=("assembly:torch", tag), sections=tuple(secs))

    if dropped:
        # Mantém o cabo e a cabeça da tocha de parede, já deitados no chão.
        def on_floor(t):
            return 0, .046, t

        seg("stick", on_floor(0), on_floor(.42), [(0,.020),(.6,.024),(1,.026)], "wood", seg=6)
        seg("head", on_floor(.40), on_floor(STICK_LEN), [(0,.032),(.4,.046),(1,.040)], "cloth", seg=8)
        return b

    # Chapa na parede (12 x 18 cm, 2 cm de espessura), feita como segmento de perfil retangular.
    b.add_segment("plate", "root", start=m(0, 0.0, 0.01), end=m(0, 0.18, 0.01), y_hint=(0, 0, 1),
                  no_overlap_check=True, tags=("assembly:torch", "iron"), sections=(
                      SegmentSection("s0", profile=Profile.rectangle(0.12 * U, 0.02 * U), t=0),
                      SegmentSection("s1", profile=Profile.rectangle(0.12 * U, 0.02 * U), t=1)))
    # Braço que sai da chapa até o anel.
    ring = stick_point(0.16)
    seg("arm", (0, 0.10, 0.02), (ring[0], ring[1], ring[2] - 0.035), [(0, 0.014), (1, 0.012)], "iron", square=True)
    # Anel que segura o bastão.
    seg("ring", stick_point(0.13), stick_point(0.19), [(0, 0.038), (1, 0.038)], "iron", seg=8)
    # Bastão de madeira, 6 lados.
    seg("stick", stick_point(0.0), stick_point(0.42), [(0, 0.020), (0.6, 0.024), (1, 0.026)], "wood", seg=6)
    # Cabeça de pano enrolado e queimado.
    seg("head", stick_point(0.40), stick_point(STICK_LEN), [(0, 0.032), (0.4, 0.046), (1, 0.040)], "cloth", seg=8)
    return b


FERRO = ["#16181d", "#262a31", "#3c414b", "#5e6470"]
FERRUGEM = ["#4a2412", "#73391b", "#9c5426"]
MADEIRA = ["#1e140f", "#33221a", "#4f3524", "#734d31"]
COURO = ["#07080c", "#22181a", "#3a2828"]
FOGO = ["#6e2a0c", "#d4651c", "#f5a63a"]


def paint_torch(painter, *, extinguished=False):
    from cleaners_lib.stone_paint import _rgb, fbm, pick, texel_xy

    ferro, ferrugem, madeira, couro, fogo = (_rgb(c) for c in (FERRO, FERRUGEM, MADEIRA, COURO, FOGO))

    def iron(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        nrm = np.asarray(rows.model_normal, float)
        v = 0.45 + (fbm(p, 0.06, 2, 31) - 0.5) * 0.5 + nrm[:, 1] * 0.15
        rust = fbm(p, 0.07, 2, 33) > 0.64
        c = np.where(rust[:, None], pick(ferrugem, v, px, py), pick(ferro, v, px, py))
        # Fuligem na chapa, logo acima da cabeça da tocha.
        soot = (p[:, 1] > 0.14) & (np.abs(p[:, 0]) < 0.035) & (p[:, 2] > 0.015) & (p[:, 2] < 0.03)
        return np.where(soot[:, None], _rgb(["#16181d"])[0], c)

    def wood(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        grain = fbm(p * np.array([4.0, 0.5, 4.0]), 0.05, 2, 41)
        v = 0.45 + (grain - 0.5) * 0.8 + p[:, 1] * 0.2
        return pick(madeira, v, px, py)

    def cloth(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        top = stick_point(STICK_LEN)[1]
        v = 0.4 + (fbm(p, 0.02, 2, 51) - 0.5) * 0.8
        c = pick(couro, v, px, py)
        if extinguished:
            charcoal = _rgb(["#07080c","#0d1018","#16181d","#262a31","#3a2828"])
            return pick(charcoal, np.clip(v + .22 - (p[:,2]-.4)*3,0,1), px, py)
        # Faixa de brasa perto do topo, mais quente na ponta.
        ember = (top - p[:, 1]) < 0.035
        hot = (top - p[:, 1]) < 0.015
        e = fbm(p, 0.012, 2, 53)
        c = np.where((ember & (e > 0.45))[:, None], fogo[0], c)
        c = np.where((hot & (e > 0.4))[:, None], fogo[1], c)
        c = np.where((hot & (e > 0.62))[:, None], fogo[2], c)
        return c

    for el in painter.all_elements():
        name = el.name if hasattr(el, "name") else str(el)
        el.paint_surface_arrays({"stick": wood, "head": cloth}.get(name, iron))
