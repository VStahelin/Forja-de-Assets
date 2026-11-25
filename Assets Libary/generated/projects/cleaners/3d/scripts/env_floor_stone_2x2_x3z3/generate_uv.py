"""UV da peça plana: 8 px por unidade (128 px/m), ilhas por face."""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from Tools.recipe_context import recipe_paths
from Tools.uv_builder import UVBuilder

if __name__ == "__main__":
    UVBuilder(recipe_paths(__file__).model, uv_scale=8, layout="faces", island_padding=0,
              allow_rectangular=True).clear().save()
