"""Alvenaria modular, fraturas e entulho da Galeria da Guarda."""
from functools import partial
import random

import numpy as np
from PIL import Image

from lib import MeshDraft, ModelBuilder
from cleaners_lib.arch_kit import add_block, box_block, vault_height
from cleaners_lib import floor_module
from cleaners_lib.floor_module import _area, _clip_rect, _dedupe
from cleaners_lib.manager_lobby import box, swept
from cleaners_lib.props import FERRO, U, m, pick_clean
from cleaners_lib.stone_paint import _rgb, fbm, stone_block_colors, surface_stone_colors, texel_xy
from cleaners_lib.wall_module import TEXTURE_FILE, load_layout, module_blocks

BREACH_EDGE = [(0, 1.25), (.62, 1.24), (1.20, 1.14), (1.76, .93), (2.28, .66), (2.80, .24), (2.92, 0)]


def convex_outline(points):
    def chain(sequence):
        edge = []
        for p in sequence:
            while len(edge) > 1 and _area([edge[-2], edge[-1], p]) < .000015:
                edge.pop()
            edge.append(p)
        return edge

    ordered = sorted(set(points))
    return chain(ordered)[:-1] + chain(reversed(ordered))[:-1]


def prism(builder, name, poly, depth, *, front=lambda x, y: 0, back=0, buried=False):
    """Extruda um contorno convexo no plano XY, mantendo as faces planas."""
    points = convex_outline(poly)
    if len(points) < 3:
        return
    draft = MeshDraft(closed=not buried)
    count = len(points)
    for i, (x, y) in enumerate(points):
        draft.vertex(f'f{i}', m(x, y, depth + front(x, y)))
        draft.vertex(f'b{i}', m(x, y, back))
    if count <= 4:
        draft.face('front', [f'f{i}' for i in range(count)])
        if not buried:
            draft.face('back', [f'b{i}' for i in reversed(range(count))])
    else:
        cx, cy = np.mean(points, axis=0)
        draft.vertex('front_center', m(cx, cy, depth + front(cx, cy)))
        if not buried:
            draft.vertex('back_center', m(cx, cy, back))
        for i in range(count):
            j = (i + 1) % count
            draft.face(f'front{i}', ['front_center', f'f{i}', f'f{j}'])
            if not buried:
                draft.face(f'back{i}', ['back_center', f'b{j}', f'b{i}'])
    for i in range(count):
        j = (i + 1) % count
        draft.face(f'edge{i}', [f'f{j}', f'f{i}', f'b{i}', f'b{j}'])
    draft.anchor('base', (0, 0, 0))
    builder.add_mesh(name, 'root', draft, pivot='base', no_overlap_check=True, allow_triangles=True)


def clip_edge(points, a, b, sign=1):
    """Recorta um bloco pela reta que delimita uma abertura."""
    def distance(point):
        x, y = point
        return sign * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]))

    result = []
    for p, q in zip(points, points[1:] + points[:1]):
        dp, dq = distance(p), distance(q)
        if dp >= 0:
            result.append(p)
        if (dp < 0) != (dq < 0):
            weight = dp / (dp - dq)
            result.append(tuple(start + (end - start) * weight for start, end in zip(p, q)))
    return result


def wall_regions(asset):
    if '2x2' in asset:
        return [(0, 2, None)]
    if 'doorway' in asset:
        return [(0, 2.25, ((-.625, 0), (-.625, 2.25), 1)),
                (0, 2.25, ((.625, 0), (.625, 2.25), -1)), (2.25, 4, None)]
    left = asset.endswith('_l')
    sign = 1 if left else -1
    borders = [((1 - width) * sign, height) for height, width in BREACH_EDGE]
    regions = [(a[1], b[1], (a, b, sign)) for a, b in zip(borders, borders[1:])]
    return regions + [(2.92, 4, None)]


# Geometria e pintura usam o mesmo referencial para as pedras aparelhadas da porta.
DOOR_TRIM = {'lintel': ((0, 2.41, -.08), (.73, .155, .166))}
for side in (-1, 1):
    for row in range(5):
        DOOR_TRIM[f'jamb_{side}_{row}'] = ((side * .685, .224 + row * .45, -.048), (.059, .219, .127))


