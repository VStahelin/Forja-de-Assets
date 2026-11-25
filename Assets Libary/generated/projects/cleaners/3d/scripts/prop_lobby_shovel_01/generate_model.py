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
    from cleaners_lib.manager_lobby import build_lobby_prop

    build_lobby_prop(paths.model.parent.name).export_bbmodel(paths.model)
