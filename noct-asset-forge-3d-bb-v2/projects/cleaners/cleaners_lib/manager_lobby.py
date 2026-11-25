"""Receitas de mobília e utensílios físicos do lobby de Cleaners."""
from functools import partial
from math import cos, sin, tau

import numpy as np

from lib import ModelBuilder, Path3D, Placement, Profile
from cleaners_lib.props import FERRO, MADEIRA, PX, U, _hash1, m, pick_clean
from cleaners_lib.stone_paint import _rgb, fbm, texel_xy

PAPER = ["#3d362e", "#615647", "#8f826b", "#b9ab8f", "#e3d9c0"]
BINDINGS = {
    "leather": ["#22181a", "#3a2828", "#563c37", "#7a5a4c", "#a08068"],
    "cloth": ["#1a202b", "#283041", "#3b4558", "#5a6577", "#8590a0"],
    "register": ["#13211f", "#1e3532", "#2f504b", "#4a7268", "#6f9a8c"],
}


def box(builder, name, size, position):
    builder.add_box(name, "root", size=m(*size), at=m(*position), native=False)


def lathe(builder, name, profile, *, segments=8, x=0.0, z=0.0):
    builder.add_revolve(name, "root", meridian=[m(radius, y) for radius, y in profile],
                        segments=segments, allow_cap_triangles=True,
                        placement=Placement.at(m(x, profile[0][1], z)).pivot("base"))


def swept(builder, name, points, radius):
    builder.add_sweep(name, "root", path=Path3D.polyline([m(*point) for point in points]),
                      profile=Profile.circle(radius * U, segments=6), allow_cap_triangles=True)


def counter(b):
    box(b, "long_top", (3.25, .09375, .75), (0, 1.015625, 0))
    box(b, "return_top", (.75, .09375, 1.25), (-1.25, 1.015625, -1))
    box(b, "front_boards", (3.125, .84375, .0625), (0, .515625, .31))
    box(b, "return_boards", (.0625, .84375, 1.27), (-1.56, .515625, -.985))
    box(b, "end_boards", (.0625, .84375, .59375), (1.53125, .515625, -.021))
    box(b, "return_end", (.59375, .84375, .0625), (-1.22, .515625, -1.53))
    for i, x in enumerate((-1.5, -.5, .59, 1.5)):
        box(b, f"post_{i}", (.115, .96, .07), (x, .48, .37625))
    for i, z in enumerate((-.46, -1.43)):
        box(b, f"return_post_{i}", (.08, .96, .115), (-1.63125, .48, z))
    box(b, "base_rail", (3.12, .097, .078), (0, .0605, .304))
    box(b, "return_base_rail", (.076, .097, 1.246), (-1.56, .0605, -.985))
    box(b, "inner_shelf", (1.78, .052, .36), (.47, .32, .076))
    return b


def shelf(b):
    for sign, label in ((-1, "left"), (1, "right")):
        box(b, f"side_{label}", (.065, 2.18, .425), (sign * .78, 1.09, 0))
        box(b, f"post_{label}", (.06, 2.22, .06), (sign * .78, 1.11, .2425))
    box(b, "back_boards", (1.492, 2.06, .036), (0, 1.075, -.19))
    for i, y in enumerate((.42, .96, 1.47, 2.02)):
        box(b, f"shelf_{i}", (1.495, .0625, .358), (0, y, .027))
        box(b, f"front_rail_{i}", (1.495, .03125, .023), (0, y - .015625, .2175))
    return b


def chair(b):
    box(b, "seat", (.47, .075, .44), (0, .47, 0))
    for sign, side in ((-1, "left"), (1, "right")):
        x = sign * .19
        box(b, f"front_leg_{side}", (.065, .4325, .065), (x, .21625, .174))
        box(b, f"back_leg_post_{side}", (.07, .995, .068), (x, .4975, -.18))
        box(b, f"brace_{side}", (.043, .042, .286), (x, .235, -.009))
    for i, y in enumerate((.66, .805, .94)):
        box(b, f"back_rail_{i}", (.309, .068 if i < 2 else .095, .055), (0, y, -.182))
    box(b, "front_skirt", (.312, .054, .037), (0, .4055, .176))
    return b


