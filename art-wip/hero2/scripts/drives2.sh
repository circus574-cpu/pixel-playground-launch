B=/root/blender-4.2.3-linux-x64/blender; M=/root/mocap
render() { name=$1; bvh=$2; start=$3; n=$4; step=$5; dirs=${6:-"down:0 side:90 up:180"}
  for d in $dirs; do dir=${d%%:*}; yaw=${d##*:}; o=$M/r-$name-$dir; rm -rf $o; mkdir -p $o
    BULK=1.0 ORTHO=2.4 STEP=$step $B -b -P /workspace/hero2/mannequin.py -- $M/$bvh.bvh $o/ $yaw $start $n >/dev/null 2>&1
    ffmpeg -y -loglevel error -framerate 30 -pattern_type glob -i "$o/*.png" -frames:v 49 -c:v libx264 -pix_fmt yuv420p $M/$name-$dir.mp4 && echo "DRIVE $name-$dir $(ls $o | wc -l)"
  done; }
render punch 02_05 480 98 2 "${ONLY:-down:0 side:90 up:180}"
[ -n "$ONLY" ] && exit 0
render kick 74_03 150 147 3 &
render spin 78_13 40 98 2 &
render dodge 83_01 200 196 4 &
wait; echo DRIVES2_DONE
