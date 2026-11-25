"""Paladino morto v2 (Cleaners), refeito do zero a partir da referência do Vitor
(docs/arte/referencias/012-personagem-paladino-morto-turnaround.png).

Ficha:
- id char_adventurer_paladin_01 / Unity SK_Char_Adventurer_Paladin_01; personagem, até 3.000 tri.
- 1,74 m com o elmo, pose em A como na referência, frente em +Z, esquerda (_L) em +X.
- Armadura de placas montada em muitas peças separadas (nada de "vareta"): elmo balde com
  viseira e cruz, gorjal em 3 lâminas, couraça com quilha, saiote de 3 lâminas, cinto com
  fivela e bolsas, coxotes, joelheiras redondas grandes, grevas, escarpes em lâminas,
  ombreira grande em lâminas no ombro esquerdo e menor no direito, braçais com cotoveleira,
  manoplas com dedos, capa longa rasgada e escudo em pipa com sol.
- Rig FK hard (estilo PS1): cada peça rígida num osso; nomes prontos para o ragdoll.
- Pintura a 256 px/m (decisão de densidade pendente com o Vitor): placas chapadas com borda
  clara em cima e junta escura, riscos de sangue em diagonal e respingos, couro marrom nas
  tiras, capa marrom-avermelhada com dobras e furos. Paleta mestre: aço na rampa pedra
  (azul-acinzentado, como na referência), couro na madeira, capa no couro_tecido.
"""
from __future__ import annotations

import math

import numpy as np

U = 16.0
DENS = 256.0  # px por metro desta pintura (uv-scale 16)

# Juntas (m), lado esquerdo; o direito vem do espelho.
SHOULDER = (0.27, 1.36, 0.0)
ELBOW = (0.40, 1.10, 0.0)
WRIST = (0.48, 0.86, 0.04)
HIP = (0.11, 0.90, 0.0)
KNEE = (0.13, 0.49, 0.02)
ANKLE = (0.14, 0.10, 0.0)

# Registro de cada segmento (para a pintura achar as bordas das placas) e do material.
SEGMENTS: dict[str, tuple] = {}
MATERIAL: dict[str, str] = {}


def m(*v):
    return tuple(float(c) * U for c in v)


def lerp(a, c, t):
    return tuple(a[i] + (c[i] - a[i]) * t for i in range(3))


def add(a, d):
    return tuple(a[i] + d[i] for i in range(3))


def _profile(spec, seg):
    from lib import Profile

    kind = spec[0]
    if kind == "c":
        return Profile.circle(spec[1] * U, segments=seg)
    if kind == "o":
        return Profile.oval(spec[1] * U, spec[2] * U, spec[3] * U, segments=seg)
    if kind == "rr":
        return Profile.rounded_rectangle(spec[1] * U, spec[2] * U, spec[3] * U)
    if kind == "r":
        return Profile.rectangle(spec[1] * U, spec[2] * U)
    raise ValueError(kind)


def seg(b, name, a, c, sections, mat="steel", n=10, caps=("flat", "flat"), nudge=None, hint=None):
    """Segmento reto com seções (t, perfil). Perfil: ("c", r) / ("o", meia_largura, frente, trás)
    / ("rr", largura, profundidade, raio) / ("r", largura, profundidade)."""
    from lib import SegmentSection

    secs = []
    for i, (t, spec) in enumerate(sections):
        prof = _profile(spec, n)
        if nudge and i in nudge:
            prof = prof.nudge({k: (dx * U, dy * U) for k, (dx, dy) in nudge[i].items()})
        secs.append(SegmentSection(f"s{i}", profile=prof, t=t))
    if hint is None:
        d = [c[i] - a[i] for i in range(3)]
        ln = math.sqrt(sum(v * v for v in d)) or 1.0
        # Peça que corre ao longo de Z (joelheira, escarpe): o "cima" do perfil passa a ser +Y.
        kw = {"y_hint": (0, 1, 0)} if abs(d[2]) / ln > 0.7 else {"y_hint": (0, 0, 1)}
    else:
        kw = hint
    b.add_segment(name, "rig", start=m(*a), end=m(*c), sections=tuple(secs), start_cap=caps[0], end_cap=caps[1],
                  no_overlap_check=True, tags=("assembly:paladin", mat), **kw)
    SEGMENTS[name] = (a, c)
    MATERIAL[name] = mat


