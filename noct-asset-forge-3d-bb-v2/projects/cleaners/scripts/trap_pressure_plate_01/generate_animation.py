from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / 'Tools' / '__init__.py').is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

from lib import AnimationEditor


if __name__ == '__main__':
    editor = AnimationEditor.from_bbmodel(recipe_paths(__file__).model)
    clip = editor.animation('pose_raised', duration=.1, loop='hold')
    track = clip.bone('plate', armature='rig')
    for t in (0,.1):
        track.key(t, position=(0, 0, 0))
    clip = editor.animation('pose_pressed', duration=.1, loop='hold')
    track = clip.bone('plate', armature='rig')
    for t in (0,.1):
        track.key(t, position=(0, -0.32, 0))
    editor.save()
