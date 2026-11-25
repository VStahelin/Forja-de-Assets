"""Textura do módulo de parede x3: albedo do gerador 2D + normal map do mapa de blocos."""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from Tools.TexturePainter import TexturePainter
from Tools.recipe_context import recipe_paths

MODULE = 3


def paint():
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.flat_relief import (paint_flat_wall_albedo, paint_flat_wall_ao,
                                           paint_flat_wall_height, paint_flat_wall_normal)

    painter = TexturePainter.from_bbmodel(paths.model)
    paint_flat_wall_albedo(painter, MODULE, paths.project)
    painter.save(paths.texture)
    for suffix, fn in (("normal", paint_flat_wall_normal), ("ao", paint_flat_wall_ao),
                       ("height", paint_flat_wall_height)):
        extra = TexturePainter.from_bbmodel(paths.model)
        fn(extra, MODULE, paths.project)
        extra.save(str(paths.texture.with_name(f"texture_{suffix}.png")), register=False, backup=False)
    print(f"[texture] Saved to {paths.texture} (+ normal, ao, height)")


if __name__ == "__main__":
    paint()
