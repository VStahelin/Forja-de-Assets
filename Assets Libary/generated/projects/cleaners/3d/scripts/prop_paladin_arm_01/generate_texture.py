"""Pinta o prop na paleta do Cleaners."""
from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from Tools.TexturePainter import TexturePainter
from Tools.recipe_context import recipe_paths

if __name__ == "__main__":
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.discard_props import paint

    painter = TexturePainter.from_bbmodel(paths.model)
    paint(painter, Path(__file__).parent.name)
    painter.save(paths.texture, edge_dilation=1)
