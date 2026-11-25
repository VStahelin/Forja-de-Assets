from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / 'Tools' / '__init__.py').is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = 'recipe'


def build_model():
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.gallery_masonry import build_masonry

    return build_masonry(paths.model.parent.name, paths.project)


if __name__ == '__main__':
    build_model().export_bbmodel(recipe_paths(__file__).model)
