B=/root/blender-4.2.3-linux-x64/blender; M=/root/mocap; cd /tmp
for a in 5 9; do o=$M/abd-$a; rm -rf $o; mkdir -p $o
  ABD=$a BULK=1.0 ORTHO=2.4 STEP=4 $B -b -P /workspace/hero2/mannequin.py -- $M/35_01.bvh $o/ 0 20 200 2>&1 | grep -a "ABD_OK\|Error" | head -3
  ffmpeg -nostdin -y -loglevel error -framerate 30 -pattern_type glob -i "$o/*.png" -vf "select=not(mod(n\,4)),scale=140:-1,tile=13x1" -frames:v 1 /tmp/abd-$a.jpg
done
ffmpeg -nostdin -y -loglevel error -i /tmp/cand-35_01.jpg -i /tmp/abd-5.jpg -i /tmp/abd-9.jpg -filter_complex vstack=inputs=3 /tmp/abd.jpg && echo STACK_OK