def wall_module(builder, asset, project):
    module = 0 if asset.endswith(('_x0', '_l')) else 1
    layout = load_layout(project)
    regions = wall_regions(asset)
    for i, (bottom, top, edge) in enumerate(regions):
        joint = [(-1, bottom), (1, bottom), (1, top), (-1, top)]
        if edge:
            joint = clip_edge(joint, *edge)
        prism(builder, f'joint_{i}', _dedupe(joint, eps=.001), 0, back=-.42)
    for i, (stone, polygon, center) in enumerate(module_blocks(layout, module)):
        ox = module * 256 + 128
        points = [((x - ox) / 128, (512 - y) / 128) for x, y in polygon]
        cx, cy = (center[0] - ox) / 128, (512 - center[1]) / 128
        tx, ty = stone['tilt']
        depth = .023 + stone['height'] * .055

        def relief(x, y):
            return max(.01, depth - ((x - cx) * tx - (y - cy) * ty) * .024)

        for j, (bottom, top, edge) in enumerate(regions):
            clipped = _clip_rect(points, -1, bottom, 1, top)
            if edge and clipped:
                clipped = clip_edge(clipped, *edge)
            clipped = _dedupe(clipped, eps=.003)
            if len(clipped) >= 3 and abs(_area(clipped)) > .001:
                prism(builder, f'block_{i}_{j}', clipped, 0, front=relief, buried=True)
    if 'doorway' in asset:
        for name, (center, half) in DOOR_TRIM.items():
            add_block(builder, box_block(name, center, half))


def pendulum_recess(builder, project):
    layout = load_layout(project)
    # A cavidade fecha em alvenaria. Esta mesma parede separa a galeria da abside.
    regions = [
        (-2, 0, 2, 2.80, 0),
        (-2, 3.68, 2, 4, 0),
        (-2, 2.80, -.17, 3.68, 0),
        (.17, 2.80, 2, 3.68, 0),
        (-.17, 2.80, .17, 3.68, -.26),
    ]
    for i, (left, bottom, right, top, front) in enumerate(regions):
        outline = [(left, bottom), (right, bottom), (right, top), (left, top)]
        prism(builder, f'joint_{i}', outline, front, back=-.42)
    for module in range(2):
        for i, (stone, polygon, center) in enumerate(module_blocks(layout, module)):
            points = [(x / 128 - 2, (512 - y) / 128) for x, y in polygon]
            cx, cy = center[0] / 128 - 2, (512 - center[1]) / 128
            tx, ty = stone['tilt']
            height = stone['height']

            def relief(x, y):
                return max(.01, .023 + height * .055 - ((x - cx) * tx - (y - cy) * ty) * .024)

            for j, (left, bottom, right, top, front) in enumerate(regions):
                clipped = _dedupe(_clip_rect(points, left, bottom, right, top), eps=.003)
                if len(clipped) >= 3 and abs(_area(clipped)) > .001:
                    prism(builder, f'block_{module}_{i}_{j}', clipped, front,
                          front=relief, back=front, buried=True)


def pier(builder):
    rng = random.Random(8301)
    box(builder, 'base', (2, .30, 1), (0, .15, 0))
    box(builder, 'cornice', (2, .24, 1), (0, 5.88, 0))
    box(builder, 'mortar', (1.88, 5.46, .78), (0, 3.03, -.066))
    heights = [.30, .64, 1.01, 1.39, 1.78, 2.18, 2.60, 3.01, 3.43, 3.84, 4.23, 4.63, 4.99, 5.37, 5.76]
    for row, (bottom, top) in enumerate(zip(heights, heights[1:])):
        cuts = [-.96, -.44 + (row % 2) * .16, .24 + (row % 2) * .22, .96]
        if row == 2:
            cuts = [-.96, -.65, -.33, .22, .65, .96]
        for col, (a, b) in enumerate(zip(cuts, cuts[1:])):
            notch = row == 2 and a >= -.65 and b <= .65
            recess = notch or (row == 12 and col == 1)
            depth = .40 if recess else .48
            name = f'{"fracture" if notch else "block"}_{row}_{col}'
            add_block(builder, box_block(name, ((a+b)/2, (bottom+top)/2, depth-.07),
                                         ((b-a)/2-.008, (top-bottom)/2-.009, .069), rng=rng))
    for side in (-1, 1):
        for row in range(11):
            for col in range(2):
                add_block(builder, box_block(f'side_{side}_{row}_{col}',
                    (.949*side, .55+row*.496, -.265+col*.379),
                    (.043, .239, .181), rng=rng))


