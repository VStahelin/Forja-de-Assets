"""Textura do esqueleto: osso, pano rasgado, ferro enferrujado e o brilho roxo, paleta da bible, 128 px/m."""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from Tools.TexturePainter import TexturePainter
from Tools.recipe_context import recipe_paths


def paint():
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.skeleton import paint_skeleton

    painter = TexturePainter.from_bbmodel(paths.model)
    paint_skeleton(painter)
    painter.save(paths.texture, edge_dilation=1)
    print(f"[texture] Saved to {paths.texture}")


if __name__ == "__main__":
    paint()
