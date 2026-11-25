"""Adaptação do paladino existente para a vítima da Galeria da Guarda.

22/11/2026: o corte passou de diagonal na lateral do peito para um rasgo vertical, no plano
do meio do corpo, que sobe do esterno, abre o gorjal e racha o elmo de cima a baixo. É o
caminho da lâmina pendular, que cai de cima e fica cravada no rasgo.
"""
from math import cos, sin, sqrt, tau

import numpy as np

from lib import MeshDraft, Profile
from cleaners_lib.props import U, m, pick_clean
from cleaners_lib.stone_paint import _rgb, fbm, texel_xy

# Rasgo da lâmina (m). Gorjal e elmo racham inteiros; na couraça o fundo do rasgo é inclinado:
# desce até o esterno na frente (1,16 m) e não chega às costas.
CLEAVE_HALF_WIDTH = .034
CLEAVE_FLOOR_Y = 1.42
CLEAVE_FLOOR_SLOPE = 1.733
CLEAVE_DEPTH = .05


def _cleave_planes(floor=False):
    """Semiespaços cuja interseção é o rasgo; cada um é f(p) > 0 dentro do rasgo."""
    w = CLEAVE_HALF_WIDTH
    planes = [lambda p: w - p[0], lambda p: w + p[0]]
    if floor:
        planes.append(lambda p: p[1] - (CLEAVE_FLOOR_Y - CLEAVE_FLOOR_SLOPE*p[2]))
    return tuple(planes)


def _clip(points, f):
    """Sutherland-Hodgman: guarda a parte do polígono com f >= 0."""
    result = []
    for a, b in zip(points, points[1:]+points[:1]):
        da, db = f(a), f(b)
        if da >= 0:
            result.append(a)
        if (da < 0) != (db < 0):
            t = da/(da-db)
            result.append(tuple(x+(y-x)*t for x, y in zip(a, b)))
    return result


class _Draft:
    def __init__(self):
        self.draft = MeshDraft(closed=False)
        self.vertices = {}
        self.faces = set()

    def face(self, points):
        names = []
        for point in points:
            key = tuple(round(v, 7) for v in point)
            if key not in self.vertices:
                self.vertices[key] = f'v{len(self.vertices)}'
                self.draft.vertex(self.vertices[key], m(*key))
            name = self.vertices[key]
            if name not in names:
                names.append(name)
        for i in range(1, len(names)-1):
            triangle = [names[0], names[i], names[i+1]]
            key = frozenset(triangle)
            if len(key) < 3 or key in self.faces:
                continue
            self.faces.add(key)
            self.draft.face(f'f{len(self.faces)}', triangle)


def cleaved_shell(builder, name, rings, *, center, caps=(True, True), vertical=.8, floor=False):
    """Casca de anéis (m) com o rasgo da lâmina recortado. A parte de dentro do rasgo recua
    para o centro e vira a malha `<name>_wound`; as paredes do corte ficam no aço."""
    steel, wound = _Draft(), _Draft()
    planes = _cleave_planes(floor)
    cx, cy, cz = center

    def inset(point):
        x, y, z = point
        d = (x-cx, (y-cy)*vertical, z-cz)
        length = sqrt(sum(v*v for v in d)) or 1.0
        return tuple(p-CLEAVE_DEPTH*v/length for p, v in zip(point, d))

    def on_edge(a, b):
        return any(abs(f(a)) < 5e-5 and abs(f(b)) < 5e-5 for f in planes)

    def emit(triangle, open_cut=False):
        rest = list(triangle)
        for f in planes:
            if len(rest) < 3:
                break
            steel.face(_clip(rest, lambda p, f=f: -f(p)))
            rest = _clip(rest, f)
        if len(rest) < 3 or open_cut:
            return
        wound.face([inset(p) for p in rest])
        for a, b in zip(rest, rest[1:]+rest[:1]):
            if on_edge(a, b):
                steel.face([a, b, inset(b), inset(a)])

    n = len(rings[0])
    for bottom, top in zip(rings, rings[1:]):
        for i in range(n):
            j = (i+1) % n
            emit([bottom[i], bottom[j], top[j]])
            emit([bottom[i], top[j], top[i]])
    # caps: True fecha e racha a tampa; "open" deixa o rasgo vazado (tampa escondida por outra peça).
    for ring, upward, enabled in ((rings[0], False, caps[0]), (rings[-1], True, caps[1])):
        if not enabled:
            continue
        hub = (0, ring[0][1], 0)
        for i in range(n):
            j = (i+1) % n
            a, b = (ring[i], ring[j]) if upward else (ring[j], ring[i])
            emit([hub, a, b], open_cut=enabled == "open")
    base = m(0, rings[0][0][1], 0)
    for part, draft in ((name, steel), (f'{name}_wound', wound)):
        if not draft.faces:
            continue
        draft.draft.anchor('base', base)
        builder.add_mesh(part, 'rig', draft.draft, pivot='base', allow_triangles=True, no_overlap_check=True,
                         tags=('assembly:paladin', 'wound' if part.endswith('_wound') else 'steel'))
    return [part for part, draft in ((name, steel), (f'{name}_wound', wound)) if draft.faces]


def oval_ring(y, half_width, front, back, n=12, ridge=0.0):
    ring = []
    for side in range(n):
        angle = tau*side/n
        r = sin(angle)
        z = r*(front if r >= 0 else back)
        if ridge and side == n//4:
            z += ridge
        ring.append((-half_width*cos(angle), y, z))
    return ring


def rr_ring(y, width, depth, radius):
    return [(-px/U, y, pz/U) for px, pz in Profile.rounded_rectangle(width*U, depth*U, radius*U).points]


def cleaved_breastplate(builder, sections):
    rings = [oval_ring(1.01+.39*t, rx, front, back, ridge=.025 if i in (1, 2, 3) else 0.0)
             for i, (t, (_, rx, front, back)) in enumerate(sections)]
    return cleaved_shell(builder, 'breastplate', rings, center=(0, 1.2, 0), caps=(True, 'open'), vertical=.0, floor=True)


def cleaved_gorget(builder, i, y0, y1, r0, r1):
    rings = [oval_ring(y0, r0, r0, r0), oval_ring(y1, r1, r1, r1)]
    return cleaved_shell(builder, f'gorget{i}', rings, center=(0, (y0+y1)/2, 0), caps=(False, False), vertical=.0)


def cleaved_helm(builder):
    sections = [(1.44, (.215, .235, .06)), (1.5925, (.232, .25, .065)), (1.745, (.222, .24, .06))]
    rings = [rr_ring(y, *spec) for y, spec in sections]
    parts = cleaved_shell(builder, 'helm', rings, center=(0, 1.58, 0), caps=('open', True), vertical=1.0)
    rim = [rr_ring(y, .235, .255, .065) for y in (1.435, 1.47)]
    parts += cleaved_shell(builder, 'helm_rim', rim, center=(0, 1.45, 0), caps=(False, False), vertical=.0)
    return parts


def paint_wound(rows):
    px, py = texel_xy(rows, len(rows.x))
    xyz = np.asarray(rows.model_position, float)/U
    n = fbm(xyz, .027, 2, 184)
    red = _rgb(['#33070c', '#6e1018', '#7a5a4c'])
    bone = _rgb(['#8f826b', '#b9ab8f'])
    pale = (n > .64) & (np.sin(91*xyz[:, 0]-38*xyz[:, 1]) > .67)
    return np.where(pale[:, None], pick_clean(bone, .35+n*.75, px, py),
                    pick_clean(red, .2+2.4*n, px, py))
