python3 -m venv --system-site-packages /root/hyenv
. /root/hyenv/bin/activate
pip install -q "transformers==4.46.3" "diffusers==0.31.0" 2>&1 | tail -1
python3 -c "import transformers,diffusers;print('TV',transformers.__version__,diffusers.__version__)"
cd /root/Hunyuan3D-2 && python3 /workspace/hero2/hy3d.py legend > /workspace/hero2/legend-3d.log 2>&1
