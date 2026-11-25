"""Kit de teto abobadado (Cleaners): pilar, arco de volta inteira, tramo de abóbada de arestas e coluna.

Referências: docs/arte/referencias-teto.md (corredor em tramos de 4 x 4 m, arcos sobre pilares,
abóbada de arestas, coluna redonda no centro da sala).

Medidas em metros (convertidas para unidades: 16 u = 1 m). A abóbada nasce a 2,0 m e chega a 4,0 m
no alto, então cabe nas paredes de 4 m que já existem. Cada bloco de pedra é uma malha fechada
própria (relevo de verdade: juntas são vãos entre blocos), pintada por stone_paint a 128 px/m.
"""
from __future__ import annotations

import math
import random

import numpy as np
from pathlib import Path

PROJECT_REFS = Path(__file__).resolve().parents[1] / "references"

U = 16.0                 # unidades por metro
SPRING = 2.0             # altura onde a abóbada e os arcos nascem
BAY = 4.0                # tramo de 4 x 4 m
VAULT_R = BAY / 2        # raio da abóbada: chega a 4,0 m
ARCH_IN = 1.55           # raio interno do arco
ARCH_OUT = 1.95          # raio externo: fica 5 cm abaixo da abóbada
ARCH_DEPTH = 0.6         # espessura do arco ao longo do corredor (= largura do pilar)
VOUSSOIRS = 11


# ---------------------------------------------------------------------------
# Blocos: cada um com seu referencial, para a pintura saber onde ficam as arestas
# ---------------------------------------------------------------------------

class Block:
    def __init__(self, name, corners, center, axes, half, green=False):
        self.name = name
        self.corners = corners          # 8 pontos (m): ordem [x-,y-,z-], [x+,y-,z-], [x+,y+,z-], [x-,y+,z-], depois z+
        self.center = np.asarray(center, float)
        self.axes = np.asarray(axes, float)   # 3 x 3: linhas = eixos locais no modelo
        self.half = np.asarray(half, float)
        self.green = green


def box_block(name, center, half, axes=None, jitter=0.006, rng=None, green=False):
    axes = np.eye(3) if axes is None else np.asarray(axes, float)
    c = np.asarray(center, float)
    pts = []
    for sz in (-1, 1):
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = c + axes[0] * sx * half[0] + axes[1] * sy * half[1] + axes[2] * sz * half[2]
            if rng is not None:
                p = p + np.array([rng.uniform(-jitter, jitter) for _ in range(3)])
            pts.append(p)
    return Block(name, pts, c, axes, half, green)


def add_block(builder, block):
    from lib import MeshDraft

    d = MeshDraft(closed=True)
    for i, p in enumerate(block.corners):
        d.vertex(f"v{i}", tuple(float(v) * U for v in p))
    faces = {
        "back": [0, 3, 2, 1], "front": [4, 5, 6, 7], "bottom": [0, 1, 5, 4],
        "top": [3, 7, 6, 2], "left": [0, 4, 7, 3], "right": [1, 2, 6, 5],
    }
    for fname, idx in faces.items():
        d.face(fname, [f"v{i}" for i in idx])
    d.anchor("base", tuple(float(v) * U for v in block.center))
    builder.add_mesh(block.name, "root", d, pivot="base", no_overlap_check=True)


def prism_block(builder, name, center_xz, y0, y1, radius, sides=10, phase=0.0):
    """Tambor de coluna (prisma de `sides` lados), malha fechada."""
    from lib import MeshDraft

    d = MeshDraft(closed=True)
    cx, cz = center_xz
    for ring, y in (("b", y0), ("t", y1)):
        for i in range(sides):
            a = phase + 2 * math.pi * i / sides
            d.vertex(f"{ring}{i}", ((cx + radius * math.cos(a)) * U, y * U, (cz + radius * math.sin(a)) * U))
        d.vertex(f"{ring}c", (cx * U, y * U, cz * U))
    for i in range(sides):
        j = (i + 1) % sides
        d.face(f"side{i}", [f"b{i}", f"t{i}", f"t{j}", f"b{j}"])
        d.face(f"bot{i}", ["bc", f"b{i}", f"b{j}"])
        d.face(f"top{i}", ["tc", f"t{j}", f"t{i}"])
    d.anchor("base", (cx * U, y0 * U, cz * U))
    builder.add_mesh(name, "root", d, pivot="base", no_overlap_check=True, allow_triangles=True)
    return Block(name, [], (cx, (y0 + y1) / 2, cz), np.eye(3), (radius, (y1 - y0) / 2, radius))


# ---------------------------------------------------------------------------
# Peças
# ---------------------------------------------------------------------------

