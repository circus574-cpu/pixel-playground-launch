pkill -f fix4.sh; pkill -f fix3.sh; pkill -f wan_run.sh; pkill -f generate.py; pkill -f preprocess_data.py; pkill -f hy3d.py; pkill -f front_ref.py
sleep 3
D=/workspace/hero2-cache; mkdir -p $D
/root/wanenv/bin/pip freeze > $D/wanenv-freeze.txt 2>/dev/null
/root/hyenv/bin/pip freeze > $D/hyenv-freeze.txt 2>/dev/null
pip freeze > $D/system-freeze.txt 2>/dev/null
cp -r /root/Wan2.2 $D/ && cp -r /root/Hunyuan3D-2 $D/ && echo CODE_OK
cp -r /root/wanout $D/ 2>/dev/null
mkdir -p $D/m && cp -r /root/m/Hunyuan3D-2 $D/m/ && echo HY_OK
cp -r /root/m/Wan2.2-Animate-14B $D/m/ && echo WAN_OK
du -sh $D
echo SAVE_DONE
