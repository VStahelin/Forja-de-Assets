"""Tramo de abóbada de arestas de 4 x 4 m, de tijolo, nascendo a 2,0 m e chegando a 4,0 m."""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib.model_builder import ModelBuilder
from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = "recipe"
PIECE = "vault"


def build_model() -> ModelBuilder:
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.arch_kit import build_piece

    builder = ModelBuilder("env_vault_groin_4x4", modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("root")
    return build_piece(builder, PIECE)


def main():
    model_path = recipe_paths(__file__).model
    build_model().export_bbmodel(model_path)
    print(f"[model] Exported to {model_path}")


if __name__ == "__main__":
    main()
