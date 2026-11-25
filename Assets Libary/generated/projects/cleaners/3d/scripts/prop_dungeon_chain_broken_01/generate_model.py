"""Receita geométrica de uma peça do kit de parede da Galeria."""
from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = "recipe"


def build_model():
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.gallery_wall_kit import build_model as build_wall_prop

    return build_wall_prop(paths.asset.name)


if __name__ == "__main__":
    build_model().export_bbmodel(recipe_paths(__file__).model)

