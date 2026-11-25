"""Moldura de ferro para os rolos do receptor da cabine."""
from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

from lib import ModelBuilder


def build_model(box):
    model = ModelBuilder("prop_disposal_counter_01", modeling_mode="free", require_integer_dimensions=False)
    model.add_group("root")
    box(model, "mount_board", (.5, .1875, .046875), (0, .09375, -.0234375))
    box(model, "iron_recess", (.40625, .15625, .03125), (0, .09375, .0078125))
    for index, sign in enumerate((-1, 1)):
        box(model, f"iron_rail_{index}", (.4375, .0234375, .046875),
            (0, .09375 + sign * .08203125, .0234375))
        box(model, f"iron_stile_{index}", (.03125, .138671875, .046875),
            (sign * .203125, .09375, .0234375))
        box(model, f"iron_mount_{index}", (.046875, .109375, .03125),
            (sign * .234375, .09375, .0078125))
        for rivet, offset in enumerate((-1, 1)):
            box(model, f"iron_rivet_{index}_{rivet}", (.015625, .015625, .015625),
                (sign * .234375, .09375 + offset * .03515625, .02734375))
    return model


if __name__ == "__main__":
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.manager_lobby import box

    build_model(box).export_bbmodel(paths.model)
