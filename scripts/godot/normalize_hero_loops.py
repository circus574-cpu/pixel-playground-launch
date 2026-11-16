#!/usr/bin/env python3
"""Evens out the hero's looping clips (walk, run, channel and their Ki variants) against the idle clip of the same race and direction
(priority 1-2 of the art plan: one proportion and one ground line for the whole hero).

Per looping clip:
  * `scale` (clip level, read by scripts/actor_view.gd): the figure height of the clip is brought towards the idle height. The correction is the
    ratio raised to SCALE_POWER, because a running figure is bent and is really lower than a standing one; the scale is anchored on the feet.
  * per frame offsets (the margin of the atlas frame): the lowest pixel of every frame is pulled towards the idle ground line and the centre of mass
    towards the clip median, both by LOCK of the deviation (a stride keeps a little natural bounce and sway).

Only looping clips are touched. One-shot clips (attacks, skills, dodge, hit, death) legitimately leave the ground line or lunge; they stay as drawn.
Idempotent: the source numbers are kept in scripts/godot/actors.source.json the first time, and the result is always computed from them.

  python3 scripts/godot/normalize_hero_loops.py [--dry-run]
"""
import argparse
import json
import statistics
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / "ports" / "godot-pyra"
ACTORS = PORT / "data" / "actors.json"
SOURCE = ROOT / "scripts" / "godot" / "actors.source.json"
SCALE_POWER = 0.6
SCALE_LIMITS = (0.92, 1.16)
SCALE_MIN_CHANGE = 0.03
LOCK = 0.75
MAX_SHIFT = 18
LOOPS = ("walk", "run", "channel", "kiwalk", "kirun", "kichannel")
IDLE_OF = {"kiwalk": "kiidle", "kirun": "kiidle", "kichannel": "kiidle"}


def stats(sheet: Image.Image, item: list[int]) -> dict | None:
    x, y, w, h, ox, oy = item[:6]
    a = np.asarray(sheet.crop((x, y, x + w, y + h)).convert("RGBA"))[..., 3] > 40
    ys, xs = np.where(a)
    if len(ys) == 0:
        return None
    return {"top": oy + int(ys.min()), "bottom": oy + int(ys.max()), "centre": ox + float(xs.mean())}


def clip_stats(clip: dict, direction: str, cache: dict) -> list[dict]:
    path = PORT / str(clip["sheet"]).replace("res://", "")
    if path not in cache:
        cache[path] = Image.open(path)
    return [s for item in clip["directions"][direction] if (s := stats(cache[path], item))]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not SOURCE.exists():
        SOURCE.write_text(ACTORS.read_text())
    actors = json.loads(SOURCE.read_text())
    cache: dict = {}
    changed = 0
    for key, actor in actors.items():
        if not key.endswith(".hero"):
            continue
        cell = float(actor["cell"])
        ref_y = float(actor["origin"][1]) * cell      # the point that stays put when a clip is scaled
        ref_x = float(actor["origin"][0]) * cell
        for name in LOOPS:
            clip = actor["clips"].get(name)
            idle = actor["clips"].get(IDLE_OF.get(name, "idle")) or actor["clips"]["idle"]
            if clip is None:
                continue
            ratios = []
            for d in clip["directions"]:
                if d not in idle["directions"]:
                    continue
                a, b = clip_stats(clip, d, cache), clip_stats(idle, d, cache)
                if a and b:
                    ratios.append(statistics.median(s["bottom"] - s["top"] for s in b) / statistics.median(s["bottom"] - s["top"] for s in a))
            ratio = statistics.median(ratios) if ratios else 1.0
            scale = min(max(ratio ** SCALE_POWER, SCALE_LIMITS[0]), SCALE_LIMITS[1])
            if abs(scale - 1.0) < SCALE_MIN_CHANGE:
                scale = 1.0
            if scale != 1.0:
                clip["scale"] = round(scale, 3)
            for d, items in clip["directions"].items():
                idle_d = idle["directions"].get(d) or idle["directions"]["down"]
                ground = statistics.median(s["bottom"] for s in clip_stats({**idle, "directions": {d: idle_d}}, d, cache))
                own = clip_stats(clip, d, cache)
                if len(own) != len(items):
                    continue
                centre = statistics.median(s["centre"] for s in own)
                for item, s in zip(items, own):
                    # the lowest pixel after scaling about the feet point: ref_y + (bottom - ref_y) * scale
                    scaled_bottom = ref_y + (s["bottom"] - ref_y) * scale
                    dy = (ground - scaled_bottom) * LOCK / scale
                    scaled_centre = ref_x + (s["centre"] - ref_x) * scale
                    target_centre = ref_x + (centre - ref_x) * scale
                    dx = (target_centre - scaled_centre) * LOCK / scale
                    item[5] = int(round(item[5] + max(-MAX_SHIFT, min(MAX_SHIFT, dy))))
                    item[4] = int(round(item[4] + max(-MAX_SHIFT, min(MAX_SHIFT, dx))))
                    changed += 1
            print(f"{key:14s} {name:10s} scale {scale:.3f}")
    if not args.dry_run:
        ACTORS.write_text(json.dumps(actors, separators=(",", ":"), ensure_ascii=False))
    print(changed, "frames adjusted" + (" (dry run)" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