def _cape(b):
    """Capa de uma camada só, com malha mais fina (12 anéis x 20 colunas) para o Cloth do Unity
    dobrar. O material dela no Unity é de duas faces (TestLevelArtPlacer monta isso)."""
    from lib import MeshDraft

    rng = np.random.default_rng(23)
    keys = [(1.41, 0.19, 0.13, -0.03), (1.32, 0.30, 0.19, -0.05), (1.05, 0.31, 0.21, -0.10),
            (0.70, 0.32, 0.23, -0.15), (0.24, 0.33, 0.25, -0.19)]
    # Anéis intermediários interpolados entre os anéis-chave.
    rings = []
    for (a, b2) in zip(keys, keys[1:]):
        steps = 2 if a[0] > 1.3 else 3
        for k in range(steps):
            t = k / steps
            rings.append(tuple(a[i] + (b2[i] - a[i]) * t for i in range(4)))
    rings.append(keys[-1])
    gap = math.radians(150)
    n = 20
    angles = [math.pi / 2 + gap / 2 + (2 * math.pi - gap) * i / n for i in range(n + 1)]
    d = MeshDraft(closed=False)
    for ri, (y, rx, rz, cz) in enumerate(rings):
        for ai, a in enumerate(angles):
            yy = y
            if ri == len(rings) - 1:
                yy = y + (0.09 if ai % 2 else -0.04) * (0.4 + rng.random())
            d.vertex(f"o{ri}_{ai}", m(rx * math.cos(a), yy, cz + rz * math.sin(a)))
    for ri in range(len(rings) - 1):
        for ai in range(n):
            d.face(f"out{ri}_{ai}", [f"o{ri}_{ai}", f"o{ri}_{ai + 1}", f"o{ri + 1}_{ai + 1}", f"o{ri + 1}_{ai}"], group="outside")
    d.anchor("base", m(0, 1.0, -0.1))
    b.add_mesh("cape", "rig", d, pivot="base", no_overlap_check=True, tags=("assembly:paladin", "cape"))
    MATERIAL["cape"] = "cape"


def _arm_parts(b, s):
    """Braço esquerdo (s = "L"). Lâminas, braçal, cotoveleira, antebraço, manopla e mão."""
    sh, el, wr = SHOULDER, ELBOW, WRIST
    seg(b, f"rerebrace_{s}", lerp(sh, el, 0.18), el, [(0, ("c", 0.074)), (0.5, ("c", 0.068)), (1, ("c", 0.062))])
    seg(b, f"arm_cloth_{s}", sh, lerp(sh, el, 0.25), [(0, ("c", 0.06)), (1, ("c", 0.062))], mat="cloth", n=8)
    # Cotoveleira: concha redonda atrás do cotovelo, com asa.
    seg(b, f"couter_{s}", add(el, (0.0, 0.0, -0.02)), add(el, (0.02, 0.0, -0.10)),
        [(0, ("c", 0.078)), (0.45, ("c", 0.072)), (1, ("c", 0.025))])
    seg(b, f"vambrace_{s}", el, lerp(el, wr, 0.82), [(0, ("c", 0.062)), (0.6, ("c", 0.066)), (1, ("c", 0.062))])
    seg(b, f"cuff_{s}", lerp(el, wr, 0.70), lerp(el, wr, 1.02), [(0, ("c", 0.066)), (1, ("c", 0.088))],
        caps=("flat", "open"))
    d = tuple((wr[i] - el[i]) for i in range(3))
    ln = math.sqrt(sum(v * v for v in d))
    d = tuple(v / ln for v in d)
    palm_end = add(wr, tuple(v * 0.10 for v in d))
    seg(b, f"palm_{s}", wr, palm_end, [(0, ("o", 0.05, 0.03, 0.03)), (1, ("o", 0.055, 0.03, 0.03))], mat="glove", n=8)
    seg(b, f"fingers_{s}", palm_end, add(palm_end, (0.012, -0.075, 0.03)),
        [(0, ("o", 0.052, 0.026, 0.026)), (0.6, ("o", 0.05, 0.025, 0.022)), (1, ("o", 0.04, 0.016, 0.014))], mat="glove", n=8)
    seg(b, f"thumb_{s}", add(wr, (-0.03, -0.03, 0.04)), add(wr, (-0.045, -0.10, 0.07)),
        [(0, ("c", 0.022)), (1, ("c", 0.016))], mat="glove", n=6)


