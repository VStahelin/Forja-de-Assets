"""Animações do gerente goblin: idle, talk, drum_fingers e nod.

Animação fluida (VX-05): curvas amostradas a 24 quadros por segundo e interpoladas em linha.
Eixos conferidos com `forge animation --rig` e com uma sonda numérica (21/11/2026):
- dedos: z negativo fecha a mão esquerda e z positivo fecha a direita (a palma olha para a coxa);
- braço e antebraço: x positivo leva a mão para a frente, nos dois lados;
- cabeça: x positivo abaixa o rosto (aceno), y gira para os lados.
Rotação em graus a partir da pose de repouso, que já tem os dedos levemente curvados.
"""
from __future__ import annotations

import math
from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib import AnimationEditor
from Tools.recipe_context import recipe_paths

FPS = 24
FINGERS = ("index", "middle", "ring", "pinky")
PHALANX = ("proximal", "middle", "distal")
TAU = math.tau


def wave(t, period, phase=0.0, harmonic=1):
    return math.sin(TAU * harmonic * t / period + phase)


def pulse(t, period, center, width):
    """Bump suave e periódico (0 a 1) centrado em `center` segundos."""
    d = (t - center + period / 2) % period - period / 2
    return math.exp(-(d / width) ** 2)


def curl_sign(side):
    return -1.0 if side == "L" else 1.0


def main():
    editor = AnimationEditor.from_bbmodel(recipe_paths(__file__).model)

    def bone(clip, name):
        return clip.bone(name, armature="rig")

    def fingers(clip, side, duration, amount, fps=FPS):
        """amount(t, finger_index) -> graus extras de curvatura (positivo fecha)."""
        sign = curl_sign(side)
        for i, finger in enumerate(FINGERS):
            for k, ph in enumerate(PHALANX):
                share = (0.8, 1.0, 0.7)[k]
                bone(clip, f"{finger}_{ph}_{side}").sample(
                    "rotation", 0, duration, fps,
                    lambda t, i=i, share=share: (0, 0, sign * share * amount(t, i)))
        bone(clip, f"thumb_proximal_{side}").sample(
            "rotation", 0, duration, fps, lambda t: (0, 0, sign * 0.5 * amount(t, 1)))

    # --- idle: respira devagar, olha em volta, dedos mexem um pouco -----------------------
    d = 4.0
    idle = editor.animation("idle", duration=d, loop=True)
    bone(idle, "chest").sample("rotation", 0, d, FPS, lambda t: (1.6 * wave(t, d), 0, 0))
    bone(idle, "spine").sample("rotation", 0, d, FPS, lambda t: (0.8 * wave(t, d, 0.4), 0, 0.6 * wave(t, d, 1.2)))
    bone(idle, "neck").sample("rotation", 0, d, FPS, lambda t: (1.0 * wave(t, d, 0.8), 0, 0))
    bone(idle, "head").sample("rotation", 0, d, FPS,
                              lambda t: (2.0 * wave(t, d, 1.3), 7.0 * wave(t, d, 0.2), 2.5 * wave(t, d, 2.0, 2)))
    for side, s in (("L", 1), ("R", -1)):
        bone(idle, f"upper_arm_{side}").sample("rotation", 0, d, FPS,
                                               lambda t, s=s: (1.5 * wave(t, d, 0.5), 0, s * 1.6 * wave(t, d)))
        bone(idle, f"forearm_{side}").sample("rotation", 0, d, FPS, lambda t: (2.0 * wave(t, d, 0.9), 0, 0))
        fingers(idle, side, d, lambda t, i, s=s: 4.0 + 3.0 * wave(t, d, 0.5 * i + (0 if s > 0 else 1.7)))

    # --- talk: explica a ordem do dia, gesticulando com a mão direita ---------------------
    d = 2.4
    talk = editor.animation("talk", duration=d, loop=True)
    bone(talk, "chest").sample("rotation", 0, d, FPS, lambda t: (1.5 * wave(t, d, 0, 2), 3.0 * wave(t, d), 0))
    bone(talk, "head").sample("rotation", 0, d, FPS,
                              lambda t: (4.0 + 4.0 * wave(t, d, 0.3, 2), -6.0 * wave(t, d, 0.6), 3.0 * wave(t, d, 1.0)))
    bone(talk, "upper_arm_R").sample("rotation", 0, d, FPS,
                                     lambda t: (24.0 + 6.0 * wave(t, d, 0, 2), 0, -8.0 - 3.0 * wave(t, d)))
    bone(talk, "forearm_R").sample("rotation", 0, d, FPS, lambda t: (62.0 + 14.0 * wave(t, d, 0.4, 2), 0, 0))
    bone(talk, "hand_R").sample("rotation", 0, d, FPS, lambda t: (-10.0 + 8.0 * wave(t, d, 0.9, 2), 0, 0))
    # Mão que fala: abre (dedos esticam um pouco) e fecha no ritmo das frases.
    fingers(talk, "R", d, lambda t, i: -6.0 + 9.0 * (0.5 + 0.5 * wave(t, d, 0.2 * i, 2)))
    bone(talk, "upper_arm_L").sample("rotation", 0, d, FPS, lambda t: (2.0 * wave(t, d), 0, 1.0 * wave(t, d, 1)))
    fingers(talk, "L", d, lambda t, i: 4.0 + 2.0 * wave(t, d, 0.4 * i))

    # --- drum_fingers: impaciente, tamborila os dedos na coxa e suspira ---------------------
    d = 2.0
    drum = editor.animation("drum_fingers", duration=d, loop=True)
    taps = (0.10, 0.26, 0.42, 0.58, 1.10, 1.26, 1.42, 1.58)   # mínimo, anelar, médio, indicador (duas vezes)
    order = (3, 2, 1, 0)
    fingers(drum, "L", d, lambda t, i: 8.0 + 24.0 * sum(
        pulse(t, d, taps[j], 0.085) for j in range(len(taps)) if order[j % 4] == i), fps=60)
    bone(drum, "forearm_L").sample("rotation", 0, d, FPS, lambda t: (3.0 + 1.5 * wave(t, d, 0, 2), 0, 0))
    bone(drum, "head").sample("rotation", 0, d, FPS, lambda t: (-3.0 + 1.0 * wave(t, d), 0, 6.0 + 1.5 * wave(t, d, 1.0)))
    bone(drum, "chest").sample("rotation", 0, d, FPS, lambda t: (-2.5 * pulse(t, d, 0.80, 0.30), 0, 0))
    fingers(drum, "R", d, lambda t, i: 4.0)

    # --- nod: concorda com ar importante e volta ao repouso ------------------------------
    d = 1.2
    nod = editor.animation("nod", duration=d, loop="hold")
    env = lambda t: math.sin(math.pi * t / d) ** 2
    bone(nod, "head").sample("rotation", 0, d, FPS, lambda t: (12.0 * env(t) * (0.5 + 0.5 * math.cos(TAU * 2 * t / d + math.pi)) + 4.0 * env(t), 0, 0))
    bone(nod, "neck").sample("rotation", 0, d, FPS, lambda t: (3.0 * env(t), 0, 0))
    bone(nod, "chest").sample("rotation", 0, d, FPS, lambda t: (-2.0 * env(t), 0, 0))

    editor.save()
    print("[animation] idle, talk, drum_fingers e nod salvos")


if __name__ == "__main__":
    main()
