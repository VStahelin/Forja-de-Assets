"""Zelador de slime com a base contínua e dois apoios sob a mesma malha."""
from __future__ import annotations

from math import cos, exp, hypot, sin, tau
from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib import MeshDraft, ModelBuilder
from Tools.recipe_context import recipe_paths

U = 16
ASSET_BUILD_GEOMETRY = "recipe"


def meters(point):
    return tuple(value * U for value in point)


def ramp(value, low, high):
    t = max(0.0, min(1.0, (value - low) / (high - low)))
    return t * t * (3.0 - 2.0 * t)


def ring_mesh(builder, name, rings, deform=None, sides=16, facial=False):
    """Feche a superfície com faces trianguladas antes de calcular as UVs."""
    draft = MeshDraft(closed=True)
    for row, (y, width, front, back, cx, cz) in enumerate(rings):
        for side in range(sides):
            angle = tau * side / sides
            radial = sin(angle)
            x = cx + width * cos(angle)
            z = cz + radial * (front if radial >= 0 else back)
            point = deform(x, y, z, angle, row) if deform else (x, y, z)
            draft.vertex(f"v{row}_{side}", meters(point))
    for row in range(len(rings) - 1):
        for side in range(sides):
            next_side = (side + 1) % sides
            a, b = f"v{row}_{side}", f"v{row}_{next_side}"
            c, d = f"v{row + 1}_{next_side}", f"v{row + 1}_{side}"
            front = facial and sin(tau * (side + .5) / sides) > .38
            group = "facial_surface" if front and 1.416 <= rings[row][0] < 1.615 else None
            draft.face(f"side{row}_{side}_a", (a, c, b), group=group)
            draft.face(f"side{row}_{side}_b", (a, d, c), group=group)
    for row in (0, len(rings) - 1):
        ring = [draft.vertices[f"v{row}_{side}"] for side in range(sides)]
        center = tuple(sum(axis) / sides for axis in zip(*ring))
        label = f"cap{row}"
        draft.vertex(label, center)
        for side in range(sides):
            edge = (f"v{row}_{side}", f"v{row}_{(side + 1) % sides}")
            draft.face(f"{label}_{side}", (label, *(edge if row == 0 else edge[::-1])))
    center = tuple((min(axis) + max(axis)) / 2 for axis in zip(*draft.vertices.values()))
    draft.anchor("center", center)
    builder.add_mesh(name, "rig", draft, pivot="center", allow_triangles=True, no_overlap_check=True)
    return draft.vertices


