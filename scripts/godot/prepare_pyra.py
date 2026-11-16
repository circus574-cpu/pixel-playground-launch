#!/usr/bin/env python3
"""Repack existing assets and bake terrain layers; never generates replacement art."""
import hashlib
import json
import math
import pathlib
import shutil
import subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = pathlib.Path(__file__).resolve().parents[2]
PORT = ROOT / "ports/godot-pyra"
SOURCE = PORT / "data/source.generated.json"
data = json.loads(SOURCE.read_text())
city = data["city"]
crop = city["crop"]
hashes = {}
images = {}
metadata = {}
exported = set()
previous_manifest = PORT / "data/provenance.json"
old_files = set(json.loads(previous_manifest.read_text()).get("exportedTextures", {})) if previous_manifest.exists() else set()


def source(path):
    file = ROOT / "public" / path.lstrip("/")
    hashes[str(file.relative_to(ROOT))] = hashlib.sha256(file.read_bytes()).hexdigest()
    return file


def image(asset):
    key = asset["url"]
    if key not in images:
        file = source(key)
        if file.suffix == ".svg":
            target = PORT / "assets" / (asset["id"] + "-source.png")
            subprocess.run(["node", "--input-type=module", "-e", "import sharp from 'sharp'; await sharp(process.argv[1]).png().toFile(process.argv[2]);", str(file), str(target)], cwd=ROOT, check=True)
            file = target
        images[key] = Image.open(file).convert("RGBA")
    return images[key]


