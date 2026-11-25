"""Esqueleto dark fantasy (Cleaners): o morto-vivo comum das masmorras.

Referências: referencias/008 (esqueletos de manto e capuz rasgado, tom sombrio com humor),
011 (esqueleto sentado no corredor) e 001 (esqueleto guerreiro na luz de tocha).

Desenho: 1,75 m, proporção de 5,5 cabeças da bible (crânio grande, de 30 cm), corcunda leve,
capuz e manto rasgados escuros, uma algema de ferro enferrujado com corrente quebrada no pulso
esquerdo (lembrança da prisão) e dois pontinhos roxos no fundo das órbitas: a magia que o
mantém de pé (roxo = magia, regra da bible). Low poly, faces planas, pintura a 128 px/m.

Coordenadas em metros, convertidas para unidades (16 u = 1 m). Frente em +Z, esquerda (_L) em +X.
"""
from __future__ import annotations

import math

import numpy as np

U = 16.0


def m(*v):
    return tuple(float(c) * U for c in v)


# ---------------------------------------------------------------------------
# Modelo
# ---------------------------------------------------------------------------

def _bone(b, name, a, c, r, seg=6):
    from lib import Profile, SegmentSection

    b.add_segment(name, "root", start=m(*a), end=m(*c), y_hint=(0, 0, 1), no_overlap_check=True,
                  tags=("assembly:skeleton", "bone"), sections=(
                      SegmentSection("s0", profile=Profile.circle(r * U, segments=seg), t=0),
                      SegmentSection("s1", profile=Profile.circle(r * 0.75 * U, segments=seg), t=0.5),
                      SegmentSection("s2", profile=Profile.circle(r * U, segments=seg), t=1),
                  ))


def _knob(b, name, p, r, seg=6):
    from lib import Profile, SegmentSection

    x, y, z = p
    b.add_segment(name, "root", start=m(x, y - r, z), end=m(x, y + r, z), y_hint=(0, 0, 1), no_overlap_check=True,
                  tags=("assembly:skeleton", "bone"), sections=(
                      SegmentSection("s0", profile=Profile.circle(r * 0.45 * U, segments=seg), t=0),
                      SegmentSection("s1", profile=Profile.circle(r * U, segments=seg), t=0.5),
                      SegmentSection("s2", profile=Profile.circle(r * 0.45 * U, segments=seg), t=1),
                  ))


def _oval_segment(b, name, a, c, sections, tag="bone", seg=8):
    from lib import Profile, SegmentSection

    secs = tuple(SegmentSection(f"s{i}", profile=Profile.oval(hw * U, fy * U, by * U, segments=seg), t=t)
                 for i, (t, hw, fy, by) in enumerate(sections))
    b.add_segment(name, "root", start=m(*a), end=m(*c), y_hint=(0, 0, 1), no_overlap_check=True,
                  tags=("assembly:skeleton", tag), sections=secs)


def _rib(b, name, y, w, side):
    from lib import Path3D, Profile

    s = side
    pts = [(s * 0.02, y, -0.075), (s * 0.10 * w, y - 0.01, -0.06), (s * 0.15 * w, y - 0.035, 0.015),
           (s * 0.11 * w, y - 0.055, 0.075), (s * 0.035, y - 0.065, 0.095)]
    b.add_sweep(name, "root", path=Path3D.polyline([m(*p) for p in pts]), profile=Profile.circle(0.011 * U, segments=4),
                no_overlap_check=True, tags=("assembly:skeleton", "bone"))


