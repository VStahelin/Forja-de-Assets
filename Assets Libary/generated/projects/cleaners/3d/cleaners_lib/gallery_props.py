"""Mobília, adereços e malhas das armadilhas da Galeria da Guarda."""
from functools import partial
from math import cos, sin, tau

import numpy as np
from PIL import Image

from lib import MeshDraft, ModelBuilder, Path3D, Profile
from cleaners_lib.gallery_masonry import prism
from cleaners_lib.manager_lobby import lathe, paint_lobby_prop, swept
from cleaners_lib.props import FERRO, U, m, pick_clean
from cleaners_lib.stone_paint import _rgb, fbm, texel_xy
from cleaners_lib.torch import build_torch, paint_torch

STONE = ['#0d1018', '#1a202b', '#262a31', '#283041', '#3b4558', '#5e6470', '#5a6577', '#8590a0']
RUST = ['#2a140c', '#4a2412', '#73391b', '#9c5426']
WAX = ['#3d362e', '#615647', '#8f826b', '#b9ab8f', '#e3d9c0']
CHAR = ['#07080c', '#0d1018', '#3d362e', '#615647']
BLADE = [(-.60,-4.65),(-.45,-4.57),(-.21,-4.67),(.21,-4.67),(.45,-4.57),(.60,-4.65),
         (.53,-4.83),(.36,-4.96),(.16,-5.01),(-.16,-5.01),(-.36,-4.96),(-.53,-4.83)]


def box(b, name, size, position, parent='root'):
    b.add_box(name,parent,size=m(*size),at=m(*position),native=False)


def bar(b, name, start, end, radius, sides=4, parent='root'):
    b.add_sweep(name, parent, path=Path3D.polyline([m(*start), m(*end)]),
                profile=Profile.circle(radius * U, segments=sides), allow_cap_triangles=True)


def ring(b, name, center, rx, ry, width, *, turn=False, count=8, parent='root'):
    """Argola plana extrudada, com bordas próprias e abertura real."""
    draft = MeshDraft(closed=True)
    x, y, z = center
    for j, depth in enumerate((-.5 * width, .5 * width)):
        for k, inset in enumerate((0, width)):
            for i in range(count):
                t = tau * i / count
                a, c = (rx-inset)*cos(t), (ry-inset)*sin(t)
                xyz = (depth, c, -a) if turn else (a, c, depth)
                draft.vertex(f'v{j}{k}{i}', m(x+xyz[0], y+xyz[1], z+xyz[2]))
    for i in range(count):
        j = (i+1) % count
        for k, corners in enumerate((
            [(1,0,i),(1,0,j),(1,1,j),(1,1,i)],
            [(0,0,j),(0,0,i),(0,1,i),(0,1,j)],
            [(1,0,j),(1,0,i),(0,0,i),(0,0,j)],
            [(1,1,i),(1,1,j),(0,1,j),(0,1,i)],
        )):
            draft.face(f'f{k}_{i}', [f'v{a}{c}{d}' for a,c,d in corners])
    draft.anchor('base', m(*center))
    b.add_mesh(name, parent, draft, pivot='base', no_overlap_check=True)


def wood_table(b):
    for i, z in enumerate((-.295,-.10,.10,.295)):
        box(b, f'wood_top_{i}', (1.5,.073,.193), (0,.7635,z))
    for x in (-.55,.55):
        index = 'l' if x < 0 else 'r'
        box(b, f'wood_crossbar_{index}', (.102,.102,.72), (x,.682,0))
        box(b, f'wood_foot_{index}', (.15,.071,.78), (x,.036,0))
        for side in (-1,1):
            bar(b, f'wood_leg_{index}_{side}', (x,.07,.31*side), (x,.675,.19*side), .072)
        box(b, f'wood_brace_{index}', (.11,.094,.64), (x,.35,0))
    box(b, 'wood_stretcher', (1.29,.073,.083), (0,.353,0))
    for i, x in enumerate((-.54,.54)):
        for j, z in enumerate((-.287,.287)):
            box(b, f'iron_pin_{i}_{j}', (.024,.009,.024), (x,.800,z))


