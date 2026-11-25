"""Textura reproduzível de um prop de mobiliário."""
from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths
from Tools.TexturePainter import TexturePainter


if __name__ == "__main__":
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.room_furniture_paint import paint

    painter = TexturePainter.from_bbmodel(paths.model)
    paint(painter, is_pewter=Path(__file__).parent.name == "prop_tin_mug_01")
    painter.save(paths.texture, edge_dilation=1)