def _cloth_sheet(b, name, rings, gap_deg, thickness=0.012, jag=None, seed=5):
    """Pano em anéis abertos na frente (capuz e manto), com duas faces para ser visto por dentro.

    rings: lista de (y, rx, rz, cz) de cima para baixo. O último anel pode ganhar barra rasgada (jag).
    """
    from lib import MeshDraft

    rng = np.random.default_rng(seed)
    d = MeshDraft(closed=False)
    g = math.radians(gap_deg)
    n = 14
    angles = [math.pi / 2 + g / 2 + (2 * math.pi - g) * i / n for i in range(n + 1)]
    for layer, inset in (("o", 0.0), ("i", thickness)):
        for ri, (y, rx, rz, cz) in enumerate(rings):
            for ai, a in enumerate(angles):
                yy = y
                if jag is not None and ri == len(rings) - 1:
                    yy = y + (jag if ai % 2 else -jag) * (0.6 + 0.8 * rng.random())
                d.vertex(f"{layer}{ri}_{ai}", m((rx - inset) * math.cos(a), yy, cz + (rz - inset) * math.sin(a)))
    for ri in range(len(rings) - 1):
        for ai in range(n):
            o = [f"o{ri}_{ai}", f"o{ri}_{ai + 1}", f"o{ri + 1}_{ai + 1}", f"o{ri + 1}_{ai}"]
            d.face(f"out{ri}_{ai}", o, group="outside")
            i = [f"i{ri}_{ai}", f"i{ri + 1}_{ai}", f"i{ri + 1}_{ai + 1}", f"i{ri}_{ai + 1}"]
            d.face(f"in{ri}_{ai}", i, group="inside")
    d.anchor("base", m(0, rings[-1][0], rings[-1][3]))
    b.add_mesh(name, "root", d, pivot="base", no_overlap_check=True, tags=("assembly:skeleton", "cloth"))


