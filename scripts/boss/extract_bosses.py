import zipfile
from pathlib import Path
from PIL import Image
import numpy as np

zip_path = Path(r'C:/Users/maki5/.gemini/antigravity/brain/d8f62331-f91e-4606-965b-c7c104fec35b/.user_uploaded/media_1793565436950_25802109.zip')
out_dir = Path('art/production/bosses/raw')
out_dir.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(zip_path, 'r') as z:
    z.extractall(out_dir)

print("Extracted files:")
for f in sorted(out_dir.glob("*.png")):
    img = Image.open(f)
    arr = np.array(img)
    # Sample corner pixels to check background color
    tl = arr[10, 10]
    print(f"  {f.name}: {img.size}, mode={img.mode}, corner_rgb={tl[:3]}")
