"""env_wall_doorway_2x4: albedo da alvenaria da Galeria + normal map das pedras."""
from __future__ import annotations

from pathlib import Path
import sys

for _root in Path(__file__).resolve().parents:
    if (_root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(_root))
        break

from Tools.recipe_context import recipe_paths
from Tools.TexturePainter import TexturePainter


if __name__ == "__main__":
    paths = recipe_paths(__file__)
    sys.path.insert(0, str(paths.project))
    from cleaners_lib.flat_relief import paint_flat_masonry_ao, paint_flat_masonry_normal
    from cleaners_lib.gallery_masonry import paint_masonry

    asset = paths.model.parent.name
    painter = TexturePainter.from_bbmodel(paths.model)
    paint_masonry(painter, asset, paths.project)
    painter.save(paths.texture, edge_dilation=1)
    for suffix, fn in (("normal", paint_flat_masonry_normal), ("ao", paint_flat_masonry_ao)):
        extra = TexturePainter.from_bbmodel(paths.model)
        fn(extra, asset, paths.project)
        extra.save(str(paths.texture.with_name(f"texture_{suffix}.png")), register=False, backup=False,
                   edge_dilation=1)
    print(f"[texture] Saved to {paths.texture} (+ normal, ao)")