def build_skeleton(b):
    # Crânio grande (30 cm): mandíbula, maçãs, testa, calota.
    _oval_segment(b, "skull", (0, 1.47, 0.035), (0, 1.77, 0.0), [
        (0.00, 0.050, 0.055, 0.020),
        (0.22, 0.072, 0.085, 0.060),
        (0.50, 0.098, 0.100, 0.105),
        (0.78, 0.100, 0.080, 0.120),
        (1.00, 0.055, 0.040, 0.065),
    ], seg=10)
    # Mandíbula separada, um pouco aberta (o "sorriso" da referência 8).
    _oval_segment(b, "jaw", (0, 1.415, 0.075), (0, 1.48, 0.045), [
        (0.0, 0.040, 0.030, 0.015), (0.6, 0.060, 0.050, 0.040), (1.0, 0.062, 0.045, 0.050)], seg=8)

    # Coluna levemente curvada para a frente (corcunda).
    spine = [(0, 0.99 + i * 0.055, -0.045 + 0.012 * i - 0.0018 * i * i) for i in range(9)]
    for i, p in enumerate(spine):
        _knob(b, f"vertebra{i}", p, 0.022 if i < 8 else 0.018)
    _bone(b, "neck", (0, 1.40, 0.0), (0, 1.47, 0.02), 0.018)

    # Costelas: 5 pares, menores embaixo.
    for k, (y, w) in enumerate([(1.37, 0.9), (1.32, 1.0), (1.27, 1.05), (1.22, 1.0), (1.17, 0.9)]):
        _rib(b, f"rib{k}_L", y, w, 1)
        _rib(b, f"rib{k}_R", y, w, -1)
    _oval_segment(b, "sternum", (0, 1.36, 0.105), (0, 1.20, 0.09), [
        (0.0, 0.022, 0.012, 0.012), (1.0, 0.016, 0.010, 0.010)], seg=4)

    # Clavículas e ombros.
    for s, side in ((1, "L"), (-1, "R")):
        _bone(b, f"clavicle_{side}", (s * 0.03, 1.40, 0.07), (s * 0.19, 1.39, 0.0), 0.014, seg=4)
        _knob(b, f"shoulder_{side}", (s * 0.20, 1.37, 0.0), 0.04)

    # Bacia.
    _oval_segment(b, "pelvis", (0, 0.86, 0.0), (0, 1.0, -0.01), [
        (0.0, 0.10, 0.05, 0.05), (0.5, 0.15, 0.07, 0.07), (1.0, 0.12, 0.05, 0.08)], seg=8)

    for s, side in ((1, "L"), (-1, "R")):
        # Braços pendurados, um pouco para a frente.
        _bone(b, f"humerus_{side}", (s * 0.21, 1.35, 0.0), (s * 0.26, 1.08, 0.03), 0.021)
        _knob(b, f"elbow_{side}", (s * 0.26, 1.08, 0.03), 0.03)
        _bone(b, f"forearm_{side}", (s * 0.26, 1.08, 0.03), (s * 0.28, 0.83, 0.08), 0.017)
        _oval_segment(b, f"hand_{side}", (s * 0.28, 0.83, 0.08), (s * 0.29, 0.75, 0.10), [
            (0.0, 0.03, 0.015, 0.015), (1.0, 0.035, 0.012, 0.012)], seg=4)
        for f, dx in enumerate((-0.02, 0.0, 0.02)):
            _bone(b, f"finger{f}_{side}", (s * (0.29 + dx), 0.75, 0.10), (s * (0.29 + dx * 1.4), 0.66, 0.13), 0.007, seg=4)
        # Pernas.
        _knob(b, f"hip_{side}", (s * 0.09, 0.92, 0.0), 0.04)
        _bone(b, f"femur_{side}", (s * 0.09, 0.92, 0.0), (s * 0.10, 0.50, 0.03), 0.026)
        _knob(b, f"knee_{side}", (s * 0.10, 0.50, 0.03), 0.038)
        _bone(b, f"tibia_{side}", (s * 0.10, 0.50, 0.03), (s * 0.11, 0.09, 0.0), 0.021)
        _oval_segment(b, f"foot_{side}", (s * 0.11, 0.07, -0.03), (s * 0.12, 0.03, 0.17), [
            (0.0, 0.035, 0.03, 0.03), (0.6, 0.045, 0.02, 0.02), (1.0, 0.04, 0.01, 0.01)], seg=6)

    # Algema de ferro com corrente quebrada no pulso esquerdo.
    _oval_segment(b, "shackle", (0.275, 0.88, 0.07), (0.28, 0.83, 0.08), [
        (0.0, 0.034, 0.034, 0.034), (1.0, 0.034, 0.034, 0.034)], tag="iron", seg=8)
    for k in range(3):
        y = 0.80 - k * 0.045
        _oval_segment(b, f"chain{k}", (0.30 + 0.01 * k, y + 0.02, 0.04), (0.30 + 0.01 * k, y - 0.02, 0.04), [
            (0.0, 0.012, 0.006, 0.006), (0.5, 0.016, 0.009, 0.009), (1.0, 0.012, 0.006, 0.006)], tag="iron", seg=4)

    # Capuz rasgado (aberto na frente) e manto curto sobre os ombros, com a barra rasgada.
    _cloth_sheet(b, "hood", [
        (1.86, 0.06, 0.07, -0.03),
        (1.78, 0.14, 0.15, -0.005),
        (1.62, 0.15, 0.16, 0.01),
        (1.47, 0.16, 0.15, -0.01),
    ], gap_deg=100, seed=3)
    _cloth_sheet(b, "mantle", [
        (1.46, 0.15, 0.13, -0.01),
        (1.38, 0.27, 0.19, -0.01),
        (1.18, 0.29, 0.21, -0.02),
        (0.98, 0.30, 0.22, -0.03),
    ], gap_deg=70, jag=0.06, seed=9)
    return b


# ---------------------------------------------------------------------------
# Pintura
# ---------------------------------------------------------------------------

OSSO = ["#3d362e", "#615647", "#8f826b", "#b9ab8f", "#e3d9c0"]
COURO = ["#22181a", "#3a2828", "#563c37", "#7a5a4c"]
FERRO = ["#16181d", "#262a31", "#3c414b", "#5e6470"]
FERRUGEM = ["#4a2412", "#73391b", "#9c5426"]
ABISMO = "#07080c"
MAGIA = ["#7f4bb3", "#b88ae6"]


