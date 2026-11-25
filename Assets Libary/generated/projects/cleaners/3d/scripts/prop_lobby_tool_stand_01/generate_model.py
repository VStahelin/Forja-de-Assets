"""Estande de ferramentas com baia alta, prateleira e placa para a loja."""
from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

from lib import ModelBuilder


def build_model(box, swept):
    model = ModelBuilder("prop_lobby_tool_stand_01", modeling_mode="free", require_integer_dimensions=False)
    model.add_group("root")

    box(model, "back_boards", (1.375, 1.75, .0625), (0, .953125, -.15625))
    box(model, "base_shelf", (1.46875, .09375, .421875), (0, .109375, .015625))
    box(model, "top_rail", (1.5, .15625, .125), (0, 1.859375, -.09375))
    box(model, "mount_board", (1.375, .125, .0625), (0, 1.5625, -.09375))
    box(model, "divider_post", (.0625, 1.5, .09375), (.171875, .90625, .046875))
    box(model, "bucket_shelf", (.46875, .0625, .375), (.4453125, .5625, .015625))
    box(model, "lip_rail", (.4453125, .046875, .03125), (.4453125, .59375, .1953125))
    for index, sign in enumerate((-1, 1)):
        x = sign * .703125
        box(model, f"post_{index}", (.09375, 1.84375, .125), (x, .953125, .09375))
        box(model, f"skid_{index}", (.109375, .0625, .4375), (x, .03125, .015625))
        box(model, f"iron_foot_{index}", (.109375, .0703125, .109375), (x, .1875, .1171875))
    box(model, "iron_sign", (.546875, .1015625, .0234375), (0, 1.87109375, -.01953125))

    for index, x in enumerate((-.484375, -.140625)):
        swept(model, f"iron_hook_{index}",
              [(x, 1.5625, -.04296875), (x, 1.5078125, .0546875),
               (x, 1.5078125, .125), (x, 1.5546875, .15625)], .015625)
        box(model, f"iron_slot_{index}", (.1875, .0625, .015625), (x, 1.6484375, -.11328125))
    box(model, "iron_slot_2", (.1875, .0546875, .015625), (.4453125, .5703125, .211))
    return model


if __name__ == "__main__":
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.manager_lobby import box, swept

    build_model(box, swept).export_bbmodel(paths.model)
