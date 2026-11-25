from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / 'Tools' / '__init__.py').is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import REPO_ROOT, recipe_paths
from Tools.TexturePainter import TexturePainter


if __name__ == '__main__':
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.gallery_props import paint_props

    painter = TexturePainter.from_bbmodel(paths.model)
    sibling_2d = paths.project.parent / '2d'
    legacy_2d = REPO_ROOT.parent / 'noct-asset-forge-v2.5/projects/cleaners'
    root_2d = sibling_2d if paths.project.name == '3d' else legacy_2d
    decal = root_2d / 'assets/dirt/dirt_blood_blade_01.png'
    paint_props(painter, paths.model.parent.name, blade_decal=decal)
    painter.save(paths.texture, edge_dilation=1)
