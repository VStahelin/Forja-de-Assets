"""Model authoring recipe for forge-mark."""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib import Frame, MeshDraft, ModelBuilder, Profile
from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = "recipe"


def build_forge_mark_model() -> ModelBuilder:
    builder = ModelBuilder("forge-mark", modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("root")
    draft = MeshDraft(closed=True)
    levels = [(0, -8, 8, 4), (2, -8, 8, 4), (5, -4, 4, 3), (9, -4, 4, 3),
              (11, -10, 9, 4), (14, -13, 13, 4), (17, -13, 15, 4)]
    rings = []
    for index, (height, left, right, depth) in enumerate(levels):
        corner = 0.7
        profile = Profile.polygon([
            (left + corner, -depth), (right - corner, -depth), (right, -depth + corner),
            (right, depth - corner), (right - corner, depth), (left + corner, depth),
            (left, depth - corner), (left, -depth + corner),
        ])
        frame = Frame.from_normal((0, height, 0), normal=(0, 1, 0), y_hint=(0, 0, -1))
        rings.append(draft.ring_from_profile(f"level_{index}", profile, frame))
    for index, (lower, upper) in enumerate(zip(rings, rings[1:])):
        draft.connect_rings(lower, upper, prefix=f"sides_{index}")
    draft.cap(rings[0], name="sole").cap(rings[-1], name="face")
    builder.add_mesh("anvil", "root", draft)

    return builder


def main():
    model_path = recipe_paths(__file__).model
    builder = build_forge_mark_model()
    builder.export_bbmodel(model_path)
    print(f"[model] Exported to {model_path}")


if __name__ == "__main__":
    main()
