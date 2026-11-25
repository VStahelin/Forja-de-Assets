"""Pixel-art texture authoring recipe for forge-mark."""
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
    model_path, texture_path = paths.model, paths.texture

    painter = TexturePainter.from_bbmodel(model_path)

    def enamel(sample):
        height = sample.model_position[1]
        if sample.model_normal[1] > 0.7 and height > 15:
            return (219, 255, 169, 255)
        if height > 13:
            return (183, 244, 120, 255)
        if height < 2:
            return (35, 50, 33, 255)
        return (81, 124, 66, 255)

    painter.element("anvil").paint_surface(enamel)
    painter.save(texture_path, edge_dilation=1)
    print(f"[texture] Saved to {texture_path}")


if __name__ == "__main__":
    paint()