def hand_mesh(builder, rig, side, sign):
    """Constrói palma, quatro dedos e polegar na mesma superfície fechada."""
    draft = MeshDraft(closed=True)
    columns = (-.057, -.033, -.027, -.003, .003, .026, .032, .054)
    sections = ((.858, .67, .025), (.818, .78, .029), (.775, .96, .032), (.728, 1, .024))
    wrist_x = .446
    palm_z = .067
    points = {}
    weights = {}
    hand_bone = f"hand_{side}"

    def vertex(name, x, y, z):
        points[name] = (x, y, z)
        weights[name] = {hand_bone: 1}
        draft.vertex(name, meters((sign * x, y, z)))
        return name

    def quad(label, a, b, c, d):
        draft.face(f"{label}_a", (a, b, c))
        draft.face(f"{label}_b", (a, c, d))

    def bridge(label, start, end, omit=None):
        for index in range(len(start)):
            if index == omit:
                continue
            following = (index + 1) % len(start)
            quad(f"{label}_{index}", start[index], start[following], end[following], end[index])

    for row, (height, width, depth) in enumerate(sections):
        for i, column in enumerate(columns):
            for surface, direction in (("f", 1), ("b", -1)):
                vertex(f"{surface}{row}_{i}", wrist_x + column * width, height,
                       palm_z + direction * (depth - abs(column) * .11))

    def perimeter(row):
        return [f"f{row}_{i}" for i in range(8)] + [f"b{row}_{i}" for i in reversed(range(8))]

    for row in range(3):
        bridge(f"palm{row}", perimeter(row), perimeter(row+1), omit=15 if row == 1 else None)
    for i in range(7):
        quad(f"wrist{i}", f"f0_{i+1}", f"f0_{i}", f"b0_{i}", f"b0_{i+1}")
    for i in (1, 3, 5):
        quad(f"webbing{i}", f"f3_{i}", f"f3_{i+1}", f"b3_{i+1}", f"b3_{i}")

    def digit(label, opening, reach):
        center = tuple(sum(axis) / 4 for axis in zip(*(points[key] for key in opening)))
        previous = opening
        rings = [opening]
        for row, (advance, width) in enumerate(((.39, .87), (.78, .72), (1, .49))):
            next_ring = []
            for index, key in enumerate(opening):
                offset = tuple(value - mid for value, mid in zip(points[key], center))
                x, y, z = (mid + advance * shift + width * local
                           for mid, shift, local in zip(center, reach, offset))
                next_ring.append(vertex(f"{label}{row}_{index}", x, y, z + .012 * advance ** 2))
            bridge(f"{label}ring{row}", previous, next_ring)
            previous = next_ring
            rings.append(next_ring)
        quad(f"{label}tip", *previous)

        def ring_center(ring):
            x, y, z = (sum(axis) / 4 for axis in zip(*(points[key] for key in ring)))
            return meters((sign * x, y, z))

        thumb = label == "thumb"
        segments = ("proximal", "distal") if thumb else ("proximal", "middle", "distal")
        names = tuple(f"{label}_{segment}_{side}" for segment in segments)
        joint_rings = (rings[0], rings[1], rings[3]) if thumb else rings
        rig.add_chain(f"{label}_chain_{side}", joints=tuple(map(ring_center, joint_rings)),
                      names=names, parent=hand_bone, connected=False)
        for key in opening:
            weights[key] = {hand_bone: .86, names[0]: .14}
        for key in rings[1]:
            weights[key] = {names[0]: .54, names[1]: .46}
        for key in rings[2]:
            weights[key] = {names[-1]: 1} if thumb else {names[1]: .52, names[2]: .48}
        for key in rings[3]:
            weights[key] = {names[-1]: 1}

    for finger, distance in enumerate((.077, .090, .082, .064)):
        start = finger * 2
        digit(f"finger{finger}", (f"f3_{start}", f"f3_{start+1}", f"b3_{start+1}", f"b3_{start}"),
              ((finger - 1.5) * .008, -distance, .008))
    digit("thumb", ("b1_0", "f1_0", "f2_0", "b2_0"), (-.057, -.025, .023))

    draft.anchor("wrist", meters((sign * wrist_x, sections[0][0], palm_z)))
    builder.add_mesh(hand_bone, "rig", draft, pivot="wrist", allow_triangles=True, no_overlap_check=True)
    rig.bind(hand_bone, mode="explicit", weights=weights)


def face_shape(x, y, z, angle, _row):
    """Esculpe os planos do rosto dentro da malha da cabeça."""
    front = max(0, sin(angle)) ** 2
    face_x = x - .007
    eye_distance = abs(abs(face_x) - .059)
    eye_height = 1.543 - .075 * abs(face_x)
    mouth_height = 1.459 - 3.2 * face_x ** 2 + .018 * face_x

    def relief(xdist, width, height, span):
        return exp(-(xdist / width) ** 2 - ((y - height) / span) ** 2)

    brow = .021 * relief(eye_distance, .046, eye_height + .025, .017)
    socket = -.022 * relief(eye_distance, .039, eye_height, .015)
    cheek = .021 * relief(abs(face_x) - .077, .040, 1.507, .032)
    nose_bridge = .025 * relief(face_x, .021, 1.530, .045)
    nose_tip = .031 * relief(face_x - .002, .026, 1.495, .017)
    nostril = -.010 * relief(abs(face_x) - .021, .010, 1.487, .009)
    mouth = -.012 * relief(face_x, .065, mouth_height, .009)
    lower_lip = .009 * relief(face_x, .049, mouth_height - .014, .010)
    chin = .012 * relief(face_x, .072, 1.420, .017)
    return x, y, z + front * (brow + socket + cheek + nose_bridge + nose_tip + nostril + mouth + lower_lip + chin)


