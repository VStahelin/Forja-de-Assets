"""Painel articulado de ferro. O eixo da dobradiça fica em X=0."""
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

    model = ModelBuilder("prop_elevator_gate_panel_01", modeling_mode="box")
    model.add_group("root")

    def box(name, size, at):
        model.add_box(name, "root", size=m(*size), at=m(*at))

    for side, x in (("hinge", 0.03125), ("tip", 0.40625)):
        box(side, (0.0625, 2.5, 0.0625), (x, 1.25, 0))
    for name, y in (("bottom", 0.0625), ("middle", 1.25), ("top", 2.4375)):
        box(name, (0.3125, 0.125, 0.0625), (0.21875, y, 0))
    for name, y in (("lower_bar", 0.65625), ("upper_bar", 1.84375)):
        box(name, (0.0625, 1.0625, 0.0625), (0.21875, y, 0))
    return model


if __name__ == "__main__":
    build_model().export_bbmodel(recipe_paths(__file__).model)
