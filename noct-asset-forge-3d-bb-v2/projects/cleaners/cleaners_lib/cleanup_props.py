"""Balde, baú, bolsa de reposição e as duas camadas da gosma."""
from math import cos, sin, pi, tau

import numpy as np

from lib import ModelBuilder, Path3D, Profile, SegmentSection
from cleaners_lib.paladin import COURO
from cleaners_lib.props import FERRO, MADEIRA, U, PX, m, pick_clean, _hash1
from cleaners_lib.stone_paint import MUSGO, _rgb, fbm, texel_xy


def bucket():
    model = ModelBuilder("prop_bucket_01", modeling_mode="free", require_integer_dimensions=False)
    model.add_group("root")
    meridian = [
        (.111, 0), (.124, 0), (.132, .028), (.137, .047), (.134, .055),
        (.148, .276), (.155, .287), (.158, .335), (.148, .35),
        (.132, .35), (.128, .321), (.106, .040),
    ]
    model.add_revolve("vessel", "root", meridian=m_profile(meridian), segments=10,
                      allow_cap_triangles=True)
    handle = [m(.158 * cos(i * pi / 8), .275 - .065 * sin(i * pi / 8), .166 * sin(i * pi / 8))
              for i in range(9)]
    model.add_sweep("handle", "root", path=Path3D.polyline(handle), profile=Profile.circle(.007 * U, segments=6),
                    y_hint=(0, 1, 0), allow_cap_triangles=True)
    return model


def chest():
    model = ModelBuilder("prop_chest_01", modeling_mode="box")
    model.add_group("root")
    model.add_group("body", "root")
    model.add_transform_group("lid", "root", pivot=m(0, .375, -.21875))

    def board(name, size, point, parent="body"):
        model.add_box(name, parent, size=m(*size), at=m(*point))

    board("floor", (.875, .0625, .5), (0, .03125, 0))
    for index in range(5):
        y = .09375 + index * .0625
        for side, sign in (("left", -1), ("right", 1)):
            board(f"side_{side}_{index}", (.0625, .0625, .375), (sign * .40625, y, 0))
        for side, sign in (("back", -1), ("front", 1)):
            board(f"wall_{side}_{index}", (.875, .0625, .0625), (0, y, sign * .21875))
    # A receita usa coordenadas do modelo. O grupo guarda o eixo de abertura.
    board("lid_lower", (.875, .0625, .5), (0, .40625, 0), "lid")
    board("lid_middle", (.875, .0625, .375), (0, .46875, 0), "lid")
    board("lid_top", (.875, .0625, .25), (0, .53125, 0), "lid")
    for side, x in (("left", -.25), ("right", .25)):
        board(f"iron_hinge_{side}", (.125, .125, .0625), (x, .34375, -.28125))
    board("iron_latch", (.0625, .125, .0625), (0, .38125, .28125), "lid")
    board("iron_plate", (.1875, .0625, .0625), (0, .21875, .28125))
    return model


def pouch():
    model = ModelBuilder("prop_supply_pouch_01", modeling_mode="free", require_integer_dimensions=False)
    model.add_group("root")
    profile = [(.052, 0), (.075, .026), (.09, .091), (.064, .165),
               (.046, .182), (.041, .199), (.061, .216), (.044, .23)]
    model.add_revolve("leather", "root", meridian=m_profile(profile), segments=8, allow_cap_triangles=True)
    model.add_box("iron_clasp", "root", size=m(.037, .028, .026), at=m(0, .189, .056), native=False)
    return model


SLIME_PROFILES = {
    "dirt_slime_puddle_01": (1., 1., 1., 0.),
    "dirt_slime_puddle_small_01": (.56, .68, .61, .43),
    "dirt_slime_puddle_wall_01": (.86, .53, .49, -.49),
    "dirt_slime_bucket_fill_01": (.21, .29, .29, .27),
}


def slime(asset="dirt_slime_puddle_01"):
    profile_x, profile_y, profile_z, ripple_phase = SLIME_PROFILES[asset]
    folds = (.09, .05) if asset == "dirt_slime_puddle_01" else (.062, .03)
    model = ModelBuilder(asset, modeling_mode="free", require_integer_dimensions=False)
    model.add_group("root")

    def blob(name, low, high, rings):
        sections = []
        for index, (t, x_radius, z_radius, shift) in enumerate(rings):
            contour = []
            for step in range(12):
                angle = step * tau / 12
                wobble = 1.0 + folds[0] * sin(3 * angle - .5 + ripple_phase) + folds[1] * cos(5 * angle + .6)
                contour.append((profile_x * x_radius * cos(angle) * wobble * U,
                                profile_z * z_radius * sin(angle) * wobble * U))
            sections.append(SegmentSection(f"ring_{index}", profile=Profile(tuple(contour)), t=t,
                                           offset=m(shift * profile_x, 0)))
        model.add_segment(name, "root", start=m(0, low * profile_y, 0), end=m(0, high * profile_y, 0), sections=sections,
                          y_hint=(0, 0, 1), allow_cap_triangles=True, no_overlap_check=True)

    blob("slime_shell", 0, .225, [(0, .34, .26, 0), (.12, .52, .39, 0), (.31, .515, .38, -.014),
                                  (.57, .43, .33, -.028), (.8, .28, .26, -.05), (1, .105, .12, -.055)])
    blob("slime_core", .015, .166, [(0, .21, .15, -.025), (.22, .368, .27, -.027), (.52, .33, .23, -.04),
                                     (.82, .21, .16, -.052), (1, .074, .085, -.075)])
    return model


