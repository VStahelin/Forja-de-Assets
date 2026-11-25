"""Clipe de teste do paladino: "death_fall", o corpo caindo de costas e batendo no chão.

Animação fluida (VX-05, 20/11/2026): poses-chave a cada 1/12 s, interpoladas em linha ("linear").
Joelhos cedem, o corpo tomba para trás com os braços abertos, bate no chão, quica uma vez
e fica (loop="hold"). Rotação em graus a partir da pose de descanso; posição em unidades (16 = 1 m).
Eixos (de `forge animation --rig`): hips e spine usam os eixos do mundo; em coxas e canelas
o x local aponta para -X do mundo, por isso o sinal do joelho é invertido.
"""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib import AnimationEditor
from Tools.recipe_context import recipe_paths

FPS = 12
STEP = "linear"  # nome antigo; desde 20/11/2026 as chaves são interpoladas

# Pose por quadro (12 por segundo). Cada linha: quadro -> valores (só os que mudam).
# hips_rot x < 0 tomba para trás; hips_pos (y, z) desce e recua.
POSES = {
    0:  dict(hips_rot=0,   hips_pos=(0, 0),       spine=0,   head=0,   thigh=0,  shin=0,   arm=0,  forearm=0),
    2:  dict(hips_rot=4,   hips_pos=(-1.0, 0),    spine=10,  head=12,  thigh=20, shin=-35, arm=8,  forearm=-10),
    4:  dict(hips_rot=0,   hips_pos=(-2.5, -0.5), spine=4,   head=-5,  thigh=30, shin=-55, arm=20, forearm=-20),
    6:  dict(hips_rot=-25, hips_pos=(-4.5, -2),   spine=-8,  head=-20, thigh=18, shin=-40, arm=45, forearm=-25),
    8:  dict(hips_rot=-50, hips_pos=(-7.5, -4.5), spine=-12, head=-25, thigh=8,  shin=-25, arm=70, forearm=-20),
    10: dict(hips_rot=-72, hips_pos=(-10.0, -7),  spine=-8,  head=-15, thigh=4,  shin=-15, arm=85, forearm=-15),
    11: dict(hips_rot=-86, hips_pos=(-11.4, -8),  spine=-4,  head=25,  thigh=2,  shin=-8,  arm=95, forearm=-5),   # bate
    12: dict(hips_rot=-82, hips_pos=(-10.7, -8),  spine=-6,  head=-10, thigh=12, shin=-22, arm=80, forearm=-25),  # quica
    14: dict(hips_rot=-87, hips_pos=(-11.5, -8.2), spine=-3, head=8,   thigh=8,  shin=-16, arm=88, forearm=-12),
    16: dict(hips_rot=-87, hips_pos=(-11.5, -8.2), spine=-3, head=12,  thigh=6,  shin=-12, arm=90, forearm=-8),
}
DURATION = 18 / FPS


def main():
    editor = AnimationEditor.from_bbmodel(recipe_paths(__file__).model)
    clip = editor.animation("death_fall", duration=DURATION, loop="hold")
    tracks = {name: clip.bone(name, armature="rig") for name in (
        "hips", "spine", "head", "thigh_L", "thigh_R", "shin_L", "shin_R",
        "upper_arm_L", "upper_arm_R", "forearm_L", "forearm_R")}
    for frame, p in POSES.items():
        t = frame / FPS
        y, z = p["hips_pos"]
        tracks["hips"].key(t, rotation=(p["hips_rot"], 0, 0), position=(0, y, z), interpolation=STEP)
        tracks["spine"].key(t, rotation=(p["spine"], 0, 0), interpolation=STEP)
        tracks["head"].key(t, rotation=(p["head"], 0, 0), interpolation=STEP)
        # Pernas um pouco assimétricas para não parecer espelho.
        tracks["thigh_L"].key(t, rotation=(p["thigh"], 0, 0), interpolation=STEP)
        tracks["thigh_R"].key(t, rotation=(p["thigh"] * 0.8, 0, 0), interpolation=STEP)
        tracks["shin_L"].key(t, rotation=(p["shin"], 0, 0), interpolation=STEP)
        tracks["shin_R"].key(t, rotation=(p["shin"] * 1.15, 0, 0), interpolation=STEP)
        # Braços abrem para os lados (z local = z do mundo; o direito gira ao contrário).
        tracks["upper_arm_L"].key(t, rotation=(0, 0, p["arm"]), interpolation=STEP)
        tracks["upper_arm_R"].key(t, rotation=(0, 0, -p["arm"] * 0.85), interpolation=STEP)
        tracks["forearm_L"].key(t, rotation=(p["forearm"], 0, 0), interpolation=STEP)
        tracks["forearm_R"].key(t, rotation=(p["forearm"] * 1.2, 0, 0), interpolation=STEP)
    # Poses paradas (um quadro só), para o seletor de pose do Unity (CharacterPose).
    poses = {
        "pose_stand": {},
        # Sentado no chão, costas na parede, pernas para a frente, cabeça caída.
        "pose_sit": dict(hips=(-18, (0, -11.6, -0.6)), spine=12, head=28,
                         thigh_L=92, thigh_R=80, shin_L=-74, shin_R=-44,
                         upper_arm_L=(0, 0, 12), upper_arm_R=(0, 0, -16), forearm_L=-35, forearm_R=-20),
        # Caído de costas (a última pose do death_fall).
        "pose_lying": dict(hips=(-87, (0, -11.5, -8.2)), spine=-3, head=12, thigh_L=6, thigh_R=5,
                           shin_L=-12, shin_R=-14, upper_arm_L=(0, 0, 90), upper_arm_R=(0, 0, -76),
                           forearm_L=-8, forearm_R=-10),
    }
    for pname, pose in poses.items():
        pc = editor.animation(pname, duration=1 / FPS, loop="hold")
        bones = ("hips", "spine", "head", "thigh_L", "thigh_R", "shin_L", "shin_R",
                 "upper_arm_L", "upper_arm_R", "forearm_L", "forearm_R")
        for bn in bones:
            tr = pc.bone(bn, armature="rig")
            v = pose.get(bn, 0)
            if bn == "hips":
                rot, pos = (v if v else (0, (0, 0, 0)))
                tr.key(0, rotation=(rot, 0, 0), position=pos, interpolation=STEP)
            elif isinstance(v, tuple):
                tr.key(0, rotation=v, interpolation=STEP)
            else:
                tr.key(0, rotation=(v, 0, 0), interpolation=STEP)
    editor.save()
    print("[animation] death_fall e poses salvos")


if __name__ == "__main__":
    main()
