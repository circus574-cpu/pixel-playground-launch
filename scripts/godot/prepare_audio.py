#!/usr/bin/env python3
"""Owner's music (public/game/music, 5 loops) and the ElevenLabs sound effects (public/game/sfx, 271 files) -> Godot, unchanged.

The files are copied byte for byte; Godot imports MP3. Presentation only.
"""
import pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
PORT = ROOT / "ports/godot-pyra/assets/audio"
count = 0
for kind in ("music", "sfx"):
    src = ROOT / "public/game" / kind
    for f in src.rglob("*.mp3"):
        dest = PORT / kind / f.relative_to(src)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists() or dest.stat().st_size != f.stat().st_size:
            shutil.copyfile(f, dest)
        count += 1
print("audio files", count)
