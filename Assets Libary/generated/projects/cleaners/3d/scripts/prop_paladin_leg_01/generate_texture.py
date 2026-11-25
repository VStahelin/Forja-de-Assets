"""Pixel-art texture authoring recipe for prop_paladin_leg_01."""
from __future__ import annotations

import json
from pathlib import Path
import sys

import numpy as np

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from Tools.TexturePainter import TexturePainter
from Tools.recipe_context import recipe_paths


def paint():
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.paladin import COURO, MADEIRA, OSSO, PEDRA, SANGUE
    from cleaners_lib.stone_paint import fbm, pick, texel_xy

    steel, leather, bone, blood = [
        np.array([tuple(bytes.fromhex(color[1:])) for color in ramp], dtype=np.uint8)
        for ramp in (PEDRA, MADEIRA, ["#8f826b", *OSSO], ["#33070c", *SANGUE])
    ]
    flesh_light = tuple(bytes.fromhex(COURO[-1][1:]))

    model = json.loads(paths.model.read_text(encoding="utf-8"))
    thigh = next(element for element in model["elements"] if element["name"] == "cuisse_L")
    cap_faces = [face for key, face in thigh["faces"].items() if key.startswith("cap_start_")]
    cap_keys = sorted({key for face in cap_faces for key in face["vertices"]})
    cap_points = (np.array([thigh["vertices"][key] for key in cap_keys]) + thigh["origin"]) / 16
    center = cap_points.mean(axis=0)
    triangle = (np.array([thigh["vertices"][key] for key in cap_faces[0]["vertices"]]) + thigh["origin"]) / 16
    cut_normal = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])
    cut_normal /= np.linalg.norm(cut_normal)
    cut_normal *= np.sign(cut_normal[1])

    def cut_surface(points, x, y, distance):
        grain = fbm(points, 0.027, 2, 73)
        colors = pick(blood, 0.48 + grain * 0.50, x, y)
        colors[(grain > 0.70) & (distance < 0.079)] = flesh_light
        colors[distance > 0.082 + 0.012 * grain] = blood[0]
        # A slightly off-center oval reads as a bone cross-section at native resolution.
        bone_radius = np.hypot((points[:, 0] - center[0] + 0.010) * 1.22, points[:, 2] - center[2] + 0.008)
        colors[bone_radius < 0.037] = blood[0]
        bone_edge = bone_radius < 0.030 + 0.006 * grain
        colors[bone_edge] = pick(bone, 0.46 + grain[bone_edge] * 0.45, x[bone_edge], y[bone_edge])
        colors[bone_radius < 0.010] = bone[0]
        return colors

    def armor(rows, name):
        x, y = texel_xy(rows, len(rows.x))
        points = np.asarray(rows.model_position) / 16
        normals = np.asarray(rows.model_normal)
        wear = fbm(points, 0.045, 2, 41)
        facing = normals @ np.array([0.35, 0.42, 0.55])
        tones = np.select(
            [facing < -0.43, facing < -0.12, facing < 0.35, facing < 0.58],
            [0.4, 1.0, 2.0, 2.8],
            default=3.4,
        )
        colors = pick(steel, tones / 4, x, y)
        colors[(wear > 0.69) & (normals[:, 1] > -0.2)] = steel[-1]
        if name == "cuisse_L":
            strap = np.abs(points[:, 1] - 0.70) < 0.025
            colors[strap] = pick(leather, 0.5 + facing[strap], x[strap], y[strap])
            offset = points - center
            if rows.face_name.startswith("cap_start_"):
                colors = cut_surface(points, x, y, np.linalg.norm(offset, axis=1))
            else:
                depth = -(offset @ cut_normal)
                rim = (depth >= 0) & (depth < 0.015 + 0.048 * wear) & (wear > 0.31)
                colors[rim] = pick(blood, wear[rim], x[rim], y[rim])
        return np.column_stack((colors, np.full(len(colors), 255, dtype=np.uint8)))

    painter = TexturePainter.from_bbmodel(paths.model)
    for element in painter.all_elements():
        element.paint_surface_arrays(lambda rows, name=element.name: armor(rows, name))
    painter.save(paths.texture, edge_dilation=1)
    print(f"[texture] Saved to {paths.texture}")


if __name__ == "__main__":
    paint()
