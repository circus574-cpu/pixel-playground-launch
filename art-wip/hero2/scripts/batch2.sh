cd /workspace/hero2; B=/root/blender-4.2.3-linux-x64/blender
until grep -q ATTACK_DONE ag0.log; do sleep 20; done
for d in front:0 fside:45 side:90 bside:135 back:180; do v=${d%%:*}; y=${d##*:}
  [ -f /root/mocap/j-kick-$v.json ] || NORENDER=1 JOINTS=/root/mocap/j-kick-$v.json BULK=1.0 ORTHO=2.4 STEP=5 $B -b -P mannequin.py -- /root/mocap/74_03.bvh /tmp/jt/ $y 2 395 > /dev/null 2>&1
done; echo JOINTS_K
export HF_HOME=/root/hfcache CNS=1.0 N=3
g() { gpu=$1; r=$2; v=$3; j=$4; X=""; NX=""
  [ $r = android ] && X=", two separate legs, black bodysuit, dark grey armored greaves" && NX=", fused legs, blue pants"
  [ $r = legend ] && X=", black sleeveless top with open chest, red sash belt, red spiked shoulder pads, black pants, red boots"
  [ $r = sage ] && export SCALE=0.78 || export SCALE=1
  EXTRA="$X" NEGX="$NX" CUDA_VISIBLE_DEVICES=$gpu python3 gridgen.py $r $v $j 2>&1 | grep -a "GRID\|Error"; }
lane() { gpu=$1; shift; for spec in "$@"; do IFS=: read m r v <<< "$spec"
  case $m in
    walk)  IPS=0.75 TAG=x MOTION= START=4 CYC=34 ACT=walking ACTWORDS="walk cycle animation frames" g $gpu $r $v /root/mocap/j-walk-$v.json ;;
    idle)  IPS=0.7 TAG=w MOTION=idle- START=0 CYC=32 ACT="standing in fighting stance, guard up, idle breathing" ACTWORDS="idle animation frames" g $gpu $r $v /root/mocap/j-punch-$v.json ;;
    skill) IPS=0.7 TAG=w MOTION=skill- START=30 CYC=24 ACT="powerful flying kick, martial arts special move" ACTWORDS="special attack animation frames" g $gpu $r $v /root/mocap/j-kick-$v.json ;;
  esac; done; }
lane 0 walk:legend:front walk:legend:fside walk:legend:bside walk:legend:back idle:legend:front idle:legend:fside idle:legend:side idle:legend:bside idle:legend:back idle:planetary:front idle:planetary:fside idle:planetary:side idle:planetary:bside idle:planetary:back skill:legend:front skill:legend:fside skill:legend:side skill:legend:bside skill:legend:back skill:planetary:front skill:planetary:fside skill:planetary:side skill:planetary:bside skill:planetary:back > b2g0.log &
lane 1 walk:sage:front walk:sage:fside walk:sage:bside walk:sage:back idle:sage:front idle:sage:fside idle:sage:side idle:sage:bside idle:sage:back idle:android:front idle:android:fside idle:android:side idle:android:bside idle:android:back skill:sage:front skill:sage:fside skill:sage:side skill:sage:bside skill:sage:back skill:android:front skill:android:fside skill:android:side skill:android:bside skill:android:back > b2g1.log &
wait; echo BATCH2_DONE >> b2g0.log
