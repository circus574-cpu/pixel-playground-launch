cd /workspace/hero2
bash drives.sh > drives.log 2>&1
while ! grep -q RESTORE_DONE restore3.log; do sleep 10; done
grep -q WAN_IMPORT_OK restore3.log || { echo "WAN_ENV_BROKEN"; exit 1; }
rm -f queue/STOP
(cd /root/Wan2.2 && . /root/wanenv/bin/activate && HF_HOME=/root/hfcache STEPS=${STEPS:-20} torchrun --nproc_per_node=2 /workspace/hero2/wan_loop.py > /workspace/hero2/worker.log 2>&1) &
bash prep_queue.sh > prep.log 2>&1
echo ORCH_PREP_DONE