def frame(ref):
    asset = data["assets"][ref["asset"]]
    raw = image(asset)
    name = ref.get("frame")
    if name is None:
        return raw.copy()
    if asset.get("atlasUrl"):
        if asset["atlasUrl"] not in metadata:
            m = json.loads(source(asset["atlasUrl"]).read_text())["frames"]
            metadata[asset["atlasUrl"]] = {f["filename"]: f for f in m} if isinstance(m, list) else m
        f = metadata[asset["atlasUrl"]][str(name)]
        if f.get("rotated"):
            raise ValueError("Rotated atlas frame requires explicit conversion: " + str(name))
        r = f["frame"]
        trimmed = raw.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
        size = f.get("sourceSize", {"w": r["w"], "h": r["h"]})
        at = f.get("spriteSourceSize", {"x": 0, "y": 0})
        canvas = Image.new("RGBA", (size["w"], size["h"]))
        canvas.alpha_composite(trimmed, (at["x"], at["y"]))
        return canvas
    for r in asset.get("crops", []):
        if r["name"] == name:
            return raw.crop((int(r["x"]), int(r["y"]), math.ceil(r["x"] + r["width"]), math.ceil(r["y"] + r["height"])))
    w = asset.get("frameWidth", raw.width // asset.get("grid", {}).get("columns", 1))
    h = asset.get("frameHeight", raw.height // asset.get("grid", {}).get("rows", 1))
    columns = raw.width // w
    i = int(name)
    return raw.crop(((i % columns) * w, (i // columns) * h, (i % columns + 1) * w, (i // columns + 1) * h))


def save(img, path):
    file = PORT / "assets" / path
    file.parent.mkdir(parents=True, exist_ok=True)
    img.save(file, format="PNG", compress_level=6)
    exported.add(str(file.relative_to(PORT)))
    return "res://assets/" + path


def local(p):
    return {"x": p["x"] - crop["x"], "y": p["y"] - crop["y"]}


def rect(r):
    return {**r, **local(r)}


actors = {}
for key, actor in data["actors"].items():
    cell = 256 if key == "hero" else 192
    result = {k: v for k, v in actor.items() if k != "clips"}
    result["clips"] = {}
    for state, clip in actor["clips"].items():
        refs = list(dict.fromkeys(str(n) for names in clip["directions"].values() for n in names))
        pages = []
        mapping = {}
        for page_i in range(math.ceil(len(refs) / 64)):
            part = refs[page_i * 64 : (page_i + 1) * 64]
            sheet = Image.new("RGBA", (8 * cell, math.ceil(len(part) / 8) * cell))
            for i, name in enumerate(part):
                original = next(n for values in clip["directions"].values() for n in values if str(n) == name)
                img = frame({"asset": clip["asset"], "frame": original}).resize((cell, cell), Image.Resampling.LANCZOS)
                x, y = (i % 8) * cell, (i // 8) * cell
                sheet.alpha_composite(img, (x, y))
                mapping[name] = {"page": page_i, "rect": [x, y, cell, cell]}
            pages.append(save(sheet, f"actors/{key}-{state}-{page_i}.png"))
        result["clips"][state] = {"fps": clip["fps"], "loop": clip["loop"], "mirrored": clip.get("mirrored", []), "directions": {direction: [{"sheet": pages[mapping[str(n)]["page"]], "rect": mapping[str(n)]["rect"]} for n in names] for direction, names in clip["directions"].items()}}
    actors[key] = result

objects = []
object_textures = {}
for o in city["objects"]:
    binding = o["binding"]
    img = frame(binding)
    texture_key = binding["asset"] + ":" + str(binding.get("frame", ""))
    if texture_key not in object_textures:
        object_textures[texture_key] = save(img, "objects/" + binding["asset"] + "-" + hashlib.sha256(texture_key.encode()).hexdigest()[:10] + ".png")
    target = object_textures[texture_key]
    size = [o["width"], o["height"]]
    if binding.get("fit") == "contain":
        factor = min(size[0] / img.width, size[1] / img.height)
        size = [img.width * factor, img.height * factor]
    objects.append({"id": o["id"], **local(o), "texture": target, "size": size, "origin": binding.get("origin", [o["anchorX"], o["anchorY"]]), "layer": binding.get("layer", "objects")})

# Ground is assembled from independent production tile images and the authored paths/zones.
# The result is a bounded set of 512px images, not a concept illustration or a world-sized texture.
SCALE = 0.75
size = (math.ceil(crop["width"] * SCALE), math.ceil(crop["height"] * SCALE))
terrain = city["terrain"]
patterns = {}


def tiled(ref):
    key = json.dumps(ref, sort_keys=True)
    if key in patterns:
        return patterns[key]
    img = frame(ref)
    # Same visual-only calming as renderWorld.softenGround; physics never reads the bake.
    rgb = img.convert("RGB").point(lambda v: max(0, min(255, round((v - 128) * 0.72 + 128))))
    rgb = ImageEnhance.Color(rgb).enhance(0.85)
    rgb = ImageEnhance.Brightness(rgb).enhance(1.02)
    wrap = Image.new("RGB", (rgb.width * 3, rgb.height * 3))
    for i in range(3):
        for j in range(3):
            wrap.paste(rgb, (i*rgb.width, j*rgb.height))
    rgb = wrap.filter(ImageFilter.GaussianBlur(1.5)).crop((rgb.width, rgb.height, 2*rgb.width, 2*rgb.height))
    img = Image.blend(rgb, Image.new("RGB", rgb.size, (217,191,148)), 0.08).convert("RGBA")
    tile_size = ref.get("tileSize", [img.width, img.height])
    img = img.resize((max(1, round(tile_size[0] * SCALE)), max(1, round(tile_size[1] * SCALE))), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", size)
    for y in range(-round(crop["y"] * SCALE) % img.height - img.height, size[1], img.height):
        for x in range(-round(crop["x"] * SCALE) % img.width - img.width, size[0], img.width):
            out.alpha_composite(img, (x, y))
    patterns[key] = out
    return out


def point(p):
    return ((p[0] - crop["x"]) * SCALE, (p[1] - crop["y"]) * SCALE)


def curve(points, closed=False):
    n = len(points)
    at = lambda i: points[i % n] if closed else points[max(0, min(n - 1, i))]
    out = []
    for i in range(n if closed else n - 1):
        a, b, c, d = at(i - 1), at(i), at(i + 1), at(i + 2)
        for j in range(17):
            t = j / 16
            out.append(point([0.5 * ((2*b[k]) + (-a[k]+c[k])*t + (2*a[k]-5*b[k]+4*c[k]-d[k])*t*t + (-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in [0, 1]]))
    return out


floor = tiled(terrain["bindings"]["ground"]).copy()
for z in terrain.get("zones", []):
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).polygon(curve(z["points"], True), fill=255)
    floor.paste(tiled(terrain["bindings"][z["texture"]]), (0, 0), mask.filter(ImageFilter.GaussianBlur(22 * SCALE)))
for category, texture in [("paths", "path"), ("plazas", "plaza")]:
    for r in terrain[category]:
        mask = Image.new("L", size)
        ImageDraw.Draw(mask).rectangle([point((r["x"], r["y"])), point((r["x"]+r["width"], r["y"]+r["height"]))], fill=255)
        floor.paste(tiled(terrain["bindings"][texture]), (0, 0), mask.filter(ImageFilter.GaussianBlur(12*SCALE)))
for road in terrain.get("roads", []):
    mask = Image.new("L", size)
    pts = curve(road["points"])
    draw = ImageDraw.Draw(mask)
    width = max(1, round(road["width"] * SCALE))
    draw.line(pts, fill=255, width=width, joint="curve")
    for x,y in [pts[0], pts[-1]]:
        draw.ellipse((x-width/2,y-width/2,x+width/2,y+width/2),fill=255)
    floor.paste(tiled(terrain["bindings"]["path"]), (0, 0), mask.filter(ImageFilter.GaussianBlur(3*SCALE)))
for court in terrain.get("courts", []):
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).polygon(curve(court["points"], True), fill=255)
    floor.paste(tiled(terrain["bindings"]["plaza"]), (0, 0), mask.filter(ImageFilter.GaussianBlur(4*SCALE)))
chunks = []
for y in range(0, size[1], 512):
    for x in range(0, size[0], 512):
        tile = floor.crop((x,y,min(x+512,size[0]),min(y+512,size[1])))
        chunks.append({"texture":save(tile,f"floor/{x}-{y}.png"),"x":x/SCALE,"y":y/SCALE,"width":tile.width/SCALE,"height":tile.height/SCALE})

rooms = {}
for key, r in data["rooms"].items():
    original = source(r["picture"])
    dest = PORT / "assets/rooms" / (key + original.suffix)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, dest)
    exported.add(str(dest.relative_to(PORT)))
    rooms[key] = {**r, "picture": "res://assets/rooms/" + dest.name}

result = {"format":"ki-godot-city-1","sourceCommit":data["sourceCommit"],"sourceWorld":data["sourceWorld"],"name":city["name"],"size":[crop["width"],crop["height"]],"nativeOrigin":{"x":crop["x"],"y":crop["y"]},"bounds":rect(city["bounds"]),"spawn":local(city["spawn"]),"speed":city["movementSpeed"],"buildings":[{**b,"door":local(b["door"])} for b in city["buildings"]],"npcs":[{**n,**local(n)} for n in city["npcs"]],"obstacles":[rect(r) for r in city["obstacles"]],"objects":objects,"floor":chunks,"actors":actors,"rooms":rooms,"limits":data["limits"]}
(PORT / "data/city.generated.json").write_text(json.dumps(result,ensure_ascii=False,separators=(",", ":"))+"\n")
for old in old_files - exported:
    file = PORT / old
    if file.resolve().is_relative_to((PORT / "assets").resolve()):
        file.unlink(missing_ok=True)
        pathlib.Path(str(file) + ".import").unlink(missing_ok=True)
manifest={"sourceCommit":data["sourceCommit"],"sourceFiles":dict(sorted(hashes.items())),"exportedTextures":{p:hashlib.sha256((PORT/p).read_bytes()).hexdigest() for p in sorted(exported)},"method":"Only production assets: untrim atlas frames, preserve mirrored clips/origins, repack; CPU tile/path bake. No generated replacement graphics."}
(PORT/"data/provenance.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"city":result["name"],"floorChunks":len(chunks),"objects":len(objects),"npcs":len(result["npcs"]),"rooms":len(rooms),"textures":len(manifest["exportedTextures"]),"sourceFiles":len(hashes)},ensure_ascii=False))
