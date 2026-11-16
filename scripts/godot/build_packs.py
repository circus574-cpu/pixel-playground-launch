#!/usr/bin/env python3
"""Splits the Godot project into a slim base (the APK) and downloadable content packs, and writes the content manifest.

The APK must stay small (target 80-90 MB; engine library alone is ~28 MB), so everything that is only needed while playing a
particular land or world is moved into PCK files that the game downloads from the server (`scripts/content.gd`):

  land-<id>      data/lands/<id>/*, assets/lands/<id>/*, the scenery textures the land's `land.json` names
  monsters-<w>   monster sheets and monster sounds of one world
  npcs-<w>       NPC sheets of one world (the heroes of the four races stay in the APK)
  rooms-<w>      interior pictures of one world (and the first-trial floor for pyra)
  music-<w>      the continent music of one world

Everything else (code, scenes, shaders, fonts, branding, icons, races, heroes, maps, rules data, UI and race sounds, caves) is the
base. A land needs a known set of packs (`lands` in the manifest); the game fetches them before it enters the land.

Usage:
  python3 scripts/godot/build_packs.py plan                     # table of sizes, no files written
  python3 scripts/godot/build_packs.py build [--version V]      # PCKs + manifest.json into deploy/godot-content/<V>/ and the
                                                                # slim export filter in export_presets.cfg
Needs `godot` (4.6.3) on PATH and an imported project (`godot --headless --import`).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import zlib
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROJECT = REPO / "ports" / "godot-pyra"
OUT_ROOT = REPO / "deploy" / "godot-content"
WORLDS = ["pyra", "verdant", "aether", "nexus"]
LANDS = WORLDS + [f"island-{i}" for i in range(1, 7)]
BASE_EXCLUDES_STATIC = ["tests/*", "tools/*", "data/source.generated.json", "assets/*-source.png"]


def imported_outputs(import_file: Path) -> list[str]:
    """Files an imported resource needs at run time (the `.import` file itself and the converted files it names)."""
    found: list[str] = []
    for line in import_file.read_text(errors="ignore").splitlines():
        m = re.match(r"(path[^=]*|dest_files)\s*=\s*(.*)", line)
        if m:
            found += [p[len("res://"):] for p in re.findall(r'"(res://[^"]+)"', m.group(2))]
    return found


def source_files() -> list[str]:
    """Resource paths (relative to the project) under assets/ and data/ that the game ships."""
    out = []
    for top in ("assets", "data"):
        for dirpath, _dirs, files in os.walk(PROJECT / top):
            for name in files:
                if name.endswith((".import", ".uid")) or name.startswith("."):
                    continue
                out.append(str((Path(dirpath) / name).relative_to(PROJECT)))
    return sorted(out)


def world_of_land(land: str) -> str:
    return json.loads((PROJECT / "data" / "lands" / land / "land.json").read_text())["world"]


def land_object_files(land: str) -> list[str]:
    data = json.loads((PROJECT / "data" / "lands" / land / "land.json").read_text())
    return [t["path"][len("res://"):] for t in data["textures"]]


def land_monster_worlds(land: str) -> set[str]:
    spawns = json.loads((PROJECT / "data" / "lands" / land / "spawns.json").read_text())
    return {k.split("-")[0] for k in spawns["kinds"]} & set(WORLDS)


def classify(path: str) -> list[str]:
    """Packs a source file belongs to ([] = the base). Objects can belong to several lands."""
    parts = path.split("/")
    if parts[0] == "data" and len(parts) >= 3 and parts[1] == "lands":
        return [f"land-{parts[2]}"]
    if parts[0] == "assets" and len(parts) >= 3 and parts[1] == "lands":
        return [f"land-{parts[2]}"]
    if parts[0] == "assets" and parts[1] == "monsters":
        w = parts[2].split("-")[0]
        return [f"monsters-{w}"] if w in WORLDS else []
    if parts[0] == "assets" and parts[1] == "actors":
        m = re.match(r"npc-(\w+?)-", parts[2])
        if m and m.group(1) in WORLDS:
            return [f"npcs-{m.group(1)}"]
        if re.match(r"(trainer|steward|smith)-idle", parts[2]):
            return ["npcs-pyra"]
        return []
    if parts[0] == "assets" and parts[1] == "rooms":
        w = parts[2].split("-")[0]
        return [f"rooms-{w}"] if w in WORLDS else ["rooms-pyra"]   # unprefixed pictures are the first-trial rooms of Pyra
    if parts[0] == "assets" and parts[1] == "floor":
        return ["rooms-pyra"]
    if parts[0] == "assets" and parts[1] == "audio":
        if parts[2] == "music" and parts[3].rsplit(".", 1)[0] in ("pyra", "verdantia", "aetheria", "nexus"):
            return [f"music-{ {'verdantia': 'verdant', 'aetheria': 'aether'}.get(parts[3].rsplit('.', 1)[0], parts[3].rsplit('.', 1)[0]) }"]
        if parts[2] == "sfx" and parts[3] == "monsters" and len(parts) > 4:
            w = parts[4].split("-")[0]
            return [f"monsters-{w}"] if w in WORLDS else []
    return []


def city_files() -> list[str]:
    """Textures of the first-trial capital (data/city.generated.json), built inside the Pyra land."""
    city = json.loads((PROJECT / "data" / "city.generated.json").read_text())
    return [o["texture"][len("res://"):] for o in city["objects"] + city["floor"]]


def pack_members() -> dict[str, list[str]]:
    members: dict[str, set[str]] = defaultdict(set)
    object_owner: dict[str, set[str]] = defaultdict(set)
    for land in LANDS:
        for f in land_object_files(land):
            object_owner[f].add(land)
    for f in city_files():
        object_owner[f].add("pyra")
    for path in source_files():
        if path.startswith("assets/objects/"):
            for land in object_owner.get(path, ()):
                members[f"land-{land}"].add(path)
            continue
        for pack in classify(path):
            members[pack].add(path)
    for path in city_files():
        if path.startswith("assets/floor/"):
            members["rooms-pyra"].add(path)
    return {k: sorted(v) for k, v in members.items()}


def excluded_from_base(path: str) -> bool:
    import fnmatch
    return any(fnmatch.fnmatch(path, pattern) for pattern in base_excludes({}))


def check_orphans(members: dict[str, list[str]]) -> list[str]:
    """Every `res://assets/...` file the rules data names must be in the base or in a pack: otherwise the game would crash on it."""
    assigned = {s for sources in members.values() for s in sources}
    problems = []
    for data_file in sorted((PROJECT / "data").glob("*.json")) + sorted((PROJECT / "data" / "races").glob("*.json")):
        text = data_file.read_text()
        for ref in sorted(set(re.findall(r'res://(assets/[^"\\]+)', text))):
            if excluded_from_base(ref) and ref not in assigned:
                problems.append(f"{data_file.name}: {ref} is left out of the APK and belongs to no pack")
    return problems


def disk_files(source: str) -> list[str]:
    """Everything a source file needs inside a pack: the file itself if it is read raw, else the import file and its outputs."""
    imp = PROJECT / (source + ".import")
    if imp.exists():
        return [source + ".import"] + [p for p in imported_outputs(imp) if (PROJECT / p).exists()]
    return [source]


def zipped_size(paths: list[str]) -> int:
    total = 0
    for p in paths:
        data = (PROJECT / p).read_bytes()
        total += len(zlib.compress(data, 6)) if len(data) < 8_000_000 else int(len(data) * 0.95)
    return total


def requirements(members: dict[str, list[str]]) -> dict[str, list[str]]:
    out = {}
    for land in LANDS:
        world = world_of_land(land)
        need = [f"land-{land}"]
        need += [f"monsters-{w}" for w in sorted(land_monster_worlds(land) | {world}) if f"monsters-{w}" in members]
        for kind in ("npcs", "rooms", "music"):
            if f"{kind}-{world}" in members:
                need.append(f"{kind}-{world}")
        out[land] = sorted(dict.fromkeys(need))
    return out


def base_excludes(members: dict[str, list[str]]) -> list[str]:
    """Export filter patterns that keep pack contents out of the APK (patterns over source resource paths)."""
    patterns = ["data/lands/*", "assets/lands/*", "assets/objects/*", "assets/monsters/*", "assets/rooms/*", "assets/floor/*"]
    patterns += ["assets/actors/npc-*", "assets/actors/trainer-*", "assets/actors/steward-*", "assets/actors/smith-*"]
    patterns += [f"assets/audio/music/{n}.mp3" for n in ("pyra", "verdantia", "aetheria", "nexus")]
    patterns += ["assets/audio/sfx/monsters/*"]
    return BASE_EXCLUDES_STATIC + patterns


def plan() -> tuple[dict[str, list[str]], dict[str, int]]:
    members = pack_members()
    sizes = {}
    for pack, sources in members.items():
        files = []
        for s in sources:
            files += disk_files(s)
        sizes[pack] = zipped_size(sorted(set(files)))
    return members, sizes


def print_plan(members: dict[str, list[str]], sizes: dict[str, int]) -> None:
    for problem in check_orphans(members):
        print("ORPHAN:", problem)
    total = 0
    for pack in sorted(members):
        print(f"{pack:18s} {len(members[pack]):6d} files  ~{sizes[pack] / 1e6:6.1f} MB")
        total += sizes[pack]
    print(f"{'packs total':18s} {'':6s}        ~{total / 1e6:6.1f} MB")
    for land, need in requirements(members).items():
        print(f"{land:10s} -> {', '.join(need)}  (~{sum(sizes[n] for n in need) / 1e6:.1f} MB)")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def patch_preset(excludes: list[str]) -> None:
    """Writes the slim exclude filter into the Android preset only (the Linux preset keeps the full game for tests)."""
    cfg = PROJECT / "export_presets.cfg"
    text = cfg.read_text()
    blocks = re.split(r"(?m)^(?=\[preset\.\d+\]$)", text)
    for i, block in enumerate(blocks):
        if re.search(r'(?m)^platform="Android"', block):
            include = 'include_filter="data/*.json,data/races/*.json,assets/branding/*.txt"'
            block = re.sub(r'(?m)^include_filter=.*$', include, block, count=1)
            block = re.sub(r'(?m)^exclude_filter=.*$', 'exclude_filter="' + ",".join(excludes) + '"', block, count=1)
            blocks[i] = block
    cfg.write_text("".join(blocks))


def client_code() -> int:
    """versionCode of the Android preset: the APK that can use this core (scripts/boot.gd looks for `core-c<code>`)."""
    m = re.search(r"(?m)^version/code=(\d+)$", (PROJECT / "export_presets.cfg").read_text())
    if not m:
        raise SystemExit("version/code not found in export_presets.cfg")
    return int(m.group(1))


def core_files() -> list[str]:
    """Code and rules data of the game (project-relative): scripts, scenes, shaders, the JSON the APK carries itself."""
    out: list[str] = []
    for pattern in ("scripts/*.gd", "scenes/*.tscn", "data/*.json", "data/races/*.json"):
        out += [str(p.relative_to(PROJECT)) for p in sorted(PROJECT.glob(pattern)) if p.name != "source.generated.json"]
    for p in sorted(PROJECT.rglob("*.gdshader")):
        rel = str(p.relative_to(PROJECT))
        if not rel.startswith((".godot", "tests/", "tools/")):
            out.append(rel)
    return out


def core_listing(work: Path) -> list[dict]:
    """PCK entries of the core. An export keeps scripts and scenes as `x.gd.remap` / `x.tscn.remap` pointing at compiled copies;
    the pack therefore also carries a remap that points at the plain file, or the APK's compiled copy would still win."""
    listing = []
    remaps = work / "remaps"
    remaps.mkdir(parents=True, exist_ok=True)
    for rel in core_files():
        listing.append({"pck": "res://" + rel, "disk": str(PROJECT / rel)})
        if rel.endswith((".gd", ".tscn")):
            remap = remaps / (rel.replace("/", "__") + ".remap")
            remap.write_text(f'[remap]\n\npath="res://{rel}"\n')
            listing.append({"pck": "res://" + rel + ".remap", "disk": str(remap)})
    return listing