def pilaster_blocks(seed=11):
    """Pilar encostado na parede (face da parede em z = 0, sai para +Z), até 2,0 m.

    Base, 4 fiadas de pedra e um capitel (imposta) que recebe o arco.
    """
    rng = random.Random(seed)
    blocks = [box_block("plinth", (0, 0.075, 0.25), (0.36, 0.075, 0.25), rng=rng)]
    y = 0.15
    course = (1.8 - 0.15) / 4
    for i in range(4):
        w = 0.30 if i % 2 == 0 else 0.28
        blocks.append(box_block(f"course{i}", (rng.uniform(-0.01, 0.01), y + course / 2, 0.2),
                                (w, course / 2 - 0.006, 0.2), rng=rng, green=rng.random() < 0.2))
        y += course
    blocks.append(box_block("impost", (0, 1.9, 0.25), (0.37, 0.1, 0.25), rng=rng))
    return blocks


def arch_blocks(seed=23):
    """Arco de volta inteira com aduelas, no plano XY, centrado em x = 0, nascendo a 2,0 m.

    O vão interno vai de x = -1,55 a 1,55 (entre as impostas dos pilares). Espessura em z: 0,6 m.
    """
    rng = random.Random(seed)
    blocks = []
    gap = math.radians(0.7)
    step = math.pi / VOUSSOIRS
    for k in range(VOUSSOIRS):
        a0 = k * step + gap / 2
        a1 = (k + 1) * step - gap / 2
        key = k == VOUSSOIRS // 2
        r0 = ARCH_IN - (0.03 if key else 0)
        r1 = ARCH_OUT + (0.0 if key else rng.uniform(-0.04, 0.0))
        dz = ARCH_DEPTH / 2 + (0.03 if key else rng.uniform(-0.01, 0.015))
        pts = []
        for z in (-dz, dz):
            for r, a in ((r0, a1), (r0, a0), (r1, a0), (r1, a1)):
                pts.append(np.array([r * math.cos(a), SPRING + r * math.sin(a), z]))
        # Reordena para o padrão do box_block: [x-,y-], [x+,y-], [x+,y+], [x-,y+] = radial in/out x tangencial
        am = (a0 + a1) / 2
        rm = (r0 + r1) / 2
        radial = np.array([math.cos(am), math.sin(am), 0.0])
        tangent = np.array([-math.sin(am), math.cos(am), 0.0])
        center = np.array([rm * math.cos(am), SPRING + rm * math.sin(am), 0.0])
        half = ((r1 - r0) / 2, rm * (a1 - a0) / 2, dz)
        # axes: x local = tangente, y local = radial (para fora), z = z
        order = [pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]]
        # pts: (r0,a1),(r0,a0),(r1,a0),(r1,a1): x local = tangente cresce com o ângulo
        # [x-,y-]=(r0,a0) [x+,y-]=(r0,a1) [x+,y+]=(r1,a1) [x-,y+]=(r1,a0)
        corners = []
        for base in (0, 4):
            corners += [order[base + 1], order[base + 0], order[base + 3], order[base + 2]]
        blocks.append(Block(f"voussoir{k:02d}", corners, center,
                            np.stack([tangent, radial, [0, 0, 1]]), np.array([half[1], half[0], half[2]]),
                            green=rng.random() < 0.15))
    return blocks


def column_parts():
    """Coluna redonda para o centro da sala: base, 3 tambores, capitel. Até 2,0 m."""
    return [
        ("base", 0.0, 0.18, 0.42, 8),
        ("drum0", 0.18, 0.72, 0.28, 10),
        ("drum1", 0.72, 1.26, 0.28, 10),
        ("drum2", 1.26, 1.78, 0.28, 10),
        ("capital", 1.78, 2.0, 0.44, 8),
    ]


def vault_height(x, z):
    """Abóbada de arestas: a mais alta de duas abóbadas de berço cruzadas, raio 2 m, nascendo a 2 m."""
    h1 = math.sqrt(max(0.0, VAULT_R ** 2 - x * x))
    h2 = math.sqrt(max(0.0, VAULT_R ** 2 - z * z))
    return SPRING + max(h1, h2)


def add_vault(builder, n=16):
    """Tramo de abóbada de arestas de 4 x 4 m, centrado na origem, folha única virada para baixo."""
    from lib import MeshDraft

    d = MeshDraft(closed=False)
    xs = [-VAULT_R + BAY * i / n for i in range(n + 1)]
    for i, x in enumerate(xs):
        for j, z in enumerate(xs):
            d.vertex(f"v{i}_{j}", (x * U, vault_height(x, z) * U, z * U))
    for i in range(n):
        for j in range(n):
            a, b, c, e = f"v{i}_{j}", f"v{i + 1}_{j}", f"v{i + 1}_{j + 1}", f"v{i}_{j + 1}"
            if i == j:            # quad cortado pela aresta da diagonal principal
                d.face(f"q{i}_{j}a", [a, b, c])
                d.face(f"q{i}_{j}b", [a, c, e])
            elif i + j == n - 1:  # cortado pela outra diagonal
                d.face(f"q{i}_{j}a", [a, b, e])
                d.face(f"q{i}_{j}b", [b, c, e])
            else:
                d.face(f"q{i}_{j}", [a, b, c, e])
    d.anchor("base", (0.0, 0.0, 0.0))
    builder.add_mesh("vault", "root", d, pivot="base", no_overlap_check=True, allow_triangles=True)



