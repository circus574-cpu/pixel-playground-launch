#!/usr/bin/env python3
"""Embed the tested standalone study under its own resource namespace. No player saves or global actor class are copied.

Run before importing/exporting Godot. Generated resources are deliberately not edited or versioned twice.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREFIX = "res://service_preview/pyra/"


def prepare(source: Path, project: Path, *, citadel: bool = False) -> dict:
    output = project / "service_preview" / "pyra"
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    for path in sorted(source.rglob("*")):
        rel = path.relative_to(source)
        if not path.is_file() or any(p.startswith(".") for p in rel.parts):
            continue
        if rel.name == "project.godot" or path.suffix in (".uid", ".import"):
            continue
        if citadel:
            if rel.parts[0] == "studies" and rel.parts[1] != "pyra-citadel":
                continue
            if rel.suffix == ".tscn" and rel.name != "world.tscn":
                continue
        data = (source / "pyra-citadel.tscn").read_bytes() if citadel and rel.name == "world.tscn" else path.read_bytes()
        if citadel and rel.as_posix() == "studies/pyra-citadel/terrain.json":
            terrain = json.loads(data)
            terrain["spawn"] = [-51, -173]
            data = (json.dumps(terrain, indent=2, ensure_ascii=False) + "\n").encode()
        if data.startswith(b"version https://git-lfs.github.com/spec/v1"):
            raise ValueError(f"Missing LFS data: {rel}; run git lfs pull")
        if path.suffix in (".gd", ".gdshader", ".tscn", ".json"):
            text = data.decode().replace("res://", PREFIX)
            if str(rel) == "scripts/actor_view.gd":
                text = text.replace("class_name PyraActor\n", "")
            if str(rel) == "scripts/world.gd":
                text = text.replace("PyraActor", "IsoActor")
                text = text.split("\nfunc run_qa()", 1)[0]
                text = text.replace('\tif "--qa" in OS.get_cmdline_user_args():run_qa.call_deferred()\n', "")
                text = text.replace("extends Node2D\n", f'extends Node2D\nconst IsoActor := preload("{PREFIX}scripts/actor_view.gd")\n', 1)
            if "user://" in text or "FileAccess.WRITE" in text:
                raise ValueError(f"Preview cannot write player data: {rel}")
            data = text.encode()
        target = output / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.read_bytes() != data:
            target.write_bytes(data)
        entries.append({"path": str(rel), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    manifest = {"format": "ki-service-preview-1", "source": "ports/godot-isometric-pyra", "scene": PREFIX + "world.tscn", "files": entries}
    text = json.dumps(manifest, indent=2) + "\n"
    target = output / "manifest.json"
    if not target.exists() or target.read_text() != text:
        target.write_text(text)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=ROOT / "ports/godot-isometric-pyra")
    parser.add_argument("--project", type=Path, default=ROOT / "ports/godot-pyra")
    args = parser.parse_args()
    result = prepare(args.source, args.project)
    print(json.dumps({"scene": result["scene"], "files": len(result["files"])}))
