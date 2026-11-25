"""Gerente do lobby: goblin gigante e velho (Cleaners).

Feito a partir da folha de modelo que o Vitor gerou em 21/11/2026
(docs/arte/referencias/015-personagem-gerente-goblin-turnaround.png).

Ficha:
- id char_manager_goblin_01 / Godot SK_Char_ManagerGoblin_01; NPC, orçamento de monstro comum (800 a 2.500 tri).
- 1,90 m sem a pena, cerca de 5,5 cabeças. Frente em +Z, esquerda (_L) em +X. Braços caídos, como na folha.
- Cabeça grande e careca, nariz comprido e curvo, orelhas enormes e pontudas para os lados,
  óculos redondos pequenos, sorriso largo, pena atrás da orelha direita, fios de barba no queixo.
- Camisa de linho com mangas arregaçadas e braçadeiras, colete escuro abotoado sobre a barriga,
  plaqueta sem texto no peito, cinto com fivela, bolsa no quadril esquerdo, molho de chaves no
  direito, calça fina e botas grandes de cano curto.
- Rig FK: o tronco tem pesos por altura (quadril, barriga, peito); o resto é rígido por peça.
- Pintura a 128 px/m (uv-scale 8), paleta mestre, no máximo 16 cores.
"""
from __future__ import annotations

import math

import numpy as np

U = 16.0
DENS = 128.0

# Juntas (m), lado esquerdo; o direito vem do espelho.
SHOULDER = (0.185, 1.380, -0.010)
ELBOW = (0.280, 1.085, -0.025)
WRIST = (0.345, 0.800, 0.02)
HIP = (0.090, 0.860, 0.0)
KNEE = (0.100, 0.480, 0.025)
ANKLE = (0.108, 0.140, 0.0)

SEGMENTS: dict[str, tuple] = {}
MATERIAL: dict[str, str] = {}


def m(*v):
    return tuple(float(c) * U for c in v)


def lerp(a, c, t):
    return tuple(a[i] + (c[i] - a[i]) * t for i in range(3))


def add(a, d):
    return tuple(a[i] + d[i] for i in range(3))


def _profile(spec, n):
    from lib import Profile

    kind = spec[0]
    if kind == "c":
        return Profile.circle(spec[1] * U, segments=n)
    if kind == "o":
        return Profile.oval(spec[1] * U, spec[2] * U, spec[3] * U, segments=n)
    if kind == "rr":
        return Profile.rounded_rectangle(spec[1] * U, spec[2] * U, spec[3] * U)
    if kind == "r":
        return Profile.rectangle(spec[1] * U, spec[2] * U)
    raise ValueError(kind)


def seg(b, name, a, c, sections, mat, n=8, caps=("flat", "flat"), hint=None):
    """Segmento reto com seções (t, perfil)."""
    from lib import SegmentSection

    secs = [SegmentSection(f"s{i}", profile=_profile(spec, n), t=t) for i, (t, spec) in enumerate(sections)]
    if hint is None:
        d = [c[i] - a[i] for i in range(3)]
        ln = math.sqrt(sum(v * v for v in d)) or 1.0
        hint = {"y_hint": (0, 1, 0)} if abs(d[2]) / ln > 0.7 else {"y_hint": (0, 0, 1)}
    b.add_segment(name, "rig", start=m(*a), end=m(*c), sections=tuple(secs), start_cap=caps[0], end_cap=caps[1],
                  no_overlap_check=True, tags=("assembly:manager", mat), **hint)
    SEGMENTS[name] = (a, c)
    MATERIAL[name] = mat


def ring_mesh(b, name, rings, mat, sides=16, deform=None):
    """Superfície fechada por anéis (y, meia_largura, frente, trás, cx, cz)."""
    from lib import MeshDraft

    d = MeshDraft(closed=True)
    for row, (y, w, fr, bk, cx, cz) in enumerate(rings):
        for s in range(sides):
            ang = math.tau * s / sides
            sn = math.sin(ang)
            x = cx + w * math.cos(ang)
            z = cz + sn * (fr if sn >= 0 else bk)
            p = deform(x, y, z, ang) if deform else (x, y, z)
            d.vertex(f"v{row}_{s}", m(*p))
    for row in range(len(rings) - 1):
        for s in range(sides):
            n2 = (s + 1) % sides
            d.face(f"q{row}_{s}", (f"v{row}_{s}", f"v{row + 1}_{s}", f"v{row + 1}_{n2}", f"v{row}_{n2}"))
    for row in (0, len(rings) - 1):
        ring = [d.vertices[f"v{row}_{s}"] for s in range(sides)]
        center = tuple(sum(a) / sides for a in zip(*ring))
        d.vertex(f"cap{row}", center)
        for s in range(sides):
            e = (f"v{row}_{s}", f"v{row}_{(s + 1) % sides}")
            d.face(f"cap{row}_{s}", (f"cap{row}", *(e if row == 0 else e[::-1])))
    center = tuple((min(a) + max(a)) / 2 for a in zip(*d.vertices.values()))
    d.anchor("center", center)
    b.add_mesh(name, "rig", d, pivot="center", allow_triangles=True, no_overlap_check=True,
               tags=("assembly:manager", mat))
    MATERIAL[name] = mat
    return d.vertices


