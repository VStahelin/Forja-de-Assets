"""Props do Cleaners (lote de teste 01).

Lição da revisão do paladino v1 (20/11): o pixel é o mesmo do cenário (128 px/m), mas o detalhe
precisa ser grande e legível como na pedra: áreas chapadas por peça, juntas escuras de 1 px,
borda clara em cima, rebites, e pouco pontilhado. O pontilhado (dithering) só aparece na
transição entre dois tons, nunca espalhado pela superfície inteira.
"""
from __future__ import annotations

import json
import math

import numpy as np

U = 16.0
PX = 128.0  # px por metro

MADEIRA = ["#1e140f", "#33221a", "#4f3524", "#734d31", "#9a6c44"]
FERRO = ["#16181d", "#262a31", "#3c414b", "#5e6470", "#9aa1ad"]
FERRUGEM = ["#4a2412", "#73391b"]


def m(*v):
    return tuple(float(c) * U for c in v)


# ---------------------------------------------------------------------------
# Pintura "limpa": tom por índice da rampa, dithering só na faixa de transição
# ---------------------------------------------------------------------------

BAYER2 = np.array([[0, 2], [3, 1]]) / 4.0 + 0.125


def pick_clean(ramp, fidx, px, py):
    """`fidx` é um índice fracionário na rampa. Fração < 0,3 fica no tom de baixo, > 0,7 no de
    cima; no meio vira um xadrez 2x2 (o pontilhado fica só na transição)."""
    fidx = np.clip(fidx, 0, len(ramp) - 1)
    i = np.floor(fidx).astype(int)
    f = fidx - i
    up = np.where(f > 0.7, True, np.where(f < 0.3, False, (BAYER2[py % 2, px % 2] < 0.5)))
    idx = np.minimum(i + up.astype(int), len(ramp) - 1)
    return ramp[idx]


