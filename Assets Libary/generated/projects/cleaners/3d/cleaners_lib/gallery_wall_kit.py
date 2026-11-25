"""Tochas, ferragens e pano reutilizáveis nos corredores de pedra."""
from functools import partial
from math import cos, pi, sin, tau

import numpy as np

from lib import MeshDraft, ModelBuilder, Path3D, Profile, SegmentSection
from cleaners_lib.gallery_props import box, ring
from cleaners_lib.manager_lobby import lathe
from cleaners_lib.props import FERRO, MADEIRA, U, m, pick_clean
from cleaners_lib.stone_paint import _rgb, fbm, texel_xy

RUST = ["#2a140c", "#4a2412", "#73391b", "#9c5426"]
ASH = ["#07080c", "#0d1018", "#16181d", "#262a31", "#3c414b"]
EMBER = ["#6e2a0c", "#d4651c", "#f5a63a"]
CLOTH = ["#13211f", "#1e3532", "#2f504b", "#4a7268", "#6f9a8c"]
THREAD = ["#3d362e", "#615647", "#8f826b", "#b9ab8f"]


def profile_segment(builder, name, start, end, radii, sides=6):
    sections = tuple(
        SegmentSection(f"level_{index}", profile=Profile.circle(radius * U, segments=sides), t=fraction)
        for index, (fraction, radius) in enumerate(radii)
    )
    hint = (0, 1, 0) if start[:2] == end[:2] else (0, 0, 1)
    builder.add_segment(name, "root", start=m(*start), end=m(*end), y_hint=hint,
                        no_overlap_check=True, sections=sections)


def rail(builder, name, points, radius, sides=4):
    builder.add_sweep(name, "root", path=Path3D.polyline([m(*point) for point in points]),
                      profile=Profile.circle(radius * U, segments=sides), allow_cap_triangles=True,
                      no_overlap_check=True)


def fasteners(builder, width, height):
    for index, (x, y) in enumerate(((-width * .34, height * .74), (width * .34, height * .23))):
        profile_segment(builder, f"pin_{index}", (x, y, .024), (x, y, .043), [(0, .017), (1, .012)])


def wall_mount(builder, width=.15, height=.20):
    box(builder, "plate", (width, height, .027), (0, height / 2, .018))
    fasteners(builder, width, height)


def crooked_torch(builder, burned=False):
    wall_mount(builder, .17, .205)
    rail(builder, "arm_forged", [(0,.095,.025), (-.006,.09,.084), (.030,.065,.129), (.036,.105,.171)], .017)
    profile_segment(builder, "cuff", (.032,.09,.154), (.034,.15,.173), [(0,.037),(1,.035)], sides=8)
    height = .35 if burned else .46
    profile_segment(builder, "stick", (.055,.025,.135), (-.050,height-.015,.264), [(0,.019),(.45,.024),(1,.028)])
    profile_segment(builder, "head", (-.044,height-.09,.239), (-.073,height,.292),
                    [(0,.029),(.42,.054),(1,.042)], sides=8)
    for index, side in enumerate((-1, 1)):
        x = -.075 + side * .022
        profile_segment(builder, f"head_fray_{index}", (x,height-.035,.313), (x+side*.014,height-.078,.317),
                        [(0,.012),(1,.006)])


def caged_torch(builder):
    wall_mount(builder, .19, .225)
    rail(builder, "arm_fork", [(0,.113,.025), (0,.105,.12), (0,.126,.25), (0,.22,.262)], .021)
    lathe(builder, "cup", [(0.034,.18),(.052,.22),(.112,.255),(.116,.296)], segments=8, z=.251)
    profile_segment(builder, "head", (0,.252,.25), (0,.448,.25), [(0,.050),(.5,.071),(1,.057)], sides=8)
    rim = []
    for index in range(6):
        angle = tau * index / 6.0 + pi / 6.0
        x, z = cos(angle), sin(angle)
        tip = (x*.099,.475,.251+z*.099)
        rail(builder, f"guard_{index}", [(x*.095,.273,.251+z*.095), (x*.118,.365,.251+z*.118), tip], .013)
        rim.append(tip)
    # Aro superior aberto deixa a chama passar entre as barras.
    for index, tip in enumerate(rim):
        rail(builder, f"rim_{index}", [tip, rim[(index + 1) % len(rim)]], .012)