def vault(builder, collapsed):
    draft = MeshDraft(closed=False)
    xs = [-2 + .25*i for i in range(17)]
    if not collapsed:
        xs[7], xs[9] = -.20, .20
    zs = [-2 + .25*i for i in range(17)]
    lift = 0 if collapsed else 2
    omitted = set()
    rim_vertices = set()
    for i in range(16):
        for j in range(16):
            x, z = (xs[i] + xs[i+1])/2, (zs[j] + zs[j+1])/2
            opening = ((x-.9)**2 + (z-.76)**2 + .13*x*z < .70) if collapsed else abs(x) < .2 and abs(z) < 1.5
            if opening:
                omitted.add((i, j))

    def point(i, j, rim=False):
        x, z = xs[i], zs[j]
        return m(x, vault_height(x, z) + lift + (.14 if rim else 0), z)

    for i in range(17):
        for j in range(17):
            if any((ii, jj) not in omitted and 0 <= ii < 16 and 0 <= jj < 16
                   for ii in (i-1, i) for jj in (j-1, j)):
                draft.vertex(f'v{i}_{j}', point(i,j))
    for i in range(16):
        for j in range(16):
            if (i,j) in omitted:
                continue
            corners = [(i,j),(i+1,j),(i+1,j+1),(i,j+1)]
            names = [f'v{k}_{l}' for k,l in corners]
            a,b,c,d = names
            if i == j:
                draft.face(f'v_{i}_{j}_a', [a,b,c])
                draft.face(f'v_{i}_{j}_b', [a,c,d])
            elif i+j == 15:
                draft.face(f'v_{i}_{j}_a', [a,b,d])
                draft.face(f'v_{i}_{j}_b', [b,c,d])
            else:
                draft.face(f'v_{i}_{j}', names)
            for k, other in enumerate(((i,j-1), (i+1,j), (i,j+1), (i-1,j))):
                if other in omitted:
                    end = (k+1) % 4
                    keys = (corners[k], corners[end])
                    a, b = [f'r{ii}_{jj}' for ii, jj in keys]
                    for name, key in zip((a,b), keys):
                        if name not in rim_vertices:
                            draft.vertex(name, point(*key, rim=True))
                            rim_vertices.add(name)
                    draft.face(f'r{i}_{j}_{k}', [names[end], names[k], a, b])
    draft.anchor('base', (0,0,0))
    builder.add_mesh('vault', 'root', draft, pivot='base', no_overlap_check=True, allow_triangles=True)
    if collapsed:
        for i, (x, z, drop) in enumerate(((.32,.39,.14), (1.36,1.18,.22))):
            stone = MeshDraft(closed=True)
            y = vault_height(x,z)
            for j, offset in enumerate(((-.13,.10,-.09),(.10,.065,-.11),(.06,.15,.13),(.014,-drop,.05))):
                stone.vertex(f'v{j}', m(x+offset[0], y+offset[1], z+offset[2]))
            for j, indices in enumerate(((0,2,1),(0,1,3),(1,2,3),(2,0,3))):
                stone.face(f'f{j}', [f'v{k}' for k in indices])
            stone.anchor('base', m(x,y,z))
            builder.add_mesh(f'fracture_{i}', 'root', stone, pivot='base',
                             allow_triangles=True, no_overlap_check=True)
    else:
        swept(builder, 'iron_axle', [(-.27,6.02,0), (.27,6.02,0)], .06)
        for side in (-1,1):
            box(builder, f'iron_mount_{side}', (.16,.24,.21), (.25*side,6.02,0))