def _leg_parts(b, s):
    hp, kn, an = HIP, KNEE, ANKLE
    seg(b, f"cuisse_{s}", lerp(hp, kn, 0.05), kn, [(0, ("c", 0.10)), (0.5, ("c", 0.094)), (1, ("c", 0.082))])
    seg(b, f"poleyn_{s}", add(kn, (0, 0.0, 0.03)), add(kn, (0.0, 0.0, 0.135)),
        [(0, ("c", 0.098)), (0.45, ("c", 0.088)), (1, ("c", 0.03))])
    seg(b, f"greave_{s}", kn, lerp(kn, an, 0.95), [(0, ("c", 0.078)), (0.45, ("c", 0.076)), (1, ("c", 0.062))])
    seg(b, f"sabaton_{s}", add(an, (0.0, -0.06, -0.07)), add(an, (0.01, -0.07, 0.21)), [
        (0.00, ("o", 0.065, 0.06, 0.05)), (0.30, ("o", 0.072, 0.07, 0.045)), (0.55, ("o", 0.07, 0.055, 0.04)),
        (0.80, ("o", 0.062, 0.04, 0.03)), (1.00, ("o", 0.045, 0.015, 0.015))])
    # Lâmina do saiote sobre a coxa (tasset).
    seg(b, f"tasset_{s}", (0.10, 0.88, 0.115), (0.115, 0.73, 0.135),
        [(0, ("o", 0.08, 0.02, 0.012)), (1, ("o", 0.085, 0.022, 0.012))], n=8)
    # Bolsa de couro pendurada no cinto.
    seg(b, f"pouch_{s}", (0.12, 0.92, 0.13), (0.12, 0.985, 0.13), [(0, ("r", 0.06, 0.035)), (1, ("r", 0.062, 0.035))],
        mat="leather")


