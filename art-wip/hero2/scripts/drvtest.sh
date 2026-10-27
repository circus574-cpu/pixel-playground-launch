B=/root/blender-4.2.3-linux-x64/blender; M=/root/mocap
t() { name=$1; bvh=$2; abd=$3; start=$4; o=$M/r-$name; rm -rf $o; mkdir -p $o
  ABD=$abd BULK=1.0 ORTHO=2.4 STEP=4 $B -b -P /workspace/hero2/mannequin.py -- $M/$bvh.bvh $o/ 0 $start 200 >/dev/null 2>&1
  ffmpeg -nostdin -y -loglevel error -framerate 30 -pattern_type glob -i "$o/*.png" -frames:v 49 -c:v libx264 -pix_fmt yuv420p $M/$name.mp4
  . /root/wanenv/bin/activate; cd /root/Wan2.2; export HF_HOME=/root/hfcache CUDA_VISIBLE_DEVICES=1
  O=/root/wanout/test-$name; rm -rf $O; mkdir -p $O; cp /root/wanout/legend-walk2-down/ref.png $O/; cp $M/$name.mp4 $O/drive.mp4
  python3 wan/modules/animate/preprocess/preprocess_data.py --ckpt_path /root/m/Wan2.2-Animate-14B/process_checkpoint --video_path $O/drive.mp4 --refer_path $O/ref.png --save_path $O/proc --resolution_area 720 1280 --retarget_flag < /dev/null > $O/prep.log 2>&1
  python3 /workspace/hero2/poscheck.py $O/proc/src_pose.mp4 | sed "s/^/$name /"; }
t w35noabd 35_01 0 20
t w07abd 07_01 5 20
t w35abd-old 35_01 5 20
echo DRVTEST_DONE
