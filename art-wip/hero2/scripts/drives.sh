# Render bulky-mannequin driving videos: name bvh start srcframes step, for yaw down=0 side=90 up=180
B=/root/blender-4.2.3-linux-x64/blender; M=/root/mocap; cd $M
for z in 74_03 83_01 78_13; do [ -f $z.bvh ] || unzip -o -q /root/cmubvh/*/${z%%_*}/Data/$z.zip; done
render() { name=$1; bvh=$2; start=$3; n=$4; step=$5
  for d in down:0 side:90 up:180; do dir=${d%%:*}; yaw=${d##*:}; o=$M/r-$name-$dir; rm -rf $o; mkdir -p $o
    BULK=1.0 ORTHO=2.4 STEP=$step $B -b -P /workspace/hero2/mannequin.py -- $M/$bvh.bvh $o/ $yaw $start $n >/dev/null 2>&1
    ffmpeg -y -loglevel error -framerate 30 -pattern_type glob -i "$o/*.png" -frames:v 77 -c:v libx264 -pix_fmt yuv420p $M/$name-$dir.mp4 && echo "DRIVE $name-$dir $(ls $o | wc -l)"
  done; }
render walk 07_01 20 240 4 &
render run 09_01 2 145 2 &
render punch 02_05 470 300 4 &
render kick 74_03 2 395 5 &
render dodge 83_01 120 480 6 &
render spin 78_13 2 172 2 &
wait; echo DRIVES_DONE
