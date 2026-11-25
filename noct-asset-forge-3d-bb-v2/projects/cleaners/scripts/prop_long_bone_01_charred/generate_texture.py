from pathlib import Path
import sys

for root in Path(__file__).resolve().parents:
    if (root / 'Tools' / '__init__.py').is_file():
        sys.path.insert(0, str(root))
        break

from Tools.recipe_context import recipe_paths

import numpy as np
from PIL import Image

if __name__ == '__main__':
    paths = recipe_paths(__file__)
    source = paths.project / 'assets/prop_long_bone_01/texture.png'
    rgba = np.asarray(Image.open(source).convert('RGBA')).copy()
    luma = rgba[:,:,:3] @ np.array([.2126, .7152, .0722])
    y, x = np.indices(luma.shape)
    char = luma + (((x * 13) ^ (y * 19)) % 17 - 8) * 3
    ramps = np.array([(7,8,12),(13,16,24),(22,24,29),(38,42,49),
                      (61,54,46),(97,86,71),(143,130,107),(185,171,143)], dtype=np.uint8)
    rgba[:,:,:3] = ramps[np.digitize(char,[43,65,90,118,148,178,203])]
    rgba[rgba[:,:,3]==0,:3] = 0
    Image.fromarray(rgba).save(paths.texture)
