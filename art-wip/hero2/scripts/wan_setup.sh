python3 -m venv --system-site-packages /root/wanenv
. /root/wanenv/bin/activate
cd /root/Wan2.2
grep -v -i "flash_attn\|^torch" requirements.txt > /tmp/req.txt
pip install -q -r /tmp/req.txt 2>&1 | tail -2
grep -v -i "flash_attn\|^torch" requirements_animate.txt > /tmp/req2.txt
pip install -q -r /tmp/req2.txt 2>&1 | tail -2
pip install -q flash-attn --no-build-isolation 2>&1 | tail -1
python3 -c "import torch,transformers,diffusers;print('WANENV',torch.__version__,transformers.__version__,diffusers.__version__)"
echo WAN_SETUP_DONE
