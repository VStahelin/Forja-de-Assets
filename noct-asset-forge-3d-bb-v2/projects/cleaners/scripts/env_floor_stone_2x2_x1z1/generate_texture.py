"""Textura do módulo de chão x1z1: albedo do gerador 2D + normal map e altura do mapa de pedras."""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from Tools.TexturePainter import TexturePainter
from Tools.recipe_context import recipe_paths

MODULE = (1, 1)


def paint():
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.floor_module import paint_floor_module
    from cleaners_lib.flat_relief import paint_flat_floor_ao, paint_flat_floor_height, paint_flat_floor_normal

    painter = TexturePainter.from_bbmodel(paths.model)
    paint_floor_module(painter, *MODULE, paths.project)
    painter.save(paths.texture)
    for suffix, fn in (("normal", paint_flat_floor_normal), ("ao", paint_flat_floor_ao), ("height", paint_flat_floor_height)):
        extra = TexturePainter.from_bbmodel(paths.model)
        fn(extra, *MODULE, paths.project)
        extra.save(str(paths.texture.with_name(f"texture_{suffix}.png")), register=False, backup=False)
    print(f"[texture] Saved to {paths.texture} (+ normal, ao, height)")


if __name__ == "__main__":
    paint()