def wall_hooks(builder):
    box(builder, "wood_rail", (.48,.108,.044), (0,.104,.028))
    for side in (-1, 1):
        x = side * .135
        profile_segment(builder, f"pin_{side}", (x,.127,.044), (x,.127,.063), [(0,.020),(1,.015)])
        rail(builder, f"hook_{side}", [(x,.099,.05),(x,.064,.083),(x+.013,.039,.111),
                                      (x+.024,.055,.142),(x+.022,.088,.142)], .016)
    rail(builder, "wood_splinter", [(-.234,.102,.027),(-.249,.093,.040),(-.229,.084,.048)], .008)


def broken_chain(builder):
    wall_mount(builder, .15, .158)
    ring(builder, "eye", (0,.09,.051), .049,.055,.016, count=8)
    ring(builder, "link_upper", (.004,.014,.081), .051,.072,.015, turn=True, count=8)
    ring(builder, "link_lower", (.019,-.067,.089), .051,.075,.015, count=8)
    points = [(cos(angle)*.043 + .026,sin(angle)*.059-.151,.098)
              for angle in [pi*.67, pi*.86, pi*1.05, pi*1.26, pi*1.45, pi*1.66]]
    rail(builder, "broken_link", points, .010, sides=6)
    rail(builder, "sheared_stub", [(.067,-.150,.10),(.074,-.123,.091),(.061,-.105,.077)], .011, sides=6)


def torn_banner(builder):
    rail(builder, "beam", [(-.319,.748,.082), (.337,.782,.096)], .023, sides=8)
    for side in (-1, 1):
        x = side*.279
        box(builder, f"bracket_{side}", (.049,.097,.025), (x,.732,.018))
        rail(builder, f"tab_{side}", [(x,.713,.022),(x,.724,.066),(x,.762,.09)], .014)
    # Duas faces fechadas com a bainha em alturas diferentes e dobras discretas.
    columns = [
        (-.275,.28,.065),(-.217,.072,.121),(-.151,.153,.085),(-.091,.031,.087),
        (-.023,.183,.124),(.050,.095,.094),(.106,.222,.119),(.179,.181,.097),(.271,.338,.069),
    ]
    draft = MeshDraft(closed=True)
    for index, (x, hem, fold) in enumerate(columns):
        top = .745 + x * .045
        for row, (y, z) in enumerate(((hem,fold),((hem+top)*.5,fold+.014),(top,.087 + x*.015))):
            for face in range(2):
                draft.vertex(f"c{index}_{row}_{face}", m(x,y,z + (face - .5)*.010))
    for index in range(len(columns)-1):
        for row in range(2):
            for face in range(2):
                quad = [f"c{index}_{row}_{face}",f"c{index+1}_{row}_{face}",
                        f"c{index+1}_{row+1}_{face}",f"c{index}_{row+1}_{face}"]
                left = quad[:3]
                right = [quad[0], quad[2], quad[3]]
                draft.face(f"panel_{index}_{row}_{face}_a", left if face else left[::-1])
                draft.face(f"panel_{index}_{row}_{face}_b", right if face else right[::-1])
        for row in (0, 2):
            quad = [f"c{index}_{row}_0", f"c{index+1}_{row}_0", f"c{index+1}_{row}_1", f"c{index}_{row}_1"]
            draft.face(f"hem_{index}_{row}", quad if row == 0 else quad[::-1])
    for index in (0, len(columns)-1):
        for row in range(2):
            quad = [f"c{index}_{row}_0", f"c{index}_{row+1}_0", f"c{index}_{row+1}_1", f"c{index}_{row}_1"]
            draft.face(f"edge_{index}_{row}", quad if index == 0 else quad[::-1])
    draft.anchor("base", m(0, 0, 0))
    builder.add_mesh("fabric", "root", draft, pivot="base", no_overlap_check=True, allow_triangles=True)