def clipboard(b):
    box(b, "back_board", (.60, .038, .38), (0, .048, 0))
    # An angled stand places the board under the player's view without painted depth.
    for sign, label in ((-1, "left"), (1, "right")):
        box(b, f"stand_{label}", (.055, .029, .14), (sign * .22, .0145, -.075))
    for i, x in enumerate((-.172, 0, .172)):
        box(b, f"paper_{i}", (.138, .009, .253), (x, .0715, .012))
        box(b, f"iron_clip_{i}", (.072, .014, .036), (x, .083, -.094))
    box(b, "iron_hinge", (.22, .018, .043), (0, .076, -.146))
    return b


def pocket_clipboard(b):
    # Prancheta de bolso: uma folha só, para a interface desenhada no papel pelo jogo.
    box(b, "back_board", (.23, .016, .32), (0, .008, 0))
    box(b, "paper_0", (.20, .004, .27), (0, .018, .018))
    box(b, "iron_clip_0", (.09, .012, .036), (0, .026, -.132))
    box(b, "iron_lever", (.05, .008, .02), (0, .036, -.142))
    return b


BOOK_SIZES = {"leather": (.078, .279, .194), "cloth": (.063, .31, .174), "register": (.10, .238, .212)}


def book(b, variant):
    w, h, d = BOOK_SIZES[variant]
    leave, cover = .013, .010
    box(b, "spine", (w, h, .022), (0, h / 2, d / 2 - .011))
    for sign, label in ((-1, "left"), (1, "right")):
        box(b, f"cover_{label}", (cover, h, d - .022),
            (sign * (w - cover) / 2, h / 2, -.011))
    box(b, "paper_pages", (w - 2 * cover - .001, h - 2 * leave, d - .038),
        (0, h / 2, -.011))
    return b


def hook_rail(b):
    box(b, "mount_board", (1.40, .22, .067), (0, .11, 0))
    for i, x in enumerate((-.49, 0, .49)):
        swept(b, f"iron_hook_{i}", [(x, .116, .044), (x, .073, .095),
                                    (x, .073, .145), (x, .121, .17)], .014)
    return b


def broom(b):
    lathe(b, "bristle_bundle", [(.091, 0), (.105, .027), (.097, .075),
                               (.072, .20), (.039, .232)], segments=8)
    lathe(b, "shaft", [(.017, .233), (.019, .991), (.021, 1.043),
                      (.015, 1.061)], segments=6)
    swept(b, "iron_hanger", [(-.009, 1.06, .011), (-.022, 1.084, .015),
                             (0, 1.103, .018), (.021, 1.084, .018), (.01, 1.062, .015)], .006)
    return b


def shovel(b):
    blade = [(.096, 0), (.123, .042), (.111, .226), (.054, .264)]
    for i, ((lower, y0), (upper, y1)) in enumerate(zip(blade, blade[1:])):
        # Each bevel step changes the silhouette while keeping the blade at 2.6 cm.
        width = lower + upper
        box(b, f"iron_blade_{i}", (width, y1 - y0, .026),
            (0, (y0 + y1) / 2, .023 + i * .002))
    lathe(b, "iron_socket", [(.027, .265), (.025, .337)], segments=8)
    lathe(b, "shaft", [(.020, .338), (.019, .951), (.025, .992)], segments=8)
    box(b, "hand_base", (.128, .023, .04), (0, 1.004, 0))
    for i, x in enumerate((-.052, .052)):
        box(b, f"iron_hand_post_{i}", (.022, .056, .026), (x, 1.044, 0))
    box(b, "hand_bar", (.136, .029, .038), (0, 1.087, 0))
    return b


