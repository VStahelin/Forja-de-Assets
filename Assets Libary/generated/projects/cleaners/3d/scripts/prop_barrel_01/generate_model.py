"""Barril de madeira com aros de ferro: 0,90 m, 0,60 m no bojo, tampa recuada, 12 aduelas."""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib.model_builder import ModelBuilder
from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = "recipe"


def build_model() -> ModelBuilder:
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.props import build_barrel

    builder = ModelBuilder("prop_barrel_01", modeling_mode="free", require_integer_dimensions=False)
    return build_barrel(builder)


def main():
    model_path = recipe_paths(__file__).model
    build_model().export_bbmodel(model_path)
    print(f"[model] Exported to {model_path}")


if __name__ == "__main__":
    main()
