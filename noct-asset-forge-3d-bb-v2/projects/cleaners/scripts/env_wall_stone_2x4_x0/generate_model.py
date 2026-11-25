"""Módulo de parede x0: pedaço 0 da parede de 8 x 4 m. 2 m x 4 m, quad plano (relevo no normal map)."""
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
MODULE = 0


def build_model() -> ModelBuilder:
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.flat_relief import build_flat_wall

    builder = ModelBuilder(paths.model.parent.name, modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("root")
    return build_flat_wall(builder, MODULE)


def main():
    model_path = recipe_paths(__file__).model
    build_model().export_bbmodel(model_path)
    print(f"[model] Exported to {model_path}")


if __name__ == "__main__":
    main()