def rope(b):
    points = []
    for i in range(21):
        t = i / 20
        angle = tau * 1.88 * t
        points.append((.119 * sin(angle), .165 + .149 * cos(angle), .045 + .065 * t))
    swept(b, "rope", points, .012)
    return b


def lantern(b):
    box(b, "iron_wall_mount", (.14, .295, .037), (0, .364, .02))
    swept(b, "iron_wall_arm", [(0, .415, .047), (0, .485, .135), (0, .485, .236),
                              (0, .422, .29)], .025)
    box(b, "iron_base", (.188, .045, .181), (0, .048, .288))
    box(b, "iron_lower_trim", (.157, .027, .154), (0, .084, .288))
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(b, f"iron_corner_{sx}_{sz}", (.022, .226, .022),
                (sx * .076, .211, .288 + sz * .076))
    box(b, "iron_eave", (.192, .032, .182), (0, .341, .288))
    lathe(b, "iron_roof", [(.093, .358), (.079, .38), (.033, .422)], segments=8, z=.288)
    box(b, "iron_oil_cup", (.069, .035, .069), (0, .115, .288))
    return b


def gate_panel(b):
    for i, x in enumerate((.024, .414)):
        box(b, f"iron_upright_{i}", (.047, 2.5, .060), (x, 1.25, 0))
    for i, y in enumerate((.028, 2.472)):
        box(b, f"iron_rail_{i}", (.343, .056, .052), (.219, y, 0))
    for i in range(3):
        y = .08 + .796 * i
        swept(b, f"iron_diagonal_forward_{i}", [(.046, y, -.014), (.392, y + .754, -.014)], .013)
        swept(b, f"iron_diagonal_back_{i}", [(.392, y, .014), (.046, y + .754, .014)], .013)
    return b


BUILDERS = {
    "prop_lobby_corner_counter_01": counter,
    "prop_lobby_bookshelf_01": shelf,
    "prop_lobby_chair_01": chair,
    "prop_lobby_clipboard_01": clipboard,
    "prop_pocket_clipboard_01": pocket_clipboard,
    "prop_lobby_wooden_hook_rail_01": hook_rail,
    "prop_lobby_broom_01": broom,
    "prop_lobby_shovel_01": shovel,
    "prop_lobby_rope_coil_01": rope,
    "light_lobby_wall_lantern_01": lantern,
    "prop_lobby_elevator_gate_panel_01": gate_panel,
    **{f"prop_lobby_book_{variant}_01": partial(book, variant=variant) for variant in BOOK_SIZES},
}


