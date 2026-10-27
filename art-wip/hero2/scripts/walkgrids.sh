cd /workspace/hero2; B=/root/blender-4.2.3-linux-x64/blender
for d in front:0 fside:45 side:90 bside:135 back:180; do v=${d%%:*}; y=${d##*:}
  [ -f /root/mocap/j-walk-$v.json ] || NORENDER=1 JOINTS=/root/mocap/j-walk-$v.json ABD=5 BULK=1.0 ORTHO=2.4 STEP=4 $B -b -P mannequin.py -- /root/mocap/35_01.bvh /tmp/jt/ $y 20 200 > /dev/null 2>&1
done; echo JOINTS_ALL
export HF_HOME=/root/hfcache CNS=1.0 IPS=0.7 N=3 TAG=w
run() { gpu=$1; shift; for spec in "$@"; do r=${spec%%:*}; v=${spec##*:}
  if [ $r = android ]; then X=", two separate legs, black bodysuit, dark grey armored greaves, blue and white tattered coat"; NX=", fused legs, blue pants"; else X=""; NX=""; fi
  EXTRA="$X" NEGX="$NX" CUDA_VISIBLE_DEVICES=$gpu python3 gridgen.py $r $v /root/mocap/j-walk-$v.json 2>&1 | grep -a "GRID\|Error"; done; }
run 0 legend:front legend:fside legend:bside legend:back planetary:front planetary:fside planetary:side planetary:bside planetary:back > wg0.log &
run 1 sage:front sage:fside sage:side sage:bside sage:back android:front android:fside android:side android:bside android:back > wg1.log &
wait; echo WALKGRIDS_DONE >> wg0.log
