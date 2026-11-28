#!/usr/bin/env bash
# Extract a verified OTA atlas into a private file for the administrator endpoint.
set -euo pipefail
release=$(realpath "$1")
snapshot=$(realpath -m "$2")
root=$(cd "$(dirname "$0")/../.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
umask 077
mapfile -t packs < <(python3 - "$release/manifest.json" <<'PY'
import json, sys
packs = json.load(open(sys.argv[1]))["packs"]
for key in ("core-c101", "world-regions"):
    print(packs[key]["file"])
PY
)
[[ "${#packs[@]}" == 2 ]]
printf '[application]\nconfig/name="Superior Atlas"\n' > "$work/project.godot"
godot --headless --path "$work" -s "$root/scripts/godot/extract_admin_android_pcks.gd" -- \
  "$release/${packs[0]}" "$release/${packs[1]}" "$work/extracted"
ln -s "$root/ports/godot-isometric-world/scripts" "$work/scripts"
ln -s "$work/extracted/data" "$work/data"
mkdir "$work/regions"
for land in pyra verdant aether nexus; do
  ln -s "$work/extracted/$land" "$work/regions/$land"
done
godot --headless --path "$work" -s "$root/scripts/godot/export_admin_android_runtime.gd" -- \
  "$work/extracted/runtime.json"
python3 "$root/scripts/godot/export_admin_android_world.py" "$work/extracted" "$release/manifest.json" \
  "$release/${packs[0]}" "$release/${packs[1]}" "$snapshot"
