"""Procedural painted texture for sword_of_omens, made from scratch (no image is projected or copied).

The 2D concept (projects/dark-fantasy/reference.png) is only the style guide: dark steel with a lit left bevel and a
shaded right bevel, engraved and hatched surfaces, ember runes in a black channel, tarnished gold with scrollwork,
blood-red gems with a slit pupil, wrapped leather. Light comes from the top-left of the front view.
Everything is computed from model-space position and normal, so it is continuous across faces.
"""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

import numpy as np

from Tools.TexturePainter import TexturePainter
from Tools.recipe_context import recipe_paths

C = {
    "ink": (10, 8, 14),
    "abyss": (14, 16, 24),
    "steel_deep": (30, 34, 48),
    "steel_dark": (52, 58, 76),
    "steel": (86, 94, 116),
    "steel_lit": (150, 160, 182),
    "steel_glint": (222, 229, 241),
    "gold_deep": (58, 36, 12),
    "gold_dark": (104, 68, 20),
    "gold": (158, 112, 38),
    "gold_lit": (214, 172, 84),
    "gold_glint": (250, 226, 150),
    "blood_deep": (44, 4, 9),
    "blood": (150, 16, 26),
    "blood_lit": (255, 104, 80),
    "leather_dark": (22, 12, 16),
    "leather": (56, 34, 40),
    "leather_lit": (96, 62, 64),
    "rune": (255, 150, 56),
    "rune_lit": (255, 226, 164),
}

GOLD_PARTS = ("guard_core", "horn_L", "horn_R", "fang_L", "fang_R", "eye_bezel", "collar",
              "ring_a", "ring_b", "ring_c", "pommel", "pommel_tip", "spike_L", "spike_R")
RUNE_Y = tuple(15.2 + 2.2 * i for i in range(7))  # rune centers along the fuller (model Y)
BLADE_BASE_Y, BLADE_LEN = 12.4, 19.6


def rgb(name):
    return np.array(C[name], dtype=np.float32)


def mix(a, b, t):
    """Blend a -> b by t per texel. a and b are one color (3,) or one color per texel (N, 3)."""
    t = np.clip(t, 0.0, 1.0)[:, None]
    a = a[None, :] if a.ndim == 1 else a
    b = b[None, :] if b.ndim == 1 else b
    return a * (1.0 - t) + b * t


def hash01(*cols):
    """Deterministic pseudo noise in [0, 1) from (quantized) model coordinates."""
    h = np.zeros_like(cols[0], dtype=np.float64)
    for i, c in enumerate(cols):
        h += np.sin(c * (12.9898 + 7.7 * i) + i * 4.1) * 43758.5453
    return h - np.floor(h)


def out(color):
    rgba = np.empty((color.shape[0], 4), dtype=np.float32)
    rgba[:, :3] = np.clip(color, 0, 255)
    rgba[:, 3] = 255
    return rgba


def light_of(nrm, strength=1.0):
    """Light from the top-left-front. 0 = shade, 1 = fully lit."""
    return np.clip(0.5 + strength * 0.5 * (-nrm[:, 0] * 0.75 + nrm[:, 1] * 0.55 + nrm[:, 2] * 0.35), 0, 1)


def cel(t, steps=4):
    """Quantize a light value into painted bands, softened a little."""
    q = np.floor(np.clip(t, 0, 0.999) * steps) / (steps - 1)
    return 0.65 * q + 0.35 * t


