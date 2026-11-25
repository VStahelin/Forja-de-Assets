from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / "Tools" / "__init__.py").is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths
from lib import AnimationEditor

if __name__ == "__main__":
    editor = AnimationEditor.from_bbmodel(recipe_paths(__file__).model)
    for name, direction in (("open_chest", 1), ("close_chest", -1)):
        track = editor.animation(name, duration=.55, loop=False).group("lid")
        for step in range(13):
            t = step / 12
            smooth = t * t * (3 - 2 * t)
            angle = -102 * (smooth if direction == 1 else 1 - smooth)
            track.key(t * .55, rotation=(angle, 0, 0), interpolation="linear")
    editor.save()