def build_paladin(b, *, slain=False):
    from lib import Profile, SegmentSection

    SEGMENTS.clear()
    MATERIAL.clear()
    rig = b.add_armature("rig")

    # --- Quadril: roupa de baixo, saiote em 3 lâminas, cinto, fivela ---
    seg(b, "pelvis_cloth", (0, 0.76, 0), (0, 0.97, 0), [(0, ("o", 0.13, 0.085, 0.085)), (0.6, ("o", 0.15, 0.10, 0.10)),
                                                        (1, ("o", 0.155, 0.105, 0.10))], mat="cloth", n=10)
    for i, (y1, y0, r1, r0) in enumerate([(1.00, 0.94, 0.17, 0.19), (0.955, 0.89, 0.18, 0.20), (0.905, 0.84, 0.19, 0.21)]):
        seg(b, f"fauld{i}", (0, y0, 0), (0, y1, 0), [(0, ("o", r0, r0 * 0.74, r0 * 0.68)), (1, ("o", r1, r1 * 0.74, r1 * 0.68))],
            n=12, caps=("open", "open"))
    seg(b, "belt", (0, 0.985, 0), (0, 1.035, 0), [(0, ("o", 0.178, 0.132, 0.124)), (1, ("o", 0.178, 0.132, 0.124))],
        mat="leather", n=12)
    seg(b, "buckle", (0, 0.988, 0.128), (0, 1.032, 0.128), [(0, ("r", 0.06, 0.014)), (1, ("r", 0.06, 0.014))], mat="buckle")

    # --- Tronco: gibão por baixo, couraça com quilha, gorjal em 3 lâminas, capa ---
    front = 0.065 if slain else 0.10
    back = 0.06 if slain else 0.10
    seg(b, "torso_cloth", (0, 0.98, 0), (0, 1.36, 0), [(0, ("o", 0.15, front, back)), (1, ("o", 0.18, front + .01, back))],
        mat="cloth", n=8)
    ridge = {i: {3: (0.0, 0.025)} for i in (1, 2, 3)}
    breastplate = [
        (0.00, ("o", 0.165, 0.118, 0.110)), (0.35, ("o", 0.195, 0.145, 0.120)), (0.70, ("o", 0.228, 0.152, 0.125)),
        (0.92, ("o", 0.222, 0.128, 0.120)), (1.00, ("o", 0.150, 0.090, 0.090))]
    gorget = [(1.36, 1.40, 0.155, 0.135), (1.39, 1.43, 0.135, 0.118), (1.42, 1.46, 0.118, 0.10)]
    if slain:
        # Rasgo vertical da lâmina pendular: esterno, gorjal e elmo rachados ao meio (22/11/2026).
        from cleaners_lib import gallery_paladin as gp

        def register(parts, a, c):
            for part in parts:
                if part.endswith("_wound"):
                    MATERIAL[part] = "wound"
                else:
                    SEGMENTS[part] = a, c
                    MATERIAL[part] = "steel"

        register(gp.cleaved_breastplate(b, breastplate), (0, 1.01, 0), (0, 1.40, 0))
        for i, (y0, y1, r0, r1) in enumerate(gorget):
            register(gp.cleaved_gorget(b, i, y0 - 0.004, y1 - 0.004, r0, r1), (0, y0 - 0.004, 0), (0, y1 - 0.004, 0))
    else:
        seg(b, "breastplate", (0, 1.01, 0), (0, 1.40, 0), breastplate, n=12, nudge=ridge)
        for i, (y0, y1, r0, r1) in enumerate(gorget):
            seg(b, f"gorget{i}", (0, y0 - 0.004, 0), (0, y1 - 0.004, 0), [(0, ("c", r0)), (1, ("c", r1))], n=12,
                caps=("open", "open"))
    _cape(b)

    # --- Elmo balde: viseira, cruz no rosto, aro de baixo ---
    if slain:
        parts = gp.cleaved_helm(b)
        register([p for p in parts if p.startswith("helm_rim")], (0, 1.435, 0), (0, 1.47, 0))
        register([p for p in parts if not p.startswith("helm_rim")], (0, 1.44, 0), (0, 1.745, 0))
        # A cruz do rosto racha junto: a trava do nariz cai no rasgo e a testeira vira duas metades.
        gap = gp.CLEAVE_HALF_WIDTH + 0.004
        for side, sx in (("L", 1), ("R", -1)):
            seg(b, f"helm_brow{side}", (sx * gap, 1.625, 0.126), (sx * 0.11, 1.625, 0.126),
                [(0, ("r", 0.032, 0.022)), (1, ("r", 0.032, 0.022))], hint={})
    else:
        seg(b, "helm", (0, 1.44, 0), (0, 1.745, 0), [(0, ("rr", 0.215, 0.235, 0.06)), (0.5, ("rr", 0.232, 0.25, 0.065)),
                                                     (1, ("rr", 0.222, 0.24, 0.06))])
        seg(b, "helm_rim", (0, 1.435, 0), (0, 1.47, 0), [(0, ("rr", 0.235, 0.255, 0.065)), (1, ("rr", 0.235, 0.255, 0.065))],
            caps=("open", "open"))
        seg(b, "helm_brow", (-0.11, 1.625, 0.126), (0.11, 1.625, 0.126), [(0, ("r", 0.032, 0.022)), (1, ("r", 0.032, 0.022))],
            hint={})
        seg(b, "helm_nose", (0, 1.47, 0.127), (0, 1.605, 0.127), [(0, ("r", 0.026, 0.016)), (1, ("r", 0.026, 0.016))])

    # --- Ombreiras: grande em lâminas na esquerda, menor na direita ---
    seg(b, "pauldron_L", (0.17, 1.48, 0.0), (0.46, 1.31, 0.0), [
        (0.00, ("o", 0.05, 0.06, 0.06)), (0.25, ("o", 0.125, 0.14, 0.14)), (0.60, ("o", 0.135, 0.15, 0.15)),
        (0.85, ("o", 0.105, 0.125, 0.125)), (1.00, ("o", 0.04, 0.05, 0.05))], n=12, hint={"x_hint": (0, 1, 0)})
    for i, t in enumerate((0.30, 0.47)):
        a = lerp(SHOULDER, ELBOW, t)
        c = lerp(SHOULDER, ELBOW, t + 0.13)
        seg(b, f"lame{i}_L", a, c, [(0, ("c", 0.105 - 0.008 * i)), (1, ("c", 0.098 - 0.008 * i))], n=12, caps=("open", "open"))
    seg(b, "pauldron_R", (-0.17, 1.46, 0.0), (-0.42, 1.33, 0.0), [
        (0.00, ("o", 0.035, 0.04, 0.04)), (0.30, ("o", 0.08, 0.09, 0.09)), (0.70, ("o", 0.075, 0.085, 0.085)),
        (1.00, ("o", 0.03, 0.035, 0.035))], n=10, hint={"x_hint": (0, 1, 0)})

    _arm_parts(b, "L")
    _leg_parts(b, "L")

    # --- Escudo em pipa no antebraço esquerdo (espessura ao longo de +X) ---
    kite = Profile.polygon([(0.30 * U, 0.0), (0.20 * U, 0.22 * U), (-0.12 * U, 0.18 * U),
                            (-0.45 * U, 0.0), (-0.12 * U, -0.18 * U), (0.20 * U, -0.22 * U)])
    b.add_segment("shield", "rig", start=m(0.53, 0.98, 0.05), end=m(0.565, 0.98, 0.05), x_hint=(0, 1, 0),
                  sections=(SegmentSection("s0", profile=kite, t=0), SegmentSection("s1", profile=kite, t=1)),
                  no_overlap_check=True, tags=("assembly:paladin", "shield"))
    MATERIAL["shield"] = "shield"

    # --- Ossos ---
    rig.add_bone("hips", between=(m(0, 0.90, 0), m(0, 1.02, 0)))
    rig.add_bone("spine", between=(m(0, 1.02, 0), m(0, 1.42, 0)), parent="hips")
    if slain:
        rig.add_bone("neck", between=(m(0, 1.42, 0), m(0, 1.44, 0)), parent="spine")
    rig.add_bone("head", between=(m(0, 1.44, 0), m(0, 1.74, 0)),
                 parent="neck" if slain else "spine", connected=slain)
    rig.add_bone("upper_arm_L", between=(m(*SHOULDER), m(*ELBOW)), parent="spine", connected=False)
    rig.add_bone("forearm_L", between=(m(*ELBOW), m(*WRIST)), parent="upper_arm_L")
    rig.add_bone("thigh_L", between=(m(*HIP), m(*KNEE)), parent="hips", connected=False)
    rig.add_bone("shin_L", between=(m(*KNEE), m(*ANKLE)), parent="thigh_L")
    if slain:
        rig.add_bone("wrist_L", between=(m(*WRIST), m(*add(WRIST, (0,-.08,.02)))), parent="forearm_L")
        rig.add_bone("ankle_L", between=(m(*ANKLE), m(*add(ANKLE, (0,-.04,.11)))), parent="shin_L")
    b.mirror("upper_arm_L", kind="bone")
    b.mirror("thigh_L", kind="bone")

    left = [n for n in list(SEGMENTS) if n.endswith("_L") and n != "pauldron_L"]
    for name in left:
        b.mirror(name, kind="element")
        rn = name[:-2] + "_R"
        a, c = SEGMENTS[name]
        SEGMENTS[rn] = ((-a[0], a[1], a[2]), (-c[0], c[1], c[2]))
        MATERIAL[rn] = MATERIAL[name]

    # --- Skinning hard: cada peça inteira num osso ---
    def bone_for(name):
        side = name[-1] if name[-2:] in ("_L", "_R") else ""
        base = name[:-2] if side else name
        if slain and base in ("palm", "fingers", "thumb"):
            return f"wrist_{side}"
        if slain and base == "sabaton":
            return f"ankle_{side}"
        if base in ("rerebrace", "arm_cloth", "pauldron") or base.startswith("lame"):
            return f"upper_arm_{side}"
        if base in ("couter", "vambrace", "cuff", "palm", "fingers", "thumb"):
            return f"forearm_{side}"
        if base in ("cuisse", "tasset"):
            return f"thigh_{side}"
        if base in ("poleyn", "greave", "sabaton"):
            return f"shin_{side}"
        if base == "pouch":
            return "hips"
        if name.startswith(("helm",)):
            return "head"
        if name.startswith(("breastplate", "torso_cloth", "gorget", "cape")):
            return "spine"
        if name == "shield":
            return "forearm_L"
        return "hips"

    for name in list(MATERIAL):
        rig.bind(name, bone=bone_for(name))
    return b


