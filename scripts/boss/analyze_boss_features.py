import numpy as np
from PIL import Image
from pathlib import Path

raw_dir = Path('art/production/bosses/raw')
files = sorted(raw_dir.glob("*.png"))

for i, f in enumerate(files):
    img = Image.open(f).convert("RGBA")
    arr = np.array(img).astype(float)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    excess = np.maximum(0.0, np.minimum(r - g, b - g))
    fg = excess < 40.0
    
    # Analyze color distribution in foreground
    fg_r, fg_g, fg_b = r[fg], g[fg], b[fg]
    total_fg = len(fg_r)
    
    # Check percentage of warm vs cold vs green vs gold vs dark colors
    fiery = np.sum((fg_r > 180) & (fg_g < 120) & (fg_b < 100)) / total_fg * 100 # orange/red
    cyan_blue = np.sum((fg_b > 160) & (fg_g > 120) & (fg_r < 100)) / total_fg * 100 # cyan/ice
    green_nature = np.sum((fg_g > 140) & (fg_r < 120) & (fg_b < 120)) / total_fg * 100 # green
    gold_amber = np.sum((fg_r > 190) & (fg_g > 150) & (fg_b < 100)) / total_fg * 100 # gold/yellow
    purple_void = np.sum((fg_r > 120) & (fg_b > 160) & (fg_g < 90)) / total_fg * 100 # purple/void
    white_bright = np.sum((fg_r > 210) & (fg_g > 210) & (fg_b > 210)) / total_fg * 100 # bright white
    dark_shadow = np.sum((fg_r < 50) & (fg_g < 50) & (fg_b < 50)) / total_fg * 100
    
    print(f"Boss [{i}] {f.name}:")
    print(f"  Color spectrum: Fiery={fiery:.1f}%, Cyan={cyan_blue:.1f}%, Green={green_nature:.1f}%, Gold={gold_amber:.1f}%, Purple={purple_void:.1f}%, White={white_bright:.1f}%, Dark={dark_shadow:.1f}%")
