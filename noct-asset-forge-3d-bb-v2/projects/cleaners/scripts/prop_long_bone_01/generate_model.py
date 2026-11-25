"""Regenera a geometria do prop a partir do personagem de origem."""
from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = "recipe"

if __name__ == "__main__":
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.discard_props import build

    build(paths, Path(__file__).parent.name).export_bbmodel(paths.model)