def strap_mesh(builder, name, path):
    draft = MeshDraft(closed=True)
    for row, (x, y, z) in enumerate(path):
        previous, following = path[max(row - 1, 0)], path[min(row + 1, len(path) - 1)]
        dy, dz = following[1] - previous[1], following[2] - previous[2]
        span = hypot(dy, dz)
        for side, (width, thickness) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
            draft.vertex(
                f"v{row}_{side}",
                meters((x + width * 0.018, y + thickness * 0.006 * dz / span,
                        z - thickness * 0.006 * dy / span)),
            )
    for row in range(len(path) - 1):
        for side in range(4):
            n = (side + 1) % 4
            a, b, c, d = f"v{row}_{side}", f"v{row}_{n}", f"v{row + 1}_{n}", f"v{row + 1}_{side}"
            draft.face(f"a{row}_{side}", (a, b, c))
            draft.face(f"b{row}_{side}", (a, c, d))
    for row in (0, len(path) - 1):
        a, b, c, d = (f"v{row}_{side}" for side in (reversed(range(4)) if row == 0 else range(4)))
        draft.face(f"end{row}_a", (a, b, c))
        draft.face(f"end{row}_b", (a, c, d))
    draft.anchor("center", meters(path[1]))
    builder.add_mesh(name, "rig", draft, pivot="center", allow_triangles=True, no_overlap_check=True)


def apron_mesh(builder):
    draft = MeshDraft(closed=True)
    rows = (
        (.649, .237, .221), (.714, .237, .207), (.871, .242, .198),
        (1.018, .189, .208), (1.139, .163, .201), (1.250, .147, .186),
    )
    columns = 7
    for row, (y, width, depth) in enumerate(rows):
        for col in range(columns):
            across = 2 * col / (columns - 1) - 1
            hem = .021 * (1 - cos(2.3 * col)) if row == 0 else 0
            for face, offset in (("f", 0.006), ("b", -0.006)):
                draft.vertex(f"{face}{row}_{col}", meters((
                    width * across, y - hem, depth - .046 * across ** 2 + offset,
                )))

    def quad(name, a, b, c, d):
        draft.face(f"{name}_a", (a, b, c))
        draft.face(f"{name}_b", (a, c, d))

    last = columns - 1
    for row in range(len(rows) - 1):
        for col in range(last):
            for face in ("f", "b"):
                points = (f"{face}{row}_{col}", f"{face}{row}_{col + 1}",
                          f"{face}{row + 1}_{col + 1}", f"{face}{row + 1}_{col}")
                quad(f"{face}{row}_{col}", *(points if face == "f" else points[::-1]))
        quad(f"left{row}", f"f{row}_0", f"f{row + 1}_0", f"b{row + 1}_0", f"b{row}_0")
        quad(f"right{row}", f"f{row + 1}_{last}", f"f{row}_{last}", f"b{row}_{last}", f"b{row + 1}_{last}")
    top = len(rows) - 1
    for col in range(last):
        quad(f"hem{col}", f"f0_{col + 1}", f"f0_{col}", f"b0_{col}", f"b0_{col + 1}")
        quad(f"bib{col}", f"f{top}_{col}", f"f{top}_{col + 1}", f"b{top}_{col + 1}", f"b{top}_{col}")
    draft.anchor("center", meters((0, .96, .186)))
    builder.add_mesh("apron", "rig", draft, pivot="center", allow_triangles=True, no_overlap_check=True)


def lower_shape(x, y, z, angle, _row):
    front = max(0, sin(angle))
    below_waist = 1 - ramp(y, 0.37, 0.64)
    central_groove = exp(-((x - 0.012) / 0.087) ** 2) * front ** 2
    z -= 0.132 * central_groove * below_waist
    leg_volume = exp(-((abs(x - .012) - .159) / .092) ** 2) * front ** 2
    z += .065 * leg_volume * (1 - ramp(y, .27, .52))
    z -= .042 * max(0, -sin(angle)) ** 2 * (1 - ramp(y, .08, .28))
    y += 0.022 * central_groove * (1 - ramp(y, 0.03, 0.23))
    z += 0.025 * sin(5 * angle + y * 14) * below_waist
    x += 0.013 * cos(angle * 5 + 2 * y) * (1 - ramp(y, 0.09, 0.46))
    return x, y, z


