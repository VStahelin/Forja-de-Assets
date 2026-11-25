"""Módulo de chão x2z1: pedaço (2, 1) do tile de chão de 8 x 8 m. 2 x 2 m, quad plano (relevo no normal map)."""
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
MODULE = (2, 1)


def build_model() -> ModelBuilder:
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.flat_relief import build_flat_floor

    builder = ModelBuilder(paths.model.parent.name, modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("root")
    return build_flat_floor(builder, *MODULE)


def main():
    model_path = recipe_paths(__file__).model
    build_model().export_bbmodel(model_path)
    print(f"[model] Exported to {model_path}")


if __name__ == "__main__":
    main()