def altar(b):
    for name, size, center in (
        ('plinth',(1.58,.125,.78),(0,.0625,0)),
        ('base_trim',(1.43,.090,.65),(0,.169,0)),
        ('body',(1.31,.62,.59),(0,.51,0)),
        ('frame_low',(1.40,.048,.66),(0,.250,0)),
        ('frame_high',(1.40,.049,.66),(0,.771,0)),
        ('top_trim',(1.48,.058,.71),(0,.828,0)),
    ):
        box(b, f'stone_{name}', size, center)
    for side in (-1,1):
        box(b, f'stone_frame_{side}', (.065,.51,.068), (.654*side,.509,.32))
    # O corte em planta separa o fragmento do tampo principal.
    points = [(-.80,-.38),(.80,-.38),(.80,-.14),(.64,-.045),(.56,.04),
              (.27,.40),(-.80,.40)]
    top = MeshDraft(closed=True)
    for j,y in enumerate((.858,1)):
        top.vertex(f'c{j}', m(-.13,y,0))
        for i,(x,z) in enumerate(points):
            top.vertex(f'v{j}_{i}', m(x,y,z))
    for i in range(len(points)):
        j=(i+1)%len(points)
        top.face(f't{i}', ['c1',f'v1_{j}',f'v1_{i}'])
        top.face(f'b{i}', ['c0',f'v0_{i}',f'v0_{j}'])
        top.face(f's{i}', [f'v0_{j}',f'v0_{i}',f'v1_{i}',f'v1_{j}'])
    top.anchor('base', (0,0,0))
    b.add_mesh('stone_top', 'root', top, pivot='base', no_overlap_check=True, allow_triangles=True)
    b.add_group('detached_corner', 'root')
    broken = MeshDraft(closed=True)
    fragment = ((.84, .16), (1.15,.05), (1.10,.43), (.96,.57))
    for j,y in enumerate((.018,.121)):
        for i,(x,z) in enumerate(fragment):
            broken.vertex(f'v{j}_{i}', m(x,y,z))
    broken.face('top',['v1_3','v1_2','v1_1','v1_0'])
    broken.face('bottom',['v0_0','v0_1','v0_2','v0_3'])
    for i in range(4):
        j=(i+1)%4
        broken.face(f'edge{i}', [f'v0_{j}',f'v0_{i}',f'v1_{i}',f'v1_{j}'])
    broken.anchor('base', (0,0,0))
    b.add_mesh('stone_fragment', 'detached_corner', broken, pivot='base', allow_triangles=True,
               no_overlap_check=True)


def pendulum(b):
    rig = b.add_armature('rig')
    rig.add_bone('pivot', between=(m(0,0,0),m(0,.12,0)))
    rig.add_bone('arm', between=(m(0,0,0),m(0,-4.56,0)), parent='pivot', connected=False)
    rig.add_bone('blade', between=(m(0,-4.56,0),m(0,-4.92,0)), parent='arm')
    ring(b, 'iron_eye', (0,0,0), .080,.080,.025, count=10, parent='rig')
    box(b, 'iron_arm', (.108,4.53,.092), (0,-2.33,0), parent='rig')
    box(b, 'iron_blade_collar', (.214,.24,.116), (0,-4.58,0), parent='rig')
    # A borda externa segue a meia-lua, com faces trianguladas em volta do miolo.
    draft = MeshDraft(closed=True)
    for side in (-1,1):
        label = 'f' if side>0 else 'b'
        draft.vertex(label+'c', m(0,-4.78,side*.030))
    for i,(x,y) in enumerate(BLADE):
        draft.vertex(f'f{i}', m(x,y,.005))
        draft.vertex(f'b{i}', m(x,y,-.005))
    for i in range(len(BLADE)):
        j=(i+1)%len(BLADE)
        draft.face(f'f{i}', ['fc',f'f{j}',f'f{i}'])
        draft.face(f'b{i}', ['bc',f'b{i}',f'b{j}'])
        draft.face(f'edge{i}', [f'f{i}',f'f{j}',f'b{j}',f'b{i}'])
    draft.anchor('base', m(0,-4.56,0))
    b.add_mesh('iron_crescent', 'rig', draft, pivot='base', allow_triangles=True,
               no_overlap_check=True)
    rig.bind('iron_eye', bone='pivot')
    rig.bind('iron_arm', bone='arm')
    rig.bind('iron_blade_collar', bone='blade')
    rig.bind('iron_crescent', bone='blade')


def blood_blade(b):
    rig = b.add_armature('rig')
    rig.add_bone('blade', between=(m(0,-4.56,0),m(0,-4.92,0)))
    draft = MeshDraft(closed=False)
    for side in (-1,1):
        label = 'f' if side > 0 else 'b'
        draft.vertex(label+'c', m(0,-4.78,side*.032))
        for i,(x,y) in enumerate(BLADE):
            draft.vertex(f'{label}{i}', m(x,y,side*.007))
        for i in range(len(BLADE)):
            j=(i+1)%len(BLADE)
            pair = (j,i) if side > 0 else (i,j)
            draft.face(f'{label}{i}', [label+'c',*(f'{label}{k}' for k in pair)])
    draft.anchor('base', m(0,-4.56,0))
    b.add_mesh('blood_mask', 'rig', draft, pivot='base', allow_triangles=True,
               no_overlap_check=True)
    rig.bind('blood_mask', bone='blade')