def build_lobby_prop(asset):
    builder = ModelBuilder(asset, modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("root")
    return BUILDERS[asset](builder)


def paint_lobby_prop(painter, asset):
    wood, iron, paper = _rgb(MADEIRA), _rgb(FERRO), _rgb(PAPER)
    soot = _rgb(["#0d1018", "#22181a", "#3a2828", "#563c37"])
    binding = next((value for key, value in BINDINGS.items() if f"book_{key}_" in asset), None)
    bound = _rgb(binding) if binding is not None else None

    def paint(rows, name):
        px, py = texel_xy(rows, len(rows.x))
        xyz = np.asarray(rows.model_position) / U
        x, y, z = xyz.T
        normals = np.asarray(rows.model_normal)
        facing = np.abs(normals)
        across = np.where(facing[:, 0] > .5, z, x)
        noise = fbm(xyz, .069, 2, 701)
        fine = fbm(xyz, .023, 2, 661)
        lit = normals[:, 1] * .63 + normals[:, 2] * .15

        if name.startswith("paper"):
            lines = np.abs((z * PX + 1) % 4 - 2) < .62
            left = np.abs(x - np.round(x / .172) * .172)
            writing = lines & (left < .044) & (fine < .64) & (z < .109) & (z > -.097)
            fibers = 2.65 + (fine - .45) * 2.4 + (noise - .5) * 1.8 + lit * .4
            if name == "paper_pages":
                writing = (np.abs((y * PX + .2) % 3 - 1) < .55) & (noise > .43)
            return pick_clean(paper, np.where(writing, .68, fibers), px, py)

        if bound is not None:
            raised_band = (np.abs(y * PX % 9 - 3.0) < 1.0) & (name == "spine")
            border = (np.abs(z) > .057) & (fine > .42) & (noise > .48)
            tone = 2.0 + lit + (fine - .46) * 2.3 + (noise - .5) * 3.5
            cover = pick_clean(bound, tone, px, py)
            trim = pick_clean(paper, 1.5 + (noise - .4) * 2.7, px, py)
            return np.where((raised_band | border)[:, None], trim, cover)

        if name.startswith("iron"):
            edge = (fine > .61) & (noise > .43)
            wear = np.where(edge, .80, 0)
            tone = 1.85 + lit + 2.9 * (noise - .48) + 1.8 * (fine - .5) + wear
            dark_iron = asset in ("prop_lobby_elevator_gate_panel_01", "light_lobby_wall_lantern_01")
            if dark_iron:
                tone -= .82
                tone += (fine > .76) * .55
            aged = pick_clean(iron, tone, px, py)
            if asset in ("prop_lobby_clipboard_01", "prop_pocket_clipboard_01"):
                return aged
            patina = pick_clean(soot, .35 + (fine - .18) * 3.9 + .55 * lit, px, py)
            return np.where((noise < (.34 if dark_iron else .41))[:, None], patina, aged)

        if name in ("rope", "bristle_bundle"):
            stride = y * PX * .34 + x * PX * .5 + z * PX * .45
            twist = np.sin(stride * tau) * .33
            tie = (name == "bristle_bundle") & (y > .163) & (y < .203)
            strand = pick_clean(paper, 2.27 + lit + (noise - .49) * 3.8 + twist, px, py)
            binder = pick_clean(wood, 2.9 + lit + (fine - .5) * 2.8, px, py)
            worn = (noise < .42) & (fine < .49)
            return np.where((tie | worn)[:, None], binder, strand)

        horizontal = (facing[:, 1] > .5) | any(key in name for key in ("top", "rail", "shelf", "seat", "skirt"))
        lengthwise = np.where(horizontal, x, y)
        widthwise = np.where(horizontal, z + y * .21, across)
        waviness = fbm(np.stack((widthwise * 2, lengthwise * .11, z * .13), axis=1), .041, 2, 492)
        seam_pos = widthwise * 4.0 + .04
        board = np.floor(seam_pos)
        joint = (np.abs(seam_pos % 1 - .5) > .479) & (name != "shaft")
        grain = np.sin((widthwise * 86 + 2.0 * waviness) * tau) * .24
        lap = (_hash1(board, 183) - .5) * 1.5
        grade = 2.1 + lit + (noise - .48) * 2.15 + (waviness - .48) * 1.9 + grain + lap
        timber = pick_clean(wood, np.where(joint, .0, grade), px, py)
        if asset in ("prop_lobby_clipboard_01", "prop_pocket_clipboard_01"):
            return timber
        studs = (("post" in name) | (name == "mount_board")) & (np.abs((y * PX) % 39 - 11) < 1.6)
        studs = studs & (np.abs((across * PX + 4) % 12 - 6) < 1.5)
        hardware = pick_clean(iron, 1.6 + lit + (fine - .45) * 3.0, px, py)
        timber = np.where(((noise < .29) & (fine < .49))[:, None],
                          pick_clean(soot, 3.8 * fine + lit * .2, px, py), timber)
        return np.where(studs[:, None], hardware, timber)

    for item in painter.all_elements():
        item.paint_surface_arrays(lambda rows, name=item.name: paint(rows, name))
