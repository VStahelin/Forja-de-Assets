"""Entulho e restos da Galeria, modelados em metros com o kit da Forja."""

from math import cos, pi, sin, tau
import random

import numpy as np

from lib import MeshDraft, ModelBuilder
from cleaners_lib.gallery_props import bar
from cleaners_lib.props import U, m, pick_clean
from cleaners_lib.stone_paint import _rgb, fbm, texel_xy

STONE = ["#0d1018", "#1a202b", "#283041", "#3b4558", "#5a6577", "#8590a0"]
GREEN = ["#13211f", "#1e3532", "#2f504b", "#4a7268", "#6f9a8c"]
BONE = ["#3d362e", "#615647", "#8f826b", "#b9ab8f", "#e3d9c0"]
CLOTH = ["#22181a", "#3a2828", "#563c37", "#7a5a4c", "#a08068"]
IRON = ["#16181d", "#262a31", "#3c414b", "#5e6470", "#9aa1ad"]
WOOD = ["#1e140f", "#33221a", "#4f3524", "#734d31", "#9a6c44"]
RUST = ["#2a140c", "#4a2412", "#73391b"]


def closed_loft(builder, name, rings):
    """Anéis de mesma resolução e duas tampas trianguladas."""
    draft = MeshDraft(closed=True)
    sides = len(rings[0])
    for j, ring in enumerate(rings):
        for i, point in enumerate(ring):
            draft.vertex(f"v{j}_{i}", m(*point))
    for j in range(len(rings) - 1):
        for i in range(sides):
            k = (i + 1) % sides
            draft.face(f"side{j}_{i}", [f"v{j}_{i}", f"v{j+1}_{i}", f"v{j+1}_{k}", f"v{j}_{k}"])
    for j in (0, len(rings) - 1):
        draft.vertex(f"center{j}", m(*np.mean(rings[j], axis=0)))
        for i in range(sides):
            k = (i + 1) % sides
            order = (i, k) if j == 0 else (k, i)
            draft.face(f"cap{j}_{i}", [f"center{j}", *(f"v{j}_{n}" for n in order)])
    draft.anchor("base", (0, 0, 0))
    builder.add_mesh(name, "root", draft, pivot="base", no_overlap_check=True, allow_triangles=True)


def oval(x, y, z, rx, rz, sides=8, turn=0.0, uneven=0.0):
    return [(x + rx * cos(turn + tau * i / sides), y + uneven * sin(i * 2.41),
             z + rz * sin(turn + tau * i / sides)) for i in range(sides)]


def chipped_chunk(builder, name, center, dims, turn=0.0, seed=13):
    rng = random.Random(seed)
    x, y, z = center
    width, height, depth = dims
    footprint = [(-.40,-.5), (.27,-.5), (.50,-.28), (.49,.23),
                 (.18,.50), (-.31,.48), (-.50,.26), (-.50,-.28)]
    profile = []
    for level, factor, drift in [(0,.79,0), (.24,1,0), (.73,.93,.02), (1,.66,.075)]:
        ring = []
        for a, b in footprint:
            xx = width * (a * factor + drift)
            zz = depth * (b * factor - drift / 2)
            shift = rng.uniform(-.06, 0) * height if level else 0
            ring.append((x + xx*cos(turn) - zz*sin(turn), y + level*height + shift,
                         z + xx*sin(turn) + zz*cos(turn)))
        profile.append(ring)
    closed_loft(builder, name, profile)


def arced_strip(builder, name, corners, segments):
    """Fatia maciça de anel, com quatro vértices por seção."""
    draft = MeshDraft(closed=True)
    for strip in range(segments + 1):
        for i, point in enumerate(corners(strip / segments)):
            draft.vertex(f"v{strip}_{i}", m(*point))
    for strip in range(segments):
        for i in range(4):
            j = (i + 1) % 4
            draft.face(f"side{strip}_{i}", [f"v{strip}_{i}", f"v{strip+1}_{i}", f"v{strip+1}_{j}", f"v{strip}_{j}"])
    draft.face("end0", [f"v0_{i}" for i in range(4)])
    draft.face("end1", [f"v{segments}_{i}" for i in (3,2,1,0)])
    draft.anchor("base", (0, 0, 0))
    builder.add_mesh(name, "root", draft, pivot="base", no_overlap_check=True)


