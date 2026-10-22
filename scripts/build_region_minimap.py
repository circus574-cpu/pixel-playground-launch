"""Rebuild the region minimap (nexus/pyra) from the installed anime textures.

Usage: python3 scripts/build_region_minimap.py nexus|pyra
Writes public/game/assets/stage3/<world>-minimap.webp and points the region JSON at it.
Same geometry as the game: rectangle paths/plazas, obstacles, objects with their origins.
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
world_id = sys.argv[1]
region_path = ROOT / f"src/game/world/regions/{world_id}.json"
world = json.loads(region_path.read_text())
pack = json.loads(next((ROOT / f"public/game/assets/gpu/{world_id}-start").glob("*/pack.json")).read_text())
urls = {a["id"]: ROOT / "public" / a["url"].lstrip("/") for a in pack["assets"]}
binds = pack["renderBindings"]
S = 1 / 2
W, H = round(world["width"] * S), round(world["height"] * S)


def tiled(key, w, h):
    b = binds[key]
    side = max(8, round(b["tileSize"][0] * S))
    tile = Image.open(urls[b["asset"]]).convert("RGBA").resize((side, side), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (w, h))
    for ty in range(0, h, side):
        for tx in range(0, w, side):
            out.paste(tile, (tx, ty))
    return out


def paint(img, key, rects):
    for r in rects:
        x, y, w, h = (round(r[k] * S) for k in ("x", "y", "width", "height"))
        img.alpha_composite(tiled(key, w, h), (x, y))


img = tiled(f"terrain.{world_id}-ground", W, H)
paint(img, f"terrain.{world_id}-path", world["terrain"]["paths"])
paint(img, f"terrain.{world_id}-plaza", world["terrain"]["plazas"])
paint(img, f"terrain.{world_id}-wall", world["obstacles"])
for o in sorted(world["objects"], key=lambda o: o["y"]):
    b = binds.get("object." + o["asset"])
    if not b:
        continue
    sprite = Image.open(urls[b["asset"]]).convert("RGBA")
    k = min(o["width"] / sprite.width, o["height"] / sprite.height) * S
    sprite = sprite.resize((max(1, round(sprite.width * k)), max(1, round(sprite.height * k))),
                           Image.Resampling.LANCZOS)
    ox, oy = b.get("origin", [o["anchorX"], o["anchorY"]])
    img.alpha_composite(sprite, (round(o["x"] * S - sprite.width * ox), round(o["y"] * S - sprite.height * oy)))
out = f"/game/assets/stage3/{world_id}-minimap.webp"
img.resize((W * 2 // 3, H * 2 // 3), Image.Resampling.LANCZOS).convert("RGB").save(ROOT / "public" / out.lstrip("/"), quality=88)
world["minimap"] = out
region_path.write_text(json.dumps(world, ensure_ascii=False, indent=2) + "\n")
print(world_id, out, img.size)
