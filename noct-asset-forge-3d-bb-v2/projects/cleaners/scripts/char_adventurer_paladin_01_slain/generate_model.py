from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / 'Tools' / '__init__.py').is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

from lib import ModelBuilder

ASSET_BUILD_GEOMETRY = 'recipe'


def build_model():
    paths = recipe_paths(__file__)
    sys.path.insert(0,str(paths.project))
    from cleaners_lib.paladin import build_paladin

    model = ModelBuilder('char_adventurer_paladin_01_slain',modeling_mode='free',require_integer_dimensions=False)
    return build_paladin(model,slain=True)


if __name__ == '__main__':
    build_model().export_bbmodel(recipe_paths(__file__).model)