def add_tympanum(builder, width=4.0, top=4.0, depth=0.5, arc_r=ARCH_OUT, step_deg=15):
    """Parede curva (tímpano): fecha o espaço entre o arco de uma passagem e o teto.

    Um painel de `width` x (top - SPRING) com um furo de meio-círculo de raio `arc_r` embaixo,
    exatamente onde fica o arco. Centrado em x = 0, espessura `depth` centrada em z = 0.
    """
    from lib import MeshDraft

    half = width / 2
    cy = SPRING
    angles = [math.radians(a) for a in range(0, 181, step_deg)]

    def bound(a):
        c, s_ = math.cos(a), math.sin(a)
        t = min(half / abs(c) if abs(c) > 1e-9 else 1e9, (top - cy) / s_ if s_ > 1e-9 else 1e9)
        return (c * t, cy + s_ * t)

    d = MeshDraft(closed=False)
    zf, zb = depth / 2, -depth / 2
    for i, a in enumerate(angles):
        ax, ay = arc_r * math.cos(a), cy + arc_r * math.sin(a)
        bx, by = bound(a)
        for tag, z in (("f", zf), ("b", zb)):
            d.vertex(f"{tag}a{i}", (ax * U, ay * U, z * U))
            d.vertex(f"{tag}o{i}", (bx * U, by * U, z * U))
    for i in range(len(angles) - 1):
        j = i + 1
        d.face(f"front{i}", [f"fa{i}", f"fo{i}", f"fo{j}", f"fa{j}"], group="front")
        d.face(f"back{i}", [f"ba{j}", f"bo{j}", f"bo{i}", f"ba{i}"], group="back")
        d.face(f"intrados{i}", [f"ba{i}", f"fa{i}", f"fa{j}", f"ba{j}"], group="intrados")
    d.anchor("base", (0.0, 0.0, 0.0))
    builder.add_mesh("tympanum", "root", d, pivot="base", no_overlap_check=True)


# ---------------------------------------------------------------------------
# Montagem e pintura por peça
# ---------------------------------------------------------------------------

def build_piece(builder, piece):
    if piece == "pilaster":
        for b in pilaster_blocks():
            add_block(builder, b)
    elif piece == "arch":
        for b in arch_blocks():
            add_block(builder, b)
    elif piece == "vault":
        add_vault(builder)
    elif piece == "tympanum":
        add_tympanum(builder)
    elif piece == "column":
        for name, y0, y1, r, sides in column_parts():
            prism_block(builder, name, (0.0, 0.0), y0, y1, r, sides, phase=math.pi / sides)
    else:
        raise ValueError(piece)
    return builder


def paint_piece(painter, piece):
    from cleaners_lib.stone_paint import stone_block_colors, surface_stone_colors

    if piece == "vault":
        def vault_colors(rows):
            # Pedras desenhadas direto na superfície 3D: atravessam as arestas sem emenda.
            # Esticadas ao longo do corredor (eixo z), como blocos em fiadas.
            p = np.asarray(rows.model_position, float) / U
            return surface_stone_colors(rows, p, cell=0.36, stretch=(1.0, 1.0, 0.55), seed=71)

        painter.element("vault").paint_surface_arrays(vault_colors)
        return

    if piece == "tympanum":
        from PIL import Image

        wimg = np.asarray(Image.open(PROJECT_REFS / "env_wall_stone_block_01.png").convert("RGBA")).astype(np.uint8)

        def tympanum_colors(rows):
            # Mesma pedra da parede: a faixa de cima da textura de parede (2 a 4 m de altura).
            p = np.asarray(rows.model_position, float) / U
            px = np.floor((p[:, 0] + 2.0) * 128.0 + 384).astype(int) % wimg.shape[1]
            py = np.clip(np.floor((4.0 - p[:, 1]) * 128.0).astype(int), 0, wimg.shape[0] - 1)
            return wimg[py, px]

        painter.element("tympanum").paint_surface_arrays(tympanum_colors)
        return

    if piece == "pilaster":
        blocks = pilaster_blocks()
    elif piece == "arch":
        blocks = arch_blocks()
    else:
        blocks = [Block(name, [], (0, (y0 + y1) / 2, 0), np.eye(3), (r, (y1 - y0) / 2, r))
                  for name, y0, y1, r, _ in column_parts()]

    for k, b in enumerate(blocks):
        def colors(rows, b=b, k=k):
            p = np.asarray(rows.model_position, float) / U
            local = (p - b.center) @ b.axes.T
            up = b.axes @ np.array([0.0, 1.0, 0.0])
            return stone_block_colors(rows, local, b.half, seed=101 + k * 7, green=b.green, light_up=up)

        painter.element(b.name).paint_surface_arrays(colors)
