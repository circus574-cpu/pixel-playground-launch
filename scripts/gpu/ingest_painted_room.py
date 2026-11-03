#!/usr/bin/env python3
"""Adds one owner-generated painted interior (4:3 background) to the pack `interior-rooms`.

usage: ingest_painted_room.py <image.png> <world e.g. verdant> <building e.g. shop>
Trims the dark rounded border some generators add, saves a webp under public/game/assets/gpu/interior-rooms
and binds it as render binding `interior.<world>.<building>`; the room geometry lives in src/game/city/room.ts.
"""
import hashlib, json, os, shutil, sys
import numpy as np
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
src, world, building = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.open(src).convert("RGB")
a = np.asarray(img).astype(int)
dark = a.max(2) < 30


def margin(lines):
    """Rows or columns from the edge that are mostly dark (the border)."""
    n = 0
    for line in lines:
        if dark[line].mean() > 0.5 if line.ndim == 1 else False:
            n += 1
        else:
            break
    return n


h, w = dark.shape
top = next((i for i in range(h) if dark[i].mean() < 0.5), 0)
bottom = next((i for i in range(h) if dark[h - 1 - i].mean() < 0.5), 0)
left = next((i for i in range(w) if dark[:, i].mean() < 0.5), 0)
right = next((i for i in range(w) if dark[:, w - 1 - i].mean() < 0.5), 0)
pad = 4  # rounded corners reach a little further than the straight border
box = (left + pad, top + pad, w - right - pad, h - bottom - pad)
room = img.crop(box)
print("trimmed", img.size, "->", room.size, "box", box)
asset_id = f"interior-{world}-{building}"
tmp = os.path.join("/tmp", asset_id + ".webp")
room.save(tmp, quality=90, method=6)
digest = hashlib.sha256(open(tmp, "rb").read()).hexdigest()[:12]
out = os.path.join(REPO, "public/game/assets/gpu/interior-rooms", f"1.0.0-{digest}")
os.makedirs(out, exist_ok=True)
shutil.copy(tmp, os.path.join(out, asset_id + ".webp"))
ext = os.path.splitext(src)[1]
shutil.copy(src, os.path.join(out, f"source-{world}-{building}{ext}"))
url = f"/game/assets/gpu/interior-rooms/1.0.0-{digest}/{asset_id}.webp"
path = os.path.join(REPO, "src/game/assets/imported.json")
packs = json.load(open(path))
pack = next((p for p in packs if p["id"] == "interior-rooms"), None)
if pack is None:
    pack = {"schemaVersion": 1, "id": "interior-rooms", "version": "1.0.0", "technical": False,
            "previewOnly": False, "assets": [], "actors": [], "actorBindings": {}, "renderBindings": {}, "effects": {}}
    packs.append(pack)
pack["assets"] = [x for x in pack["assets"] if x["id"] != asset_id] + [
    {"id": asset_id, "version": "1.0.0", "kind": "image", "url": url, "width": room.size[0], "height": room.size[1]}]
pack["renderBindings"][f"interior.{world}.{building}"] = {"asset": asset_id, "fit": "stretch"}
open(path, "w").write(json.dumps(packs, ensure_ascii=False, indent=2) + "\n")
print("room", asset_id, room.size, "->", url)
