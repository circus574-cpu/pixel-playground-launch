#!/usr/bin/env bash
# Install tools inside an already-running, owner-authorized pod. No pod lifecycle operations.
set -euo pipefail
root=/workspace/ki-terrain3d
mkdir -p "$root/tools" "$root/project" "$root/qa" "$root/models"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends curl unzip git ca-certificates \
  libvulkan1 vulkan-tools xvfb xauth libx11-6 libxcursor1 libxi6 libxrandr2 libxinerama1 \
  libasound2t64 libgl1 libegl1 mesa-utils python3-numpy python3-scipy python3-pil \
  blender nodejs npm ffmpeg > "$root/qa/apt.txt" 2>&1
curl --fail --location --retry 2 -o "$root/tools/godot.zip" \
  https://github.com/godotengine/godot-builds/releases/download/4.6.3-stable/Godot_v4.6.3-stable_linux.x86_64.zip
printf 'd0bc2113065e481c9c2c2b2c37daa4e8be3fe9e27f0ab9ab0b6096e9a37907f3  %s\n' "$root/tools/godot.zip" | sha256sum -c -
unzip -o -q "$root/tools/godot.zip" -d "$root/tools/godot"
chmod +x "$root/tools/godot/Godot_v4.6.3-stable_linux.x86_64"
ln -sfn "$root/tools/godot/Godot_v4.6.3-stable_linux.x86_64" "$root/tools/godot-bin"
curl --fail --location --retry 2 -o "$root/tools/terrain3d.zip" \
  https://github.com/TokisanGames/Terrain3D/releases/download/v1.1.0-stable/Terrain3D_v1.1.0-stable.zip
printf '51b78bc758f5759cbc8eaaab14e5cf4e8661717e265fdd760f5abf945f15b243  %s\n' "$root/tools/terrain3d.zip" | sha256sum -c -
unzip -o -q "$root/tools/terrain3d.zip" -d "$root/tools/terrain3d-release"
addon=$(find "$root/tools/terrain3d-release" -type d -path '*/addons/terrain_3d' -print -quit)
test -n "$addon"
mkdir -p "$root/project/addons"
cp -a "$addon" "$root/project/addons/"
if [ ! -d "$root/tools/godot-mcp/.git" ]; then
  git clone https://github.com/Coding-Solo/godot-mcp.git "$root/tools/godot-mcp"
  git -C "$root/tools/godot-mcp" checkout --detach 1209744fad78f3998f98c7394fd0f6ef50da5281
fi
(cd "$root/tools/godot-mcp" && npm ci && npm run build) > "$root/qa/godot-mcp-install.txt" 2>&1
if ! pgrep -f '^Xvfb :99 ' >/dev/null; then
  Xvfb :99 -screen 0 1600x900x24 -nolisten tcp > "$root/qa/xvfb.txt" 2>&1 &
fi
{
  "$root/tools/godot-bin" --version
  blender --version | head -2
  node --version
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
  DISPLAY=:99 vulkaninfo --summary
} > "$root/qa/runtime.txt" 2>&1
sha256sum "$root/tools/godot.zip" "$root/tools/terrain3d.zip" > "$root/qa/tool-archives.sha256"
printf 'TOOLS_READY\n' > "$root/qa/tools-ready.txt"
