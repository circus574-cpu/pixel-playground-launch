import os, torch, torch.distributed as dist
dist.init_process_group("nccl"); r = dist.get_rank(); torch.cuda.set_device(r)
x = torch.ones(1024, device="cuda") * (r + 1); dist.all_reduce(x); torch.cuda.synchronize()
print("NCCL_OK", r, x[0].item(), flush=True); dist.destroy_process_group()