def paint_skeleton(painter):
    from cleaners_lib.stone_paint import _rgb, fbm, pick, texel_xy

    osso, couro, ferro, ferrugem = _rgb(OSSO), _rgb(COURO), _rgb(FERRO), _rgb(FERRUGEM)
    deep = _rgb([ABISMO])[0]
    glow = _rgb(MAGIA)

    def bone(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        nrm = np.asarray(rows.model_normal, float)
        v = 0.55 + (fbm(p, 0.06, 3, 7) - 0.5) * 0.6 + nrm[:, 1] * 0.12 - (nrm[:, 1] < -0.4) * 0.2
        return pick(osso, v, px, py)

    def skull(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        nrm = np.asarray(rows.model_normal, float)
        c = bone(rows)
        front = nrm[:, 2] > 0.2
        x, y = p[:, 0], p[:, 1]
        # Órbitas grandes e fundas, com um ponto roxo no fundo de cada uma.
        for sx in (-1, 1):
            d = np.hypot((x - sx * 0.045) / 1.1, y - 1.635)
            c = np.where((front & (d < 0.032))[:, None], deep, c)
            c = np.where((front & (d < 0.0085))[:, None], glow[0], c)
            c = np.where((front & (d < 0.004))[:, None], glow[1], c)
        # Cavidade do nariz (triângulo invertido).
        nose = front & (y > 1.55) & (y < 1.60) & (np.abs(x) < (y - 1.55) * 0.45 + 0.004)
        c = np.where(nose[:, None], deep, c)
        # Dentes de cima.
        teeth = front & (y > 1.485) & (y < 1.515) & (np.abs(x) < 0.05)
        stripe = (px % 3 == 0)
        c = np.where((teeth & stripe)[:, None], _rgb([OSSO[1]])[0], np.where(teeth[:, None], _rgb([OSSO[4]])[0], c))
        return c

    def jaw(rows):
        n = len(rows.x)
        p = np.asarray(rows.model_position, float) / U
        nrm = np.asarray(rows.model_normal, float)
        c = bone(rows)
        teeth = (nrm[:, 2] > 0.2) & (p[:, 1] > 1.455) & (np.abs(p[:, 0]) < 0.045)
        px, _ = texel_xy(rows, n)
        c = np.where((teeth & (px % 3 == 0))[:, None], _rgb([OSSO[1]])[0], np.where(teeth[:, None], _rgb([OSSO[4]])[0], c))
        return c

    def cloth(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        v = 0.45 + (fbm(p, 0.08, 3, 13) - 0.5) * 0.7 - np.clip((1.1 - p[:, 1]) * 2.5, 0, 0.35)
        # Rasgos e furos: manchas bem escuras.
        holes = fbm(p * np.array([1, 0.4, 1]), 0.05, 2, 21) > 0.72
        c = pick(couro, v, px, py)
        return np.where(holes[:, None], _rgb([COURO[0]])[0], c)

    def iron(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        v = 0.5 + (fbm(p, 0.02, 2, 31) - 0.5) * 0.8
        rust = fbm(p, 0.015, 2, 33) > 0.5
        return np.where(rust[:, None], pick(ferrugem, v, px, py), pick(ferro, v, px, py))

    for el in painter.all_elements():
        name = el.name if hasattr(el, "name") else str(el)
        if name == "skull":
            el.paint_surface_arrays(skull)
        elif name == "jaw":
            el.paint_surface_arrays(jaw)
        elif name in ("hood", "mantle"):
            el.paint_surface_arrays(cloth)
        elif name.startswith(("shackle", "chain")):
            el.paint_surface_arrays(iron)
        else:
            el.paint_surface_arrays(bone)
