"""Pintura em pixel art para slime escuro, couro e expressão cansada."""
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

U = 16


def rgb(ramp):
    return np.array([tuple(bytes.fromhex(color[1:])) for color in ramp], dtype=np.uint8)


def main():
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.props import MADEIRA, pick_clean
    from cleaners_lib.stone_paint import ABISMO, PEDRA, fbm, texel_xy

    slime = rgb([ABISMO, *PEDRA[:4]])
    leather = rgb(MADEIRA)
    eye = rgb(["#615647", "#b9ab8f", "#e3d9c0"])
    film = rgb(["#2f504b"])[0]

    def paint_slime(points, normals, texel_x, texel_y, name):
        x, y, z = points.T
        wave = fbm(points * np.array([1.4, 0.16, 1.4]), 0.055, 2, 23)
        pools = fbm(points, 0.15, 2, 73)
        facing = normals @ np.array([0.17, 0.48, 0.30])
        value = 1.65 + facing * 1.75 + (wave - 0.5) * 1.08
        value += np.where(y < .12, -0.45, 0)
        color = pick_clean(slime, value, texel_x, texel_y)
        wet_edge = (y < .62) & (wave > .65) & (facing > .11) & (pools > .43)
        color[wet_edge] = film
        if name == "slime_head":
            face_x = x - .007
            front = (normals[:, 2] > .03) & (z > .122) & (np.abs(face_x) < .116)
            color[front] = pick_clean(slime, value[front] + .55, texel_x[front], texel_y[front])
            eye_x = np.abs(face_x) - .059
            eyelid = 1.543 - .075 * np.abs(face_x)

            socket = front & ((eye_x / .047) ** 2 + ((y - eyelid) / .022) ** 2 < 1)
            color[socket] = slime[1]
            brow = eyelid + .026 - .11 * eye_x
            ridge = front & (np.abs(eye_x) < .047) & (np.abs(y - brow) < .005)
            color[ridge] = slime[4]
            crease = front & (np.abs(eye_x) < .039) & (np.abs(y - (eyelid - .024)) < .004)
            color[crease] = slime[1]

            opening = .012 * np.clip(1 - (eye_x / .038) ** 2, 0, 1)
            eye_mask = front & (opening > 0) & (y < eyelid + .002) & (y > eyelid - opening)
            color[eye_mask] = eye[1]
            iris_x = np.abs(face_x - .006) - .058
            color[eye_mask & (np.abs(iris_x) < .009)] = slime[0]
            color[eye_mask & (eye_x > .023)] = eye[0]
            color[eye_mask & (iris_x > .011) & (iris_x < .017)] = eye[2]

            nasal = front & (np.abs(face_x) < .019) & (z > .190) & (1.490 < y) & (y < 1.532)
            color[nasal] = slime[4]
            nostrils = front & (np.abs(np.abs(face_x) - .020) < .008) & (np.abs(y - 1.487) < .005)
            color[nostrils] = slime[0]
            frown = 1.459 - 3.2 * face_x ** 2 + .018 * face_x
            mouth = front & (np.abs(face_x) < .061) & (np.abs(y - frown) < .0055)
            color[mouth] = slime[0]
            lip = front & (np.abs(face_x) < .047) & (np.abs(y - (frown - .014)) < .004)
            color[lip] = slime[4]
        elif name.startswith(("arm_", "hand_")):
            accent = (normals[:, 2] > .22) & (facing > .15)
            color[accent] = pick_clean(slime, value[accent] + .32, texel_x[accent], texel_y[accent])
        return color

    def paint_leather(points, normals, texel_x, texel_y, name):
        x, y, z = points.T
        wear = fbm(points, 0.047, 3, 56)
        crease = fbm(points * np.array([1.0, 0.38, 1.0]), .037, 2, 35)
        warmth = 2.0 if name == "apron" else 1.35
        colors = pick_clean(leather, warmth + normals[:, 1] * .72 + (wear - .50) * 1.55 -
                            np.where(crease < .24, .63, 0), texel_x, texel_y)
        front = normals[:, 2] > .18
        if name == "apron":
            pocket_x = np.abs(x + .055)
            pocket = front & (pocket_x < .075) & (.945 < y) & (y < 1.073)
            colors[pocket] = leather[2]
            rim = pocket & (y > 1.057)
            colors[rim] = leather[3]
            stitches = ((texel_x + texel_y) % 3 == 0)
            colors[pocket & (pocket_x > .063) & stitches] = leather[3]
            patch_x = np.abs(x - .100 + (y - .75) * .15)
            patch = front & (patch_x < .052) & (.714 < y) & (y < .809)
            colors[patch] = leather[1]
            seam = patch & ((patch_x > .043) | (y < .724) | (y > .799))
            colors[seam & stitches] = leather[4]
            colors[front & (y < .692) & (crease > .45)] = leather[1]
        elif name == "belt":
            buckle = front & (np.abs(x + .02) < .041) & (np.abs(y - .880) < .023)
            colors[buckle] = slime[4]
            colors[buckle & (np.abs(x + .02) < .024) & (np.abs(y - .880) < .012)] = leather[1]
        else:
            near_rivets = front & (y > 1.231) & (y < 1.249) & (wear > .36)
            colors[near_rivets] = leather[4]
        return colors

    def surface(rows, name):
        px, py = texel_xy(rows, len(rows.x))
        points = np.asarray(rows.model_position) / U
        normals = np.asarray(rows.model_normal)
        is_leather = name in ("apron", "belt") or name.startswith("strap_")
        painter = paint_leather if is_leather else paint_slime
        color = painter(points, normals, px, py, name)
        return np.column_stack((color, np.full(len(color), 255, dtype=np.uint8)))

    painter = TexturePainter.from_bbmodel(paths.model)
    for element in painter.all_elements():
        element.paint_surface_arrays(lambda rows, name=element.name: surface(rows, name))
    painter.save(paths.texture, edge_dilation=1)


if __name__ == "__main__":
    main()