# ------------------------------------------------------------------ blade
def blade(rows):
    pos, nrm = rows.model_position, rows.model_normal
    x, y, z = pos[:, 0], pos[:, 1], pos[:, 2]
    t = (y - BLADE_BASE_Y) / BLADE_LEN                         # 0 at the guard, 1 at the tip
    lit_side = np.clip(-nrm[:, 0] * 1.6, 0, 1)                  # bevel facing the light
    shade_side = np.clip(nrm[:, 0] * 1.6, 0, 1)
    front = np.abs(nrm[:, 2]) > 0.55                            # flat faces of the blade

    base = mix(rgb("steel_dark"), rgb("steel"), 0.35 + 0.55 * t)           # darker toward the guard
    color = base * (1 - 0.55 * shade_side[:, None])
    color = color + (rgb("steel_lit") - base) * (0.8 * lit_side[:, None])
    # Flat faces: a soft diagonal sheen that shifts with height.
    sheen = np.clip(np.sin((x * 2.2 + y * 0.45) * 3.0) * 0.5 + 0.5, 0, 1)
    color[front] = mix(base[front], rgb("steel_lit"), 0.18 + 0.35 * sheen[front] * (0.4 + 0.6 * t[front]))

    # Cross-hatching on the shaded half, engraving-style (two crossing line families).
    hatch_a = np.abs(((x * 3.1 + y * 2.3) % 0.5) - 0.25) < 0.035
    hatch_b = np.abs(((x * 3.1 - y * 2.3) % 0.7) - 0.35) < 0.03
    hatch = (hatch_a | (hatch_b & (shade_side > 0.2))) & ((shade_side > 0.15) | (x > 0.15))
    color[hatch] *= 0.62

    # Long scratches along the blade and small pits (battle wear).
    streak = hash01(np.round(x * 11), np.round(y * 1.7)) > 0.93
    color[streak] = mix(color[streak], rgb("steel_glint"), np.full(streak.sum(), 0.35))
    pits = hash01(np.round(x * 9), np.round(y * 11), np.round(z * 9)) > 0.968
    color[pits] *= 0.4

    # Bright knife edge on the lit side and a dark ink line on the shaded side.
    return out(color)


def fuller(rows):
    pos, nrm = rows.model_position, rows.model_normal
    x, y = pos[:, 0], pos[:, 1]
    inset = np.clip(np.abs(x) / 0.3, 0, 1)
    color = mix(rgb("abyss"), rgb("steel_deep"), 0.25 + 0.5 * inset ** 2)

    glow = np.zeros_like(x)
    core = np.zeros_like(x, dtype=bool)
    for i, ry in enumerate(RUNE_Y):
        dy = y - ry
        kind = i % 3
        if kind == 0:      # diamond
            d = np.abs(x) / 0.16 + np.abs(dy) / 0.42
            inside = d < 1.0
        elif kind == 1:    # bar
            inside = (np.abs(x) < 0.07) & (np.abs(dy) < 0.34)
            d = np.maximum(np.abs(x) / 0.07, np.abs(dy) / 0.34)
        else:              # triangle pointing up
            half = 0.17 * np.clip((0.4 - dy) / 0.8, 0, 1)
            inside = (dy > -0.4) & (dy < 0.4) & (np.abs(x) < half)
            d = np.where(inside, 0.5, 2.0)
        core |= inside
        glow = np.maximum(glow, np.clip(1.4 - d, 0, 1) * 0.55)    # warm halo around each glyph
    color = color + (np.array(C["rune"], dtype=np.float32)[None, :] * glow[:, None] * 0.35)
    color[core] = mix(rgb("rune"), rgb("rune_lit"), 0.5 - np.abs(x[core]) * 3)
    return out(color)


# ------------------------------------------------------------------- gold
def gold(rows):
    pos, nrm = rows.model_position, rows.model_normal
    x, y, z = pos[:, 0], pos[:, 1], pos[:, 2]
    lt = cel(light_of(nrm, 1.15), 4)                          # painted light bands
    color = mix(rgb("gold_deep"), rgb("gold_lit"), lt)
    color = mix_rows(color, rgb("gold_dark"), (lt < 0.25))   # deepest shade band

    # Engraved scrollwork: thin dark concentric/curved lines around the horn and plate centers.
    for cx, cy in ((2.2, 12.2), (-2.2, 12.2), (3.6, 11.0), (-3.6, 11.0)):
        r = np.hypot(x - cx, y - cy)
        line = np.abs(((r * 3.4) % 1.0) - 0.5) < 0.05
        color[line & (r < 2.4)] *= 0.55
    seam = np.abs(((x * 1.8 + y * 1.1) % 1.0) - 0.5) < 0.035
    color[seam] *= 0.65

    # Rim light on edges facing the light, tarnish pooled in the shade, dark pitting.
    glint = (lt > 0.85) & (hash01(np.round(x * 12), np.round(y * 12), np.round(z * 12)) > 0.55)
    color[glint] = mix(color[glint], rgb("gold_glint"), np.full(glint.sum(), 0.6))
    tarnish = hash01(np.round(x * 7), np.round(y * 7), np.round(z * 7)) * (1.0 - lt)
    color *= (1.0 - 0.35 * tarnish)[:, None]
    pits = hash01(np.round(x * 15), np.round(y * 15), np.round(z * 15)) > 0.975
    color[pits] = rgb("gold_deep")
    return out(color)


