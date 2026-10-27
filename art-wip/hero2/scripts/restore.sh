export HF_HOME=/root/hfcache PIP_CACHE_DIR=/root/pipcache
C=/workspace/hero2-cache
mkdir -p /root/m /root/hfcache
cp -r $C/Wan2.2 $C/Hunyuan3D-2 /root/ && echo CODE_OK
# system env (Animagine/diffusers tools)
pip install -q diffusers==0.31.0 transformers==4.46.3 accelerate safetensors "rembg[gpu]" opencv-python-headless controlnet_aux==0.0.9 2>&1 | tail -1
pip uninstall -y -q mediapipe 2>/dev/null; echo SYS_OK
# wan env
( python3 -m venv --system-site-packages /root/wanenv && . /root/wanenv/bin/activate && cd /root/Wan2.2 &&
  grep -v -i "flash_attn\|^torch" requirements.txt > /tmp/r1 && grep -v -i "flash_attn\|^torch" requirements_animate.txt > /tmp/r2 &&
  pip install -q -r /tmp/r1 -r /tmp/r2 decord librosa soundfile "numpy>=2.0,<2.3" 2>&1 | tail -1 &&
  python3 -c "import generate; print('WAN_IMPORT_OK')" ) > /workspace/hero2/restore-wan.log 2>&1 &
# hunyuan env
( python3 -m venv --system-site-packages /root/hyenv && . /root/hyenv/bin/activate && cd /root/Hunyuan3D-2 &&
  pip install -q -r requirements.txt 2>&1 | tail -1 && pip install -q -e . 2>&1 | tail -1 &&
  (cd hy3dgen/texgen/custom_rasterizer && pip install -q --no-build-isolation . 2>&1 | tail -1) &&
  (cd hy3dgen/texgen/differentiable_renderer && pip install -q --no-build-isolation . 2>&1 | tail -1) &&
  pip install -q pyrender trimesh 2>&1 | tail -1 && echo HY_ENV_OK ) > /workspace/hero2/restore-hy.log 2>&1 &
cp -r $C/m/Wan2.2-Animate-14B /root/m/ && echo WAN_MODEL_OK
cp -r $C/m/Hunyuan3D-2 /root/m/ && echo HY_MODEL_OK
apt-get install -y -q ffmpeg libegl1 libgl1 >/dev/null 2>&1; echo APT_OK
wait
echo RESTORE_DONE
