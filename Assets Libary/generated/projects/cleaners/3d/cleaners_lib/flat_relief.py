"""Kit de chão, parede e teto em malha plana, com o relevo das pedras no normal map (Cleaners).

Desde 22/11/2026 (pedido do Vitor), as peças do kit de pedra não modelam mais cada pedra na
geometria. A malha é a mínima (um quad por face plana) e o relevo vem da textura:

- albedo: o mesmo PNG do gerador 2D, copiado pixel a pixel pela posição (128 px/m);
- normal map: calculado a partir do mapa de pedras do gerador 2D (o mesmo layout.json que
  antes virava prismas na malha), com a altura, a inclinação e as pedras levantadas de antes;
- altura: o campo de altura em metros também sai em PNG (cinza) para conferência e para quem
  quiser AO ou parallax no futuro. O material do Godot hoje usa só albedo + normal.

O normal map tem a mesma densidade do albedo (1 texel = 1 pixel da textura) e é quantizado em
poucos degraus de inclinação, para o brilho seguir os pixels e não virar degradê liso.

Convenção do normal map: tangente (OpenGL / glTF / Godot): R = +U, G = "para cima" na imagem
(-V), B = para fora da face. O quadro tangente de cada face é tirado da própria UV (posição do
modelo em função do texel), então vale para qualquer rotação ou espelho que o empacotador der.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np

PX_PER_M = 128.0
U_PER_M = 16.0
PX_PER_UNIT = PX_PER_M / U_PER_M        # 8 px por unidade

# Relevo (metros), igual ao que a malha antiga tinha.
FLOOR_GROOVE = 0.010        # topo mínimo de uma pedra acima do fundo do sulco
FLOOR_RANGE = 0.020         # variação entre pedras
FLOOR_RAISED = 0.020        # pedras levantadas
WALL_BASE = 0.020           # bloco sai pelo menos 2 cm da face
WALL_RANGE = 0.040
WALL_RAISED = 0.020
RAISED_THRESHOLD = 0.85
MAX_SLOPE = math.tan(math.radians(1.5))

BEVEL_PX = 4                # quina arredondada da pedra, em pixels
SLOPE_STEPS = 0.25          # degrau de quantização da inclinação (tangente) no normal map
MAX_TS_SLOPE = 1.2          # inclinação máxima no normal map (~50 graus)
# A malha antiga dava a cada pedra um tom próprio de luz (altura e faceta). No plano, isso volta
# como uma inclinação própria de cada pedra só no normal map (o albedo já escurece o mesmo lado).
STONE_TILT = 0.08           # tangente da inclinação de uma pedra com tilt 1 (~5 graus)
TILT_STEPS = 0.04

FLOOR_LAYOUT = "env_floor_stone_slab_01.layout.json"
WALL_LAYOUT = "env_wall_stone_block_01.layout.json"


def _layout(project: Path, name: str) -> dict:
    return json.loads((Path(project) / "references" / name).read_text(encoding="utf-8"))


def _erode(mask: np.ndarray, wrap: bool) -> np.ndarray:
    if wrap:
        out = mask.copy()
        for axis in (0, 1):
            for step in (-1, 1):
                out &= np.roll(mask, step, axis=axis)
        return out
    p = np.pad(mask, 1, constant_values=True)
    return mask & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]


def _height_field(layout: dict, base: float, rng: float, raised: float, wrap_y: bool,
                  tilt_sign_y: float):
    """Altura em metros por pixel do tile: sulco = 0, pedra = topo inclinado com quina arredondada.

    Devolve (altura, tilt_x, tilt_y, borda), onde borda é a distância em px até o sulco (0 no sulco)."""
    from PIL import Image, ImageDraw

    tw, th = layout["tile"]
    stones = layout["stones"]
    label = Image.new("I", (tw, th), 0)
    draw = ImageDraw.Draw(label)
    offsets_y = (-th, 0, th) if wrap_y else (0,)
    for k, stone in enumerate(stones, start=1):
        for ox in (-tw, 0, tw):
            for oy in offsets_y:
                draw.polygon([(x + ox, y + oy) for x, y in stone["polygon"]], fill=k)
    lab = np.asarray(label, dtype=np.int32)

    # Distância até o sulco (ou até a pedra vizinha), em px, até BEVEL_PX + 1.
    edge = np.zeros(lab.shape, dtype=np.int32)
    cur = lab > 0
    for k in range(1, BEVEL_PX + 2):
        edge[cur] = k
        same = cur.copy()
        for axis in (0, 1):
            for step in (-1, 1):
                if axis == 0 and not wrap_y:
                    shifted = np.pad(lab, ((1, 1), (0, 0)), mode="edge")[1 + step:th + 1 + step]
                    cshift = np.pad(cur, ((1, 1), (0, 0)), mode="edge")[1 + step:th + 1 + step]
                else:
                    shifted = np.roll(lab, -step, axis=axis)
                    cshift = np.roll(cur, -step, axis=axis)
                same &= (shifted == lab) & cshift
        cur = same

    hs = np.array([0.0] + [base + st["height"] * rng + (raised if st["height"] > RAISED_THRESHOLD else 0.0)
                           for st in stones])
    txs = np.array([0.0] + [st["tilt"][0] for st in stones])
    tys = np.array([0.0] + [st["tilt"][1] for st in stones])
    cxs = np.array([0.0] + [st["center"][0] for st in stones])
    cys = np.array([0.0] + [st["center"][1] for st in stones])
    yy, xx = np.mgrid[0:th, 0:tw].astype(float) + 0.5
    dx = (xx - cxs[lab] + tw / 2) % tw - tw / 2
    dy = (yy - cys[lab] + th / 2) % th - th / 2 if wrap_y else yy - cys[lab]
    top = hs[lab] - (dx * txs[lab] + tilt_sign_y * dy * tys[lab]) / PX_PER_M * MAX_SLOPE
    top = np.maximum(base * 0.5, top)
    # Quina arredondada: sobe rápido na borda e assenta no topo.
    t = np.clip(edge / (BEVEL_PX + 1.0), 0.0, 1.0)
    profile = 1.0 - (1.0 - t) ** 2
    height = np.where(lab > 0, top * profile, 0.0)
    inner = edge > BEVEL_PX
    tilt_x = np.where(inner, txs[lab], 0.0)
    tilt_y = np.where(inner, tilt_sign_y * tys[lab], 0.0)
    return height, tilt_x, tilt_y, edge


@lru_cache(maxsize=2)
def floor_height(project: str) -> np.ndarray:
    lay = _layout(Path(project), FLOOR_LAYOUT)
    # No chão, a pedra desce na direção da inclinação nos dois eixos da textura (y = +Z).
    return _height_field(lay, FLOOR_GROOVE, FLOOR_RANGE, FLOOR_RAISED, wrap_y=True, tilt_sign_y=1.0)


@lru_cache(maxsize=2)
def wall_height(project: str) -> np.ndarray:
    lay = _layout(Path(project), WALL_LAYOUT)
    # Na parede o y da textura cresce para baixo; em px do tile o sinal fica igual ao do chão.
    return _height_field(lay, WALL_BASE, WALL_RANGE, WALL_RAISED, wrap_y=False, tilt_sign_y=1.0)


def tile_slopes(field, wrap_y: bool):
    """Inclinações (m/m) do normal map ao longo de +x e +y da imagem do tile, já quantizadas.

    Soma a quina chanfrada (derivada da altura) e a inclinação própria de cada pedra."""
    height, tilt_x, tilt_y, _edge = field
    hx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5 * PX_PER_M
    if wrap_y:
        hy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5 * PX_PER_M
    else:
        p = np.pad(height, ((1, 1), (0, 0)), mode="edge")
        hy = (p[2:] - p[:-2]) * 0.5 * PX_PER_M
    # A pedra desce no lado do tilt, igual à malha antiga (h - d . tilt).
    sx = np.round(tilt_x * STONE_TILT / TILT_STEPS) * TILT_STEPS
    sy = np.round(tilt_y * STONE_TILT / TILT_STEPS) * TILT_STEPS
    return quantize(hx) - sx, quantize(hy) - sy


def quantize(v: np.ndarray) -> np.ndarray:
    v = np.clip(v, -MAX_TS_SLOPE, MAX_TS_SLOPE)
    return np.round(v / SLOPE_STEPS) * SLOPE_STEPS


def _face_frame(rows):
    """Quadro tangente da face a partir da UV: T = d(pos)/d(u), B = -d(pos)/d(v) (cima na imagem)."""
    pos = np.asarray(rows.model_position, dtype=float)
    a = np.column_stack([np.asarray(rows.x, dtype=float), np.asarray(rows.y, dtype=float), np.ones(len(pos))])
    coef, *_ = np.linalg.lstsq(a, pos, rcond=None)
    t = coef[0] / np.linalg.norm(coef[0])
    b = -coef[1] / np.linalg.norm(coef[1])
    n = np.asarray(rows.model_normal, dtype=float)[0]
    n = n / np.linalg.norm(n)
    return t, b, n


def encode_normals(world: np.ndarray, rows) -> np.ndarray:
    """Normais no espaço do modelo (N, 3) -> RGBA 0-255 no espaço tangente da face."""
    t, b, n = _face_frame(rows)
    ts = np.column_stack([world @ t, world @ b, world @ n])
    ts /= np.linalg.norm(ts, axis=1, keepdims=True)
    rgb = np.clip(np.round((ts * 0.5 + 0.5) * 255.0), 0, 255)
    return np.column_stack([rgb, np.full(len(rgb), 255.0)])


# ---------------------------------------------------------------- chão
FLOOR_MODULE_PX = 256
FLOOR_HALF = FLOOR_MODULE_PX / PX_PER_UNIT / 2      # 16 unidades


def build_flat_floor(builder, mi: int, mj: int):
    """Chão de 2 x 2 m num quad só, no plano y = 0 (o topo da colisão das salas)."""
    from lib import MeshDraft

    d = MeshDraft(closed=False)
    h = FLOOR_HALF
    for i, (x, z) in enumerate([(-h, -h), (h, -h), (h, h), (-h, h)]):
        d.vertex(f"v{i}", (x, 0.0, z))
    d.face("top", ["v0", "v3", "v2", "v1"], group="floor")
    d.anchor("base", (0.0, 0.0, 0.0))
    builder.add_mesh("floor", "root", d, pivot="base", no_overlap_check=True)
    return builder


def _floor_tile_px(rows, mi, mj, tw, th):
    pos = np.asarray(rows.model_position, dtype=float)
    px = np.floor((pos[:, 0] + FLOOR_HALF) * PX_PER_UNIT + mi * FLOOR_MODULE_PX).astype(int) % tw
    py = np.floor((pos[:, 2] + FLOOR_HALF) * PX_PER_UNIT + mj * FLOOR_MODULE_PX).astype(int) % th
    return px, py


def paint_flat_floor_normal(painter, mi: int, mj: int, project: Path):
    qx, qy = tile_slopes(floor_height(str(project)), wrap_y=True)
    th, tw = qx.shape

    def sample(rows):
        px, py = _floor_tile_px(rows, mi, mj, tw, th)
        # Imagem x = +X do modelo, imagem y = +Z, para cima = +Y.
        world = np.column_stack([-qx[py, px], np.ones(len(px)), -qy[py, px]])
        world /= np.linalg.norm(world, axis=1, keepdims=True)
        return encode_normals(world, rows)

    for element in painter.all_elements():
        element.paint_surface_arrays(sample)


def paint_flat_floor_height(painter, mi: int, mj: int, project: Path):
    h = floor_height(str(project))[0]
    th, tw = h.shape

    def sample(rows):
        px, py = _floor_tile_px(rows, mi, mj, tw, th)
        g = np.clip(h[py, px] / 0.06 * 255.0, 0, 255)
        return np.column_stack([g, g, g, np.full(len(g), 255.0)])

    for element in painter.all_elements():
        element.paint_surface_arrays(sample)


# ---------------------------------------------------------------- parede 2 x 4 m
WALL_MODULE_PX = 256
WALL_HALF = WALL_MODULE_PX / PX_PER_UNIT / 2        # 16 unidades
WALL_HEIGHT_PX = 512
WALL_HEIGHT = WALL_HEIGHT_PX / PX_PER_UNIT          # 64 unidades
# A face plana fica na saliência média dos blocos de antes (~4 cm), para tochas e ganchos
# encostados na parede antiga continuarem encostados.
WALL_FACE_Z = (WALL_BASE + WALL_RANGE * 0.5) * U_PER_M


def build_flat_wall(builder, mi: int):
    from lib import MeshDraft

    d = MeshDraft(closed=False)
    h = WALL_HALF
    for i, (x, y) in enumerate([(-h, 0.0), (h, 0.0), (h, WALL_HEIGHT), (-h, WALL_HEIGHT)]):
        d.vertex(f"v{i}", (x, y, WALL_FACE_Z))
    d.face("front", ["v0", "v1", "v2", "v3"], group="wall")
    d.anchor("base", (0.0, 0.0, 0.0))
    builder.add_mesh("wall", "root", d, pivot="base", no_overlap_check=True)
    return builder


def _wall_tile_px(rows, mi, tw, th):
    pos = np.asarray(rows.model_position, dtype=float)
    px = np.floor((pos[:, 0] + WALL_HALF) * PX_PER_UNIT + mi * WALL_MODULE_PX).astype(int) % tw
    py = np.clip(np.floor(WALL_HEIGHT_PX - pos[:, 1] * PX_PER_UNIT).astype(int), 0, th - 1)
    return px, py


def paint_flat_wall_normal(painter, mi: int, project: Path):
    qx, qy = tile_slopes(wall_height(str(project)), wrap_y=False)
    th, tw = qx.shape

    def sample(rows):
        px, py = _wall_tile_px(rows, mi, tw, th)
        # Imagem x = +X, imagem y = -Y (para baixo), para fora = +Z.
        world = np.column_stack([-qx[py, px], qy[py, px], np.ones(len(px))])
        world /= np.linalg.norm(world, axis=1, keepdims=True)
        return encode_normals(world, rows)

    for element in painter.all_elements():
        element.paint_surface_arrays(sample)


def paint_flat_wall_albedo(painter, mi: int, project: Path):
    from PIL import Image

    img = np.asarray(Image.open(Path(project) / "references" / "env_wall_stone_block_01.png").convert("RGBA"))
    th, tw = img.shape[:2]

    def sample(rows):
        px, py = _wall_tile_px(rows, mi, tw, th)
        return img[py, px].astype(np.uint8)

    for element in painter.all_elements():
        element.paint_surface_arrays(sample)


# ---------------------------------------------------------------- alvenaria da Galeria
# Paredes 2 x 2 e 2 x 4 com recorte (brechas, porta), nicho do pêndulo e laje da placa.
# O recorte e a espessura continuam na malha; só as pedras saem da geometria.
MASONRY_FACE = WALL_BASE + WALL_RANGE * 0.5     # metros: face plana na saliência média
FLAT_NORMAL = np.array([128.0, 128.0, 255.0, 255.0])


def build_flat_masonry(asset: str, project: Path):
    from lib import ModelBuilder
    from cleaners_lib import gallery_masonry as gm
    from cleaners_lib.arch_kit import add_block, box_block
    from cleaners_lib.floor_module import _dedupe

    builder = ModelBuilder(asset, modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("root")
    if asset == "env_wall_pendulum_recess_4x4":
        regions = [
            (-2, 0, 2, 2.80, 0), (-2, 3.68, 2, 4, 0), (-2, 2.80, -.17, 3.68, 0),
            (.17, 2.80, 2, 3.68, 0), (-.17, 2.80, .17, 3.68, -.26),
        ]
        for i, (left, bottom, right, top, front) in enumerate(regions):
            outline = [(left, bottom), (right, bottom), (right, top), (left, top)]
            gm.prism(builder, f"joint_{i}", outline, front + MASONRY_FACE, back=-.42)
    elif asset.startswith("env_wall"):
        for i, (bottom, top, edge) in enumerate(gm.wall_regions(asset)):
            joint = [(-1, bottom), (1, bottom), (1, top), (-1, top)]
            if edge:
                joint = gm.clip_edge(joint, *edge)
            gm.prism(builder, f"joint_{i}", _dedupe(joint, eps=.001), MASONRY_FACE, back=-.42)
        if "doorway" in asset:
            for name, (center, half) in gm.DOOR_TRIM.items():
                center = (center[0], center[1], center[2] + MASONRY_FACE)
                add_block(builder, box_block(name, center, half))
    elif asset == "env_floor_stone_2x2_plate_socket":
        from lib import MeshDraft
        ring = [(0, 0, 96, 256), (160, 0, 256, 256), (96, 0, 160, 96), (96, 160, 160, 256)]
        d = MeshDraft(closed=False)
        for j, (x0, z0, x1, z1) in enumerate(ring):
            for i, (x, z) in enumerate(((x0, z0), (x0, z1), (x1, z1), (x1, z0))):
                d.vertex(f"g{j}_{i}", ((x - 128) / 8, 0.0, (z - 128) / 8))
            d.face(f"g{j}", [f"g{j}_{i}" for i in range(4)])
        d.anchor("base", (0, 0, 0))
        builder.add_mesh("floor", "root", d, pivot="base", no_overlap_check=True)
    else:
        raise ValueError(f"{asset} não é peça de alvenaria plana")
    return builder


def paint_flat_masonry_normal(painter, asset: str, project: Path):
    if asset.startswith("env_floor"):
        paint_flat_floor_normal(painter, 0, 0, project)
        return
    qx, qy = tile_slopes(wall_height(str(project)), wrap_y=False)
    th, tw = qx.shape
    recess = asset == "env_wall_pendulum_recess_4x4"
    x0 = 0 if asset.endswith(("_x0", "_l")) else 256

    def sample(rows, name):
        n = len(rows.x)
        out = np.tile(FLAT_NORMAL, (n, 1))
        if not name.startswith("joint"):
            return out
        normals = np.asarray(rows.model_normal, dtype=float)
        front = normals[:, 2] > 0.86
        if not front.any():
            return out
        xyz = np.asarray(rows.model_position, dtype=float) / U_PER_M
        x, y = xyz[:, 0], xyz[:, 1]
        px = np.floor((x + 2) * PX_PER_M if recess else (x + 1) * PX_PER_M + x0).astype(int) % tw
        py = np.clip(np.floor(WALL_HEIGHT_PX - y * PX_PER_M).astype(int), 0, th - 1)
        world = np.column_stack([-qx[py, px], qy[py, px], np.ones(n)])
        world /= np.linalg.norm(world, axis=1, keepdims=True)
        enc = encode_normals(world, rows)
        out[front] = enc[front]
        return out

    from functools import partial
    for element in painter.all_elements():
        element.paint_surface_arrays(partial(sample, name=element.name))


# ---------------------------------------------------------------- oclusão (AO) e altura
AO_GROOVE = 0.45            # luz ambiente que chega no fundo do sulco
AO_LEVELS = 6               # degraus de cinza, para o AO seguir os pixels


def ao_tile(field) -> np.ndarray:
    _h, _tx, _ty, edge = field
    t = np.clip(edge / (BEVEL_PX + 1.0), 0.0, 1.0)
    ao = AO_GROOVE + (1.0 - AO_GROOVE) * (1.0 - (1.0 - t) ** 2)
    return np.round(ao * (AO_LEVELS - 1)) / (AO_LEVELS - 1)


def _gray(values):
    g = np.clip(np.round(values * 255.0), 0, 255)
    return np.column_stack([g, g, g, np.full(len(g), 255.0)])


def paint_flat_floor_ao(painter, mi: int, mj: int, project: Path):
    ao = ao_tile(floor_height(str(project)))
    th, tw = ao.shape

    def sample(rows):
        px, py = _floor_tile_px(rows, mi, mj, tw, th)
        return _gray(ao[py, px])

    for element in painter.all_elements():
        element.paint_surface_arrays(sample)


def paint_flat_wall_ao(painter, mi: int, project: Path):
    ao = ao_tile(wall_height(str(project)))
    th, tw = ao.shape

    def sample(rows):
        px, py = _wall_tile_px(rows, mi, tw, th)
        return _gray(ao[py, px])

    for element in painter.all_elements():
        element.paint_surface_arrays(sample)


def paint_flat_wall_height(painter, mi: int, project: Path):
    h = wall_height(str(project))[0]
    th, tw = h.shape

    def sample(rows):
        px, py = _wall_tile_px(rows, mi, tw, th)
        return _gray(h[py, px] / 0.08)

    for element in painter.all_elements():
        element.paint_surface_arrays(sample)


def paint_flat_masonry_ao(painter, asset: str, project: Path):
    if asset.startswith("env_floor"):
        paint_flat_floor_ao(painter, 0, 0, project)
        return
    ao = ao_tile(wall_height(str(project)))
    th, tw = ao.shape
    recess = asset == "env_wall_pendulum_recess_4x4"
    x0 = 0 if asset.endswith(("_x0", "_l")) else 256

    def sample(rows, name):
        n = len(rows.x)
        out = np.ones(n)
        if name.startswith("joint"):
            normals = np.asarray(rows.model_normal, dtype=float)
            front = normals[:, 2] > 0.86
            if front.any():
                xyz = np.asarray(rows.model_position, dtype=float) / U_PER_M
                x, y = xyz[:, 0], xyz[:, 1]
                px = np.floor((x + 2) * PX_PER_M if recess else (x + 1) * PX_PER_M + x0).astype(int) % tw
                py = np.clip(np.floor(WALL_HEIGHT_PX - y * PX_PER_M).astype(int), 0, th - 1)
                out[front] = ao[py, px][front]
        return _gray(out)

    from functools import partial
    for element in painter.all_elements():
        element.paint_surface_arrays(partial(sample, name=element.name))
