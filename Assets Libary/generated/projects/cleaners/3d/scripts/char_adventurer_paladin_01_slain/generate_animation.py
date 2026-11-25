from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / 'Tools' / '__init__.py').is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

from copy import deepcopy
import json
from math import sin, tau
from lib import AnimationEditor

# Cavaleiro pendurado na lâmina pendular (22/11/2026). A lâmina segura o corpo pelo rasgo do
# peito ao elmo: tronco e cabeça ficam presos e caídos para a frente, braços pendem retos para
# baixo e as pernas balançam devagar, como um corpo suspenso. `pose_pinned` é o primeiro quadro
# parado (prévia estática da sala); `idle_hanging` é o laço que o jogo toca até a lâmina soltar.
HANG_PERIOD = 4.0
HANG_FPS = 12

# Pose base (graus, offsets da pose em A de repouso).
HANG_POSE = {
    'hips': (2, 0, 0),
    'spine': (8, 0, 0),
    'neck': (6, 0, 0),
    'head': (20, 0, -3),
    'upper_arm_L': (-6, 0, -24), 'upper_arm_R': (-6, 0, 24),
    'forearm_L': (-8, 0, -4), 'forearm_R': (-8, 0, 4),
    'wrist_L': (-10, 0, 0), 'wrist_R': (-10, 0, 0),
    'thigh_L': (2, 0, 1), 'thigh_R': (-1, 0, -1),
    'shin_L': (-12, 0, 0), 'shin_R': (-7, 0, 0),
    'ankle_L': (-32, 0, 0), 'ankle_R': (-28, 0, 0),
}

# Balanço (amplitude em graus no eixo x e fase em voltas). As canelas e os braços vêm atrasados.
SWAY = {
    'thigh_L': (4.0, 0.00), 'thigh_R': (3.4, 0.42),
    'shin_L': (3.0, 0.12), 'shin_R': (2.6, 0.54),
    'ankle_L': (2.5, 0.20), 'ankle_R': (2.5, 0.62),
    'upper_arm_L': (2.0, 0.08), 'upper_arm_R': (1.8, 0.50),
    'forearm_L': (1.5, 0.18), 'forearm_R': (1.5, 0.60),
    'hips': (0.8, 0.95),
}


def inherit_poses(model, paths):
    source = paths.project / 'assets/char_adventurer_paladin_01/model.bbmodel'
    base = json.loads(source.read_text(encoding='utf-8'))
    new_bones = {bone['name']:bone['uuid'] for bone in model['elements'] if bone.get('type') == 'armature_bone'}
    remap = {bone['uuid']:new_bones.get(bone['name']) for bone in base['elements']
             if bone.get('type') == 'armature_bone'}
    names = {clip['name'] for clip in model.get('animations', [])}
    for clip in base.get('animations', []):
        if clip['name'] in ('pose_stand','pose_lying') and clip['name'] not in names:
            inherited = deepcopy(clip)
            inherited['animators'] = {remap[uuid]:track for uuid,track in clip['animators'].items()
                                      if remap.get(uuid)}
            model.setdefault('animations', []).append(inherited)


if __name__ == '__main__':
    paths = recipe_paths(__file__)
    model = json.loads(paths.model.read_text(encoding='utf-8'))
    inherit_poses(model, paths)
    paths.model.write_text(json.dumps(model, ensure_ascii=False),encoding='utf-8')
    editor = AnimationEditor.from_bbmodel(paths.model)

    pinned = editor.animation('pose_pinned', duration=.1, loop='hold')
    for bone, rotation in HANG_POSE.items():
        track = pinned.bone(bone, armature='rig')
        for time in (0, .1):
            track.key(time, rotation=rotation)

    idle = editor.animation('idle_hanging', duration=HANG_PERIOD, loop=True)
    for bone, rotation in HANG_POSE.items():
        amplitude, phase = SWAY.get(bone, (0.0, 0.0))

        def curve(t, base=rotation, amplitude=amplitude, phase=phase):
            swing = amplitude * sin(tau * (t / HANG_PERIOD - phase))
            return (base[0] + swing, base[1], base[2])

        idle.bone(bone, armature='rig').sample('rotation', 0, HANG_PERIOD, HANG_FPS, curve)
    editor.save()
