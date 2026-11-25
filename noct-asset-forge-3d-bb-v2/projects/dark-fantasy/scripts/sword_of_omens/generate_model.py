"""Model authoring recipe for sword_of_omens (dark fantasy sword with a clawed guard and an eye gem).

Reference: projects/dark-fantasy/reference.png (the 2D take of the same sword).
Orientation: Y up, tip up, blade flat facing +Z (front), symmetric on X. 1 unit ~= 15 px of the 2D reference,
so the sword is about 32 units long (the same height as a character).

Layout along Y (units): pommel 0-3, grip 2.8-9.4, collar 9.4-10.3, guard 10.2-12.4 (horns reach 15.3),
blade 12.4-32.
"""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from lib import Path3D, Profile, SegmentSection
from lib.model_builder import ModelBuilder
from lib.geometry_types import Placement
from Tools.recipe_context import recipe_paths

ASSET_BUILD_GEOMETRY = "recipe"

TAGS = ("assembly:sword",)


def _blade_profile(half_width: float, half_thickness: float) -> Profile:
    """Flat hexagonal blade section: sharp edges at +-X, bevelled faces."""
    w, t = half_width, half_thickness
    return Profile.polygon([(w, 0), (w * 0.5, t), (-w * 0.5, t), (-w, 0), (-w * 0.5, -t), (w * 0.5, -t)])


def _blade_sections() -> list[SegmentSection]:
    """Base to tip. The lower half is bitten by five notches on both edges (a tormented blade)."""
    base_t = 0.26
    stops: list[tuple[float, float, float]] = [(0.0, 1.0, base_t)]
    for i in range(5):
        a = 0.07 + 0.085 * i
        stops += [(a, 1.0, base_t), (a + 0.030, 0.74, base_t), (a + 0.045, 1.0, base_t)]
    stops += [(0.60, 1.06, 0.24), (0.88, 0.80, 0.18), (0.965, 0.40, 0.12), (1.0, 0.06, 0.06)]
    widen = 1.3  # blade half-width at the base, in units (the stops above are factors of it)
    return [SegmentSection(f"s{i}", _blade_profile(w * widen, t), t=at) for i, (at, w, t) in enumerate(stops)]


def build_sword_of_omens_model() -> ModelBuilder:
    builder = ModelBuilder("sword_of_omens", modeling_mode="free", require_integer_dimensions=False)

    builder.add_group("root") \
           .add_transform_group("body", "root", pivot=(0, 0, 0))

    common = dict(tags=TAGS, no_overlap_check=True)

    # ------------------------------------------------------------------ blade
    builder.add_segment("blade", "body", start=(0, 12.4, 0), end=(0, 32.0, 0), y_hint=(0, 0, 1),
                        sections=_blade_sections(), pivot="start", **common)

    # Raised inlay strips along the center of both faces: the channel that carries the runes.
    builder.add_box("fuller_front", "body", size=(0.6, 14.5, 0.1), at=(0, 22.0, 0.28), native=False, tags=TAGS)
    builder.add_box("fuller_back", "body", size=(0.6, 14.5, 0.1), at=(0, 22.0, -0.28), native=False, tags=TAGS)

    # ------------------------------------------------------------------ guard
    builder.add_box("guard_core", "body", size=(3.6, 1.9, 1.5), at=(0, 11.3, 0), native=False, tags=TAGS)

    # Claw horns: one sweeping curve that dips below the guard and rises to a sharp tip.
    horn_path = Path3D.bezier((1.5, 11.0, 0), (4.5, 9.6, 0), (6.2, 12.0, 0), (4.9, 15.3, 0), samples=14)
    builder.add_sweep("horn_L", "body", path=horn_path, profile=Profile.ellipse(1.5, 1.0, segments=6),
                      y_hint=(0, 0, 1), scale=((0, 1.0), (0.6, 0.7), (1, 0.08)), pivot="base", **common)
    builder.mirror("horn_L")  # creates horn_R

    # Fangs hanging under the guard (inverted cones).
    builder.add_frustum("fang_L", "body", bottom_radius=0.06, top_radius=0.55, height=1.7, segments=6,
                        placement=Placement.at((1.7, 9.55, 0)).pivot("center"), **common)
    builder.mirror("fang_L")  # creates fang_R

    # Eye gem set in a diamond bezel on the front of the guard.
    builder.add_prism("eye_bezel", "body", radius=1.2, height=0.5, sides=4, axis="Z",
                      placement=Placement.at((0, 11.3, 0.62)).pivot("center"), **common)
    builder.add_uv_sphere("eye_gem", "body", radius=0.9, segments=8, rings=4,
                          placement=Placement.at((0, 11.3, 0.85)).pivot("center"), **common)
    builder.scale_mesh("eye_gem", (0.75, 1.35, 0.55))

    # ------------------------------------------------------------ grip + collar
    builder.add_frustum("collar", "body", bottom_radius=0.75, top_radius=1.0, height=0.9, segments=8,
                        placement=Placement.at((0, 9.85, 0)).pivot("center"), **common)
    builder.add_cylinder("grip", "body", radius=0.72, height=6.6, segments=8,
                         placement=Placement.at((0, 6.1, 0)).pivot("center"), **common)
    for name, y in (("ring_a", 4.3), ("ring_b", 6.1), ("ring_c", 7.9)):
        builder.add_cylinder(name, "body", radius=0.9, height=0.5, segments=8,
                             placement=Placement.at((0, y, 0)).pivot("center"), **common)

    # ------------------------------------------------------------------ pommel
    builder.add_uv_sphere("pommel", "body", radius=1.4, segments=8, rings=4,
                          placement=Placement.at((0, 1.7, 0)).pivot("center"), **common)
    builder.add_cone("spike_L", "body", radius=0.45, height=1.3, segments=6, axis="X",
                     placement=Placement.at((1.9, 1.7, 0)).pivot("center"), **common)
    builder.mirror("spike_L")  # creates spike_R
    builder.add_frustum("pommel_tip", "body", bottom_radius=0.06, top_radius=0.5, height=1.0, segments=6,
                        placement=Placement.at((0, 0.5, 0)).pivot("center"), **common)
    builder.add_uv_sphere("pommel_gem", "body", radius=0.55, segments=8, rings=4,
                          placement=Placement.at((0, 1.7, 1.25)).pivot("center"), **common)

    return builder


def main():
    model_path = recipe_paths(__file__).model
    builder = build_sword_of_omens_model()
    builder.export_bbmodel(model_path)
    print(f"[model] Exported to {model_path}")


if __name__ == "__main__":
    main()
