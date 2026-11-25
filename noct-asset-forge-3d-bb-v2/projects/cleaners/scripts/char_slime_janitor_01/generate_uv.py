"""UVs a 128 px/m, com 192 px/m na superfície frontal do rosto."""
from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from Tools.recipe_context import recipe_paths
from Tools.uv_builder import UVBuilder


if __name__ == "__main__":
    uv = UVBuilder(
        recipe_paths(__file__).model, uv_scale=8, layout="faces",
        require_integer_uvs=False, island_padding=1,
    ).clear()
    uv.rule(element="slime_head", face_group="facial_surface", density=12)
    uv.save()