def plate_socket(builder, project):
    """Usa o tile x0z0 e recorta o sulco e as pedras em torno da placa."""
    module = floor_module
    layout = module.load_layout(project)
    # Quatro retângulos disjuntos circundam o encaixe de 64 px.
    ring = [(0,0,96,256), (160,0,256,256), (96,0,160,96), (96,160,160,256)]
    groove = MeshDraft(closed=False)

    def position(px, py, h):
        return ((px-128)/8, h, (py-128)/8)

    for j,(x0,z0,x1,z1) in enumerate(ring):
        for i,(x,z) in enumerate(((x0,z0),(x0,z1),(x1,z1),(x1,z0))):
            groove.vertex(f'g{j}_{i}', position(x,z,0))
        groove.face(f'g{j}', [f'g{j}_{i}' for i in range(4)])
    groove.anchor('base',(0,0,0))
    builder.add_mesh('groove','root',groove,pivot='base',no_overlap_check=True)
    for k,(stone, polygon, center) in enumerate(module.module_stones(layout,0,0)):
        level = module.GROOVE_DEPTH + stone['height'] * module.STONE_RANGE
        if stone['height'] > module.RAISED_THRESHOLD:
            level += module.RAISED_EXTRA
        tx,tz = stone['tilt']

        def top(x,z):
            return max(module.GROOVE_DEPTH*.5, level-((x-center[0])*tx+(z-center[1])*tz)/8*module.MAX_SLOPE)

        for j,region in enumerate(ring):
            points = convex_outline(_dedupe(_clip_rect(polygon,*region)))
            if len(points)<3 or abs(_area(points))<6:
                continue
            stones = MeshDraft(closed=False)
            key=f's{k}_{j}'
            for i,(x,z) in enumerate(points):
                stones.vertex(f'{key}t{i}',position(x,z,top(x,z)))
                stones.vertex(f'{key}b{i}',position(x,z,0))
            x,z = np.mean(points,axis=0)
            stones.vertex(f'{key}c', position(x,z,top(x,z)))
            for i in range(len(points)):
                q=(i+1)%len(points)
                a,b = points[i], points[q]
                stones.face(f'{key}top{i}',[f'{key}c',f'{key}t{q}',f'{key}t{i}'])
                if any(abs(a[axis]-value)<.001 and abs(b[axis]-value)<.001
                       for axis in (0,1) for value in (0,256)):
                    continue
                stones.face(f'{key}side{i}',[f'{key}b{q}',f'{key}b{i}',f'{key}t{i}',f'{key}t{q}'])
            stones.anchor('base',(0,0,0))
            builder.add_mesh(key,'root',stones,pivot='base',allow_triangles=True,no_overlap_check=True)


def rubble(builder, asset):
    large = 'large' in asset
    loose = 'stone_0' in asset
    width, height, depth = (2.5,1.2,1.5) if large else (1,.4,.8)
    seed = sum(map(ord, asset))
    rng = random.Random(seed)
    if loose:
        size = .25 + .05 * int(asset[-1])
        add_block(builder, box_block('fracture_loose', (0,size*.35,0),
                                    (size/2,size*.33,size*.42), rng=rng, jitter=.022))
        return
    blocks = []
    for layer, count in enumerate((14, 10, 4, 2) if large else (8, 5, 2)):
        for n in range(count):
            angle = n * 2.39996 + layer * 1.29
            radius = max(.09, .32-layer*.078) * rng.uniform(.75, 1.1)
            x = np.cos(angle) * radius * width
            z = np.sin(angle) * radius * depth
            sy = height * rng.uniform(.09, .15)
            y = sy + layer * height * .235
            yaw = rng.uniform(-1.8, 1.8)
            c, s = np.cos(yaw), np.sin(yaw)
            axes = ((c, 0, s), (0,1,0), (-s,0,c))
            blocks.append(box_block(f'fracture_{layer}_{n}', (x,y,z),
                (width*rng.uniform(.067,.11), sy, depth*rng.uniform(.085,.17)),
                axes=axes, rng=rng, jitter=.024 if large else .012))
    corners = np.concatenate([block.corners for block in blocks])
    lo, hi = corners.min(axis=0), corners.max(axis=0)
    center = np.array([(lo[0]+hi[0])/2, lo[1], (lo[2]+hi[2])/2])
    scale = np.array([width,height,depth]) / (hi-lo)
    for block in blocks:
        block.corners = [(p-center)*scale for p in block.corners]
        block.center = (block.center-center)*scale
        add_block(builder,block)


def build_masonry(asset, project):
    builder = ModelBuilder(asset, modeling_mode='free', require_integer_dimensions=False)
    builder.add_group('root')
    if asset == 'env_wall_pendulum_recess_4x4':
        pendulum_recess(builder, project)
    elif asset.startswith('env_wall'):
        wall_module(builder, asset, project)
    elif asset.startswith('env_floor'):
        plate_socket(builder, project)
    elif asset.startswith('env_gate_pier'):
        pier(builder)
    elif asset.startswith(('env_ceiling', 'env_vault')):
        vault(builder, 'collapsed' in asset)
    else:
        rubble(builder, asset)
    return builder


