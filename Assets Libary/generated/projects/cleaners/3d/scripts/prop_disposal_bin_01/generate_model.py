"""Caixa de descarte aberta, 1,375 × 1,00 × 0,75 m."""
from __future__ import annotations

from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from lib.model_builder import ModelBuilder
from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = "recipe"


def build_model() -> ModelBuilder:
    sys.path.insert(0, str(recipe_paths(__file__).project))
    from cleaners_lib.props import m

    model = ModelBuilder("prop_disposal_bin_01", modeling_mode="box")
    model.add_group("root")

    def board(name, size, center):
        model.add_box(name, "root", size=m(*size), at=m(*center))

    board("floor", (1.375, 0.125, 1.0), (0.0, 0.0625, 0.0))
    for side, sign in (("positive", 1), ("negative", -1)):
        board(f"long_wall_{side}", (1.125, 0.5625, 0.0625), (0.0, 0.40625, sign * 0.4375))
        board(f"short_wall_{side}", (0.0625, 0.5625, 0.75), (sign * 0.625, 0.40625, 0.0))
        board(f"long_rim_{side}", (1.375, 0.0625, 0.125), (0.0, 0.71875, sign * 0.4375))
        board(f"short_rim_{side}", (0.125, 0.0625, 0.75), (sign * 0.625, 0.71875, 0.0))
        for end, end_sign in (("front", 1), ("back", -1)):
            board(f"post_{side}_{end}", (0.125, 0.5625, 0.125), (sign * 0.625, 0.40625, end_sign * 0.4375))
    return model


if __name__ == "__main__":
    build_model().export_bbmodel(recipe_paths(__file__).model)