def torus(b, name, center, radius, tube, mat, major=8, minor=3):
    """Argola no plano XY (atravessada por Z)."""
    from lib import MeshDraft

    d = MeshDraft(closed=True)
    cx, cy, cz = center
    for i in range(major):
        a = math.tau * i / major
        for j in range(minor):
            t = math.tau * j / minor
            r = radius + tube * math.cos(t)
            d.vertex(f"v{i}_{j}", m(cx + r * math.cos(a), cy + r * math.sin(a), cz + tube * math.sin(t)))
    for i in range(major):
        for j in range(minor):
            i2, j2 = (i + 1) % major, (j + 1) % minor
            d.face(f"f{i}_{j}", (f"v{i}_{j}", f"v{i2}_{j}", f"v{i2}_{j2}", f"v{i}_{j2}"))
    d.anchor("center", m(*center))
    b.add_mesh(name, "rig", d, pivot="center", no_overlap_check=True, tags=("assembly:manager", mat))
    MATERIAL[name] = mat


# ---------------------------------------------------------------------------
# Geometria
# ---------------------------------------------------------------------------

HEAD_RINGS = [
    # y, meia-largura, frente, trás, cx, cz
    (1.548, .045, .040, .040, 0, .110),
    (1.565, .088, .075, .062, 0, .090),
    (1.595, .118, .098, .090, 0, .075),
    (1.635, .134, .108, .112, 0, .068),
    (1.675, .144, .108, .126, 0, .062),
    (1.715, .152, .106, .136, 0, .056),
    (1.760, .154, .100, .140, 0, .050),
    (1.805, .144, .090, .134, 0, .044),
    (1.845, .120, .074, .112, 0, .040),
    (1.878, .080, .052, .076, 0, .038),
    (1.900, .026, .020, .026, 0, .038),
]

TORSO_RINGS = [
    (0.895, .158, .135, .100, 0, .012),
    (0.950, .168, .170, .102, 0, .018),
    (1.020, .174, .196, .106, 0, .020),
    (1.100, .172, .192, .108, 0, .016),
    (1.180, .166, .152, .112, 0, .006),
    (1.260, .164, .120, .128, 0, -.006),
    (1.335, .172, .104, .142, 0, -.012),
    (1.395, .176, .094, .136, 0, -.010),
    (1.440, .124, .072, .096, 0, .000),
    (1.478, .058, .050, .052, 0, .020),
]


def _face_deform(x, y, z, ang):
    """Testa e maçãs um pouco à frente, olhos fundos e boca larga marcada na malha."""
    front = max(0.0, math.sin(ang)) ** 2
    ex = abs(abs(x) - .052)
    brow = .012 * math.exp(-(ex / .05) ** 2 - ((y - 1.728) / .012) ** 2)
    socket = -.010 * math.exp(-(ex / .035) ** 2 - ((y - 1.695) / .016) ** 2)
    cheek = .010 * math.exp(-((abs(x) - .085) / .035) ** 2 - ((y - 1.645) / .025) ** 2)
    mouth = -.008 * math.exp(-(x / .08) ** 2 - ((y - 1.607) / .008) ** 2)
    return x, y, z + front * (brow + socket + cheek + mouth)


def _arm(b, s):
    sh, el, wr = SHOULDER, ELBOW, WRIST
    seg(b, f"sleeve_{s}", sh, lerp(sh, el, 0.80), [(0, ("c", .058)), (1, ("c", .052))], "shirt")
    seg(b, f"garter_{s}", lerp(sh, el, 0.30), lerp(sh, el, 0.40), [(0, ("c", .061)), (1, ("c", .061))], "garter",
        caps=("open", "open"))
    seg(b, f"cuff_{s}", lerp(sh, el, 0.72), lerp(sh, el, 1.02),
        [(0, ("c", .060)), (0.5, ("c", .068)), (1, ("c", .060))], "shirt_roll")
    seg(b, f"forearm_{s}", el, wr, [(0, ("c", .040)), (0.35, ("c", .044)), (1, ("c", .031))], "skin")
    d = tuple(wr[i] - el[i] for i in range(3))
    ln = math.sqrt(sum(v * v for v in d))
    d = tuple(v / ln for v in d)
    palm_end = add(wr, tuple(v * PALM_LEN for v in d))
    seg(b, f"palm_{s}", wr, palm_end, [(0, ("o", .026, .040, .036)), (0.6, ("o", .028, .050, .046)),
                                       (1, ("o", .024, .052, .048))], "skin")


