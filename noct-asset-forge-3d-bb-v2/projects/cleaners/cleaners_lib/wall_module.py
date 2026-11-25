"""Módulo de parede de pedra com relevo de verdade (Cleaners).

Lê o mapa de blocos exportado pelo gerador 2D (references/env_wall_stone_block_01.layout.json)
e monta um pedaço de 2 m de largura x 4 m de altura da parede de 8 x 4 m: cada bloco da
textura vira um bloco saliente na malha (2 a 8 cm para fora da face), com as juntas fundas.

Unidades: 16 unidades = 1 m; 1 unidade = 8 px da textura (128 px/m).
A face da parede fica no plano z = 0, a frente é +Z, o pivô é o pé do módulo no centro
(x de -16 a 16, y de 0 a 64). O topo da textura (y = 0 px) é o topo da parede.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from cleaners_lib.floor_module import _area, _clip_rect, _dedupe

PX_PER_UNIT = 8.0
MODULE_PX = 256                         # 2 m de largura
HALF = MODULE_PX / PX_PER_UNIT / 2      # 16 unidades
HEIGHT_PX = 512                         # 4 m de altura
HEIGHT = HEIGHT_PX / PX_PER_UNIT        # 64 unidades

M = 16.0
BASE_OUT = 0.02 * M             # todo bloco sai pelo menos 2 cm da face
RANGE_OUT = 0.04 * M            # variação entre blocos: até +4 cm
RAISED_EXTRA = 0.02 * M         # blocos mais salientes: até ~8 cm no total
RAISED_THRESHOLD = 0.85
MAX_SLOPE = math.tan(math.radians(1.5))

LAYOUT_FILE = "env_wall_stone_block_01.layout.json"
TEXTURE_FILE = "env_wall_stone_block_01.png"


def load_layout(project: Path) -> dict:
    return json.loads((project / "references" / LAYOUT_FILE).read_text(encoding="utf-8"))


def module_blocks(layout: dict, mi: int):
    tw, _ = layout["tile"]
    x0, x1 = mi * MODULE_PX, (mi + 1) * MODULE_PX
    out = []
    for s in layout["stones"]:
        for ox in (-tw, 0, tw):
            poly = [(x + ox, y) for x, y in s["polygon"]]
            xs = [p[0] for p in poly]
            if max(xs) < x0 or min(xs) > x1:
                continue
            clipped = _dedupe(_clip_rect(poly, x0, 0, x1, HEIGHT_PX))
            if len(clipped) < 3:
                continue
            perimeter = sum(math.dist(a, b) for a, b in zip(clipped, clipped[1:] + clipped[:1]))
            if abs(_area(clipped)) < 16 or abs(_area(clipped)) / perimeter < 1.0:
                continue
            if _area(clipped) < 0:
                clipped.reverse()
            out.append((s, clipped, (s["center"][0] + ox, s["center"][1])))
    return out


def build_wall_module(builder, mi: int, project: Path):
    """Adiciona a parede do módulo mi (0 a 3) ao builder (o grupo 'root' já deve existir)."""
    from lib import MeshDraft

    layout = load_layout(project)
    ox_px = mi * MODULE_PX

    def to_model(p):
        return ((p[0] - ox_px) / PX_PER_UNIT - HALF, (HEIGHT_PX - p[1]) / PX_PER_UNIT)

    def on_border_edge(a, b):
        for axis, sides in ((0, (-HALF, HALF)), (1, (0.0, HEIGHT))):
            for side in sides:
                if abs(a[axis] - side) < 1e-3 and abs(b[axis] - side) < 1e-3:
                    return True
        return False

    # Fundo das juntas: a face da parede, uma placa só.
    face = MeshDraft(closed=False)
    for i, (x, y) in enumerate([(-HALF, 0.0), (HALF, 0.0), (HALF, HEIGHT), (-HALF, HEIGHT)]):
        face.vertex(f"f{i}", (x, y, 0.0))
    face.face("joint", ["f0", "f1", "f2", "f3"], group="joint")
    face.anchor("base", (0.0, 0.0, 0.0))
    builder.add_mesh("joints", "root", face, pivot="base", no_overlap_check=True)

    draft = MeshDraft(closed=False)
    for k, (stone, poly_px, center_px) in enumerate(module_blocks(layout, mi)):
        out = BASE_OUT + stone["height"] * RANGE_OUT
        if stone["height"] > RAISED_THRESHOLD:
            out += RAISED_EXTRA
        tx, ty = stone["tilt"]
        cx, cy = to_model(center_px)

        def front_z(x, y, out=out, tx=tx, ty=ty, cx=cx, cy=cy):
            # A inclinação segue a textura: o lado que escurece na pintura recua.
            # (y da textura cresce para baixo, por isso o sinal de ty inverte.)
            z = out - ((x - cx) * tx - (y - cy) * ty) * MAX_SLOPE
            return max(BASE_OUT * 0.5, z)

        pts = [to_model(p) for p in poly_px]
        n = len(pts)
        for i, (x, y) in enumerate(pts):
            draft.vertex(f"s{k}_t{i}", (x, y, front_z(x, y)))
            draft.vertex(f"s{k}_b{i}", (x, y, 0.0))
        mx = sum(p[0] for p in pts) / n
        my = sum(p[1] for p in pts) / n
        draft.vertex(f"s{k}_c", (mx, my, front_z(mx, my)))
        for i in range(n):
            j = (i + 1) % n
            draft.face(f"s{k}_front{i}", [f"s{k}_c", f"s{k}_t{j}", f"s{k}_t{i}"], group="block_front")
        for i in range(n):
            j = (i + 1) % n
            if on_border_edge(pts[i], pts[j]):
                continue
            draft.face(f"s{k}_side{i}", [f"s{k}_b{j}", f"s{k}_b{i}", f"s{k}_t{i}", f"s{k}_t{j}"], group="block_side")

    draft.anchor("base", (0.0, 0.0, 0.0))
    builder.add_mesh("blocks", "root", draft, pivot="base", allow_triangles=True, no_overlap_check=True)
    return builder


def paint_wall_module(painter, mi: int, project: Path):
    """Pinta o módulo copiando a textura do gerador 2D pixel a pixel pela posição (x, y)."""
    import numpy as np
    from PIL import Image

    img = np.asarray(Image.open(project / "references" / TEXTURE_FILE).convert("RGBA"))
    th, tw = img.shape[:2]
    ox_px = mi * MODULE_PX

    def sample(rows):
        pos = np.asarray(rows.model_position, dtype=float)
        px = np.floor((pos[:, 0] + HALF) * PX_PER_UNIT + ox_px).astype(int) % tw
        py = np.clip(np.floor(HEIGHT_PX - pos[:, 1] * PX_PER_UNIT).astype(int), 0, th - 1)
        return img[py, px].astype(np.uint8)

    for element in painter.all_elements():
        element.paint_surface_arrays(sample)