def build_core(out: Path) -> dict:
    work = out / "core-work"
    work.mkdir(parents=True, exist_ok=True)
    listing = core_listing(work)
    listing_path = work / "core.files.json"
    listing_path.write_text(json.dumps(listing))
    target = out / "core.pck"
    subprocess.run(
        ["godot", "--headless", "--path", str(PROJECT), "--script", "res://tools/pack_builder.gd", "--", str(listing_path), str(target)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    shutil.rmtree(work)
    digest = sha256(target)
    key = f"core-c{client_code()}"
    final = out / f"{key}-{digest[:12]}.pck"
    target.replace(final)
    print(f"built {final.name} {final.stat().st_size / 1e6:.1f} MB ({len(listing)} entries)")
    return {key: {"file": final.name, "bytes": final.stat().st_size, "sha256": digest, "files": len(listing)}}


def build(version: str) -> None:
    members, sizes = plan()
    print_plan(members, sizes)
    if check_orphans(members):
        raise SystemExit("orphaned assets: fix the classification first")
    out = OUT_ROOT / version
    out.mkdir(parents=True, exist_ok=True)
    manifest_packs = {}
    for pack in sorted(members):
        files = []
        for s in members[pack]:
            files += disk_files(s)
        files = sorted(set(files))
        listing = [{"pck": "res://" + f, "disk": str(PROJECT / f)} for f in files]
        listing_path = out / f"{pack}.files.json"
        listing_path.write_text(json.dumps(listing))
        target = out / f"{pack}.pck"
        subprocess.run(
            ["godot", "--headless", "--path", str(PROJECT), "--script", "res://tools/pack_builder.gd", "--", str(listing_path), str(target)],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        listing_path.unlink()
        digest = sha256(target)
        final = out / f"{pack}-{digest[:12]}.pck"
        target.replace(final)
        manifest_packs[pack] = {"file": final.name, "bytes": final.stat().st_size, "sha256": digest, "files": len(files)}
        print(f"built {final.name} {final.stat().st_size / 1e6:.1f} MB")
    manifest_packs.update(build_core(out))
    manifest = {
        "format": "ki-godot-content-1",
        "version": version,
        "engine": "4.6.3",
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "packs": manifest_packs,
        "lands": requirements(members),
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    patch_preset(base_excludes(members))
    total = sum(p["bytes"] for p in manifest_packs.values())
    print(f"manifest written: {len(manifest_packs)} packs, {total / 1e6:.1f} MB, {out}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["plan", "build"])
    parser.add_argument("--version", default=datetime.now(timezone.utc).strftime("%Y.%m.%d.1"))
    args = parser.parse_args()
    if args.command == "plan":
        members, sizes = plan()
        print_plan(members, sizes)
    else:
        build(args.version)
    return 0


if __name__ == "__main__":
    sys.exit(main())