PALM_LEN = 0.095
# Dedos: (nome, deslocamento em Z na junta, abertura em graus para frente, falanges, quanto curva)
FINGERS = (
    ("index", 0.032, 9.0, (0.048, 0.034, 0.026), 0.80),
    ("middle", 0.011, 3.0, (0.052, 0.037, 0.028), 1.00),
    ("ring", -0.010, -3.0, (0.048, 0.034, 0.026), 1.12),
    ("pinky", -0.030, -10.0, (0.038, 0.027, 0.022), 1.30),
)
# Curvatura natural em repouso (graus por junta, fechando para a palma).
CURL = (12.0, 20.0, 14.0)
FINGER_ELEMENTS: set[str] = set()


def _norm(v):
    ln = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / ln for c in v)


def _cross(a, c):
    return (a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0])


def _bend(direction, toward, degrees):
    """Gira `direction` no plano formado com `toward`."""
    a = math.radians(degrees)
    d = _norm(direction)
    t = _norm(tuple(toward[i] - d[i] * sum(toward[j] * d[j] for j in range(3)) for i in range(3)))
    return _norm(tuple(math.cos(a) * d[i] + math.sin(a) * t[i] for i in range(3)))


def _tube(b, name, points, radii, sides=5):
    """Dedo low poly: anéis ao longo da linha das juntas, base fechada e ponta em vértice."""
    from lib import MeshDraft

    d = MeshDraft(closed=True)
    n = len(points)
    rings = []
    for i, p in enumerate(points[:-1]):
        a = points[max(i - 1, 0)]
        c = points[i + 1]
        t = _norm(tuple(c[k] - a[k] for k in range(3)))
        ref = (0.0, 0.0, 1.0) if abs(t[2]) < 0.9 else (1.0, 0.0, 0.0)
        u = _norm(_cross(t, ref))
        v = _cross(t, u)
        keys = []
        for sdx in range(sides):
            ang = math.tau * sdx / sides
            q = tuple(p[k] + radii[i] * (math.cos(ang) * u[k] + math.sin(ang) * v[k]) for k in range(3))
            key = f"r{i}_{sdx}"
            d.vertex(key, m(*q))
            keys.append(key)
        rings.append(keys)
    d.vertex("tip", m(*points[-1]))
    for i in range(len(rings) - 1):
        for sdx in range(sides):
            n2 = (sdx + 1) % sides
            d.face(f"q{i}_{sdx}", (rings[i][sdx], rings[i][n2], rings[i + 1][n2], rings[i + 1][sdx]))
    last = rings[-1]
    for sdx in range(sides):
        d.face(f"tip{sdx}", (last[sdx], last[(sdx + 1) % sides], "tip"))
    base = rings[0]
    d.vertex("base", m(*points[0]))
    for sdx in range(sides):
        d.face(f"base{sdx}", (base[(sdx + 1) % sides], base[sdx], "base"))
    d.anchor("base_anchor", m(*points[0]))
    b.add_mesh(name, "rig", d, pivot="base_anchor", allow_triangles=True, no_overlap_check=True,
               tags=("assembly:manager", "skin"))
    MATERIAL[name] = "skin"
    FINGER_ELEMENTS.add(name)
    return rings


def _hand_fingers(b, rig, s, sign):
    """Quatro dedos e polegar com três (ou duas) falanges, cada um com sua cadeia de ossos."""
    el = (sign * ELBOW[0], ELBOW[1], ELBOW[2])
    wr = (sign * WRIST[0], WRIST[1], WRIST[2])
    down = _norm(tuple(wr[i] - el[i] for i in range(3)))
    inward = (-sign, 0.0, 0.0)     # a palma olha para a coxa
    forward = (0.0, 0.0, 1.0)
    palm_end = add(wr, tuple(v * PALM_LEN for v in down))
    hand_bone = f"hand_{s}"

    def build(label, start, direction, lengths, radii, curl, bones):
        pts = [start]
        dirn = direction
        for k, length in enumerate(lengths):
            dirn = _bend(dirn, inward, curl[k])
            pts.append(add(pts[-1], tuple(c * length for c in dirn)))
        name = f"{label}_{s}"
        joints = list(pts)
        # Ponta arredondada: um anel a mais perto do fim, para o dedo não virar garra.
        cap = tuple(pts[-2][i] + (pts[-1][i] - pts[-2][i]) * 0.72 for i in range(3))
        rings = _tube(b, name, pts[:-1] + [cap, pts[-1]], tuple(radii) + (radii[-1] * 0.72,))
        names = tuple(f"{label}_{bn}_{s}" for bn in bones)
        rig.add_chain(f"{label}_chain_{s}", joints=tuple(m(*p) for p in joints), names=names,
                      parent=hand_bone, connected=False)
        weights = {}
        for i, ring in enumerate(rings):
            if i == 0:
                w = {hand_bone: 0.5, names[0]: 0.5}
            elif i < len(names):
                w = {names[i - 1]: 0.5, names[i]: 0.5}
            else:
                w = {names[-1]: 1.0}
            for key in ring:
                weights[key] = w
        weights["tip"] = {names[-1]: 1.0}
        weights["base"] = {hand_bone: 1.0}
        rig.bind(name, mode="explicit", weights=weights)

    for label, zoff, splay, lengths, bend in FINGERS:
        start = add(palm_end, (inward[0] * 0.004, 0.0, zoff))
        direction = _bend(down, forward, splay)
        r0 = 0.0165 if label != "pinky" else 0.0140
        build(label, start, direction, lengths, (r0, r0 * 0.92, r0 * 0.84), tuple(c * bend for c in CURL),
              ("proximal", "middle", "distal"))
    thumb_start = add(wr, tuple(down[i] * 0.030 + forward[i] * 0.036 + inward[i] * 0.010 for i in range(3)))
    thumb_dir = _norm(tuple(down[i] * 0.85 + forward[i] * 0.40 + inward[i] * 0.30 for i in range(3)))
    build("thumb", thumb_start, thumb_dir, (0.046, 0.036), (0.019, 0.017), (6.0, 18.0), ("proximal", "distal"))


