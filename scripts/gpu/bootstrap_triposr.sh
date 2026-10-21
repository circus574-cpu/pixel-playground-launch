#!/usr/bin/env bash
# Candidate inference environment only; never changes ComfyUI/Blender/Ollama.
set -euo pipefail
TRIPO_ROOT=${TRIPO_ROOT:-/opt/ki-legends-gpu/triposr-candidate}
TRIPO_SOURCE_VENV=${TRIPO_SOURCE_VENV:-/opt/ki-legends-gpu/comfy-venv}
command -v nvcc >/dev/null || { echo 'CUDA toolkit nvcc missing; install no packages before resolving isolated toolkit'; exit 2; }
if [ -e "$TRIPO_ROOT/venv" ] || [ -e "$TRIPO_ROOT/repo" ]; then
  echo 'Candidate already exists; inspect existing installation before rerunning.'; exit 3
fi
mkdir -p "$TRIPO_ROOT"
cp -aL --reflink=never "$TRIPO_SOURCE_VENV" "$TRIPO_ROOT/venv"
TRIPO_PYTHON="$TRIPO_ROOT/venv/bin/python"
# Invoke pip as module; copied entrypoint shebangs may name original venv.
tripo_pip() { "$TRIPO_PYTHON" -m pip "$@"; }
tripo_pip install 'pip<26' 'setuptools<81' wheel 'cmake<4' ninja
"$TRIPO_PYTHON" -c "import torch; assert torch.__version__ == '2.4.1+cu124', torch.__version__"
tripo_pip install numpy==1.26.4 omegaconf==2.3.0 Pillow==10.1.0 einops==0.7.0 transformers==4.35.0 huggingface-hub==0.17.3 trimesh==4.0.5 rembg==2.0.57 onnxruntime==1.19.2 imageio==2.36.0 imageio-ffmpeg==0.5.1 xatlas==0.0.9 moderngl==5.10.0
tripo_pip install pybind11 'scikit-build-core>=1.0,<2'
tripo_pip install --no-build-isolation 'git+https://github.com/tatsy/torchmcubes.git@a9ac95aa329957ba646e7bb057f825f5dfa77f38'
git clone https://github.com/VAST-AI-Research/TripoSR.git "$TRIPO_ROOT/repo"
git -C "$TRIPO_ROOT/repo" checkout --detach 107cefdc244c39106fa830359024f6a2f1c78871
# Headless render context: explicit EGL, no X server requirement.
"$TRIPO_ROOT/venv/bin/python" - "$TRIPO_ROOT/repo/tsr/bake_texture.py" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text();old='moderngl.create_context(standalone=True)'
assert old in s
s=s.replace(old,"moderngl.create_context(standalone=True, backend='egl')")
s=s.replace("positions = torch.tensor(positions_texture.reshape(-1, 4)[:, :-1])","positions = torch.tensor(positions_texture.reshape(-1, 4)[:, :-1], device=scene_code.device)")
s=s.replace('queried_grid["color"].numpy()','queried_grid["color"].detach().cpu().numpy()')
p.write_text(s)
PY
# Full pip check may report inherited Comfy requirements after downgrade; log separately.
tripo_pip check > "$TRIPO_ROOT/pip-check.txt" || true
"$TRIPO_ROOT/venv/bin/python" - <<'PY'
import torch,moderngl
assert torch.cuda.is_available()
ctx=moderngl.create_context(standalone=True,backend='egl')
print('torch',torch.__version__,'CUDA',torch.cuda.get_device_name(0),'EGL',ctx.version_code)
PY
tripo_pip freeze > "$TRIPO_ROOT/environment.freeze.txt"