def floor_torch(builder):
    lathe(builder, "base", [(.189,0),(.192,.032),(.17,.056),(.10,.073)], segments=8)
    for index in range(3):
        angle = tau * index / 3.0
        rail(builder, f"brace_{index}", [(0,.20,0),(cos(angle)*.115,.121,sin(angle)*.115),
                                        (cos(angle)*.148,.048,sin(angle)*.148)], .018)
    lathe(builder, "shaft", [(.076,.055),(.062,.123),(.046,.324),(.061,.578),(.047,.730)], segments=8)
    lathe(builder, "cup", [(.056,.724),(.072,.762),(.123,.798),(.133,.829)], segments=8)
    profile_segment(builder, "head", (0,.796,0), (0,.891,0), [(0,.081),(.38,.09),(1,.051)], sides=8)


SHAPES = {
    "light_wall_torch_crooked_01": crooked_torch,
    "light_wall_torch_caged_01": caged_torch,
    "prop_wall_torch_burned_01": partial(crooked_torch, burned=True),
    "prop_dungeon_wall_hooks_01": wall_hooks,
    "prop_dungeon_chain_broken_01": broken_chain,
    "prop_dungeon_banner_torn_01": torn_banner,
    "light_floor_torch_stand_01": floor_torch,
}


def build_model(asset):
    builder = ModelBuilder(asset, modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("root")
    SHAPES[asset](builder)
    return builder


def paint_model(painter, asset):
    iron, rust, wood, ash, ember, cloth, thread = map(_rgb, (FERRO, RUST, MADEIRA, ASH, EMBER, CLOTH, THREAD))
    is_burned = asset == "prop_wall_torch_burned_01"

    def paint(rows, name):
        p = np.asarray(rows.model_position, float) / U
        n = np.asarray(rows.model_normal, float)
        px, py = texel_xy(rows, len(rows.x))
        x, y, z = p.T
        grain = fbm(p, .035, 2, 763)
        tone = .38 + grain*2.54 + n[:,1]*.8 + n[:,2]*.38
        if name == "fabric":
            fray = (fbm(p, .023, 1, 43)>.62) & (y<.35)
            seam = (np.abs(x) > .237) | (y > .690) | (np.abs(x) < .008)
            diamond = np.abs(x) * 1.75 + np.abs(y-.471) < .197
            accent = pick_clean(thread, tone * .84 + .24, px, py)
            banner = pick_clean(cloth, tone - fray * .76 + np.where(diamond, .55, 0), px, py)
            return np.where((seam | (diamond & (np.abs(x)*1.75+np.abs(y-.471)>.170)))[:,None], accent, banner)
        if name.startswith(("stick", "wood_", "beam")):
            grain = fbm(p * np.array([4.2, 1, 4.2]), .035, 2, 44)
            return pick_clean(wood, .55 + grain*2.45 + n[:,1]*.85, px, py)
        if name.startswith("head"):
            top = .35 if is_burned else (.89 if "stand" in asset else (.45 if "caged" in asset else .46))
            charcoal = pick_clean(ash, .55 + grain*2.8 + n[:,1]*1.20, px, py)
            if is_burned:
                soot = grain < .45
                return np.where(soot[:, None], pick_clean(wood, .2 + grain*1.13, px, py), charcoal)
            spark = (y > top-.018) & (grain > .47)
            return np.where(spark[:,None], pick_clean(ember, grain*2.2 + n[:,1]*.6, px, py), charcoal)
        oxide = fbm(p, .052, 2, 86) > (.60 if "pin" not in name else .79)
        metal = pick_clean(iron, tone + (.8 if "pin" in name or "stub" in name else 0.0), px, py)
        return np.where(oxide[:,None], pick_clean(rust, grain*3.25+n[:,1]*.8, px, py), metal)

    for element in painter.all_elements():
        element.paint_surface_arrays(partial(paint, name=element.name))