def body_weights(point):
    x, y, z = (coord / U for coord in point)
    body = ramp(y, 0.39, 0.83)
    chest = ramp(y, 0.79, 1.23)
    trail = ramp(-z, 0.045, 0.37) * (1 - ramp(y, 0.16, 0.61))
    left = ramp(x, -0.11, 0.11)
    low = (1 - body) * (1 - trail)
    weights = {name: value for name, value in (
        ("pelvis", body * (1 - chest)), ("chest", body * chest),
        ("trail", (1 - body) * trail),
        ("push_L", low * left), ("push_R", low * (1 - left)),
    ) if value > 0}
    # The shared center and rear stay on the original controls. The front of
    # each lobe also follows its knee and foot when posed independently.
    influence = ramp(abs(x), .11, .171) * ramp(z, .047, .13) * (1 - ramp(y, .63, .75))
    if influence > 0:
        side = "L" if x > 0 else "R"
        driver = f"push_{side}"
        portion = weights.get(driver, 0) * influence
        if portion > 0:
            weights[driver] -= portion
            ankle = 1 - ramp(y, .115, .28)
            thigh = ramp(y, .32, .53)
            for joint, fraction in (("foot", ankle), ("shin", 1 - ankle - thigh), ("thigh", thigh)):
                if fraction > 0:
                    weights[f"{joint}_{side}"] = portion * fraction
    return {name: value for name, value in weights.items() if value > 0}


