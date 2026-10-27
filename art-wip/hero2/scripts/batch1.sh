B=/root/blender-4.2.3-linux-x64/blender; M=/root/mocap
render() { # name bvh yaw start nframes(source)
  rm -rf $M/r-$1; mkdir -p $M/r-$1
  ORTHO=2.4 STEP=4 $B -b -P /workspace/hero2/mannequin.py -- $M/$2.bvh $M/r-$1/ $3 $4 $5 >/dev/null 2>&1
  ffmpeg -y -loglevel error -framerate 30 -pattern_type glob -i "$M/r-$1/*.png" -c:v libx264 -pix_fmt yuv420p $M/$1.mp4 && echo "DRIVE $1 $(ls $M/r-$1 | wc -l)"
}
render walk-down 07_01 0 20 300
render walk-up 07_01 180 20 300
render walk-side 07_01 90 20 300
render punch-down 02_05 0 470 300
cd /workspace/hero2/android && [ -f final/kp.json ] || true
for clip in walk-down punch-down walk-up walk-side; do
  for race in legend planetary sage android; do
    echo "== $race $clip $(date +%T)"
    bash /workspace/hero2/wan_go.sh $race $M/$clip.mp4 $clip > /workspace/hero2/wan-$race-$clip.log 2>&1
    grep -q GIF_DONE /workspace/hero2/wan-$race-$clip.log && echo "OK $race $clip $(date +%T)" || echo "FAIL $race $clip"
  done
done
echo BATCH1_DONE