def catch(b):
    rig = b.add_armature('rig')
    rig.add_bone('latch', between=(m(0,.185,.12),m(0,.30,.12)))
    box(b,'iron_backplate',(.40,.30,.05),(0,.15,.025))
    prism(b,'iron_hook',[(-.18,.10),(-.14,.065),(.075,.065),(.18,.14),(.18,.21),(.13,.19),(-.18,.19)],
          .23,back=.135)
    box(b,'iron_latch',(.055,.145,.054),(0,.207,.195),parent='rig')
    ring(b,'iron_latch_pin',(0,.185,.12),.047,.047,.011,count=6)
    rig.bind('iron_latch', bone='latch')


def winch(b):
    rig = b.add_armature('rig')
    rig.add_bone('drum', between=(m(0,.29,.257),m(.21,.29,.257)))
    rig.add_bone('crank', between=(m(.31,.29,.257),m(.46,.29,.257)), parent='drum', connected=False)
    box(b,'iron_wallplate',(.79,.58,.07),(0,.29,.035))
    for side in (-1,1):
        box(b,f'iron_brace_{side}',(.08,.42,.36),(.315*side,.29,.207))
    bar(b,'wood_drum',(-.245,.29,.257),(.245,.29,.257),.167,10,parent='rig')
    for side in (-1,1):
        left = (.20 if side > 0 else -.25)
        bar(b,f'iron_band_{side}',(left,.29,.257),(left+.041,.29,.257),.174,10,parent='rig')
        rig.bind(f'iron_band_{side}', bone='drum')
    rig.bind('wood_drum', bone='drum')
    points = [m(*xyz) for xyz in ((.34,.29,.26),(.35,.15,.38),(.35,.078,.435),(.47,.078,.435))]
    b.add_sweep('iron_crank','rig',path=Path3D.polyline(points),
                profile=Profile.circle(.022*U,segments=6),allow_cap_triangles=True)
    bar(b,'wood_grip',(.43,.078,.435),(.54,.078,.435),.033,6,parent='rig')
    rig.bind('iron_crank', bone='crank')
    rig.bind('wood_grip', bone='crank')


def pulley(b):
    box(b,'iron_anchor',(.28,.043,.16),(0,.33,0))
    for x in (-.082,.082):
        box(b,f'iron_yoke_{x}',(.028,.23,.118),(x,.238,0))
    for x in (-.062,.062):
        ring(b,f'iron_flange_{x}',(x,.16,0),.15,.14,.038,turn=True,count=8)
    bar(b,'iron_hub',(-.109,.16,0),(.109,.16,0),.078,8)


def chain(b):
    for i in range(3):
        ring(b,f'iron_link_{i}',(0,.098+i*.153,0),.047,.098,.013,turn=i%2==1,count=6)


def tripwire(b, snapped):
    for side in (-1,1):
        box(b,f'iron_anchor_{side}',(.046,.125,.051),(1.977*side,.105,0))
        if snapped:
            swept(b,f'rope_end_{side}',[(1.97*side,.15,0),(1.61*side,.056,.015),
                  (1.36*side,.015,.055),(1.19*side,.013,.22*side)],.008)
    if not snapped:
        bar(b,'rope_wire',(-1.977,.15,0),(1.977,.15,0),.008)


def pressure_plate(b):
    rig = b.add_armature('rig')
    rig.add_bone('plate', between=(m(0,0,0),m(0,.12,0)))
    box(b,'stone_rim',(.50,.036,.50),(0,.018,0))
    box(b,'stone_plate',(.47,.026,.47),(0,.047,0),parent='rig')
    rig.bind('stone_plate', bone='plate')


def launcher(b):
    box(b,'iron_panel',(1,.5,.03),(0,.25,.015))
    for j in range(5):
        x=(j-2)*.174
        ring(b,f'iron_port_{j}',(x,.255,.032),.026,.026,.010,count=6)
    for side in (-1,1):
        for end in (-1,1):
            box(b,f'iron_rivet_{side}_{end}',(.036,.027,.008),(.454*side,.25+.196*end,.031))


