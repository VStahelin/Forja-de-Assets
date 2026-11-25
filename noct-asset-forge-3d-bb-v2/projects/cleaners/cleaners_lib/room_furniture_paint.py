"""Materiais de madeira antiga e estanho para o lote de mobiliário."""
from __future__ import annotations

import numpy as np

from .props import FERRO, MADEIRA, PX, U, _hash1, pick_clean
from .stone_paint import _rgb, fbm, texel_xy


def paint(painter, is_pewter):
    wood = _rgb(MADEIRA)
    iron = _rgb(FERRO)
    pewter = _rgb(("#1a202b", "#283041", "#3b4558", "#5a6577", "#8590a0"))

    def surface(rows, name):
        px, py = texel_xy(rows, len(rows.x))
        points = np.asarray(rows.model_position, float) / U
        normals = np.asarray(rows.model_normal, float)
        x, y, z = points.T

        if is_pewter:
            noise = fbm(points, 0.024, 3, 41)
            shoulder = y > 0.102
            rim_edge = (y > 0.105) & (normals[:, 1] > 0.4)
            foot = y < 0.016
            inside = (x * normals[:, 0] + z * normals[:, 2] < -0.005)
            seam = (np.abs(y - 0.037) * PX < 0.85) | (np.abs(y - 0.024) * PX < 0.65)
            tone = np.where(inside, 0.7, 2.35) + (noise - 0.47) * 3.4
            tone = np.where(shoulder, tone + 0.55, tone)
            tone = np.where(foot, tone - 0.50, tone)
            base = pick_clean(pewter, tone, px, py)
            metal_tone = np.where(rim_edge, 4.0, np.where(seam, 0.3, 1.5 + 1.8 * noise))
            return np.where((rim_edge | seam | (name == "loop_handle"))[:, None],
                            pick_clean(iron, metal_tone, px, py), base)

        vertical = name.startswith(("leg_", "corner_"))
        along = y if vertical else np.where(np.abs(normals[:, 0]) > 0.6, z, x)
        across = x + z if vertical else np.where(np.abs(normals[:, 1]) > 0.5, z, y)
        grain_points = np.column_stack((along * 0.17, across * 3.1, x * 0.05 + z * 0.10))
        grain = fbm(grain_points, 0.024, 3, 23)
        swatch = float(_hash1(sum((index + 1) * ord(char) for index, char in enumerate(name)), 7))
        cut_end = np.abs(normals[:, 1 if vertical else 0]) > 0.75
        shade = 2.4 + (swatch - 0.48) * 1.7 + (grain - 0.50) * 3.0
        shade += np.where(normals[:, 1] > 0.55, 0.54, 0.0)
        shade = np.where(normals[:, 1] < -0.55, shade - 1.3, shade)
        shade = np.where(cut_end, shade + 0.52, shade)
        torn = name.startswith(("front_splinter_", "split_wood"))
        if torn:
            sharp = (np.abs(normals[:, 0]) > 0.44) & (np.abs(normals[:, 1]) < 0.6)
            shade = np.where(sharp, 3.25 + (grain - 0.4) * 2.5, shade)
        knot = (np.abs(across - 0.021) * PX < 3.1) & (np.abs(along - 0.13) * PX < 5.3)
        shade = np.where(knot & (grain > 0.45), shade - 1.45, shade)
        color = pick_clean(wood, shade, px, py)

        # Pregos de três tons, com metal na cabeça e uma marca curta de oclusão.
        nail_col = np.abs(along - np.sign(along) * (
            0.591 if name.startswith("seat_plank") else
            0.22 if name in ("split_wood", "front_bottom_board") else 0.211
        )) * PX
        nail_row = np.abs((across + 0.045) % 0.096 - 0.048) * PX
        pin = (nail_col < 2.4) & (nail_row < 2.4) & (np.abs(normals[:, 1]) > 0.55 if
            name.startswith(("seat_plank", "split_wood")) else np.abs(normals[:, 1]) < 0.55)
        nail_tone = np.where(nail_row + nail_col < 1.35, 4.0, np.where(nail_row < 1.6, 2.0, 0.0))
        return np.where(pin[:, None], pick_clean(iron, nail_tone, px, py), color)

    for part in painter.all_elements():
        part.paint_surface_arrays(lambda rows, name=part.name: surface(rows, name))