def _hash1(k, seed):
    k = np.asarray(k, dtype=np.int64)
    h = (k * 374761393 + seed * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


# ---------------------------------------------------------------------------
# Barril (prop_barrel_01)
# ---------------------------------------------------------------------------

BARREL_SIDES = 12            # GE-03: 8 a 12 lados
CHIME_R = 0.225              # raio da tampa, recuada 2,5 cm dentro do aro
# Perfil externo (raio, altura) em metros: bojudo, 0,60 m no meio, 0,90 m de altura.
BARREL_PROFILE = [(0.25, 0.0), (0.275, 0.10), (0.295, 0.30), (0.30, 0.45),
                  (0.295, 0.60), (0.275, 0.80), (0.25, 0.90)]
HOOPS = [(0.06, 0.035), (0.20, 0.035), (0.70, 0.035), (0.84, 0.035)]  # (centro, altura)
HOOP_OUT = 0.012             # o aro sai 1,2 cm da madeira


def barrel_radius(y):
    pts = BARREL_PROFILE
    for (r0, y0), (r1, y1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            return r0 + (r1 - r0) * (y - y0) / (y1 - y0)
    return pts[-1][0]


def build_barrel(b):
    from lib import Placement

    b.add_group("root")
    # Corpo: meridiano que sobe pelo lado de fora e desce no aro até a tampa recuada.
    meridian = [(CHIME_R, 0.025), (CHIME_R, 0.0)] + BARREL_PROFILE + [(CHIME_R, 0.90), (CHIME_R, 0.875)]
    b.add_revolve("body", "root", meridian=[(r * U, y * U) for r, y in meridian], segments=BARREL_SIDES,
                  start_cap="flat", end_cap="flat", allow_cap_triangles=True, no_overlap_check=True)
    # Aros de ferro salientes.
    for i, (yc, h) in enumerate(HOOPS):
        y0, y1 = yc - h / 2, yc + h / 2
        r0, r1 = barrel_radius(y0) - 0.004, barrel_radius(y1) - 0.004
        mer = [(r0, y0), (r0 + HOOP_OUT + 0.004, y0), (r1 + HOOP_OUT + 0.004, y1), (r1, y1)]
        b.add_revolve(f"hoop{i}", "root", meridian=[(r * U, y * U) for r, y in mer], segments=BARREL_SIDES,
                      start_cap="open", end_cap="open", no_overlap_check=True)
    # Batoque (a rolha de madeira) no lado, de frente (+Z).
    b.add_cylinder("bung", "root", radius=0.028 * U, height=0.03 * U, segments=6, axis="Z",
                   placement=Placement.at(m(0, 0.45, 0.30)), no_overlap_check=True)
    return b


def _body_phase(model_path):
    """Ângulo do primeiro vértice do corpo, para as juntas das aduelas caírem nas arestas."""
    bb = json.loads(open(model_path, encoding="utf-8").read())
    for el in bb["elements"]:
        if el["name"] == "body":
            best = None
            for v in el["vertices"].values():
                x, y, z = v
                if abs(y / U - 0.45) < 0.01:
                    a = math.atan2(z, x)
                    best = a if best is None else best
            if best is not None:
                step = 2 * math.pi / BARREL_SIDES
                return best % step
    return 0.0


def paint_barrel(painter, model_path):
    from cleaners_lib.stone_paint import _rgb, fbm, texel_xy

    madeira, ferro, ferrugem = _rgb(MADEIRA), _rgb(FERRO), _rgb(FERRUGEM)
    step = 2 * math.pi / BARREL_SIDES
    phase = _body_phase(model_path)

    def body(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        r = np.hypot(x, z)
        ang = np.arctan2(z, x) - phase
        k = np.floor(ang / step).astype(int) % BARREL_SIDES
        u = (ang / step) - np.floor(ang / step)
        seam_px = np.minimum(u, 1 - u) * step * r * PX
        outer = r > CHIME_R + 0.01
        lid = ~outer & ((y > 0.87) | (y < 0.03)) & (r < CHIME_R - 0.002)

        # Aduelas: um tom por aduela, veios verticais longos e pouco ruído.
        tone = 2.0 + np.clip(np.round((_hash1(k, 7) - 0.5) * 2.6), -1, 1)
        tone += (fbm(p * np.array([1.0, 0.12, 1.0]), 0.12, 2, 11) - 0.5) * 0.35
        grain_u = _hash1(k * 3 + 1, 9)
        grain = (np.abs(u - grain_u) * step * r * PX < 0.6) & (fbm(p * np.array([1, 0.3, 1]), 0.05, 2, 13) > 0.45)
        tone = np.where(grain, tone - 1.0, tone)
        # Escurece perto das pontas e logo acima/abaixo dos aros (sombra do aro).
        for yc, h in HOOPS:
            d = np.abs(y - yc) - h / 2
            tone = np.where((d > 0) & (d * PX < 2.0), tone - 0.8, tone)
        tone = np.where((y < 0.04) | (y > 0.86), tone - 0.6, tone)
        # Quina de cima de cada aduela pega luz.
        tone = np.where(outer & (y > 0.885), tone + 0.8, tone)
        c = pick_clean(madeira, tone, px, py)
        c = np.where((outer & (seam_px < 1.0))[:, None], madeira[0], c)

        # Marca de bota numa aduela da frente (alguém chutou o barril).
        s = r * (np.arctan2(z, x) - math.pi / 2)
        t = y - 0.33
        sole = (s / 0.05) ** 2 + ((t - 0.05) / 0.10) ** 2 < 1
        heel = (s / 0.045) ** 2 + ((t + 0.09) / 0.045) ** 2 < 1
        boot = outer & (z > 0.1) & (sole | heel)
        tread = (np.floor(t * PX / 3) % 2 == 0)
        c = np.where((boot & tread)[:, None], madeira[0], np.where(boot[:, None], madeira[1], c))

        # Tampa: tábuas atravessadas, juntas escuras, borda escura.
        plank = np.floor((x + 0.3) / 0.075).astype(int)
        pu = ((x + 0.3) / 0.075) - np.floor((x + 0.3) / 0.075)
        ltone = 2.0 + np.clip(np.round((_hash1(plank, 21) - 0.5) * 2.6), -1, 1) + (fbm(p * np.array([0.15, 1, 1]), 0.1, 2, 23) - 0.5) * 0.3
        lc = pick_clean(madeira, ltone, px, py)
        lc = np.where((np.minimum(pu, 1 - pu) * 0.075 * PX < 1.0)[:, None], madeira[0], lc)
        lc = np.where((r > CHIME_R - 0.012)[:, None], madeira[1], lc)
        c = np.where(lid[:, None], lc, c)
        # Parede interna do aro (fim das aduelas): escura.
        inner = ~outer & ~lid
        c = np.where(inner[:, None], pick_clean(madeira, np.full(n, 0.6), px, py), c)
        return c

    def hoop(rows, yc, h):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        nrm = np.asarray(rows.model_normal, float)
        tone = np.full(n, 2.0) + (fbm(p, 0.12, 2, 31) - 0.5) * 0.2
        top = (yc + h / 2 - y) * PX < 1.2
        bot = (y - (yc - h / 2)) * PX < 1.2
        tone = np.where(top, 3.6, np.where(bot, 0.6, tone))
        tone = np.where(nrm[:, 1] > 0.5, 3.2, np.where(nrm[:, 1] < -0.5, 0.8, tone))
        c = pick_clean(ferro, tone, px, py)
        # Rebites no meio do aro, entre as aduelas.
        ang = np.arctan2(z, x) - phase
        u = (ang / step) - np.floor(ang / step)
        r = np.hypot(x, z)
        du = np.abs(u - 0.5) * step * r * PX
        dy = (y - yc) * PX
        rivet = (du < 1.2) & (np.abs(dy) < 1.2)
        rivet_sh = (du < 1.2) & (dy < -1.2) & (dy > -2.4)
        c = np.where(rivet[:, None], ferro[4], np.where(rivet_sh[:, None], ferro[0], c))
        # Ferrugem em manchas grandes.
        rust = fbm(p, 0.09, 2, 33) > 0.64
        c = np.where((rust & ~rivet)[:, None], pick_clean(ferrugem, tone * 0.3, px, py), c)
        return c

    def bung(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        nrm = np.asarray(rows.model_normal, float)
        return pick_clean(madeira, np.where(nrm[:, 2] > 0.5, 1.4, 0.8), px, py)

    painter.element("body").paint_surface_arrays(body)
    for i, (yc, h) in enumerate(HOOPS):
        painter.element(f"hoop{i}").paint_surface_arrays(lambda rows, yc=yc, h=h: hoop(rows, yc, h))
    painter.element("bung").paint_surface_arrays(bung)
