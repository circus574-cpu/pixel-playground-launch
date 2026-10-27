"""Persistent Wan-Animate worker: load once (2 GPUs, FSDP + Ulysses), then render queued jobs.
Queue: /workspace/hero2/queue/*.job (text: <src_root_path> <save_file>); done jobs get renamed *.done."""
import os, sys, time, glob, logging
sys.argv = [sys.argv[0], "--task", "animate-14B", "--ckpt_dir", "/root/m/Wan2.2-Animate-14B/", "--src_root_path", "x",
            "--refert_num", "1", "--dit_fsdp", "--t5_fsdp", "--ulysses_size", str(int(os.getenv("WORLD_SIZE", 1)))] + sys.argv[1:]
sys.path.insert(0, "/root/Wan2.2")
import torch, torch.distributed as dist
import generate as G
import wan
from wan.configs import WAN_CONFIGS
from wan.distributed.util import init_distributed_group
from wan.utils.utils import save_video
args = G._parse_args()
rank, ws, lr = int(os.getenv("RANK", 0)), int(os.getenv("WORLD_SIZE", 1)), int(os.getenv("LOCAL_RANK", 0))
G._init_logging(rank)
torch.cuda.set_device(lr)
dist.init_process_group(backend="nccl", init_method="env://", rank=rank, world_size=ws)
init_distributed_group()
cfg = WAN_CONFIGS[args.task]
steps = int(os.getenv("STEPS", args.sample_steps or cfg.sample_steps))
model = wan.WanAnimate(config=cfg, checkpoint_dir=args.ckpt_dir, device_id=lr, rank=rank, t5_fsdp=True, dit_fsdp=True,
                       use_sp=ws > 1, t5_cpu=False, convert_model_dtype=True, use_relighting_lora=False)
Q = "/workspace/hero2/queue"; os.makedirs(Q, exist_ok=True)
logging.info("WORKER_READY")
while True:
    job = [None]
    if rank == 0:
        jobs = sorted(glob.glob(Q + "/*.job"))
        if jobs:
            src, save = open(jobs[0]).read().split()[:2]
            os.rename(jobs[0], jobs[0][:-4] + ".run"); job = [(jobs[0][:-4], src, save)]
        else:
            job = ["IDLE"] if not os.path.exists(Q + "/STOP") else ["STOP"]
    dist.broadcast_object_list(job, src=0)
    j = job[0]
    if j == "STOP": break
    if j == "IDLE": time.sleep(5); continue
    base, src, save = j; t0 = time.time()
    try:
        video = model.generate(src_root_path=src, replace_flag=False, refert_num=1, clip_len=args.frame_num,
                               shift=args.sample_shift, sample_solver=args.sample_solver, sampling_steps=steps,
                               guide_scale=args.sample_guide_scale, seed=42, offload_model=False)
        if rank == 0:
            save_video(tensor=video[None], save_file=save, fps=cfg.sample_fps, nrow=1, normalize=True, value_range=(-1, 1))
            os.rename(base + ".run", base + ".done"); logging.info(f"JOB_DONE {save} {time.time()-t0:.0f}s")
        del video
    except Exception as e:
        if rank == 0: os.rename(base + ".run", base + ".fail"); logging.info(f"JOB_FAIL {save} {e!r} " + __import__("traceback").format_exc().replace("\n", " | ")[-1500:])
    torch.cuda.empty_cache()
dist.barrier(); dist.destroy_process_group()