def arch_fragment(builder):
    for index, (start, end, depth) in enumerate(((.69,.95,.49),(.97,1.19,.52),(1.21,1.48,.45))):
        def corners(t):
            angle = start + t * (end - start)
            cut = .035 * sin(index + t*3)
            return [(r*cos(angle)-.47, r*sin(angle)-.464, z)
                    for r, z in ((.74,-depth/2), (1.06+cut,-depth/2),
                               (1.06+cut,depth/2), (.74,depth/2))]
        arced_strip(builder, f"stone_arch_{index}", corners, 4)


def low_rubble(builder):
    for index, (x, y, z, width, height, depth, turn) in enumerate([
        (-.47,0,.07,.44,.15,.40,.25), (-.13,0,-.12,.45,.18,.43,-.40),
        (.23,0,-.11,.40,.14,.49,.24), (.51,0,.05,.39,.12,.34,.51),
        (.09,.095,.09,.38,.13,.44,-.38), (-.30,.073,.13,.35,.14,.33,.36),
        (-.10,0,.27,.27,.085,.22,1.25), (.40,0,.25,.28,.081,.23,-.14),
    ]):
        # Escalona a base de cada pedra alguns milímetros para não haver faces coplanares.
        chipped_chunk(builder, f"stone_rubble_{index}", (x,y+index*.004,z), (width,height,depth), turn, 101+index)


def curve_spike(builder, name, stations, sides=6):
    rings = []
    for i, (x, y, z, width, height) in enumerate(stations):
        a = np.array(stations[max(0, i-1)][:3])
        b = np.array(stations[min(i+1, len(stations)-1)][:3])
        tangent = b - a
        tangent /= np.linalg.norm(tangent)
        axis = np.cross(tangent, np.array([0, 1, 0]))
        if np.linalg.norm(axis) < .05:
            axis = np.cross(tangent, np.array([0, 0, 1]))
        axis /= np.linalg.norm(axis)
        normal = np.cross(tangent, axis)
        center = np.array([x,y,z])
        rings.append([tuple(center + axis * width * cos(tau*j/sides)
                            + normal * height * sin(tau*j/sides)) for j in range(sides)])
    closed_loft(builder, name, rings)


def creature_jaw(builder):
    def corners(t):
        angle = -.19 + 3.53*t
        lower = .016 + .024 * sin(pi*t)**2
        upper = .12 + .033*sin(2*pi*t+.4)
        return [(r*.25*cos(angle), y, r*.28*sin(angle)-.098)
                for r,y in ((.63,lower),(1,lower),(1,upper),(.63,upper))]
    arced_strip(builder, "bone_jaw", corners, 12)
    for index, (angle, length, width) in enumerate((
        (.09,.15,.052), (.54,.070,.028), (.88,.056,.026), (1.27,.071,.029),
        (1.60,.045,.026), (1.94,.056,.027), (2.30,.054,.030), (2.66,.070,.030), (3.07,.123,.046),
    )):
        x, z = .206*cos(angle), .224*sin(angle) - .098
        base_y = .109 + .029*sin(2*angle+.4)
        curve_spike(builder, f"tooth_{index}", [(x,base_y,z,width,width),
                    (x*.96,base_y+length*.54,z+.015,width*.56,width*.54),
                    (x*.81,base_y+length,z+.03,width*.10,width*.11)])
    for side in (-1, 1):
        closed_loft(builder, "bone_hinge_l" if side < 0 else "bone_hinge_r", [
            oval(side*.207,.024,-.086,.063,.085,6),
            oval(side*.215,.084,-.126,.071,.078,6,.12),
            oval(side*.197,.158,-.155,.047,.045,6)])


def cracked_claw(builder):
    curve_spike(builder, "bone_claw", [(-.035,.091,-.24,.123,.089),
                (-.025,.099,-.10,.109,.092), (.005,.131,.035,.083,.070),
                (.034,.129,.148,.056,.058), (.082,.078,.222,.039,.037),
                (.092,.055,.258,.025,.027)], 8)
    curve_spike(builder, "bone_claw_split", [(-.11,.046,-.185,.033,.037),
                (-.146,.046,-.051,.023,.030), (-.094,.052,.041,.009,.014)])


