import numpy as np
from PIL import Image, ImageFilter

src_path = 'C:/Users/maki5/.gemini/antigravity/brain/d8f62331-f91e-4606-965b-c7c104fec35b/.user_uploaded/media_1793563769497_c4bcafa3.jpg'
img = Image.open(src_path).convert('RGB')
arr = np.array(img).astype(float)
h, w = arr.shape[:2]

r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

# Compute excess magenta: min(r - g, b - g)
excess_m = np.maximum(0.0, np.minimum(r - g, b - g))

# In the shadow at the bottom (rows > 480):
# Shadow is dark magenta/black: R ~ 100, G ~ 0, B ~ 100
# For the character itself, let's isolate rows 0 to 480
char_excess = excess_m.copy()

# Thresholds for alpha
# Full background: excess > 100
# Full foreground: excess < 35
# Linear blend between 35 and 90
alpha = np.clip(1.0 - (excess_m - 35.0) / (90.0 - 35.0), 0.0, 1.0)

# De-spill magenta: on semi-transparent edge pixels, reduce R and B excess to eliminate magenta fringe
despill_amount = (1.0 - alpha)[:, :, np.newaxis]
arr_despill = arr.copy()
# Reduce R and B towards G proportionally
arr_despill[:, :, 0] = np.maximum(0.0, arr[:, :, 0] - excess_m * (1.0 - alpha))
arr_despill[:, :, 2] = np.maximum(0.0, arr[:, :, 2] - excess_m * (1.0 - alpha))

# Combine into RGBA
rgba = np.dstack([arr_despill, alpha * 255.0]).astype(np.uint8)
out_img = Image.fromarray(rgba, mode='RGBA')

# Crop character bounding box (excluding bottom shadow, so rows 0 to 480)
char_rgba = rgba.copy()
char_rgba[480:, :, 3] = 0 # zero out shadow in character sprite

# Find bounding box of character
ys, xs = np.nonzero(char_rgba[:, :, 3] > 10)
min_y, max_y = ys.min(), ys.max()
min_x, max_x = xs.min(), xs.max()
print(f"Character bounding box: x=[{min_x}, {max_x}] (w={max_x - min_x + 1}), y=[{min_y}, {max_y}] (h={max_y - min_y + 1})")

# Also isolate ground shadow
shadow_rgba = rgba.copy()
shadow_rgba[:480, :, 3] = 0
sys, sxs = np.nonzero(shadow_rgba[:, :, 3] > 10)
s_min_y, s_max_y = sys.min(), sys.max()
s_min_x, s_max_x = sxs.min(), sxs.max()
print(f"Shadow bounding box: x=[{s_min_x}, {s_max_x}] (w={s_max_x - s_min_x + 1}), y=[{s_min_y}, {s_max_y}] (h={s_max_y - s_min_y + 1})")

char_crop = Image.fromarray(char_rgba[min_y:max_y+1, min_x:max_x+1], mode='RGBA')
char_crop.save('art/production/boss_preview_char.png', 'PNG')

shadow_crop = Image.fromarray(shadow_rgba[s_min_y:s_max_y+1, s_min_x:s_max_x+1], mode='RGBA')
shadow_crop.save('art/production/boss_preview_shadow.png', 'PNG')

print("Saved art/production/boss_preview_char.png and boss_preview_shadow.png")
