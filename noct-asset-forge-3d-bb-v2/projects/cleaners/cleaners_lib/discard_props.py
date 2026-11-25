"""Deriva os props dos modelos de paladino e esqueleto do Cleaners."""
from __future__ import annotations

from collections import Counter
import json

import numpy as np

from lib.geometry_types import MeshDraft
from lib.model_builder import ModelBuilder

from cleaners_lib.paladin import COURO, MADEIRA, PEDRA, SANGUE
from cleaners_lib.skeleton import ABISMO, OSSO
from cleaners_lib.stone_paint import _rgb, fbm, pick, texel_xy


SOURCE_NAMES = {
    "prop_paladin_arm_01": ("char_adventurer_paladin_01", (
        "arm_cloth_L", "rerebrace_L", "couter_L", "vambrace_L", "cuff_L",
        "palm_L", "fingers_L", "thumb_L",
    )),
    "prop_skull_01": ("char_skeleton_01", ("skull", "jaw")),
    "prop_long_bone_01": ("char_skeleton_01", ("femur_L", "hip_L", "knee_L")),
    "prop_dented_helm_01": ("char_adventurer_paladin_01", ("helm", "helm_brow", "helm_nose")),
    "prop_cracked_shield_01": ("char_adventurer_paladin_01", ("shield",)),
}


def _reshape(asset_id, component, point):
    x, y, z = np.asarray(point) / 16.0
    if asset_id == "prop_cracked_shield_01":
        x, z = -z, x
        if x > -0.005 and y > 1.13:
            x -= 0.023
            y -= 0.027
            z -= 0.005
    elif asset_id == "prop_dented_helm_01" and component == "helm":
        distance = ((x - 0.09) / 0.092) ** 2 + ((y - 1.688) / 0.12) ** 2
        dent = 0.044 * max(0.0, 1.0 - distance)
        if z > 0.02:
            z -= dent
            y -= dent * 0.35
    return np.array((x, y, z)) * 16.0


def _edges(face):
    return tuple(zip(face, face[1:] + face[:1]))


def _close_cuff(faces):
    incidence = Counter(tuple(sorted(edge)) for face in faces.values() for edge in _edges(face))
    border = {a: b for face in faces.values() for b, a in _edges(face) if incidence[tuple(sorted((a, b)))] == 1}
    if not border:
        return
    first = next(iter(border))
    ring = [first]
    while border[ring[-1]] != first:
        ring.append(border[ring[-1]])
    if len(ring) != len(border):
        raise ValueError("Expected one open cap on the gauntlet cuff")
    faces["discard_cap"] = tuple(ring)


