cd /root && [ -d Hunyuan3D-2 ] || git clone -q https://github.com/Tencent/Hunyuan3D-2.git
cd /root/Hunyuan3D-2 && pip install -q -r requirements.txt 2>&1 | tail -2
pip install -q -e . 2>&1 | tail -1
cd hy3dgen/texgen/custom_rasterizer && pip install -q --no-build-isolation . 2>&1 | tail -2
cd ../differentiable_renderer && pip install -q --no-build-isolation . 2>&1 | tail -2 || python3 setup.py install 2>&1 | tail -2
echo HY_SETUP_DONE