def _leg(b, s):
    hp, kn, an = HIP, KNEE, ANKLE
    seg(b, f"thigh_{s}", lerp(hp, kn, -0.04), kn, [(0, ("c", .074)), (0.5, ("c", .064)), (1, ("c", .058))], "trousers")
    seg(b, f"shin_{s}", kn, lerp(kn, an, 0.82), [(0, ("c", .058)), (0.3, ("c", .056)), (1, ("c", .052))], "trousers")
    x = an[0]
    seg(b, f"boot_shaft_{s}", (x, 0.07, -0.005), (x, 0.255, 0.0),
        [(0, ("o", .066, .072, .062)), (0.7, ("o", .064, .064, .062)), (1, ("o", .070, .068, .066))], "boot", n=8)
    seg(b, f"boot_cuff_{s}", (x, 0.235, 0.0), (x, 0.275, 0.0),
        [(0, ("c", .074)), (1, ("c", .076))], "boot", n=8, caps=("open", "flat"))
    seg(b, f"boot_foot_{s}", (x + .004, 0.058, -0.085), (x + .010, 0.058, 0.215), [
        (0.00, ("o", .066, .052, .058)), (0.35, ("o", .072, .062, .058)), (0.70, ("o", .074, .048, .058)),
        (1.00, ("o", .050, .024, .042))], "boot", n=8)


