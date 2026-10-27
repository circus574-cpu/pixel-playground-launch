. /root/wanenv/bin/activate; cd /root/Wan2.2
pip install -q -U "diffusers>=0.35" "transformers>=4.51,<5" easydict 2>&1 | tail -1
for i in 1 2 3 4 5 6; do
  e=$( (python3 -c "import sys; sys.path.insert(0,'wan/modules/animate/preprocess'); import preprocess_data" && python3 -c "import generate") 2>&1 | grep -oP "No module named '\K[^'.]+" | head -1)
  [ -z "$e" ] && break; echo "installing $e"; pip install -q "$e" 2>&1 | tail -1
done
python3 -c "import sys; sys.path.insert(0,'wan/modules/animate/preprocess'); import preprocess_data; import generate; print('ALL_IMPORT_OK')" 2>&1 | tail -2
bash /workspace/hero2/wan_go.sh legend /root/mocap/walk-front.mp4 walk 4 > /workspace/hero2/wan-legend-walk.log 2>&1