def carapace(builder):
    closed_loft(builder, "shell_plate", [
        oval(0,.016,0,.272,.217,10,.10,.008),
        oval(0,.07,0,.309,.279,10,.10,.021),
        oval(-.012,.129,.018,.251,.242,10,.10,.015),
        oval(-.026,.183,.087,.125,.116,10,.10,.011)])
    for index, (x,z,width) in enumerate([(-.14,-.024,.035), (0,-.044,.05), (.13,-.022,.031)]):
        curve_spike(builder, f"shell_keel_{index}", [(x,.134,z-.136,width,.033),
                    (x-.012,.165,z,width*.86,.036), (x-.023,.17,z+.171,width*.19,.011)])


def torn_sack(builder):
    closed_loft(builder, "cloth_sack", [
        oval(-.06,.006,0,.275,.199,10,.14),
        oval(-.055,.081,.005,.31,.215,10,.14,.012),
        oval(-.06,.168,-.005,.236,.170,10,.14,.012),
        oval(-.04,.214,-.01,.130,.090,10,.14,.006)])
    closed_loft(builder, "cloth_mouth", [
        oval(.20,.070,0,.090,.080,8,.25), oval(.255,.120,-.005,.080,.090,8,.25,.008),
        oval(.290,.150,0,.045,.060,8,.25,.004)])
    for index, z in enumerate((-.093,-.031,.063)):
        curve_spike(builder, f"rope_stitch_{index}", [
            (-.262,.111,z,.011,.01), (-.253,.181,z+.017,.01,.01),
            (-.211,.218,z+.031,.007,.007)], 6)


def jug_shards(builder):
    for index, (x, z, yaw, r, cut) in enumerate([(-.15,-.08,-.36,.15,.7), (.13,.059,.80,.13,1.1),
                                                (.19,-.14,-.29,.094,.6), (-.20,.115,.3,.085,.9),
                                                (.033,.157,1.40,.105,.69)]):
        def corners(t):
            angle = yaw + cut*(t-.5)
            # Altura mínima de 4,5 cm para o perfil do caco não se cruzar.
            height = max(.045, (r*.79 + .042*sin(t*2.4+index)) * (1-.47*abs(2*t-1)))
            return [(x+radius*cos(angle), y, z+radius*sin(angle))
                    for radius,y in ((r*.76,.012),(r,.012),(r,height),(r*.76,height-.009))]
        arced_strip(builder, f"clay_shard_{index}", corners, 5)


def bracer(builder):
    def corners(t):
        angle = -.14 + t*3.44
        return [(r*cos(angle), .036 + r*sin(angle), z)
                for r,z in ((.087,-.184),(.121,-.211),(.121,.202),(.087,.181))]
    arced_strip(builder, "iron_bracer", corners, 12)
    for index,z in enumerate((-.125,.108)):
        def band(t):
            angle = -.16 + t*3.47
            return [(r*cos(angle), .037 + r*sin(angle), z+d)
                    for r,d in ((.113,-.029),(.135,-.029),(.135,.029),(.113,.029))]
        arced_strip(builder, f"leather_band_{index}", band, 8)
        for side in (-1,1):
            bar(builder, f"rust_rivet_{index}_{side}", (side*.07,.128,z), (side*.078,.145,z), .019, 6)


def warped_tray(builder):
    for i, z in enumerate((-.118,-.002,.112)):
        closed_loft(builder, f"wood_board_{i}", [[(-.304,y,z-.052),(.314,y+.037,z-.052),
                    (.283,y+.049,z+.052),(-.306,y+.013,z+.052)] for y in (.011,.043)])
    for i, (a,c) in enumerate([((-.31,.072,-.178),(.318,.113,-.168)),
                                ((-.31,.071,.174),(.291,.112,.170)),
                                ((-.306,.065,-.167),(-.307,.074,.166)),
                                ((.309,.103,-.16),(.287,.113,.161))]):
        bar(builder, f"wood_border_{i}", a, c, .024, 6)
    for side in (-1,1):
        for i,z in enumerate((-.141,.142)):
            y = .090 if side < 0 else .13
            bar(builder, f"iron_pin_{side}_{i}", (side*.282,y-.018,z),(side*.282,y,z),.013,6)


