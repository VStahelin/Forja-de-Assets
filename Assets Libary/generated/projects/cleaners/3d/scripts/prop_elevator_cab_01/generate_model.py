"""Cabine de 4,25 × 3,1875 × 3,75 m. A entrada fica em +Z."""
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

    model = ModelBuilder("prop_elevator_cab_01", modeling_mode="box")
    model.add_group("root")

    def box(name, size, at):
        model.add_box(name, "root", size=m(*size), at=m(*at))

    box("floor", (4.25, 0.1875, 3.375), (0, 0.09375, -0.1875))
    box("threshold", (4.25, 0.1875, 0.375), (0, 0.09375, 1.6875))
    box("ceiling", (4.25, 0.1875, 3.75), (0, 3.09375, 0))
    box("rear_wall", (4.25, 2.8125, 0.125), (0, 1.59375, -1.8125))
    box("gate_header", (3.5, 0.25, 0.125), (0, 2.875, 1.8125))
    for side, sign in (("left", -1), ("right", 1)):
        box(f"side_wall_{side}", (0.125, 2.8125, 3.5), (sign * 2.0625, 1.59375, 0))
        box(f"gate_jamb_{side}", (0.375, 2.8125, 0.125), (sign * 1.9375, 1.59375, 1.8125))
        for index, z in enumerate((-1.5, 0, 1.5)):
            box(f"upright_{side}_{index}", (0.125, 2.6875, 0.125), (sign * 1.9375, 1.59375, z))
        for index, z in enumerate((-0.75, 0.75)):
            box(f"side_strap_{side}_{index}", (0.0625, 2.6875, 0.0625), (sign * 1.96875, 1.59375, z))
        box(f"rear_upright_{side}", (0.125, 2.6875, 0.125), (sign * 1.625, 1.59375, -1.6875))
        box(f"rear_strap_{side}", (0.0625, 2.6875, 0.0625), (sign * 0.75, 1.59375, -1.71875))
    for index, z in enumerate((-1.375, -0.4375, 0.4375, 1.375)):
        box(f"ceiling_beam_{index}", (4, 0.125, 0.125), (0, 2.9375, z))
    return model


if __name__ == "__main__":
    build_model().export_bbmodel(recipe_paths(__file__).model)
