"""Empacota ilhas a 8 px por unidade da Forja."""
from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths
from Tools.uv_builder import UVBuilder

if __name__ == "__main__":
    UVBuilder(
        recipe_paths(__file__).model,
        uv_scale=8,
        layout="faces",
        require_integer_uvs=False,
        island_padding=1,
    ).clear().save()
