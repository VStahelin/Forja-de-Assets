"""Model authoring recipe for prop_paladin_leg_01."""
from __future__ import annotations

import json
from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib.model_builder import ModelBuilder
from lib.geometry_types import MeshDraft
from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = "recipe"


def build_prop_paladin_leg_01_model() -> ModelBuilder:
    paths = recipe_paths(__file__)
    paladin = paths.project / "assets" / "char_adventurer_paladin_01" / "model.bbmodel"
    elements = {element["name"]: element for element in json.loads(
        paladin.read_text(encoding="utf-8")
    )["elements"]}
    names = ("cuisse_L", "poleyn_L", "greave_L", "sabaton_L")

    # These armor pieces are stored in bind pose, with vertex positions relative to their origins.
    positions = {}
    for name in names:
        piece = elements[name]
        if any(piece.get("rotation", (0, 0, 0))):
            raise ValueError(f"{name}: expected unrotated geometry in the paladin bind pose")
        positions[name] = {
            key: tuple(coord + origin for coord, origin in zip(point, piece["origin"]))
            for key, point in piece["vertices"].items()
        }

    x, y, z = zip(*(point for piece in positions.values() for point in piece.values()))
    pivot = ((min(x) + max(x)) / 2, min(y), (min(z) + max(z)) / 2)
    builder = ModelBuilder("prop_paladin_leg_01", modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("leg")
    for name in names:
        draft = MeshDraft(closed=True)
        for key, point in positions[name].items():
            draft.vertex(key, tuple(coord - origin for coord, origin in zip(point, pivot)))
        draft.anchor("center", tuple((min(axis) + max(axis)) / 2 for axis in zip(*draft.vertices.values())))
        for key, face in elements[name]["faces"].items():
            vertices = face["vertices"]
            # Planar UV islands for the existing triangle surfaces, including warped quads.
            for index in range(1, len(vertices) - 1):
                draft.face(f"{key}_{index}", (vertices[0], vertices[index], vertices[index + 1]))
        builder.add_mesh(name, "leg", draft, pivot="center", allow_triangles=True, no_overlap_check=True)
    return builder


def main():
    model_path = recipe_paths(__file__).model
    builder = build_prop_paladin_leg_01_model()
    builder.export_bbmodel(model_path)
    print(f"[model] Exported to {model_path}")


if __name__ == "__main__":
    main()
