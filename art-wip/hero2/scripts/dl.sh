set -x
mkdir -p /root/m && cd /root/m
pip install -q -U "huggingface_hub[hf_transfer]" 2>&1 | tail -1
export HF_HUB_ENABLE_HF_TRANSFER=1
python3 - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download("tencent/Hunyuan3D-2", local_dir="/root/m/Hunyuan3D-2", allow_patterns=["hunyuan3d-dit-v2-0/*","hunyuan3d-paint-v2-0/*","hunyuan3d-delight-v2-0/*","*.json","*.md"])
print("HY_DONE", flush=True)
snapshot_download("Wan-AI/Wan2.2-Animate-14B", local_dir="/root/m/Wan2.2-Animate-14B")
print("WAN_DONE", flush=True)
PY
cd /root && git clone -q https://github.com/Tencent/Hunyuan3D-2.git && git clone -q https://github.com/Wan-Video/Wan2.2.git && echo CLONE_DONE