# ---------------------------------------------------------------------------
# Pintura (256 px/m)
# ---------------------------------------------------------------------------

PEDRA = ["#1a202b", "#283041", "#3b4558", "#5a6577", "#8590a0"]   # aço azulado
MADEIRA = ["#1e140f", "#33221a", "#4f3524"]                        # couro marrom
COURO = ["#22181a", "#3a2828", "#563c37", "#7a5a4c"]               # capa e roupa
SANGUE = ["#6e1018", "#9c1f24"]
OSSO = ["#b9ab8f", "#e3d9c0"]
FERRUGEM = ["#73391b"]
BAYER2 = np.array([[0, 2], [3, 1]]) / 4.0 + 0.125
LIGHT = np.array([-0.35, 0.75, 0.55])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
# Peças grandes que ganham filete claro na borda de cima (o resto só tem a junta escura).
RIM = {"breastplate", "fauld0", "fauld1", "fauld2", "gorget0", "gorget1", "gorget2", "lame0", "lame1",
       "helm_rim", "cuff", "tasset"}


def _rgb(hexes):
    return np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] + [255] for h in hexes], dtype=np.uint8)


def _hash(ix, iy, iz, seed):
    h = (ix * 374761393 + iy * 668265263 + iz * 1274126177 + seed * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def _pick(ramp, fidx, px, py):
    fidx = np.clip(fidx, 0, len(ramp) - 1)
    i = np.floor(fidx).astype(int)
    f = fidx - i
    up = np.where(f > 0.7, True, np.where(f < 0.3, False, BAYER2[py % 2, px % 2] < 0.5))
    return ramp[np.minimum(i + up.astype(int), len(ramp) - 1)]


def _slashes(p, cell, seed, width_px, density):
    """Riscos retos e curtos em células 3D (sangue ou arranhão), lidos no plano da superfície."""
    q = p / cell
    base = np.floor(q).astype(np.int64)
    hit = np.zeros(len(p), bool)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                c = base + np.array([dx, dy, dz])
                on = _hash(c[:, 0], c[:, 1], c[:, 2], seed) < density
                o = c + np.stack([_hash(c[:, 0], c[:, 1], c[:, 2], seed + k) for k in (1, 2, 3)], axis=1)
                ang = _hash(c[:, 0], c[:, 1], c[:, 2], seed + 4) * 0.8 + 0.4   # diagonais
                d = np.stack([np.cos(ang), -np.sin(ang), np.cos(ang) * 0.3], axis=1)
                d /= np.linalg.norm(d, axis=1, keepdims=True)
                rel = (q - o) * cell
                along = np.sum(rel * d, axis=1)
                perp = np.linalg.norm(rel - along[:, None] * d, axis=1)
                length = 0.05 + 0.10 * _hash(c[:, 0], c[:, 1], c[:, 2], seed + 5)
                hit |= on & (np.abs(along) < length) & (perp * DENS < width_px)
    return hit


def paint_paladin(painter, variant="default", *, slain=False):
    from cleaners_lib.stone_paint import fbm, texel_xy

    # O registro de peças é preenchido montando o modelo de novo em memória (é determinístico).
    if not SEGMENTS:
        from lib.model_builder import ModelBuilder

        build_paladin(ModelBuilder("registro", modeling_mode="free", require_integer_dimensions=False), slain=slain)
    pedra, madeira, couro, sangue, osso, ferrugem = (_rgb(c) for c in (PEDRA, MADEIRA, COURO, SANGUE, OSSO, FERRUGEM))
    rusty = variant == "rusty"

    def frame(rows):
        n = len(rows.x)
        px, py = texel_xy(rows, n)
        p = np.asarray(rows.model_position, float) / U
        nrm = np.asarray(rows.model_normal, float)
        return n, px, py, p, nrm

    def along(name, p):
        a, c = SEGMENTS[name]
        a, c = np.array(a), np.array(c)
        d = c - a
        L = np.linalg.norm(d)
        return ((p - a) @ (d / L)) / L, L

    def light_index(nrm, base):
        lam = nrm @ LIGHT
        return base + np.where(lam > 0.55, 1.0, np.where(lam < -0.1, -1.0, 0.0))

    def blood(c, p, px, py, seed, amount=1.0):
        if slain:
            return c
        sl = _slashes(p, 0.14, seed, 2.6, 0.35 * amount)
        dots = (fbm(p, 0.03, 2, seed + 7) > 0.86) & (fbm(p, 0.12, 2, seed + 8) > 0.6)
        c = np.where(dots[:, None], sangue[0], c)
        return np.where(sl[:, None], np.where((px + py)[:, None] % 3 == 0, sangue[0], sangue[1]), c)

    def steel(rows, name, seed):
        n, px, py, p, nrm = frame(rows)
        idx = light_index(nrm, np.full(n, 2.0))
        c = _pick(pedra, idx, px, py)
        base = name[:-2] if name[-2:] in ("_L", "_R") else name
        dome = base in ("poleyn", "couter", "pauldron")
        if name in SEGMENTS and not dome:
            t, L = along(name, p)
            ep = 1.4 / (L * DENS)
            # Borda da placa: junta escura nas pontas, filete claro logo depois.
            c = np.where(((t < ep) | (t > 1 - ep))[:, None], pedra[0], c)
            top_end = 1 - ep * 2.5 if SEGMENTS[name][1][1] >= SEGMENTS[name][0][1] else ep * 2.5
            if base in RIM:
                rim = np.abs(t - top_end) < ep * 0.8
                c = np.where(rim[:, None], pedra[4], c)
            # Uma tira de couro nos braçais e coxotes, como na referência.
            if base in ("rerebrace", "cuisse"):
                band = np.abs(t - 0.5) < 0.06
                c = np.where(band[:, None], _pick(madeira, light_index(nrm, np.full(n, 1.6)), px, py), c)
                buck = band & (np.abs(p[:, 2] - p[:, 2].max()) < 0.02)
                c = np.where(buck[:, None], pedra[4], c)
        # Arranhões claros e amassados.
        scr = _slashes(p, 0.09, seed + 40, 0.9, 0.18)
        c = np.where(scr[:, None], pedra[4], c)
        dent = fbm(p, 0.06, 2, seed + 3) > 0.76
        c = np.where(dent[:, None], pedra[1], c)
        lim = 0.6 if rusty else 2.0   # ferrugem só na variante enferrujada
        rust = fbm(p, 0.08, 2, seed + 5) > lim
        c = np.where(rust[:, None], ferrugem[0], c)
        return blood(c, p, px, py, seed + 11)

    def helm(rows):
        c = steel(rows, "helm", 5)
        n, px, py, p, nrm = frame(rows)
        x, y = p[:, 0], p[:, 1]
        front = nrm[:, 2] > 0.4
        slit = front & (np.abs(y - 1.595) < 0.011) & (np.abs(x) < 0.10)
        c = np.where(slit[:, None], pedra[0], c)
        # Furos de respiração no lado direito do rosto (lado esquerdo da imagem de frente).
        hx = np.floor((x + 1) * DENS / 5)
        hy = np.floor(y * DENS / 5)
        holes = front & (x < -0.025) & (x > -0.09) & (y > 1.49) & (y < 1.56) & (hx % 2 == 0) & (hy % 2 == 0)
        c = np.where(holes[:, None], pedra[0], c)
        return c

    def leather(rows):
        n, px, py, p, nrm = frame(rows)
        c = _pick(madeira, light_index(nrm, np.full(n, 1.8)), px, py)
        stitch = (fbm(p, 0.2, 1, 3) > 0) & ((px + py) % 6 == 0) & (np.abs(nrm[:, 1]) < 0.5) & \
                 (np.abs((p[:, 1] * DENS) % 12 - 6) < 0.6)
        return np.where(stitch[:, None], madeira[2], c)

    def glove(rows):
        n, px, py, p, nrm = frame(rows)
        c = _pick(madeira, light_index(nrm, np.full(n, 0.9)), px, py)
        return blood(c, p, px, py, 61, 0.6)

    def cloth(rows):
        n, px, py, p, nrm = frame(rows)
        return _pick(couro, light_index(nrm, np.full(n, 1.0)), px, py)

    def buckle(rows):
        n, px, py, p, nrm = frame(rows)
        c = _pick(pedra, np.full(n, 3.2), px, py)
        hole = (np.abs(p[:, 0]) < 0.018) & (np.abs(p[:, 1] - 1.01) < 0.009)
        return np.where(hole[:, None], madeira[1], c)

    def cape(rows):
        n, px, py, p, nrm = frame(rows)
        ang = np.arctan2(p[:, 2] + 0.1, p[:, 0])
        fold = np.cos(ang * 6 + fbm(p, 0.25, 2, 3) * 2.5)
        idx = 1.8 + np.where(fold > 0.7, 0.8, np.where(fold < -0.7, -0.8, 0.0)) - np.clip((0.5 - p[:, 1]) * 2.0, 0, 0.8)
        c = _pick(couro, idx, px, py)
        holes = fbm(p * np.array([1, 0.5, 1]), 0.05, 2, 9) > 0.80
        c = np.where(holes[:, None], couro[0], c)
        return blood(c, p, px, py, 71, 0.5)

    def shield(rows):
        c = steel(rows, "_none", 31)
        n, px, py, p, nrm = frame(rows)
        face = np.abs(nrm[:, 0]) > 0.6
        y, z = p[:, 1] - 1.0, p[:, 2] - 0.05
        r = np.hypot(y, z)
        ang = np.arctan2(y, z)
        rays = (np.cos(ang * 8) > 0.6) & (r > 0.05) & (r < 0.12)
        sun = face & ((r < 0.05) | rays)
        c = np.where(sun[:, None], osso[0], c)
        if not rusty:  # na variante enferrujada a ferrugem ocupa a vaga dessa cor (máx. 16 cores)
            c = np.where((sun & (y + z * 0.3 > 0.01))[:, None], osso[1], c)
        gash = face & (np.abs(z - (y * 0.7 + 0.03)) < 0.007) & (np.abs(y) < 0.25)
        c = np.where(gash[:, None], pedra[0], c)
        return c

    for el in painter.all_elements():
        name = el.name if hasattr(el, "name") else str(el)
        mat = MATERIAL.get(name, "steel")
        seed = (sum(ord(ch) for ch in name) * 7) % 997
        if name == "helm":
            el.paint_surface_arrays(helm)
        elif mat == "leather":
            el.paint_surface_arrays(leather)
        elif mat == "glove":
            el.paint_surface_arrays(glove)
        elif mat == "cloth":
            el.paint_surface_arrays(cloth)
        elif mat == "buckle":
            el.paint_surface_arrays(buckle)
        elif mat == "cape":
            el.paint_surface_arrays(cape)
        elif mat == "shield":
            el.paint_surface_arrays(shield)
        elif mat == "wound":
            from cleaners_lib.gallery_paladin import paint_wound

            el.paint_surface_arrays(paint_wound)
        else:
            el.paint_surface_arrays(lambda rows, nm=name, sd=seed: steel(rows, nm, sd))