def build_manager(b):
    SEGMENTS.clear()
    MATERIAL.clear()
    rig = b.add_armature("rig")

    # --- Cabeça ---
    head_v = ring_mesh(b, "head", HEAD_RINGS, "skin", sides=16, deform=_face_deform)
    seg(b, "nose", (0, 1.705, 0.150), (0, 1.672, 0.268),
        [(0, ("c", .030)), (0.6, ("c", .031)), (1, ("c", .027))], "skin")
    seg(b, "nose_tip", (0, 1.672, 0.268), (0, 1.612, 0.300),
        [(0, ("c", .027)), (0.5, ("c", .020)), (1, ("c", .007))], "skin", n=6)
    seg(b, "ear_L", (0.135, 1.705, 0.040), (0.380, 1.770, 0.000),
        [(0, ("o", .050, .016, .016)), (0.30, ("o", .078, .014, .014)), (0.70, ("o", .046, .010, .010)),
         (1, ("o", .005, .004, .004))], "ear", n=6, hint={"x_hint": (0, 1, 0)})
    seg(b, "lens_L", (0.055, 1.692, 0.168), (0.055, 1.692, 0.180), [(0, ("c", .029)), (1, ("c", .029))], "lens", n=8)
    seg(b, "bridge", (-0.027, 1.700, 0.180), (0.027, 1.700, 0.180), [(0, ("c", .005)), (1, ("c", .005))], "iron",
        n=4, hint={"x_hint": (0, 1, 0)})
    seg(b, "quill", (-0.110, 1.745, -0.020), (-0.185, 1.965, -0.080),
        [(0, ("o", .004, .004, .004)), (0.25, ("o", .020, .005, .005)), (0.75, ("o", .022, .005, .005)),
         (1, ("o", .004, .003, .003))], "quill", n=4)
    seg(b, "chin_hair_L", (0.042, 1.585, 0.140), (0.052, 1.500, 0.145), [(0, ("c", .008)), (1, ("c", .003))], "hair", n=4)
    seg(b, "neck", (0, 1.445, 0.010), (0, 1.590, 0.085), [(0, ("c", .056)), (1, ("c", .052))], "skin")

    # --- Tronco (camisa e colete pintados na mesma malha) ---
    torso_v = ring_mesh(b, "torso", TORSO_RINGS, "torso", sides=16)
    seg(b, "collar", (0, 1.440, -0.002), (0, 1.490, 0.010), [(0, ("c", .070)), (1, ("c", .060))], "shirt",
        n=8, caps=("open", "open"))
    seg(b, "nameplate", (0.085, 1.255, 0.122), (0.085, 1.255, 0.134), [(0, ("r", .070, .026)), (1, ("r", .070, .026))],
        "plate")
    seg(b, "belt", (0, 0.875, 0.004), (0, 0.930, 0.010),
        [(0, ("o", .166, .142, .108)), (1, ("o", .170, .150, .110))], "belt", n=10)
    seg(b, "buckle", (0, 0.880, 0.157), (0, 0.925, 0.157), [(0, ("r", .060, .014)), (1, ("r", .060, .014))], "iron")
    seg(b, "pelvis", (0, 0.760, 0.0), (0, 0.900, 0.006),
        [(0, ("o", .150, .095, .100)), (1, ("o", .160, .128, .102))], "trousers", n=8)
    seg(b, "pouch", (0.168, 0.780, 0.030), (0.172, 0.890, 0.030), [(0, ("rr", .050, .070, .015)), (1, ("rr", .048, .066, .014))],
        "pouch")
    torus(b, "key_ring", (-0.150, 0.810, 0.085), 0.030, 0.006, "iron")
    seg(b, "key_a", (-0.165, 0.785, 0.088), (-0.172, 0.690, 0.090), [(0, ("r", .010, .006)), (1, ("r", .010, .006))], "iron")
    seg(b, "key_a_bit", (-0.172, 0.700, 0.090), (-0.152, 0.700, 0.090), [(0, ("r", .016, .006)), (1, ("r", .016, .006))],
        "iron", hint={"x_hint": (0, 1, 0)})
    seg(b, "key_b", (-0.135, 0.785, 0.092), (-0.128, 0.705, 0.096), [(0, ("r", .009, .006)), (1, ("r", .009, .006))], "iron")

    _arm(b, "L")
    _leg(b, "L")

    # --- Ossos ---
    rig.add_bone("root", between=(m(0, 0, 0), m(0, 0.12, 0)))
    rig.add_bone("hips", between=(m(0, 0.86, 0), m(0, 0.98, 0)), parent="root", connected=False)
    rig.add_bone("spine", between=(m(0, 0.98, 0), m(0, 1.20, 0)), parent="hips")
    rig.add_bone("chest", between=(m(0, 1.20, 0), m(0, 1.44, -0.005)), parent="spine")
    rig.add_bone("neck", between=(m(0, 1.445, 0.010), m(0, 1.585, 0.080)), parent="chest", connected=False)
    rig.add_bone("head", between=(m(0, 1.585, 0.080), m(0, 1.90, 0.05)), parent="neck")
    rig.add_bone("upper_arm_L", between=(m(*SHOULDER), m(*ELBOW)), parent="chest", connected=False)
    rig.add_bone("forearm_L", between=(m(*ELBOW), m(*WRIST)), parent="upper_arm_L")
    rig.add_bone("hand_L", between=(m(*WRIST), m(*add(WRIST, (0.02, -0.20, 0.02)))), parent="forearm_L")
    rig.add_bone("thigh_L", between=(m(*HIP), m(*KNEE)), parent="hips", connected=False)
    rig.add_bone("shin_L", between=(m(*KNEE), m(*ANKLE)), parent="thigh_L")
    rig.add_bone("foot_L", between=(m(*add(ANKLE, (0, -0.08, 0))), m(ANKLE[0], 0.05, 0.20)), parent="shin_L",
                 connected=False)
    b.mirror("upper_arm_L", kind="bone")
    b.mirror("thigh_L", kind="bone")

    for name in [n for n in list(MATERIAL) if n.endswith("_L") and n not in ("chin_hair_L",)] + ["chin_hair_L"]:
        b.mirror(name, kind="element")
        rn = name[:-2] + "_R"
        if name in SEGMENTS:
            a, c = SEGMENTS[name]
            SEGMENTS[rn] = ((-a[0], a[1], a[2]), (-c[0], c[1], c[2]))
        MATERIAL[rn] = MATERIAL[name]

    FINGER_ELEMENTS.clear()
    for side, sign in (("L", 1), ("R", -1)):
        _hand_fingers(b, rig, side, sign)

    def bone_for(name):
        side = name[-1] if name[-2:] in ("_L", "_R") else ""
        base = name[:-2] if side else name
        if base in ("sleeve", "garter", "cuff"):
            return f"upper_arm_{side}"
        if base == "forearm":
            return f"forearm_{side}"
        if base == "palm":
            return f"hand_{side}"
        if base == "thigh":
            return f"thigh_{side}"
        if base in ("shin", "boot_shaft", "boot_cuff"):
            return f"shin_{side}"
        if base == "boot_foot":
            return f"foot_{side}"
        if base in ("ear", "lens", "chin_hair") or name in ("nose", "nose_tip", "bridge", "quill"):
            return "head"
        if name in ("collar", "nameplate"):
            return "chest"
        if name == "neck":
            return "neck"
        return "hips"

    def ramp(v, lo, hi):
        t = max(0.0, min(1.0, (v - lo) / (hi - lo)))
        return t * t * (3 - 2 * t)

    weights = {}
    for key, p in torso_v.items():
        y = p[1] / U
        up = ramp(y, 0.93, 1.05)
        top = ramp(y, 1.14, 1.26)
        w = {"hips": 1 - up, "spine": up * (1 - top), "chest": up * top}
        weights[key] = {k: v for k, v in w.items() if v > 1e-4}
    rig.bind("torso", mode="explicit", weights=weights)
    rig.bind("head", bone="head")
    del head_v
    for name in list(MATERIAL):
        if name not in ("torso", "head") and name not in FINGER_ELEMENTS:
            rig.bind(name, bone=bone_for(name))
    return b


