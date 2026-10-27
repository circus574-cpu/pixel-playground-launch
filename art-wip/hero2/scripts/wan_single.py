"""Single-GPU persistent Wan-Animate worker (no torch.distributed). Run one per GPU; they share the queue."""
import os, sys, time, glob, logging
sys.path.insert(0, "/root/Wan2.2")
sys.argv = [sys.argv[0], "--task", "animate-14B", "--ckpt_dir", "/root/m/Wan2.2-Animate-14B/", "--src_root_path", "x", "--refert_num", "1", "--frame_num", os.getenv("FRAMES", "77")]
import torch
import generate as G
import wan
from wan.configs import WAN_CONFIGS
from wan.utils.utils import save_video
args = G._parse_args(); G._init_logging(0)
cfg = WAN_CONFIGS[args.task]; steps = int(os.getenv("STEPS", cfg.sample_steps))
gpu = os.getenv("CUDA_VISIBLE_DEVICES", "0")
model = wan.WanAnimate(config=cfg, checkpoint_dir=args.ckpt_dir, device_id=0, rank=0, t5_fsdp=False, dit_fsdp=False,
                       use_sp=False, t5_cpu=False, convert_model_dtype=True, use_relighting_lora=False)
Q = "/workspace/hero2/queue"
logging.info(f"WORKER_READY gpu{gpu}")
while not os.path.exists(Q + "/STOP"):
    jobs = sorted(glob.glob(Q + "/*.job"))
    if not jobs: time.sleep(5); continue
    job = jobs[0]; base = job[:-4]
    try: os.rename(job, base + f".run{gpu}")
    except FileNotFoundError: continue            # the other worker took it
    src, save = open(base + f".run{gpu}").read().split()[:2]; t0 = time.time()
    try:
        video = model.generate(src_root_path=src, replace_flag=False, refert_num=1, clip_len=args.frame_num,
                               shift=args.sample_shift, sample_solver=args.sample_solver, sampling_steps=steps,
                               guide_scale=args.sample_guide_scale, seed=42, offload_model=os.getenv("OFFLOAD") == "1")
        save_video(tensor=video[None], save_file=save, fps=cfg.sample_fps, nrow=1, normalize=True, value_range=(-1, 1))
        os.rename(base + f".run{gpu}", base + ".done"); logging.info(f"JOB_DONE gpu{gpu} {save} {time.time()-t0:.0f}s")
        del video
    except Exception as e:
        os.rename(base + f".run{gpu}", base + ".fail"); logging.info(f"JOB_FAIL gpu{gpu} {save} {e!r}")
    torch.cuda.empty_cache()
