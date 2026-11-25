"""Pixel-art texture authoring recipe for tool_mop_01."""
from __future__ import annotations

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
    from cleaners_lib.paladin import COURO, OSSO
    from cleaners_lib.props import FERRO, MADEIRA, U, pick_clean
    from cleaners_lib.stone_paint import fbm, texel_xy

    wood, iron, leather, canvas = [
        np.array([tuple(bytes.fromhex(color[1:])) for color in ramp], dtype=np.uint8)
        for ramp in (MADEIRA[:4], FERRO[:4], COURO[:3], ["#3d362e", "#615647", "#8f826b", *OSSO])
    ]

    def surface(rows, name):
        x, y = texel_xy(rows, len(rows.x))
        points = np.asarray(rows.model_position) / U
        normals = np.asarray(rows.model_normal)
        shade = (normals @ np.array([0.45, 0.52, 0.48])) * 1.35
        if name == "shaft":
            grain = fbm(points * np.array([2.6, 0.08, 2.6]), 0.025, 2, 9)
            colors = pick_clean(wood, 1.20 + shade + (grain - 0.45) * 2, x, y)
        elif name == "ferrule":
            edges = (points[:, 1] < 0.155) | (points[:, 1] > 0.211)
            colors = pick_clean(iron, 1.6 + shade + edges * 0.65, x, y)
        elif name == "grip" or name == "binding":
            wraps = (points[:, 1] + 0.33 * points[:, 0]) % 0.025 < 0.006
            colors = pick_clean(leather, 1.25 + shade - wraps * 0.9, x, y)
        else:
            weave = fbm(points * np.array([1.0, 0.35, 1.0]), 0.035, 2, 17)
            tip = np.clip((0.068 - points[:, 1]) * 13, 0, 0.85)
            colors = pick_clean(canvas, 2.65 + shade + (weave - 0.5) * 1.6 - tip, x, y)
        return np.column_stack((colors, np.full(len(colors), 255, dtype=np.uint8)))

    painter = TexturePainter.from_bbmodel(paths.model)
    for part in painter.all_elements():
        part.paint_surface_arrays(lambda rows, name=part.name: surface(rows, name))
    painter.save(paths.texture, edge_dilation=1)
    print(f"[texture] Saved to {paths.texture}")


if __name__ == "__main__":
    paint()