def build(paths, asset_id):
    source, names = SOURCE_NAMES[asset_id]
    source_model = paths.project / "assets" / source / "model.bbmodel"
    elements = {element["name"]: element for element in json.loads(
        source_model.read_text(encoding="utf-8")
    )["elements"]}
    parts = {}
    for name in names:
        part = elements[name]
        if any(part.get("rotation", (0, 0, 0))):
            raise ValueError(f"{name}: expected geometry in the unrotated bind pose")
        parts[name] = {
            key: _reshape(asset_id, name, np.asarray(point) + part["origin"])
            for key, point in part["vertices"].items()
        }
    points = np.array([point for part in parts.values() for point in part.values()])
    low, high = points.min(axis=0), points.max(axis=0)
    pivot = (low + high) * 0.5
    pivot[1] = low[1]

    builder = ModelBuilder(asset_id, modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("root")
    for name, points in parts.items():
        draft = MeshDraft(closed=True)
        for key, point in points.items():
            draft.vertex(key, tuple(point - pivot))
        draft.anchor("center", tuple((min(axis) + max(axis)) * 0.5 for axis in zip(*draft.vertices.values())))
        faces = {key: tuple(face["vertices"]) for key, face in elements[name]["faces"].items()}
        if name == "cuff_L":
            _close_cuff(faces)
        for key, face in faces.items():
            for i in range(1, len(face) - 1):
                draft.face(f"{key}_{i}", (face[0], face[i], face[i + 1]))
        builder.add_mesh(name, "root", draft, pivot="center", allow_triangles=True, no_overlap_check=True)
    return builder


def _distance(x, y, start, end):
    dx, dy = np.subtract(end, start)
    fraction = np.clip(((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(x - start[0] - fraction * dx, y - start[1] - fraction * dy)


def paint(painter, asset_id):
    steel, leather, wood, bone, blood = map(
        _rgb, (PEDRA, COURO, MADEIRA, OSSO, ["#33070c", *SANGUE])
    )
    abyss = _rgb([ABISMO, "#0d1018"])
    iron = _rgb(["#16181d", "#262a31", "#3c414b", "#5e6470", "#9aa1ad"])

    def surface(rows, name):
        px, py = texel_xy(rows, len(rows.x))
        point = np.asarray(rows.model_position) / 16
        normal = np.asarray(rows.model_normal)
        x, y, z = point.T
        front = normal[:, 2] > 0.28
        variation = fbm(point, 0.033, 2, 25)
        facing = normal @ np.array([0.30, 0.61, 0.44])

        if asset_id in ("prop_skull_01", "prop_long_bone_01"):
            tone = 0.50 + 0.50 * facing + (variation - 0.45) * 0.92
            colors = pick(bone, tone, px, py)
            dust = (variation < 0.33) & (facing < 0.23)
            colors[dust] = pick(wood, variation[dust] * 2.8, px[dust], py[dust])
            if name == "skull":
                socket = np.minimum(np.hypot((x - 0.045) / 1.14, y - 0.219),
                                    np.hypot((x + 0.045) / 1.14, y - 0.219))
                colors[front & (socket < 0.035)] = bone[0]
                colors[front & (socket < 0.028)] = abyss[0]
                nose = front & (y > 0.145) & (y < 0.194) & (np.abs(x) < (y - 0.145) * 0.40 + 0.005)
                colors[nose] = abyss[1]
            teeth = front & (np.abs(x) < 0.051) & (
                ((y > 0.080) & (y < 0.109)) if name == "skull" else (y > 0.041) if name == "jaw" else False
            )
            colors[teeth] = np.where((px[teeth] % 3 == 0)[:, None], bone[1], bone[-1])
            return colors

        shade = 0.39 + 0.49 * facing + (variation - 0.50) * 0.73
        colors = pick(steel, shade, px, py)
        if name.startswith(("palm_", "fingers_", "thumb_", "arm_cloth_")):
            colors = pick(leather, 0.40 + 0.40 * facing + (variation - 0.48) * 0.81, px, py)
        if name == "arm_cloth_L":
            cut = rows.face_name.startswith("cap_start_")
            if cut:
                colors = pick(blood, 0.42 + 0.75 * variation, px, py)
                marrow = np.hypot(x + 0.128, z * 1.22) < 0.028
                colors[marrow] = pick(bone, 0.45 + 0.58 * variation[marrow], px[marrow], py[marrow])
            else:
                stained = (y > 0.613 + 0.04 * variation) & (variation > 0.31)
                colors[stained] = pick(blood, variation[stained], px[stained], py[stained])

        if asset_id == "prop_dented_helm_01":
            if name == "helm":
                visor = front & (np.abs(x) < 0.096) & (np.abs(y - 0.171 + 0.08 * x) < 0.013)
                colors[visor] = abyss[0]
                scrape = front & (x > 0.025) & (np.abs(y - 0.238 - 0.31 * x) < 0.009)
                colors[scrape] = iron[4]
                lower_band = (y < 0.036) & ~visor
                colors[lower_band] = pick(iron, 0.31 + 0.6 * facing[lower_band], px[lower_band], py[lower_band])
            else:
                colors = pick(iron, shade, px, py)

        if asset_id == "prop_cracked_shield_01":
            panel = np.abs(normal[:, 2]) > 0.66
            bevel = (np.abs(x) > 0.178) | (y > 0.687) | (y < 0.068 + 1.74 * np.abs(x))
            timber = panel & ~bevel
            plank = (x + 0.24) % 0.086
            colors[timber] = pick(wood, 0.53 + (variation[timber] - 0.47) * 1.0, px[timber], py[timber])
            colors[timber & (plank < 0.009)] = wood[0]
            badge = front & ~bevel & (np.abs(x) + np.abs(y - 0.46) * 0.84 < 0.081)
            colors[badge] = steel[-2]
            segments = (
                ((0.222, 0.665), (0.093, 0.579)),
                ((0.093, 0.579), (0.119, 0.497)),
                ((0.119, 0.497), (0.012, 0.359)),
                ((0.119, 0.497), (0.166, 0.402)),
                ((0.012, 0.359), (0.027, 0.290)),
            )
            crack = np.minimum.reduce([_distance(x, y, start, end) for start, end in segments])
            colors[front & (crack < 0.012)] = steel[-1]
            colors[front & (crack < 0.0070)] = abyss[0]
        return colors

    for part in painter.all_elements():
        part.paint_surface_arrays(lambda rows, name=part.name: surface(rows, name))
