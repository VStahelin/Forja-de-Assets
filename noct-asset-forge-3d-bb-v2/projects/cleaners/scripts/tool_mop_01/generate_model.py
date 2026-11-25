"""Model authoring recipe for tool_mop_01."""
from __future__ import annotations

from math import cos, sin, tau
from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib.model_builder import ModelBuilder
from lib import Placement, Profile, SegmentSection
from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = "recipe"


def build_tool_mop_01_model() -> ModelBuilder:
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.props import U, m

    builder = ModelBuilder("tool_mop_01", modeling_mode="free", require_integer_dimensions=False)
    builder.add_group("mop")
    builder.add_transform_group("mop_head", "mop", pivot=m(0, 0.185, 0))

    def collar(name, y, radius, length, parent="mop"):
        builder.add_cylinder(
            name, parent, radius=radius * U, height=length * U, segments=8, axis="Y",
            placement=Placement.at(m(0, y, 0), space="world"), no_overlap_check=True,
        )

    collar("shaft", 0.795, 0.017, 1.21)
    collar("grip", 1.30, 0.023, 0.16)
    collar("ferrule", 0.185, 0.054, 0.078)
    collar("binding", 0.144, 0.069, 0.030, parent="mop_head")

    # Each bundle keeps its own hinge at the attachment point on the binding.
    for i, length in enumerate((0.096, 0.11, 0.093, 0.12, 0.112, 0.103, 0.117, 0.108)):
        angle = tau * i / 8
        x, z = cos(angle), sin(angle)
        builder.add_segment(
            f"cloth_{i}", "mop_head", start=m(0.031 * x, 0.143, 0.031 * z),
            end=m(length * x, 0.031 + 0.005 * (i % 3), length * z),
            sections=tuple(
                SegmentSection(
                    f"section_{index}", profile=Profile.circle(radius * U, segments=6), t=t
                )
                for index, (t, radius) in enumerate(((0, 0.026), (0.50, 0.036), (1, 0.024)))
            ),
            pivot="start", y_hint=(0, 0, 1), start_cap="flat", end_cap="flat", no_overlap_check=True,
        )

    return builder


def main():
    paths = recipe_paths(__file__)
    builder = build_tool_mop_01_model()
    builder.export_bbmodel(paths.model)
    print(f"[model] Exported to {paths.model}")


if __name__ == "__main__":
    main()
