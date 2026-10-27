cd /workspace/hero2; pkill -f batch2.sh; pkill -f gridgen.py; sleep 8
export HF_HOME=/root/hfcache CNS=1.0 IPS=0.6 N=2 TAG=i MOTION= START=4 CYC=34 ACT=walking ACTWORDS="walk cycle animation frames"
t() { gpu=$1; r=$2; v=$3; st=$4; STR=$st SEED0=900 CUDA_VISIBLE_DEVICES=$gpu python3 gridgen.py $r $v /root/mocap/j-walk-$v.json 2>&1 | grep -a "GRID\|Error"; }
( t 0 legend front 0.55; t 0 legend side 0.55 ) > i2i0.log &
( t 1 android front 0.55; t 1 sage side 0.55 ) > i2i1.log &
wait; echo I2I_DONE >> i2i0.log