def m_profile(profile):
    return [m(radius, height) for radius, height in profile]


def paint_model(painter, kind):
    wood, iron, leather = _rgb(MADEIRA), _rgb(FERRO), _rgb([*COURO, "#a08068"])
    gel = _rgb(["#1f3a14", "#4f8a24", "#8fcf3a", "#d4f27a"])
    moss = _rgb(MUSGO)

    def paint(rows, name):
        px, py = texel_xy(rows, len(rows.x))
        points = np.asarray(rows.model_position) / U
        normals = np.asarray(rows.model_normal)
        x, y, z = points.T
        noise = fbm(points, .11, 2, 49)
        fine = fbm(points * np.array([1.65, .33, 1.65]), .046, 2, 61)
        face = normals[:, 1] * .56
        if kind == "slime":
            glare = (noise > .54) & (normals[:, 1] > .4)
            tone = (2.15 if name == "slime_shell" else 1.72) + face + (noise - .49) * 2.8
            base = pick_clean(gel, np.where(glare & (fine > .55), 3.0, tone), px, py)
            contours = (normals[:, 1] < .38) | (fine < .29)
            edge = pick_clean(moss, (noise - .32) * 14 + face, px, py)
            contact_shadow = (y < .034) & (noise + fine < 1.03)
            return np.where(contact_shadow[:, None], gel[0], np.where(contours[:, None], edge, base))

        if kind == "pouch" and not name.startswith("iron"):
            fold = .25 * np.cos(9 * np.arctan2(z, x)) * (1 + .9 * (y > .15))
            tone = 2 + face + (noise - .48) * 2.95 + fold
            stitch = (abs(z) > .052) & (abs(x) < .012) & ((y * PX) % 4 < 1)
            worn = (fine > .54) & (np.abs(y - .08) < .026)
            cord = (y > .181) & (y < .202)
            braid = np.sin(np.arctan2(z, x) * 19 + y * 380)
            cord_color = pick_clean(wood, 3.1 + face + braid * .85, px, py)
            return np.where(cord[:, None], cord_color,
                            pick_clean(leather, np.where(stitch | worn, tone + .95, tone), px, py))

        if kind == "bucket":
            radius = np.hypot(x, z)
            low_band = (y > .026) & (y < .052) & (radius > .128)
            rim = (y > .274) & (radius > .132)
            hardware = low_band | rim | (name == "handle")
            across = np.arctan2(z, x) * 10 / tau
            seams = np.abs((across + .5) % 1 - .5) * radius * tau * PX / 10 < 1.25
            board = np.floor(across)
            rivet = hardware & (np.abs((across % 1) - .5) < .055) & (np.abs(y - .30) < .013)
            tone = 2.2 + face + (_hash1(board, 12) - .5) * 2.3 + (fine - .5) * 2.2
            interior = x * normals[:, 0] + z * normals[:, 2] < -.02
            timber = pick_clean(wood, np.where(seams, 0, tone - interior * .54), px, py)
            iron_tone = np.where(rivet, 4, 2 + face * 1.4 + (noise - .45) * 3)
            return np.where(hardware[:, None], pick_clean(iron, iron_tone, px, py), timber)

        # As cintas de ferro continuam de uma tábua à outra pelo espaço do modelo.
        strap_distance = np.minimum(np.abs(x - .305), np.abs(x + .305))
        visible_band = (strap_distance < .044) & (np.abs(normals[:, 0]) < .8)
        hardware = visible_band | name.startswith("iron")
        board = np.floor((y + .009) / .0625)
        joint = np.abs((y % .0625) - .001) * PX < 1.05
        inside = x * normals[:, 0] + z * normals[:, 2] < -.05
        tone = 2.28 + face + (_hash1(board, 15) - .5) * 2.15 + (fine - .45) * 1.9 - inside * .67
        timber = pick_clean(wood, np.where(joint & (np.abs(normals[:, 1]) < .45), 0, tone), px, py)
        rivet = (strap_distance * PX < 1.5) & np.where(np.abs(normals[:, 1]) > .5,
                                                     np.abs((z + .03) % .091 - .0455) * PX < 1.5,
                                                     np.abs((y + .015) % .125 - .0625) * PX < 1.5)
        iron_tone = np.where(rivet, 4, 2 + face + (noise - .5) * 3.2)
        return np.where(hardware[:, None], pick_clean(iron, iron_tone, px, py), timber)

    for part in painter.all_elements():
        part.paint_surface_arrays(lambda rows, name=part.name: paint(rows, name))