def broken_column(builder):
    closed_loft(builder, "stone_plinth", [
        oval(0,0,0,.473,.359,10,.18), oval(0,.06,0,.476,.381,10,.18),
        oval(.017,.14,0,.439,.348,10,.18), oval(.014,.181,0,.364,.284,10,.18)])
    closed_loft(builder, "stone_broken_drum", [
        oval(.002,.165,.015,.348,.277,10,.18),
        oval(.002,.27,.015,.337,.269,10,.18),
        oval(.008,.40,.025,.335,.272,10,.18,.03),
        oval(.02,.46,.035,.29,.23,10,.18,.04)])
    chipped_chunk(builder, "stone_fallen_chip", (-.30,.006,-.21), (.32,.12,.28), -.47, 78)


RECIPES = {
    "prop_gallery_chipped_block_01": lambda b: chipped_chunk(b, "stone_chipped_block", (0,0,0), (.60,.264,.46), .06),
    "prop_gallery_arch_fragment_01": arch_fragment,
    "prop_gallery_low_rubble_01": low_rubble,
    "prop_creature_jaw_01": creature_jaw,
    "prop_creature_cracked_claw_01": cracked_claw,
    "prop_creature_carapace_plate_01": carapace,
    "prop_gallery_torn_sack_01": torn_sack,
    "prop_gallery_jug_shards_01": jug_shards,
    "prop_gallery_bracer_01": bracer,
    "prop_gallery_warped_tray_01": warped_tray,
    "prop_gallery_broken_column_01": broken_column,
}


def build_rubble_prop(asset):
    builder = ModelBuilder(asset, modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("root")
    RECIPES[asset](builder)
    return builder


def paint_rubble_prop(painter):
    def color(rows, name):
        xyz = np.asarray(rows.model_position, dtype=float) / U
        normal = np.asarray(rows.model_normal, dtype=float)
        x, y, z = xyz.T
        px, py = texel_xy(rows, len(rows.x))
        seed = sum(ord(letter) for letter in name)
        burst = fbm(xyz, .084, 2, seed)
        grain = fbm(xyz, .017, 2, seed + 17)
        tone = .50 + (burst-.5)*.44 + (grain-.5)*.23 + normal[:,1]*.19
        if name.startswith("stone"):
            surface = pick_clean(_rgb(STONE), tone * (len(STONE)-1), px, py)
            green = pick_clean(_rgb(GREEN), tone * (len(GREEN)-1), px, py)
            return np.where(((burst < .33) & (y < .20))[:,None], green, surface)
        if name.startswith(("shell", "clay")):
            ridge = (abs(np.sin((z + x * .22) * 37)) < .17) & (burst < .65)
            paint = pick_clean(_rgb(GREEN), (tone + ridge*.20)*4, px, py)
            cut = pick_clean(_rgb(STONE), (tone + .16)*5, px, py)
            return np.where(((burst < .43) | ridge)[:,None], cut, paint)
        if name.startswith(("tooth", "bone")):
            bone = pick_clean(_rgb(BONE), (tone + .14 + (y > .12)*.10)*4, px, py)
            root = pick_clean(_rgb(CLOTH), tone*4, px, py)
            return np.where(((burst < .43) & (y < .17))[:,None], root, bone)
        if name.startswith("wood"):
            fib = fbm(xyz * np.array([.13,5.1,5.8]),.065,2,seed+31)
            wood = pick_clean(_rgb(WOOD), (tone + (fib-.5)*.60)*4, px, py)
            wear = pick_clean(_rgb(BONE), tone*4, px, py)
            return np.where(((fib > .53) & (grain > .46))[:,None], wear, wood)
        if name.startswith(("iron", "rust")):
            iron = pick_clean(_rgb(IRON), tone*4, px, py)
            rust = pick_clean(_rgb(RUST), tone*2, px, py)
            return np.where((burst < .46)[:,None], rust, iron)
        tissue = pick_clean(_rgb(CLOTH), tone*4, px, py)
        fiber = pick_clean(_rgb(BONE), (tone-.02)*4, px, py)
        return np.where(((grain > .55) | name.startswith("rope"))[:,None], fiber, tissue)

    for element in painter.all_elements():
        element.paint_surface_arrays(lambda rows, name=element.name: color(rows, name))