# ---------------------------------------------------------------------------
# Pintura (128 px/m)
# ---------------------------------------------------------------------------

PELE = ["#1e3532", "#2f504b", "#4a7268", "#6f9a8c"]      # pedra_verde 1-4
LINHO = ["#8f826b", "#b9ab8f", "#e3d9c0"]                 # osso 2-4
COURO = ["#1e140f", "#33221a", "#4f3524", "#734d31"]      # madeira 0-3
CALCA = ["#1e3532", "#283041", "#3b4558"]                 # pedra_verde 1 + pedra 1-2
FERRO = "#5e6470"                                         # ferro 3
ESCURO = "#0d1018"                                        # abismo 1
BAYER2 = np.array([[0, 2], [3, 1]]) / 4.0 + 0.125
LIGHT = np.array([-0.30, 0.75, 0.60])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def _rgb(hexes):
    return np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] + [255] for h in hexes], dtype=np.uint8)


def _pick(ramp, fidx, px, py):
    fidx = np.clip(fidx, 0, len(ramp) - 1)
    i = np.floor(fidx).astype(int)
    f = fidx - i
    up = np.where(f > 0.7, True, np.where(f < 0.3, False, BAYER2[py % 2, px % 2] < 0.5))
    return ramp[np.minimum(i + up.astype(int), len(ramp) - 1)]