def mix_rows(color, other, mask):
    color = color.copy()
    color[mask] = other[None, :] * 0.5 + color[mask] * 0.5
    return color


# ------------------------------------------------------------------- gems
def gem_core(rows, pupil=False):
    pos, nrm = rows.model_position, rows.model_normal
    lt = cel(light_of(nrm, 1.2), 5)
    color = mix(rgb("blood_deep"), rgb("blood_lit"), lt ** 1.2)
    color = mix(color, rgb("blood"), np.full(color.shape[0], 0.25) * (1 - lt))
    if pupil:
        front = nrm[:, 2] > 0.15
        slit = front & (np.abs(pos[:, 0]) < 0.1 * (1.2 - np.abs(pos[:, 1] - 11.3) / 1.2)) & (np.abs(pos[:, 1] - 11.3) < 0.95)
        color[slit] = rgb("ink")
    glint = (nrm[:, 2] > 0.1) & (np.hypot(pos[:, 0] + 0.26, pos[:, 1] - (11.3 if pupil else 1.7) - 0.4) < 0.15)
    color[glint] = rgb("rune_lit")
    return out(color)


def eye_gem(rows):
    return gem_core(rows, pupil=True)


def pommel_gem(rows):
    return gem_core(rows, pupil=False)


# ------------------------------------------------------------------- grip
def grip(rows):
    pos, nrm = rows.model_position, rows.model_normal
    x, y, z = pos[:, 0], pos[:, 1], pos[:, 2]
    angle = np.arctan2(x, z)
    phase = y * 2.6 + angle * 0.9                              # diagonal cord wrap
    local = (phase % 1.0)
    rib = np.abs(local - 0.5) * 2                              # 1 at the seam between cords
    lt = light_of(nrm, 1.0)
    color = mix(rgb("leather"), rgb("leather_lit"), lt * (1 - 0.7 * rib))
    color[rib > 0.86] = rgb("leather_dark")
    stitch = (rib > 0.74) & (rib <= 0.86) & (np.floor((y * 9 + angle * 3)) % 2 == 0)
    color[stitch] = mix(color[stitch], rgb("gold_dark"), np.full(stitch.sum(), 0.6))
    scuff = hash01(np.round(x * 9), np.round(y * 9), np.round(z * 9))
    color *= (0.84 + 0.22 * scuff)[:, None]
    return out(color)


def paint():
    paths = recipe_paths(__file__)
    painter = TexturePainter.from_bbmodel(paths.model)

    painter.fill_all(C["steel"] + (255,))
    painter.element("blade").paint_surface_arrays(blade)
    for name in ("fuller_front", "fuller_back"):
        painter.element(name).paint_surface_arrays(fuller)
    for name in GOLD_PARTS:
        painter.element(name).paint_surface_arrays(gold)
    painter.element("eye_gem").paint_surface_arrays(eye_gem)
    painter.element("pommel_gem").paint_surface_arrays(pommel_gem)
    painter.element("grip").paint_surface_arrays(grip)

    # Ink shadows in creases and where parts meet: the dark-fantasy outline feel, strongest at joints.
    field = painter.creases(max_internal_angle=125) | painter.contacts(tolerance=0.2)
    field.paint(lambda hit: (6, 4, 10, int(210 * (1.0 - hit.normalized_distance))), blend="multiply")

    painter.save(paths.texture, edge_dilation=4)
    print(f"[texture] Saved to {paths.texture}")


if __name__ == "__main__":
    paint()