def dart(b, broken):
    if broken:
        bar(b,'wood_shaft_front',(0,.023,0),(0,.079,0),.006)
        bar(b,'wood_shaft_tail',(.035,.106,.015),(.025,.200,.01),.006)
        bar(b,'iron_point',(0,0,0),(0,.034,0),.008)
        pos=(.028,.158,.011)
    else:
        bar(b,'wood_shaft',(0,.02,0),(0,.196,0),.006)
        lathe(b,'iron_point',[(.002,0),(.008,.032),(.005,.046)],segments=5)
        pos=(0,.157,0)
    for i in range(3):
        angle = tau*i/3
        x,y,z = pos
        bar(b,f'wood_fletch_{i}',(x,y,z),(x+cos(angle)*.015,y+.031,z+sin(angle)*.015),.004,4)


def magazine(b):
    rig = b.add_armature('rig')
    rig.add_bone('case', between=(m(0,0,0),m(0,.12,0)))
    rig.add_bone('lid', between=(m(0,.40,.24),m(.13,.40,.24)), parent='case', connected=False)
    box(b,'wood_back',(.50,.4,.065),(0,.2,.0325))
    box(b,'wood_bottom',(.498,.042,.176),(0,.023,.151))
    for side in (-1,1):
        box(b,f'wood_cheek_{side}',(.052,.345,.175),(.2238*side,.221,.1515))
    for i in range(5):
        x=(i-2)*.076
        slot=f'dart_slot_{i+1}'
        rig.add_bone(slot,between=(m(x,.163,.156),m(x,.20,.156)),parent='case',connected=False)
        cradle=f'wood_cradle_{i}'
        box(b,cradle,(.038,.156,.094),(x,.138,.106),parent='rig')
        rig.bind(cradle,bone=slot)
    box(b,'wood_lid',(.492,.374,.028),(0,.205,.250),parent='rig')
    box(b,'iron_lid_handle',(.10,.024,.021),(0,.096,.256),parent='rig')
    for name in ('wood_lid','iron_lid_handle'):
        rig.bind(name,bone='lid')


def bars(b, fallen):
    width, height, count = (1,2.2,6) if fallen else (4,3,26)
    draw = lambda x,y,z: (x,z,-y) if fallen else (x,y,z)
    for side in (-1,1):
        bar(b,f'iron_frame_{side}',draw(side*(width/2-.02),.04,.055),
            draw(side*(width/2-.02),height,.035),.032)
    for i in range(2):
        y=.11+i*(height-.205)
        bar(b,f'iron_cross_{i}',draw(-width/2,y,.050),draw(width/2,y,.05),.028)
    for i in range(count):
        x=width*(i+1)/(count+1)-width/2
        torn=not fallen and -.89 < x < 1.15
        sides=([(.09,.042),(height,.038)] if not torn else
               [(.09,.042),(.51+.15*sin(i),.175),(.72+.24*cos(i),.365+.065*sin(i))])
        for j,(a,c) in enumerate(zip(sides,sides[1:])):
            bar(b,f'iron_bar_{i}_{j}',draw(x,*a),draw(x+.072*j,*c),.0145)
    if fallen:
        # A face da folha caída fica acima do plano do chão.
        bar(b,'iron_pull',(-.13,.094,-1.05),(.13,.094,-1.05),.027)


def rack(b):
    for x in (-.693,.693):
        box(b,f'wood_post_{x}',(.114,1.60,.106),(x,.80,.053))
    for y in (.17,.98,1.49):
        box(b,f'wood_rail_{y}',(1.49,.106,.101),(0,y,.06))
    for i in range(5):
        box(b,f'wood_tooth_{i}',(.064,.102,.169),((i-2)*.284,1.49,.157))


def spear(b):
    lathe(b,'wood_pole',[(.018,0),(.019,1.73),(.016,1.82)],segments=6)
    lathe(b,'iron_spearhead',[(.023,1.76),(.023,1.83),(.048,1.87),(.002,2)],segments=4)


def candle(b):
    lathe(b,'iron_saucer',[(.095,0),(.11,.016),(.125,.027),(.113,.045),(.105,.037)],segments=8)
    for i,(x,z,y,r) in enumerate(((-.060,-.017,.19,.026),(.027,-.032,.25,.027),(.052,.049,.10,.020))):
        lathe(b,f'wax_body_{i}',[(r,.034),(r*.88,y-.027),(r*.96,y),(r*.68,y-.003)],
              segments=6,x=x,z=z)
        bar(b,f'dark_wick_{i}',(x,y-.004,z),(x+.002,y+.015,z),.003)
        bar(b,f'wax_drip_{i}',(x+r*.82,y-.012,z),(x+r*.87,y-.048,z+.009),.008)


