"""Módulo de chão de pedra (Cleaners). Desde 22/11/2026 (VX-07) as peças usam cleaners_lib.flat_relief;
aqui ficam o layout, o recorte e a pintura do albedo, ainda usados por ele. O build_floor_module (relevo na malha) é histórico.

Lê o mapa de pedras exportado pelo gerador 2D (references/env_floor_stone_slab_01.layout.json)
e monta um pedaço de 2 x 2 m do tile de 8 x 8 m: cada pedra vira um prisma baixo com o
contorno exato da pedra da textura, altura e inclinação próprias, e o sulco fica afundado.

Unidades: 16 unidades = 1 m. A textura tem 128 px/m, então 1 unidade = 8 px.
O módulo é centrado na origem (x e z de -16 a 16), fundo do sulco em y = 0.
Eixo x da textura = +X do modelo; eixo y da textura = +Z do modelo.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

PX_PER_UNIT = 8.0                       # 128 px/m / 16 u/m
MODULE_PX = 256                         # 2 m
HALF = MODULE_PX / PX_PER_UNIT / 2      # 16 unidades

# Relevo, em metros convertidos para unidades (16 u = 1 m).
M = 16.0
GROOVE_DEPTH = 0.01 * M         # topo mínimo de uma pedra acima do fundo do sulco (1 cm)
STONE_RANGE = 0.02 * M          # variação de altura entre pedras (até +2 cm)
RAISED_EXTRA = 0.02 * M         # pedras levantadas: até ~5 cm no total
RAISED_THRESHOLD = 0.85
MAX_SLOPE = math.tan(math.radians(1.5))

LAYOUT_FILE = "env_floor_stone_slab_01.layout.json"
TEXTURE_FILE = "env_floor_stone_slab_01.png"


def load_layout(project: Path) -> dict:
    return json.loads((project / "references" / LAYOUT_FILE).read_text(encoding="utf-8"))


def _clip_axis(poly, axis, value, keep_less):
    out = []
    for i, a in enumerate(poly):
        b = poly[(i + 1) % len(poly)]
        ia = a[axis] <= value if keep_less else a[axis] >= value
        ib = b[axis] <= value if keep_less else b[axis] >= value
        if ia:
            out.append(a)
        if ia != ib:
            t = (value - a[axis]) / (b[axis] - a[axis])
            p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
            p[axis] = value  # exato na borda, para o módulo vizinho bater
            out.append(tuple(p))
    return out


def _clip_rect(poly, x0, y0, x1, y1):
    for axis, value, keep_less in ((0, x0, False), (0, x1, True), (1, y0, False), (1, y1, True)):
        if not poly:
            break
        poly = _clip_axis(poly, axis, value, keep_less)
    return poly


def _area(poly):
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1]))


def _dedupe(poly, eps=0.05):
    out = []
    for p in poly:
        if not out or math.dist(p, out[-1]) > eps:
            out.append(p)
    if len(out) > 1 and math.dist(out[0], out[-1]) <= eps:
        out.pop()
    return out


def module_stones(layout: dict, mi: int, mj: int):
    """Pedras do módulo (mi, mj), já cortadas na borda do módulo, em px do tile."""
    tw, th = layout["tile"]
    x0, y0 = mi * MODULE_PX, mj * MODULE_PX
    x1, y1 = x0 + MODULE_PX, y0 + MODULE_PX
    out = []
    for s in layout["stones"]:
        for ox in (-tw, 0, tw):
            for oy in (-th, 0, th):
                poly = [(x + ox, y + oy) for x, y in s["polygon"]]
                xs = [p[0] for p in poly]
                ys = [p[1] for p in poly]
                if max(xs) < x0 or min(xs) > x1 or max(ys) < y0 or min(ys) > y1:
                    continue
                clipped = _dedupe(_clip_rect(poly, x0, y0, x1, y1))
                if len(clipped) < 3:
                    continue
                perimeter = sum(math.dist(a, b) for a, b in zip(clipped, clipped[1:] + clipped[:1]))
                # Lascas finas na borda do módulo (menos de ~2 px de largura) ficam de fora:
                # o resto da pedra está no módulo vizinho e o sulco cobre a diferença.
                if abs(_area(clipped)) < 16 or abs(_area(clipped)) / perimeter < 1.0:
                    continue
                if _area(clipped) < 0:
                    clipped.reverse()
                center = (s["center"][0] + ox, s["center"][1] + oy)
                out.append((s, clipped, center))
    return out


def build_floor_module(builder, mi: int, mj: int, project: Path):
    """Adiciona o chão do módulo (mi, mj) ao builder (o grupo 'root' já deve existir)."""
    from lib import MeshDraft

    layout = load_layout(project)
    ox_px, oy_px = mi * MODULE_PX, mj * MODULE_PX

    def to_model(p):
        return ((p[0] - ox_px) / PX_PER_UNIT - HALF, (p[1] - oy_px) / PX_PER_UNIT - HALF)

    def on_border_edge(a, b):
        for axis in (0, 1):
            for side in (-HALF, HALF):
                if abs(a[axis] - side) < 1e-3 and abs(b[axis] - side) < 1e-3:
                    return True
        return False

    # Fundo do sulco: uma placa só, por baixo de tudo (malha própria).
    groove = MeshDraft(closed=False)
    for i, (x, z) in enumerate([(-HALF, -HALF), (HALF, -HALF), (HALF, HALF), (-HALF, HALF)]):
        groove.vertex(f"base{i}", (x, 0.0, z))
    groove.face("groove", ["base0", "base3", "base2", "base1"], group="groove")
    groove.anchor("base", (0.0, 0.0, 0.0))
    builder.add_mesh("groove", "root", groove, pivot="base", no_overlap_check=True)

    # Pedras: cada uma é um prisma aberto embaixo, apoiado no fundo do sulco.
    draft = MeshDraft(closed=False)

    for k, (stone, poly_px, center_px) in enumerate(module_stones(layout, mi, mj)):
        h = GROOVE_DEPTH + stone["height"] * STONE_RANGE
        if stone["height"] > RAISED_THRESHOLD:
            h += RAISED_EXTRA
        tx, tz = stone["tilt"]
        cx, cz = to_model(center_px)

        def top_y(x, z, h=h, tx=tx, tz=tz, cx=cx, cz=cz):
            # A pedra desce na direção da inclinação (mesmo lado em que a textura escurece).
            y = h - ((x - cx) * tx + (z - cz) * tz) * MAX_SLOPE
            return max(GROOVE_DEPTH * 0.5, y)

        pts = [to_model(p) for p in poly_px]
        n = len(pts)
        for i, (x, z) in enumerate(pts):
            draft.vertex(f"s{k}_t{i}", (x, top_y(x, z), z))
            draft.vertex(f"s{k}_b{i}", (x, 0.0, z))
        mx = sum(p[0] for p in pts) / n
        mz = sum(p[1] for p in pts) / n
        draft.vertex(f"s{k}_c", (mx, top_y(mx, mz), mz))
        # Topo em leque a partir do centro.
        for i in range(n):
            j = (i + 1) % n
            draft.face(f"s{k}_top{i}", [f"s{k}_c", f"s{k}_t{j}", f"s{k}_t{i}"], group="stone_top")
        # Laterais, menos as que ficam na borda do módulo (o vizinho continua a pedra).
        for i in range(n):
            j = (i + 1) % n
            if on_border_edge(pts[i], pts[j]):
                continue
            draft.face(f"s{k}_side{i}", [f"s{k}_b{j}", f"s{k}_b{i}", f"s{k}_t{i}", f"s{k}_t{j}"], group="stone_side")

    draft.anchor("base", (0.0, 0.0, 0.0))
    builder.add_mesh("stones", "root", draft, pivot="base", allow_triangles=True, no_overlap_check=True)
    return builder


def paint_floor_module(painter, mi: int, mj: int, project: Path):
    """Pinta o módulo copiando a textura do gerador 2D pixel a pixel pela posição (x, z)."""
    import numpy as np
    from PIL import Image

    img = np.asarray(Image.open(project / "references" / TEXTURE_FILE).convert("RGBA"))
    th, tw = img.shape[:2]
    ox_px, oy_px = mi * MODULE_PX, mj * MODULE_PX

    def sample(rows):
        pos = np.asarray(rows.model_position, dtype=float)
        px = np.floor((pos[:, 0] + HALF) * PX_PER_UNIT + ox_px).astype(int) % tw
        py = np.floor((pos[:, 2] + HALF) * PX_PER_UNIT + oy_px).astype(int) % th
        return img[py, px].astype(np.uint8)

    for element in painter.all_elements():
        element.paint_surface_arrays(sample)
