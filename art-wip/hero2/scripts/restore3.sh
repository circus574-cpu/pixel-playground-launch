set -x
export HF_HOME=/root/hfcache PIP_CACHE_DIR=/root/pipcache HF_HUB_ENABLE_HF_TRANSFER=1
mkdir -p /root/m /root/km /root/hfcache
(apt-get update -q >/dev/null 2>&1; apt-get install -y -q ffmpeg libegl1 libgl1 libxrender1 libxi6 libxkbcommon0 libsm6 libxfixes3 >/dev/null 2>&1; echo APT_OK) &
pip install -q "huggingface_hub[hf_transfer]" 2>&1 | tail -1
(python3 -c "from huggingface_hub import snapshot_download; snapshot_download('Wan-AI/Wan2.2-Animate-14B', local_dir='/root/m/Wan2.2-Animate-14B')" && echo WAN_DL_OK) &
(cp -r /workspace/ki-legends-gpu/models/animagine-diffusers /workspace/ki-legends-gpu/models/controlnet /workspace/ki-legends-gpu/models/ip-adapter /root/km/ && echo KM_OK) &
cp -r /workspace/hero2-cache/Wan2.2 /root/ && echo CODE_OK
(cd /root && wget -q https://download.blender.org/release/Blender4.2/blender-4.2.3-linux-x64.tar.xz -O b.tar.xz && tar xf b.tar.xz && rm b.tar.xz && echo BLENDER_OK) &
mkdir -p /root/mocap && cp /workspace/hero2-cache/pod2/mocap/* /root/mocap/ && echo MOCAP_OK
pip install -q diffusers==0.31.0 transformers==4.46.3 accelerate safetensors "rembg[gpu]" opencv-python-headless controlnet_aux==0.0.9 2>&1 | tail -1
pip uninstall -y -q mediapipe 2>/dev/null; echo SYS_OK
python3 -m venv --system-site-packages /root/wanenv
. /root/wanenv/bin/activate; cd /root/Wan2.2
grep -v -i "flash_attn\|^torch" requirements.txt > /tmp/r1; grep -v -i "flash_attn\|^torch" requirements_animate.txt | grep -vi sam > /tmp/r2
pip install -q -r /tmp/r1 -r /tmp/r2 2>&1 | tail -1
pip install -q decord librosa soundfile easydict ftfy peft "numpy>=2.0,<2.3" "diffusers>=0.35" "transformers>=4.51,<5" 2>&1 | tail -1
pip install -q --no-build-isolation "git+https://github.com/facebookresearch/sam2.git" 2>&1 | tail -1
for i in 1 2 3 4 5; do m=$(python3 -c "import sys; sys.path.insert(0,'wan/modules/animate/preprocess'); import preprocess_data; import generate" 2>&1 | grep -oP "No module named '\K[^'.]+" | head -1); [ -z "$m" ] && break; pip install -q $m; done
python3 -c "import sys; sys.path.insert(0,'wan/modules/animate/preprocess'); import preprocess_data; import generate; print('WAN_IMPORT_OK')"
deactivate
wait
echo RESTORE_DONE