def shackles(b):
    box(b,'iron_wallplate',(.22,.16,.057),(0,.42,.03))
    for side in (-1,1):
        for i in range(2):
            ring(b,f'iron_link_{side}_{i}',(.09*side,.36-i*.065,.064+i*.038),.033,.047,.010,
                 turn=bool(i),count=6)
        ring(b,f'iron_shackle_{side}',(.12*side,.168,.112),.071,.084,.019,count=8)


BUILDERS = {
    'prop_wooden_table_01': wood_table, 'prop_altar_broken_01': altar,
    'trap_pendulum_axe_01': pendulum, 'dirt_blood_blade_01': blood_blade,
    'trap_pendulum_catch_01': catch, 'trap_pendulum_winch_01': winch,
    'env_pulley_01': pulley, 'env_chain_segment_01': chain,
    'trap_tripwire_01': partial(tripwire, snapped=False),
    'trap_tripwire_01_snapped': partial(tripwire, snapped=True),
    'trap_pressure_plate_01': pressure_plate, 'trap_dart_launcher_01': launcher,
    'prop_dart_01': partial(dart, broken=False), 'prop_dart_broken_01': partial(dart, broken=True),
    'trap_dart_magazine_01': magazine, 'env_cell_bars_torn_4m': partial(bars,fallen=False),
    'prop_cell_gate_fallen_01': partial(bars,fallen=True), 'prop_weapon_rack_01': rack,
    'prop_spear_01': spear, 'light_candle_cluster_01': candle,
    'prop_wall_shackles_01': shackles, 'prop_torch_dropped_01': partial(build_torch,dropped=True),
}


def build_props(asset):
    builder = ModelBuilder(asset, modeling_mode='free', require_integer_dimensions=False)
    builder.add_group('root')
    BUILDERS[asset](builder)
    return builder


def paint_props(painter, asset, *, blade_decal=None):
    if asset == 'prop_torch_dropped_01':
        paint_torch(painter,extinguished=True)
        return
    if blade_decal is None:
        paint_lobby_prop(painter, asset)
    else:
        blade = np.asarray(Image.open(blade_decal).convert('RGBA'))
    ramps = {name: _rgb(ramp) for name,ramp in (
        ('stone',STONE), ('wax',WAX), ('metal',FERRO), ('rust',RUST), ('dark',CHAR),
    )}

    def sample(rows, name):
        xyz = np.asarray(rows.model_position,float) / U
        x,y,z = xyz.T
        px,py = texel_xy(rows,len(rows.x))
        normals = np.asarray(rows.model_normal)
        noise = fbm(xyz,.043,2,472)
        small = fbm(xyz,.017,2,467)
        tone = 2 + normals[:,1]*.57 + (noise-.48)*3.5 + (small-.5)*1.3
        if name.startswith('blood'):
            u = np.clip(np.floor((x+.6)*128).astype(int),0,blade.shape[1]-1)
            v = np.clip(np.floor((-4.51-y)*128).astype(int),0,blade.shape[0]-1)
            return blade[v,u]
        if name == 'iron_crescent':
            edge = y < -4.98 + .27*np.abs(x)**1.75
            steel = pick_clean(ramps['metal'],np.where(edge,3.92,tone+.33),px,py)
            rust = pick_clean(ramps['rust'],tone-.67,px,py)
            return np.where(((noise<.34)&~edge)[:,None],rust,steel)
        if name == 'iron_panel':
            offset = x - np.round(x/.174)*.174
            face = normals[:,2] > .75
            opening = face & (np.hypot(offset,y-.255)<.019) & (np.abs(x)<.39)
            runoff = face & (y<.254) & (y>.12) & (np.abs(offset)<.008 + small*.010)
            metal = pick_clean(ramps['metal'],tone,px,py)
            rust = pick_clean(ramps['rust'],tone-.47,px,py)
            return np.where(opening[:,None],ramps['dark'][0], np.where(runoff[:,None],rust,metal))
        material = name.split('_')[0]
        if name == 'stone_top':
            crack = np.abs((x-.44) + z*1.36 + .022*np.sin(z*49)) < .010
            tone = np.where(crack,.22,tone+.25)
        if material == 'dark':
            tone -= .85
        if material == 'wax':
            tone += .6 + .34*np.sin(x*210+z*193)
        if material == 'stone':
            tone = np.clip(tone*1.7+.50,0,7)
        return pick_clean(ramps[material],tone,px,py)

    for element in painter.all_elements():
        name = element.name
        if name.startswith(('stone','wax','dark','blood','iron_crescent','iron_panel')):
            element.paint_surface_arrays(partial(sample,name=name))
