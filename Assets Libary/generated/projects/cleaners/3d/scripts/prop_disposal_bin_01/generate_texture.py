"""Tábuas e aros com a paleta do barril da sala."""
from __future__ import annotations

from pathlib import Path
import sys

import numpy as np

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from Tools.TexturePainter import TexturePainter
from Tools.recipe_context import recipe_paths


def paint():
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.props import FERRO, MADEIRA, PX, U, _hash1, pick_clean
    from cleaners_lib.stone_paint import _rgb, fbm, texel_xy

    wood, iron = _rgb(MADEIRA), _rgb(FERRO)

    def surface(rows, name):
        px, py = texel_xy(rows, len(rows.x))
        points = np.asarray(rows.model_position) / U
        normals = np.asarray(rows.model_normal)
        x, y, z = points.T
        grain = fbm(points * np.array([0.35, 2.0, 0.35]), 0.045, 2, 19)
        if "rim" in name:
            along = z if name.startswith("short") else x
            rivet = (np.abs((along + 0.088) % 0.176 - 0.088) * PX < 1.4) & (np.abs(y - 0.71875) * PX < 1.5)
            edge = np.abs(normals[:, 1]) > 0.5
            tone = np.where(rivet, 4.0, np.where(edge, 2.9, 1.55) + (grain - 0.45) * 0.8)
            return pick_clean(iron, tone, px, py)

        plank_axis = x if name == "floor" else y
        plank = np.floor((plank_axis + 0.75) / 0.154).astype(int)
        seam = np.abs((plank_axis + 0.75 + 0.077) % 0.154 - 0.077) * PX < 1.0
        shade = 2.1 + (_hash1(plank, 23) - 0.5) * 2.15 + (grain - 0.5) * 1.45
        interior = (x * normals[:, 0] + z * normals[:, 2] < -0.1) | (name == "floor")
        shade = np.where(interior, shade - 0.72, shade)
        if name.startswith("post"):
            edge = np.abs(normals[:, 0]) > 0.5
            shade = np.where(edge, 3.0, 3.65) + (grain - 0.45) * 0.8
        else:
            shade = np.where(seam, 0.0, shade)
        return pick_clean(wood, shade, px, py)

    painter = TexturePainter.from_bbmodel(paths.model)
    for part in painter.all_elements():
        part.paint_surface_arrays(lambda rows, name=part.name: surface(rows, name))
    painter.save(paths.texture, edge_dilation=1)


if __name__ == "__main__":
    paint()
