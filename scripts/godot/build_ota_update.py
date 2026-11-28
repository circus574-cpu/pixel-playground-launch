#!/usr/bin/env python3
"""Replace selected files in verified Android OTA packs and preserve all other pack identities."""
import argparse
import hashlib
import json
import struct
import subprocess
import tempfile
from pathlib import Path, PurePosixPath

from build_preview_update import _bucket_input_digest, _pack_items
from prepare_service_preview import PREFIX, prepare

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "ports/godot-isometric-world"
DEFAULT_CHANGES = {
    "core-c101": (
        "data/quests_wilderness.json", "scripts/actor_view.gd", "scripts/boss_ai_iso.gd",
        "scripts/boss_visuals.gd", "scripts/dialogue_strip.gd", "scripts/quest_engine_iso.gd", "scripts/world.gd",
    ),
    "world-regions": tuple(f"regions/{land}/buildings.json" for land in ("pyra", "verdant", "aether", "nexus")),
    "world-monsters": tuple(
        file.relative_to(SOURCE).as_posix()
        for file in sorted((SOURCE / "assets/monsters/boss-premium").glob("*.webp"))
    ),
}


def read_pack(path, expected):
    content = path.read_bytes()
    if len(content) != expected["bytes"] or hashlib.sha256(content).hexdigest() != expected["sha256"]:
        raise ValueError(f"SHA-256 or size mismatch: {path.name}")
    magic, version, _, _, _, flags, base, directory = struct.unpack_from("<4s5IQQ", content)
    if (magic, version, flags) != (b"GDPC", 3, 2):
        raise ValueError(f"Unsupported PCK header: {path.name}")
    count = struct.unpack_from("<I", content, directory)[0]
    if count != expected["files"]:
        raise ValueError(f"Unexpected file count: {path.name}")
    cursor = directory + 4
    files = {}
    for _ in range(count):
        length = struct.unpack_from("<I", content, cursor)[0]
        cursor += 4
        rel = content[cursor:cursor + length].rstrip(b"\0").decode()
        cursor += length
        offset, size, digest, flags = struct.unpack_from("<QQ16sI", content, cursor)
        cursor += 36
        data = content[base + offset:base + offset + size]
        if flags or len(data) != size or hashlib.md5(data, usedforsecurity=False).digest() != digest:
            raise ValueError(f"Invalid PCK member: {rel}")
        name = rel if rel.startswith("res://") else "res://" + rel
        if name in files:
            raise ValueError(f"Duplicate PCK member: {rel}")
        files[name] = data
    if cursor != len(content):
        raise ValueError(f"Unexpected PCK directory size: {path.name}")
    return files


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--from-version", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--base-ref", required=True)
    p.add_argument("--replace", action="append", metavar="PACK=SOURCE_PATH",
                   help="Replace a file relative to the isometric port; repeat for additional files")
    p.add_argument("base_packs", type=Path, help="Verified release files named by pack ID plus .pck")
    args = p.parse_args()
    base_dir = f"deliveries/godot-content-{args.from_version}"

    def tracked(filename):
        return subprocess.check_output(["git", "show", f"{args.base_ref}:{base_dir}/{filename}"], cwd=ROOT)

    manifest = json.loads(tracked("manifest.json"))
    report = json.loads(tracked("preview-update.json"))
    if manifest["version"] != args.from_version:
        raise ValueError("Wrong base manifest")
    changes = DEFAULT_CHANGES
    if args.replace:
        changes = {}
        used_paths = set()
        for change in args.replace:
            pack_id, separator, rel = change.partition("=")
            path = PurePosixPath(rel)
            if (not separator or pack_id not in manifest["packs"] or not rel
                    or path.is_absolute() or ".." in path.parts or path.as_posix() != rel
                    or rel in used_paths or not (SOURCE / path).is_file()):
                p.error(f"Invalid replacement: {change}")
            changes.setdefault(pack_id, []).append(rel)
            used_paths.add(rel)
    elif len(changes["world-monsters"]) != 8:
        raise ValueError("Wrong boss archive")
    out = ROOT / f"deliveries/godot-content-{args.version}"
    out.mkdir(parents=True, exist_ok=False)
    with tempfile.TemporaryDirectory(prefix="ki-ota-") as temp:
        work = Path(temp)
        staging = work / "source"
        for paths in changes.values():
            for rel in paths:
                target = staging / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((SOURCE / rel).read_bytes())
        preview = prepare(staging, work, gemini=True)
        preview_dir = work / PREFIX.removeprefix("res://")
        project = ROOT / "ports/godot-pyra"

        class Builder:
            PROJECT = project
            @staticmethod
            def sha256(path):
                with path.open("rb") as source:
                    return hashlib.file_digest(source, "sha256").hexdigest()

        for pack_id, paths in changes.items():
            previous = manifest["packs"][pack_id]
            members = read_pack(args.base_packs / (pack_id + ".pck"), previous)
            for rel in paths:
                name = PREFIX + rel
                if args.replace and name not in members:
                    raise ValueError(f"File is not in {pack_id}: {rel}")
                members[name] = (preview_dir / rel).read_bytes()
                if rel.endswith(".gd"):
                    members[name + ".remap"] = f'[remap]\n\npath="{name}"\n'.encode()
            if pack_id == "core-c101":
                inner = json.loads(members[PREFIX + "manifest.json"])
                by_path = {entry["path"]: entry for entry in inner["files"]}
                by_path.update({entry["path"]: entry for entry in preview["files"]})
                inner["files"] = [by_path[rel] for rel in sorted(by_path)]
                members[PREFIX + "manifest.json"] = (json.dumps(inner, indent=2) + "\n").encode()
            entries = []
            for index, (name, value) in enumerate(members.items()):
                disk = work / str(index)
                disk.write_bytes(value)
                entries.append({"pck": name, "disk": str(disk)})
            packaged, filename = _pack_items(Builder, work, out, pack_id, entries)
            if read_pack(out / filename, packaged) != members:
                raise ValueError(f"Rebuilt pack differs from approved file list: {pack_id}")
            manifest["packs"][pack_id] = packaged
            if pack_id == "core-c101":
                report["files"] = list(members)
                report["core"] = packaged
            else:
                report["world_pack_inputs"][pack_id] = _bucket_input_digest(entries)
                report["world_packs"][pack_id] = packaged
    for pack_id, entry in manifest["packs"].items():
        if pack_id in changes:
            continue
        pointer = tracked(entry["file"])
        if not pointer.startswith(b"version https://git-lfs.github.com/spec/v1") or (
            f"oid sha256:{entry['sha256']}\nsize {entry['bytes']}".encode() not in pointer
        ):
            raise ValueError(f"Invalid inherited LFS pointer: {entry['file']}")
        (out / entry["file"]).write_bytes(pointer)
    from datetime import datetime, timezone
    manifest.update(version=args.version, createdAt=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    report.update(version=args.version, base=args.from_version, unchanged_lands=True)
    for name, payload in [("manifest.json", manifest), ("preview-update.json", report)]:
        (out / name).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"{args.version}: {len(changes)} packs rebuilt and checked, {len(manifest['packs']) - len(changes)} reused")


if __name__ == "__main__":
    main()
