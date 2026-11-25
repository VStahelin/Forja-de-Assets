from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / 'Tools' / '__init__.py').is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

from shutil import copyfile

ASSET_BUILD_GEOMETRY = 'recipe'

if __name__ == '__main__':
    paths = recipe_paths(__file__)
    paths.model.parent.mkdir(parents=True,exist_ok=True)
    copyfile(paths.project / 'assets/prop_skull_01/model.bbmodel', paths.model)
