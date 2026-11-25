"""Passos curtos sob a gosma, com a base traseira seguindo dois quadros depois.

Chaves lineares (20/11/2026): a animação é fluida; as 16 poses viram chaves interpoladas."""
from __future__ import annotations

from math import cos, pi, sin, sqrt, tau
from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib import AnimationEditor
from Tools.recipe_context import recipe_paths

FPS = 12
FRAMES = 16
U = 16


def step(phase):
    half_stride = .148
    if phase < .5:
        # Under load this lobe travels backward at the same speed as the actor advances.
        return 0, half_stride * (1 - 4 * phase)
    recovery = 2 * phase - 1
    return .058 * sin(pi * recovery) ** 1.3, -half_stride * cos(pi * recovery)


def main():
    editor = AnimationEditor.from_bbmodel(recipe_paths(__file__).model)
    clip = editor.animation("walk_slime", duration=FRAMES / FPS, loop=True)
    tracks = {name: clip.bone(name, armature="rig") for name in (
        "pelvis", "chest", "head", "trail", "push_L", "push_R",
        "upper_arm_L", "upper_arm_R", "forearm_L", "forearm_R",
    )}

    def pose(name, time, *, position=None, rotation=None, scale=None):
        if position is not None:
            position = tuple(value * U for value in position)
        tracks[name].key(time, position=position, rotation=rotation, scale=scale,
                         interpolation="linear")

    for frame in range(FRAMES + 1):
        t = frame / FPS
        phase = (frame % FRAMES) / FRAMES
        pulse = cos(2 * tau * phase)
        sway = cos(tau * phase)
        stretch = 1 - .038 * pulse
        cross = sqrt(1 / stretch)
        pose("pelvis", t, position=(.024 * sway, -.025 * pulse, .017 * sin(2 * tau * phase)),
             rotation=(2.5 + 1.2 * pulse, 0, 1.8 * sway), scale=(cross, stretch, cross))
        pose("chest", t, rotation=(-1.5 - 2 * sin(2 * tau * phase), 2.7 * sway, -1.6 * sway))
        follow = (phase - 2 / FRAMES) % 1
        pose("head", t, rotation=(2.2 * cos(2 * tau * follow), -1.5 * cos(tau * follow), 1.4 * sway))
        tail_pulse = cos(2 * tau * follow)
        tail_stretch = 1 + .145 * tail_pulse
        tail_cross = sqrt(1 / tail_stretch)
        pose("trail", t, position=(.019 * cos(tau * follow), .004 * (1 - tail_pulse), -.041 * tail_pulse),
             scale=(tail_cross, tail_cross, tail_stretch))

        for side, offset in (("L", 0), ("R", .5)):
            local = (phase + offset) % 1
            lift, advance = step(local)
            landing = max(0, cos(2 * tau * local))
            spread = 1 + .044 * landing
            pose(f"push_{side}", t, position=(0, lift, advance),
                 scale=(spread, 1 / (spread * spread), spread))
            swing = sin(tau * (local - .13))
            pose(f"upper_arm_{side}", t, rotation=(6 * swing, 0, 0))
            pose(f"forearm_{side}", t, rotation=(2 + 3.8 * sin(tau * (local - .23)), 0, 0))
    editor.save()


if __name__ == "__main__":
    main()
