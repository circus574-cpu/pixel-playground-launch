. /root/wanenv/bin/activate
cd /root/Wan2.2
pip install -q librosa soundfile 2>&1 | tail -1
for i in 1 2 3 4 5; do
  m=$(python3 -c "import sys; sys.argv=['x']; import generate" 2>&1 | grep -oP "No module named '\K[^'.]+" | head -1)
  [ -z "$m" ] && break; echo "installing $m"; pip install -q "$m" 2>&1 | tail -1
done
python3 -c "import generate; print('GEN_IMPORT_OK')"
which ffmpeg || (apt-get install -y -q ffmpeg >/dev/null 2>&1)
ffmpeg -y -loglevel error -i examples/wan_animate/animate/video.mp4 -t 2.2 /root/wanout/drive2s.mp4 && echo TRIM_OK
sed -i 's#--video_path ./examples/wan_animate/animate/video.mp4#--video_path /root/wanout/drive2s.mp4#' /workspace/hero2/wan_run.sh
bash /workspace/hero2/wan_run.sh > /workspace/hero2/wan_run.log 2>&1
