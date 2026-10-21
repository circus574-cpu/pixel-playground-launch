#!/bin/bash
# Restore software only. Pod Start/Stop/Restart/Terminate belong exclusively to the owner.
set -euo pipefail

runtime=/opt/ki-legends-gpu
project=/opt/ki-legends-project-current
cache=/workspace/ki-legends-gpu/runtime-cache
archive=runtime-20261021-py311-cu124-v2.tar.gz

if [ ! -x /usr/bin/python3.11 ]; then
  echo 'This pinned runtime requires /usr/bin/python3.11 in the owner-selected image.' >&2
  exit 1
fi

if [ ! -x "$runtime/comfy-venv/bin/python" ] ||
   [ ! -x "$runtime/blender-venv/bin/python" ] ||
   [ ! -x "$runtime/node/bin/node" ] ||
   [ ! -f "$project/package.json" ]; then
  (
    cd "$cache"
    sha256sum -c "$archive.sha256"
    tar -xzf "$archive" -C /opt --no-same-owner
  )
fi

need_packages=0
if ! /usr/bin/python3.11 - <<'PY'
import ctypes
for library in [
    "libXrender.so.1", "libXi.so.6", "libXfixes.so.3", "libxkbcommon.so.0",
    "libSM.so.6", "libICE.so.6", "libEGL.so.1", "libgomp.so.1",
]:
    ctypes.CDLL(library)
PY
then
  need_packages=1
fi
if ! command -v nginx >/dev/null; then
  need_packages=1
fi
if [ "$need_packages" -eq 1 ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y --no-install-recommends \
    libxrender1 libxi6 libxfixes3 libxkbcommon0 libsm6 libice6 libegl1 libgomp1 nginx
fi

"$runtime/comfy-venv/bin/python" -m pip check
"$runtime/blender-venv/bin/python" -m pip check
/usr/bin/python3.11 "$runtime/scripts/install_links.py"
ki-gpu-check
ki-comfy-start
ki-blender-python -c 'import bpy; assert bpy.app.version_string == "4.5.3 LTS"; print("BLENDER_READY", bpy.app.version_string)'
ki-assets-current run assets:check
echo 'KI_LEGENDS_RUNTIME_READY; pod lifecycle remains owner-only'
