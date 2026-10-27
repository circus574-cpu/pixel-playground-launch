export HF_HOME=/root/hfcache
unset HF_HUB_ENABLE_HF_TRANSFER
python3 -c "from huggingface_hub import snapshot_download; snapshot_download('tencent/Hunyuan3D-2', local_dir='/root/m/Hunyuan3D-2', allow_patterns=['hunyuan3d-paint-v2-0-turbo/*'])" && echo TURBO_DL
(cd /root/Hunyuan3D-2 && /root/hyenv/bin/python /workspace/hero2/hy3d.py legend > /workspace/hero2/legend-3d.log 2>&1) &
/root/wanenv/bin/pip install -q decord 2>&1 | tail -1
/root/wanenv/bin/python -c "import decord; print('DECORD_OK')"
bash /workspace/hero2/wan_run.sh > /workspace/hero2/wan_run.log 2>&1
wait
