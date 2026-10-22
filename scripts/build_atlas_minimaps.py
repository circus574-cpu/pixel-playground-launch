"""Cut each continent's in-game minimap from the same painted atlas that /mapa and the globe use.

Usage: python3 scripts/build_atlas_minimaps.py
Reads src/game/world/zones.json (atlas bbox per world), writes the padded crop to
public/game/assets/stage3/<world>-minimap.webp and stores the crop box back in zones.json
(`atlas.crop`), so the game maps world coordinates onto the image exactly as on the atlas.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ZONES = ROOT / "src/game/world/zones.json"
ATLAS = ROOT / "src/assets/planet-map/atlas-3840.webp"
MAP_W, MAP_H = 2000, 1000
PAD = 0.06
OUT_W = 960

zones = json.loads(ZONES.read_text())
atlas = Image.open(ATLAS).convert("RGB")
k = atlas.width / MAP_W
for world, z in zones.items():
    b = z["atlas"]["bbox"]
    pw, ph = (b["x1"] - b["x0"]) * PAD, (b["y1"] - b["y0"]) * PAD
    crop = dict(x0=max(0, round(b["x0"] - pw)), y0=max(0, round(b["y0"] - ph)),
                x1=min(MAP_W, round(b["x1"] + pw)), y1=min(MAP_H, round(b["y1"] + ph)))
    img = atlas.crop(tuple(round(crop[c] * k) for c in ("x0", "y0", "x1", "y1")))
    img = img.resize((OUT_W, round(OUT_W * img.height / img.width)))
    out = ROOT / f"public/game/assets/stage3/{world}-minimap.webp"
    img.save(out, quality=86)
    z["atlas"]["crop"] = crop
    print(world, out.name, img.size, crop)
ZONES.write_text(json.dumps(zones, ensure_ascii=False, indent=2) + "\n")
