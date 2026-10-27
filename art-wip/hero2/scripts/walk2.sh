B=/root/blender-4.2.3-linux-x64/blender; M=/root/mocap; cd /tmp
mkdir -p /workspace/hero2/queue-old; mv /workspace/hero2/queue-hold/*.job /workspace/hero2/queue-old/ 2>/dev/null
for d in down:0 side:90 up:180; do dir=${d%%:*}; yaw=${d##*:}; o=$M/r-walk2-$dir; rm -rf $o; mkdir -p $o
  ABD=5 BULK=1.0 ORTHO=2.4 STEP=4 $B -b -P /workspace/hero2/mannequin.py -- $M/35_01.bvh $o/ $yaw 20 200 >/dev/null 2>&1
  ffmpeg -nostdin -y -loglevel error -framerate 30 -pattern_type glob -i "$o/*.png" -c:v libx264 -pix_fmt yuv420p $M/walk2-$dir.mp4 && echo "DRIVE walk2-$dir $(ls $o | wc -l)"
done
for r in android legend planetary sage; do rm -rf /root/wanout/$r-walk2-down; done
printf "android walk2 down\nlegend walk2 down\nplanetary walk2 down\nsage walk2 down\n" > /workspace/hero2/jobs-w2.txt
JOBS=/workspace/hero2/jobs-w2.txt PAD=0.12 QDIR=/workspace/hero2/queue bash /workspace/hero2/prep_queue.sh
