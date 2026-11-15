#!/usr/bin/env python3
"""Pyra continent -> Godot: terrain control textures and the walk mask.

Reads only the published Superior v2 world files (chunks, navigation, collision) and writes
presentation textures plus a collision mask for the Godot port. Geometry is never regenerated.
"""
import glob, json, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "public/game/worlds/superior-v2/pyra"
OUT = ROOT / "ports/godot-pyra/assets/continent"
DATA = ROOT / "ports/godot-pyra/data"
FOOT = 12  # same foot radius as the browser game


def runs(rle, count):
    out = np.empty(count, np.uint8)
    at = 0
    for value, n in rle:
        out[at:at + n] = value
        at += n
    assert at == count, (at, count)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    terrain = json.load(open(SRC / "terrain.json"))
    W, H = terrain["width"], terrain["height"]
    flags = runs(terrain["flags"], W * H).reshape(H, W)
    biome = np.zeros((H, W), np.uint8)
    colliders = set()
    for f in glob.glob(str(SRC / "chunks/*.json")):
        d = json.load(open(f))
        t = d["terrain"]
        n = t["width"] * t["height"]
        b = runs(t["biome"], n).reshape(t["height"], t["width"])
        x0, y0 = d["x"] // 32, d["y"] // 32
        h, w = min(t["height"], H - y0), min(t["width"], W - x0)
        biome[y0:y0 + h, x0:x0 + w] = b[:h, :w]
        for c in d["colliders"]:
            colliders.add((c["x"], c["y"], c["width"], c["height"]))
    for c in json.load(open(SRC / "collision.json")):
        colliders.add((c["x"], c["y"], c["width"], c["height"]))
    land = (flags & 16) > 0
    dry = (flags & 1) > 0
    molten = land & ~dry & (biome == 2)
    print("terrain", W, H, "land", int(land.sum()), "molten", int(molten.sum()), "colliders", len(colliders))

    # Control texture A: one weight per biome (land only). Bilinear sampling in the shader softens edges.
    # Alpha stays 255: Godot's alpha-border fix would otherwise overwrite RGB wherever one weight is zero.
    # Canyon (biome 3) is the remainder: land - ash - basalt - volcano.
    ctrl = np.zeros((H, W, 4), np.uint8)
    for b in range(3):
        ctrl[..., b] = np.where(land & (biome == b), 255, 0)
    ctrl[..., 3] = 255
    Image.fromarray(ctrl, "RGBA").save(OUT / "ctrl-biome.png", optimize=True)
    # Control texture B: R land, G molten (lava cells), B dry-walkable
    c2 = np.zeros((H, W, 4), np.uint8)
    c2[..., 0] = np.where(land, 255, 0)
    c2[..., 1] = np.where(molten, 255, 0)
    c2[..., 2] = np.where(dry, 255, 0)
    c2[..., 3] = 255
    Image.fromarray(c2, "RGBA").save(OUT / "ctrl-land.png", optimize=True)

    # Walk mask at 16 units: navigation grid AND dry ground AND outside every collider (grown by foot radius).
    nav = json.load(open(SRC / "navigation.json"))
    NW, NH = nav["width"], nav["height"]
    blocked = runs(nav["blocked"], NW * NH).reshape(NH, NW).astype(bool)
    dry16 = np.kron(dry, np.ones((2, 2), bool))[:NH, :NW]
    if dry16.shape != (NH, NW):
        pad = np.zeros((NH, NW), bool)
        pad[:dry16.shape[0], :dry16.shape[1]] = dry16
        dry16 = pad
    # dilate the non-dry cells by one 16-unit cell (foot radius 12 < 16)
    nd = ~dry16
    grown = nd.copy()
    grown[1:, :] |= nd[:-1, :]; grown[:-1, :] |= nd[1:, :]; grown[:, 1:] |= nd[:, :-1]; grown[:, :-1] |= nd[:, 1:]
    walk = ~blocked & ~grown
    for x, y, w, h in colliders:
        x0 = max(0, int((x - FOOT) // 16)); x1 = min(NW, int((x + w + FOOT) // 16) + 1)
        y0 = max(0, int((y - FOOT) // 16)); y1 = min(NH, int((y + h + FOOT) // 16) + 1)
        walk[y0:y1, x0:x1] = False
    (DATA / "continent").mkdir(parents=True, exist_ok=True)
    (DATA / "continent/walk.bin").write_bytes(np.where(walk, 255, 0).astype(np.uint8).tobytes())  # raw, row-major 16-unit cells
    json.dump({"cell": 16, "width": int(NW), "height": int(NH), "terrainCell": 32, "terrainWidth": int(W), "terrainHeight": int(H),
               "world": [65600, 42304], "foot": FOOT, "walkable": int(walk.sum())}, open(DATA / "continent.terrain.json", "w"))
    print("walk cells", int(walk.sum()), "of", NW * NH)
    # preview
    prev = np.zeros((H, W, 3), np.uint8)
    cols = np.array([[200, 120, 60], [90, 40, 30], [150, 70, 40], [140, 130, 120]], np.uint8)
    for b in range(4):
        prev[land & (biome == b)] = cols[b]
    prev[~land] = (40, 90, 110)
    prev[molten] = (255, 80, 0)
    Image.fromarray(prev).resize((1025, 661)).save("/tmp/pyra-terrain-preview.png")
    Image.fromarray(np.where(walk, 255, 0).astype(np.uint8)).resize((1025, 661)).save("/tmp/pyra-walk-preview.png")


main()