def build_char_slime_janitor_01_model():
    builder = ModelBuilder("char_slime_janitor_01", modeling_mode="free", require_integer_dimensions=False)
    rig = builder.add_armature("rig")

    def bone(name, start, length, parent=None):
        x, y, z = start
        rig.add_bone(name, between=(meters(start), meters((x, y + length, z))),
                     parent=parent, connected=parent is None)

    bone("root", (0, 0, 0), 0.12)
    bone("pelvis", (0, 0.78, 0), 0.20, "root")
    bone("chest", (0, 1.05, 0), 0.25, "pelvis")
    bone("head", (0.01, 1.385, 0.035), 0.265, "chest")
    rig.add_bone("jaw", between=(meters((.008, 1.48, .076)), meters((.008, 1.416, .151))),
                 parent="head", connected=False)
    bone("trail", (0, 0.052, -0.21), 0.175, "root")
    for side, sign in (("L", 1), ("R", -1)):
        bone(f"push_{side}", (0.16 * sign, 0.085, 0.065), 0.34, "root")
        rig.add_chain(
            f"leg_{side}",
            joints=tuple(meters((sign * x, y, z)) for x, y, z in (
                (.145, .654, .013), (.155, .335, .100), (.165, .101, .058), (.166, .054, .229),
            )),
            names=(f"thigh_{side}", f"shin_{side}", f"foot_{side}"),
            parent=f"push_{side}", connected=False,
        )
        bone(f"upper_arm_{side}", (0.275 * sign, 1.31, 0.015), 0.23, "chest")
        bone(f"forearm_{side}", (0.387 * sign, 1.035, 0.028), 0.22, f"upper_arm_{side}")
        bone(f"hand_{side}", (0.446 * sign, 0.858, 0.067), 0.109, f"forearm_{side}")

    body = ring_mesh(builder, "slime_body", [
        (0.014, .297, .244, .370, .012, -.038),
        (.065, .355, .326, .423, .020, -.048),
        (.133, .345, .302, .350, .019, -.036),
        (.235, .306, .262, .284, .016, -.025),
        (.343, .275, .230, .227, .009, -.016),
        (.458, .253, .208, .190, .003, -.012),
        (.588, .232, .182, .169, .000, -.005),
        (.735, .233, .157, .158, -.004, .000),
        (.86, .246, .169, .156, -.005, .000),
        (1.02, .244, .175, .151, -.005, -.005),
        (1.18, .270, .176, .155, -.007, -.008),
        (1.31, .301, .157, .139, -.001, -.014),
        (1.378, .192, .116, .117, .005, -.007),
        (1.414, .088, .077, .075, .010, .021),
    ], lower_shape, sides=20)
    rig.bind("slime_body", mode="explicit", weights={key: body_weights(v) for key, v in body.items()})

    face = ring_mesh(builder, "slime_head", [
        (1.365, .053, .064, .066, .009, .028), (1.394, .071, .085, .083, .009, .044),
        (1.417, .084, .103, .098, .009, .048), (1.438, .101, .115, .104, .009, .049),
        (1.455, .107, .120, .109, .009, .050), (1.475, .111, .121, .117, .009, .051),
        (1.495, .119, .126, .122, .008, .052), (1.517, .126, .128, .124, .008, .052),
        (1.534, .126, .129, .124, .008, .052), (1.550, .124, .128, .124, .007, .052),
        (1.568, .128, .131, .123, .006, .052), (1.587, .124, .126, .121, .005, .049),
        (1.614, .116, .119, .115, .003, .044), (1.650, .103, .105, .107, .001, .037),
        (1.679, .082, .087, .089, -.002, .031), (1.70, .045, .052, .059, -.005, .026),
    ], face_shape, sides=28, facial=True)
    jaw_weights = {}
    for key, point in face.items():
        _, y, z = (value / U for value in point)
        amount = ramp(y, 1.37, 1.415) * (1 - ramp(y, 1.45, 1.475)) * ramp(z, .063, .133)
        jaw_weights[key] = {joint: w for joint, w in (("head", 1 - amount), ("jaw", amount)) if w > 0}
    rig.bind("slime_head", mode="explicit", weights=jaw_weights)

    for side, sign in (("L", 1), ("R", -1)):
        arm_name = f"arm_{side}"
        arm = ring_mesh(builder, arm_name, [
            (y, width, front, back, sign * x, z + (0.017 if sign > 0 else 0))
            for y, width, front, back, x, z in (
                (.845,.033,.036,.027,.446,.059), (.875,.035,.039,.032,.443,.052),
                (.924,.049,.054,.042,.431,.041), (.971,.059,.066,.052,.415,.030),
                (1.009,.059,.069,.054,.398,.020), (1.046,.049,.055,.050,.384,.018),
                (1.089,.057,.061,.054,.372,.021), (1.148,.069,.076,.061,.344,.017),
                (1.207,.072,.079,.073,.321,.003), (1.261,.086,.088,.081,.292,-.009),
                (1.314,.075,.080,.072,.267,-.013), (1.351,.054,.058,.055,.244,-.012),
            )
        ], lambda x, y, z, angle, _r: (
            x + .005 * cos(3 * angle + y * 18),
            y,
            z + .010 * max(0, sin(angle)) ** 2 * exp(-((y - 1.17) / .083) ** 2)
              - .012 * max(0, -sin(angle)) ** 2 * exp(-((y - 1.046) / .027) ** 2),
        ), sides=12)
        arm_weights = {}
        for key, point in arm.items():
            upper = ramp(point[1] / U, .91, 1.14)
            arm_weights[key] = {name: weight for name, weight in (
                (f"upper_arm_{side}", upper), (f"forearm_{side}", 1 - upper)) if weight > 0}
        rig.bind(arm_name, mode="explicit", weights=arm_weights)
        hand_mesh(builder, rig, side, sign)

    apron_mesh(builder)
    rig.bind("apron", bone="pelvis")
    ring_mesh(builder, "belt", [(.848, .250, .194, .174, 0, -.005),
                               (.884, .252, .193, .177, 0, -.005),
                               (.912, .251, .192, .174, 0, -.005)], sides=16)
    rig.bind("belt", bone="pelvis")
    for side, sign in (("L", 1), ("R", -1)):
        crossing = .006 if sign > 0 else 0
        strap_mesh(builder, f"strap_{side}", [
            (sign * .116, 1.216, .183), (sign * .134, 1.30, .159),
            (sign * .156, 1.384, .102), (sign * .164, 1.406, -.005),
            (sign * .147, 1.348, -.124), (sign * .066, 1.235, -.156 - crossing),
            (-sign * .058, 1.081, -.170 - crossing), (-sign * .146, .903, -.139),
        ])
        rig.bind(f"strap_{side}", bone="chest")

    return builder


def main():
    build_char_slime_janitor_01_model().export_bbmodel(recipe_paths(__file__).model)


if __name__ == "__main__":
    main()
