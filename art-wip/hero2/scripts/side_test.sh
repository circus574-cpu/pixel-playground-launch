cd /workspace/hero2; export HF_HOME=/root/hfcache
pgrep -f dirmaster2 && { echo "DM_RUNNING"; exit 1; }
python3 cutdir.py legend:side:p-2 legend:back:p-2 planetary:side:p-2 planetary:back:p-0 sage:side:p-3 sage:back:p-4 2>&1 | grep -a CUT
rm -rf /root/wanout/legend-walk2-side
echo "legend walk2 side" > /workspace/hero2/jobs-st.txt
JOBS=/workspace/hero2/jobs-st.txt PAD=0.12 QDIR=/workspace/hero2/queue bash prep_queue.sh 2>&1 | tail -2
cd /root/Wan2.2; NCCL_P2P_DISABLE=1 NCCL_IB_DISABLE=1 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True HF_HOME=/root/hfcache STEPS=12 nohup /root/wanenv/bin/python -m torch.distributed.run --nproc_per_node=2 /workspace/hero2/wan_loop.py --frame_num 49 > /workspace/hero2/worker.log 2>&1 &
echo WORKER_STARTED
