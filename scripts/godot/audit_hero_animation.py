#!/usr/bin/env python3
"""Measures the consistency of the hero animations of the Godot port (priority 1-2 of the art plan): for every race, clip and frame of the direction `right`
it places the frame in its 200 px cell (as the game does) and reports the height and the ground line of the figure and its horizontal centre.

A clip is flagged when its median figure height differs from the idle clip by more than TOLERANCE (the figure is drawn too big or too small), when the feet of
its frames wander (ground jitter above GROUND_JITTER px inside the clip) or when the centre of the figure wanders more than CENTRE_JITTER px (the hero slides).
Flying and falling poses (death, hit, dodge, finisher) are judged on the ground line only against their own first frame, not against idle.

  python3 scripts/godot/audit_hero_animation.py [--sheet-dir DIR] [--json OUT.json]
"""
import argparse
import json
import statistics
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / "ports" / "godot-pyra"
TOLERANCE = 0.12
GROUND_JITTER = 10
CENTRE_JITTER = 14
FREE_BODY = {"death", "kideath", "respawn", "kirespawn", "hit", "kihit", "hitheavy", "kihitheavy", "dodge", "kidodge", "finisher", "kifinisher", "victory", "kivictory"}


def frame_stats(sheet: Image.Image, rect: list[int], cell: int) -> dict | None:
    x, y, w, h, ox, oy = rect[:6]
    tile = np.asarray(sheet.crop((x, y, x + w, y + h)).convert("RGBA"))[..., 3] > 40
    ys, xs = np.where(tile)
    if len(ys) == 0:
        return None
    return {"top": oy + int(ys.min()), "bottom": oy + int(ys.max()), "height": int(ys.max() - ys.min() + 1), "centre": ox + float(xs.mean())}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", default="")
    args = parser.parse_args()
    actors = json.loads((PORT / "data" / "actors.json").read_text())
    report, flagged = {}, []
    cache: dict[str, Image.Image] = {}
    for key, actor in actors.items():
        if not key.endswith(".hero"):
            continue
        cell = int(actor["cell"])
        clips = {}
        for name, clip in actor["clips"].items():
            frames = clip["directions"].get("right") or next(iter(clip["directions"].values()))
            path = PORT / str(clip["sheet"]).replace("res://", "")
            if str(path) not in cache:
                cache[str(path)] = Image.open(path)
            stats = [s for r in frames if (s := frame_stats(cache[str(path)], r, cell))]
            if not stats:
                continue
            clips[name] = {
                "frames": len(frames), "height": statistics.median(s["height"] for s in stats), "bottom": statistics.mean(s["bottom"] for s in stats),
                "ground_jitter": max(s["bottom"] for s in stats) - min(s["bottom"] for s in stats), "centre_jitter": max(s["centre"] for s in stats) - min(s["centre"] for s in stats),
            }
        reference = clips["idle"]["height"]
        report[key] = {"idle_height": reference, "clips": clips}
        for name, c in clips.items():
            problems = []
            if name not in FREE_BODY and abs(c["height"] - reference) / reference > TOLERANCE:
                problems.append(f"height {c['height']:.0f} vs idle {reference:.0f}")
            if name not in FREE_BODY and c["ground_jitter"] > GROUND_JITTER:
                problems.append(f"feet wander {c['ground_jitter']:.0f} px")
            if name not in FREE_BODY and c["centre_jitter"] > CENTRE_JITTER:
                problems.append(f"centre wanders {c['centre_jitter']:.0f} px")
            if problems:
                flagged.append((key, name, "; ".join(problems)))
    for race, name, why in flagged:
        print(f"{race:14s} {name:12s} {why}")
    total = sum(len(v["clips"]) for v in report.values())
    print(f"\n{len(report)} heroes, {total} clips measured, {len(flagged)} flagged")
    if args.json:
        Path(args.json).write_text(json.dumps(report, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