def paint_masonry(painter, asset, project):
    if asset.startswith('env_floor'):
        floor_module.paint_floor_module(painter, 0, 0, project)
        return
    is_wall = asset.startswith('env_wall')
    is_pendulum_recess = asset == 'env_wall_pendulum_recess_4x4'
    stone = _rgb(['#0d1018','#1a202b','#262a31','#283041','#3b4558','#5e6470','#5a6577','#8590a0'])
    iron = _rgb(FERRO)
    wall = np.asarray(Image.open(project / 'references' / TEXTURE_FILE).convert('RGBA')) if is_wall else None
    x0 = 0 if asset.endswith(('_x0', '_l')) else 256

    def color(rows, name):
        xyz = np.asarray(rows.model_position, float) / U
        normals = np.asarray(rows.model_normal)
        px, py = texel_xy(rows, len(rows.x))
        variation = fbm(xyz, .048, 3, 144)
        light = normals[:,1] * .72
        if name.startswith('iron'):
            return pick_clean(iron, 1.65 + 3*(variation-.5) + light, px, py)
        if is_wall and name in DOOR_TRIM:
            center, half = DOOR_TRIM[name]
            seed = 189 if name == 'lintel' else 231 + int(name[-1]) * 11 + (13 if '_-1_' in name else 0)
            return stone_block_colors(rows, xyz - center, half, seed=seed, light_up=(0,1,0))
        if is_wall and name.startswith(('block', 'joint')):
            x, y, z = xyz.T
            base_x = np.floor((x+2)*128 if is_pendulum_recess else (x+1)*128+x0).astype(int) % wall.shape[1]
            base_y = np.clip(np.floor(512-y*128).astype(int), 0, wall.shape[0]-1)
            result = wall[base_y, base_x]
            side = np.abs(normals[:,2]) < .86
            if np.any(side):
                if name.startswith('joint'):
                    # A ombreira tem espessura. Amostra a pedra no volume real, inclusive nos retornos.
                    reveal = surface_stone_colors(rows, xyz, cell=.39, stretch=(.85,1.05,1.1),
                                                  seed=187+x0//256, groove=2.2, bevel=3.8)
                else:
                    # Nas faces curtas do relevo, a granulação continua em profundidade.
                    coarse = fbm(xyz,.16,2,153)
                    grain = fbm(xyz,.021,2,139)
                    tone = 3.8 + (coarse-.5)*2.9 + (grain-.5)*2.2 + .55*normals[:,1]
                    tone -= .65 * np.clip(-z/.12,0,1)
                    reveal = pick_clean(stone,tone,px,py)
                result = np.where(side[:,None], reveal, result)
            if is_pendulum_recess:
                # Pedra mais fria dentro do encaixe, com lascas visíveis nos retornos.
                recess = (z < -.045) & (z > -.34) & (np.abs(x) <= .172) & (y >= 2.798) & (y <= 3.682)
                cold = pick_clean(stone, 3.25 + 2.7*(variation-.5) + light, px, py)
                return np.where(recess[:,None], cold, result)
            if 'breach' in asset:
                half = 1 if asset.endswith('_l') else -1
                boundary = half * (1-np.interp(y, [p[0] for p in BREACH_EDGE], [p[1] for p in BREACH_EDGE]))
                fractured = (y < 2.92) & (np.abs(x-boundary) < .055) & (np.abs(normals[:,2]) < .8)
                fresh = pick_clean(stone, 6.15 + 2*(variation-.5), px, py)
                return np.where(fractured[:,None], fresh, result)
            return result
        if name == 'vault':
            coords = xyz.copy()
            if 'slot' in asset:
                coords[:,1] -= 2
            return surface_stone_colors(rows, coords, cell=.36, stretch=(1,1,.55), seed=71)
        fine = fbm(xyz,.019,2,716)
        tone = 3.6 + 1.32*light + 5.6*(variation-.46) + 4.5*(fine-.50)
        if name == 'fracture_loose':
            tone = 3.4 + 2*light + 8*(variation-.45) + 6*(fine-.50)
        if name.startswith('fracture'):
            tone += .43
        if name == 'mortar':
            tone -= .85
        return pick_clean(stone, tone, px, py)

    for element in painter.all_elements():
        element.paint_surface_arrays(partial(color, name=element.name))
