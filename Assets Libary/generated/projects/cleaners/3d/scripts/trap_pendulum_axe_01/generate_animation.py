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
    clip = editor.animation('pose_armed', duration=.1, loop='hold')
    track = clip.bone('pivot', armature='rig')
    for t in (0,.1):
        track.key(t, rotation=(0, 0, -40))
    clip = editor.animation('pose_lodged', duration=.1, loop='hold')
    track = clip.bone('pivot', armature='rig')
    for t in (0,.1):
        track.key(t, rotation=(0, 0, 26))
    editor.save()
