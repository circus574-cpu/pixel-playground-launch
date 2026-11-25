#!/usr/bin/env bash
set -euo pipefail

project=$(cd -- "$(dirname -- "$0")/.." && pwd)
output=${1:-"$project/build"}
mkdir -p -- "$output"
export GAMEMASTER_BUILD_DIR=$(cd -- "$output" && pwd)
export PYTHONDONTWRITEBYTECODE=1

for input in rig.glb walk-meshy.glb flight-meshy.glb attacks-meshy.glb; do
  cp -- "$project/sources/$input" "$GAMEMASTER_BUILD_DIR/$input"
done

python3 "$project/tools/eye_projection.py"
python3 "$project/tools/assemble.py"
python3 "$project/tools/floor_lock.py"
python3 "$project/tools/check_motion.py"
