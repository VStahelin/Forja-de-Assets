"""Albedo da cabine e da folha sanfonada, em coordenadas do modelo."""
from __future__ import annotations

import numpy as np

from cleaners_lib.props import FERRO, FERRUGEM, MADEIRA, PX, U, _hash1, pick_clean
from cleaners_lib.stone_paint import _rgb, fbm, texel_xy


def paint(painter, *, is_gate: bool):
    iron, wood, rust = _rgb(FERRO), _rgb(MADEIRA), _rgb(FERRUGEM)

    def surface(rows, name):
        px, py = texel_xy(rows, len(rows.x))
        points = np.asarray(rows.model_position) / U
        normals = np.asarray(rows.model_normal)
        x, y, z = points.T
        iron_part = is_gate or name.startswith("gate_") or "strap" in name
        direction = normals @ np.array([0.22, 0.40, 0.13])
        noise = fbm(points, 0.11, 2, 31)

        if name == "threshold":
            front_edge = (1.875 - z) * PX < 2.0
            rear_edge = (z - 1.5) * PX < 2.0
            flat = normals[:, 1] > 0.5
            rivet = (np.abs(x % 0.3125 - 0.15625) * PX < 1.4) & (np.abs(z - 1.58) * PX < 1.4)
            tone = 1.55 + direction + (noise - 0.48) * 0.65
            tone = np.where(flat & front_edge, 3.05, np.where(flat & rear_edge, 0.55, tone))
            return pick_clean(iron, np.where(flat & rivet, 3.65, tone), px, py)

        if iron_part:
            if is_gate and name == "middle":
                grip = (x > 0.095) & (x < 0.34375)
                wood_tone = 2.55 + direction + (noise - 0.48) * 2.65
            else:
                grip = np.zeros(len(px), dtype=bool)
                wood_tone = 0.0
            run = np.where(np.abs(normals[:, 0]) > 0.5, z, x)
            long_bar = is_gate and name in ("hinge", "tip", "lower_bar", "upper_bar")
            if long_bar:
                run = y
            rivet = (np.abs((run + 0.15625) % 0.3125 - 0.15625) * PX < 1.4)
            rivet &= (np.abs((y + 0.0625) % 0.125 - 0.0625) * PX < 1.3)
            if long_bar:
                rivet &= (np.abs(x - (0.03125 if name == "hinge" else 0.40625)) * PX < 1.5)
            patina = (noise > 0.62) & ~rivet
            edge = np.abs(normals[:, 2]) < 0.5
            tone = np.where(edge, 0.68, 2.2) + direction + (noise - 0.48) * 3.2
            colors = pick_clean(iron, np.where(rivet, 4.0, tone), px, py)
            colors = np.where(patina[:, None], pick_clean(rust, (noise - 0.62) * 22.0 + 0.15, px, py), colors)
            return np.where(grip[:, None], pick_clean(wood, wood_tone, px, py), colors)

        horizontal = name in ("floor", "ceiling")
        plank_axis = x if horizontal else y
        board = (plank_axis + 2.125) / 0.25
        seam = np.abs(((board + 0.5) % 1.0) - 0.5) * (0.25 * PX) < 1.1
        grain_axis = np.array([1.5, 1.5, 0.18]) if horizontal else np.array([0.50, 1.8, 0.50])
        grain = fbm(points * grain_axis, 0.07, 2, 7)
        shade = 2.15 + direction + (_hash1(np.floor(board), 14) - 0.5) * 2.0 + (grain - 0.5) * 1.8
        if "upright" in name or "beam" in name:
            shade = 2.85 + direction + (grain - 0.5) * 1.1
        else:
            shade = np.where(seam, 0.0, shade)
        return pick_clean(wood, shade, px, py)

    for part in painter.all_elements():
        part.paint_surface_arrays(lambda rows, name=part.name: surface(rows, name))