def paint_manager(painter):
    from cleaners_lib.stone_paint import fbm, texel_xy

    if not MATERIAL:
        from lib.model_builder import ModelBuilder

        build_manager(ModelBuilder("registro", modeling_mode="free", require_integer_dimensions=False))
    pele, linho, couro, calca = (_rgb(c) for c in (PELE, LINHO, COURO, CALCA))
    ferro, escuro = _rgb([FERRO])[0], _rgb([ESCURO])[0]

    def frame(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        nrm = np.asarray(rows.model_normal, float)
        return n, px, py, p, nrm

    def lit(nrm, base, k=1.0):
        lam = nrm @ LIGHT
        return base + k * np.where(lam > 0.55, 1.0, np.where(lam < -0.1, -1.0, 0.0))

    def skin(rows, name):
        n, px, py, p, nrm = frame(rows)
        x, y, z = p.T
        idx = lit(nrm, np.full(n, 1.8), 1.0) + (fbm(p, 0.06, 2, 17) - 0.5) * 0.5
        c = _pick(pele, idx, px, py)
        spots = (fbm(p, 0.025, 2, 29) > 0.80)
        c = np.where(spots[:, None], pele[1], c)
        if name == "head":
            front = nrm[:, 2] > 0.25
            # Rugas da testa: três linhas horizontais curvas.
            for k, yy in enumerate((1.775, 1.800)):
                curve = yy + 0.5 * x ** 2
                wr = front & (np.abs(y - curve) < 0.003) & (np.abs(x) < 0.060 - 0.015 * k) & (np.abs(x) > 0.008)
                c = np.where(wr[:, None], pele[1], c)
            # Sobrancelha pesada e sombra embaixo dos óculos.
            ex = np.abs(np.abs(x) - 0.052)
            brow = front & (ex < 0.042) & (np.abs(y - (1.728 + 0.25 * ex)) < 0.006)
            c = np.where(brow[:, None], pele[0], c)
            # Sorriso largo de dentes tortos.
            smile = 1.606 + 2.2 * x ** 2
            lip = front & (np.abs(x) < 0.082) & (np.abs(y - smile) < 0.006)
            teeth = front & (np.abs(x) < 0.050) & (y < smile - 0.004) & (y > smile - 0.017) & \
                    ~((np.floor((x + 1) * DENS / 3) % 3 == 0) & (np.abs(x) > 0.012))
            c = np.where(teeth[:, None], linho[1], c)
            c = np.where(lip[:, None], escuro, c)
            corner = front & (np.abs(np.abs(x) - 0.086) < 0.006) & (np.abs(y - (smile + 0.004)) < 0.007)
            c = np.where(corner[:, None], pele[0], c)
            # Fios brancos ralos nos lados da careca.
            side = (np.abs(x) > 0.10) & (y > 1.72) & (y < 1.84) & (z < 0.06)
            hair = side & ((px * 3 + py) % 7 == 0) & (fbm(p, 0.03, 1, 41) > 0.45)
            c = np.where(hair[:, None], linho[0], c)
        if name.startswith("ear"):
            inner = nrm[:, 2] > 0.35
            c = np.where(inner[:, None], _pick(pele, idx - 1.0, px, py), c)
        if name.startswith("nose_tip"):
            c = _pick(pele, idx + 0.4, px, py)
        return c

    def shirt(rows, name):
        n, px, py, p, nrm = frame(rows)
        idx = lit(nrm, np.full(n, 1.1)) + (fbm(p, 0.05, 2, 7) - 0.5) * 0.5
        c = _pick(linho, idx, px, py)
        fold = fbm(p * np.array([1.0, 0.35, 1.0]), 0.035, 2, 13) < 0.28
        c = np.where(fold[:, None], linho[0], c)
        if name.startswith("cuff"):
            a, cc = SEGMENTS[name]
            a, cc = np.array(a), np.array(cc)
            d = cc - a
            t = ((p - a) @ d) / (d @ d)
            band = (np.abs(t - 0.33) < 0.05) | (np.abs(t - 0.68) < 0.05)
            c = np.where(band[:, None], linho[0], c)
        return c

    def torso(rows, name):
        n, px, py, p, nrm = frame(rows)
        x, y, z = p.T
        c = shirt(rows, name)
        front = nrm[:, 2] > 0.0
        # Colete: cobre o tronco de 0,97 m aos ombros, com decote em V na frente e cava larga.
        v_half = 0.008 + 0.20 * np.clip(y - 1.22, 0, None)
        vest = (y > 0.965 - 0.03 * np.clip(np.abs(x) / 0.16, 0, 1)) & (y < 1.43)
        vest &= ~(front & (np.abs(x - 0.004) < v_half) & (y > 1.22))
        vest &= ~((np.abs(x) > 0.150) & (y > 1.33))
        vi = lit(nrm, np.full(n, 1.0), 0.9) + (fbm(p, 0.05, 2, 21) - 0.5) * 0.5
        vc = _pick(couro, vi, px, py)
        seam = (np.abs(np.abs(x) - 0.12) < 0.004) & (nrm[:, 2] < -0.2)
        vc = np.where(seam[:, None], couro[0], vc)
        edge = vest & front & (np.abs(np.abs(x - 0.004) - v_half) < 0.006) & (y > 1.22)
        vc = np.where(edge[:, None], couro[3], vc)
        c = np.where(vest[:, None], vc, c)
        # Botões do lado esquerdo do decote; o terceiro está quase saltando.
        for k, by in enumerate((1.000, 1.045, 1.090)):
            bx = -0.018 if k != 1 else -0.024
            btn = front & (np.abs(x - bx) < 0.007) & (np.abs(y - by) < 0.007)
            c = np.where(btn[:, None], ferro, c)
        # Barriga de camisa aparecendo embaixo do colete e fechada por uma costura.
        under = front & (y < 0.97) & (np.abs(x) < 0.006)
        c = np.where(under[:, None], linho[0], c)
        # Fivela e tira de ajuste do colete nas costas.
        back = nrm[:, 2] < -0.4
        strap = back & (np.abs(y - 1.010) < 0.010) & (np.abs(x) < 0.07)
        c = np.where(strap[:, None], couro[0], c)
        bk = back & (np.abs(y - 1.010) < 0.014) & (np.abs(x) < 0.016)
        c = np.where(bk[:, None], ferro, c)
        return c

    def leather(rows, name, base):
        n, px, py, p, nrm = frame(rows)
        idx = lit(nrm, np.full(n, base)) + (fbm(p, 0.04, 2, 5) - 0.5) * 0.5
        return _pick(couro, idx, px, py), (n, px, py, p, nrm)

    def boot(rows, name):
        c, (n, px, py, p, nrm) = leather(rows, name, 1.6)
        x, y, z = p.T
        sole = y < 0.018
        c = np.where(sole[:, None], couro[0], c)
        if name.startswith("boot_shaft") or name.startswith("boot_foot"):
            lx = x - np.sign(x) * ANKLE[0]
            lace_zone = (nrm[:, 2] > 0.45) & (np.abs(lx) < 0.030) & (y > 0.07) & (y < 0.24)
            cross = lace_zone & (np.abs((y * DENS) % 6 - np.abs(lx) * DENS * 0.5 - 1) < 0.9)
            c = np.where(cross[:, None], linho[0], c)
        if name.startswith("boot_cuff"):
            c = _pick(couro, lit(nrm, np.full(n, 2.6)), px, py)
        scuff = fbm(p, 0.03, 2, 88) > 0.80
        return np.where(scuff[:, None], couro[1], c)

    def trousers(rows, name):
        n, px, py, p, nrm = frame(rows)
        idx = lit(nrm, np.full(n, 1.0), 0.9) + (fbm(p, 0.05, 2, 9) - 0.5) * 0.5
        c = _pick(calca, idx, px, py)
        crease = fbm(p * np.array([1.0, 0.3, 1.0]), 0.03, 2, 19) < 0.25
        c = np.where(crease[:, None], calca[0], c)
        if name.startswith("shin"):
            knee = (np.abs(p[:, 1] - 0.47) < 0.035) & (nrm[:, 2] > 0.3)
            c = np.where(knee[:, None], calca[0], c)
        return c

    def solid(rows, color):
        n = len(rows.x)
        return np.repeat(color[None, :], n, axis=0)

    def lens(rows, name):
        n, px, py, p, nrm = frame(rows)
        x, y, z = p.T
        a, cc = SEGMENTS.get(name, ((0.052, 1.692, 0.14), (0.052, 1.692, 0.152)))
        r = np.hypot(x - a[0], y - a[1])
        c = np.repeat(linho[2][None, :], n, axis=0)
        # Pupila olhando um pouco para dentro e para baixo: cara de quem não entendeu nada.
        pupil = (np.hypot(x - a[0] * 0.80, y - (a[1] - 0.004)) < 0.010)
        c = np.where(pupil[:, None], escuro, c)
        c = np.where((r > 0.021)[:, None], ferro, c)
        return c

    def quill(rows, name):
        n, px, py, p, nrm = frame(rows)
        a, cc = SEGMENTS[name]
        a, cc = np.array(a), np.array(cc)
        d = cc - a
        t = ((p - a) @ d) / (d @ d)
        c = _pick(linho, lit(nrm, np.full(n, 0.8)), px, py)
        c = np.where((t > 0.55)[:, None], _pick(couro, lit(nrm, np.full(n, 1.6)), px, py), c)
        barbs = ((px + py) % 4 == 0) & (t > 0.2)
        c = np.where(barbs[:, None], linho[0], c)
        return c

    def plate(rows, name):
        n, px, py, p, nrm = frame(rows)
        c = _pick(couro, lit(nrm, np.full(n, 3.0)), px, py)
        rim = (np.abs(p[:, 0] - 0.085) > 0.028) | (np.abs(p[:, 1] - 1.255) > 0.008)
        return np.where(rim[:, None], couro[2], c)

    for el in painter.all_elements():
        name = el.name if hasattr(el, "name") else str(el)
        mat = MATERIAL.get(name, "skin")
        if mat in ("skin", "ear"):
            fn = lambda rows, nm=name: skin(rows, nm)
        elif mat in ("shirt", "shirt_roll"):
            fn = lambda rows, nm=name: shirt(rows, nm)
        elif mat == "torso":
            fn = lambda rows, nm=name: torso(rows, nm)
        elif mat == "garter":
            fn = lambda rows: _pick(couro, lit(np.asarray(rows.model_normal, float), np.full(len(rows.x), 0.6)),
                                    *texel_xy(rows, len(rows.x)))
        elif mat in ("belt",):
            fn = lambda rows, nm=name: leather(rows, nm, 1.2)[0]
        elif mat == "pouch":
            fn = lambda rows, nm=name: leather(rows, nm, 2.4)[0]
        elif mat == "boot":
            fn = lambda rows, nm=name: boot(rows, nm)
        elif mat == "trousers":
            fn = lambda rows, nm=name: trousers(rows, nm)
        elif mat == "iron":
            fn = lambda rows: solid(rows, ferro)
        elif mat == "lens":
            fn = lambda rows, nm=name: lens(rows, nm)
        elif mat == "quill":
            fn = lambda rows, nm=name: quill(rows, nm)
        elif mat == "hair":
            fn = lambda rows: solid(rows, linho[0])
        elif mat == "plate":
            fn = lambda rows, nm=name: plate(rows, nm)
        else:
            fn = lambda rows, nm=name: skin(rows, nm)
        el.paint_surface_arrays(fn)
