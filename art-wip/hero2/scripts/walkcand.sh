B=/root/blender-4.2.3-linux-x64/blender; M=/root/mocap; cd $M
for z in 08_01 35_01 16_15 02_01 39_01; do [ -f $z.bvh ] || unzip -o -q /root/cmubvh/*/${z%%_*}/Data/$z.zip 2>/dev/null; [ -f $z.bvh ] || { echo "MISSING $z"; continue; }
  o=$M/cand-$z; rm -rf $o; mkdir -p $o
  BULK=1.0 ORTHO=2.4 STEP=4 $B -b -P /workspace/hero2/mannequin.py -- $M/$z.bvh $o/ 0 20 200 >/dev/null 2>&1
  ffmpeg -nostdin -y -loglevel error -framerate 30 -pattern_type glob -i "$o/*.png" -vf "select=not(mod(n\,4)),scale=140:-1,tile=13x1" -frames:v 1 /tmp/cand-$z.jpg && echo "CAND $z"
done
