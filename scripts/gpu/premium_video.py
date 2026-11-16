#!/usr/bin/env python3
"""Image-conditioned animation candidates. No pod control or game installation.

Input images must come from the installed character. Generated MP4s are source
material, not evidence of gameplay; acceptance requires the Godot preview too.
"""
import argparse
import hashlib
import json
from pathlib import Path
import time


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def validate(root):
    root = Path(root).resolve()
    queue = json.loads((root / "queue.json").read_text())
    if not 1 <= len(queue["jobs"]) <= 6:
        raise ValueError("Animation calibration is limited to six clips")
    ids = set()
    for job in queue["jobs"]:
        if job["id"] in ids or not job["id"].replace("-", "").isalnum():
            raise ValueError("Invalid animation ID")
        ids.add(job["id"])
        source = (root / "inputs" / job["input"]).resolve()
        if not source.is_relative_to(root / "inputs") or sha(source) != job["inputSha256"]:
            raise ValueError("Animation identity reference mismatch")
        if not 17 <= job["frames"] <= 81 or (job["frames"] - 1) % 4:
            raise ValueError("Wan frames must be 4n+1 within the calibration budget")
        if any(not isinstance(n, int) or n < 256 or n % 32 for n in job["size"]) or job["size"][0] * job["size"][1] > 1280 * 720:
            raise ValueError("Invalid or excessive animation resolution")
        if not 10 <= job["steps"] <= 50 or job["fps"] != 24:
            raise ValueError("Invalid calibration duration or sampling budget")
    return queue


def run(root, model_root):
    import torch
    import diffusers
    from diffusers import AutoencoderKLWan, WanImageToVideoPipeline
    from diffusers.utils import export_to_video
    from PIL import Image, ImageDraw, ImageOps

    root, model_root = Path(root).resolve(), Path(model_root).resolve()
    queue = validate(root)
    receipt = json.loads((root / "model-ready.json").read_text())
    if receipt["revision"] != queue["modelRevision"]:
        raise ValueError("Wrong animation model revision")
    # The downloader already compared full hashes against pinned upstream LFS.
    for entry in receipt["files"]:
        if (model_root / entry["file"]).stat().st_size != entry["bytes"]:
            raise ValueError("Incomplete local model: " + entry["file"])
    out = root / "generated"
    out.mkdir(exist_ok=True)
    state_file = out / "results.json"
    state = json.loads(state_file.read_text()) if state_file.exists() else {"clips": []}
    state.update({"status": "running", "modelRevision": receipt["revision"],
                  "modelReceiptSha256": sha(root / "model-ready.json"), "queueSha256": sha(root / "queue.json"),
                  "gpu": torch.cuda.get_device_name(0), "torch": torch.__version__, "diffusers": diffusers.__version__,
                  "scope": "Generated source animation, not a gameplay recording. Identity/loop review pending."})
    vae = AutoencoderKLWan.from_pretrained(str(model_root), subfolder="vae", torch_dtype=torch.float32, local_files_only=True)
    pipe = WanImageToVideoPipeline.from_pretrained(str(model_root), vae=vae, torch_dtype=torch.bfloat16, local_files_only=True).to("cuda")
    # Diffusers 0.35.2's tiled Wan VAE path bypasses patchify for the 5B
    # twelve-channel encoder. A100 has room for the correct non-tiled path.
    pipe.vae.disable_tiling()
    pipe.set_progress_bar_config(disable=True)
    for job in queue["jobs"]:
        fingerprint = hashlib.sha256(json.dumps({"job": job, "model": receipt["revision"],
                                                "runner": sha(__file__)}, sort_keys=True).encode()).hexdigest()
        folder = out / job["id"]
        folder.mkdir(exist_ok=True)
        video = folder / "generated.mp4"
        old = next((r for r in state["clips"] if r["id"] == job["id"]), None)
        if old and old.get("fingerprint") == fingerprint and video.is_file() and sha(video) == old.get("videoSha256"):
            if all((folder / f["file"]).is_file() and sha(folder / f["file"]) == f["sha256"] for f in old["frames"]):
                print("VIDEO_REUSED", job["id"], flush=True)
                continue
        started = time.monotonic()
        image = ImageOps.pad(Image.open(root / "inputs" / job["input"]).convert("RGB"),
                             tuple(job["size"]), method=Image.Resampling.LANCZOS, color="white")
        def progress(pipeline, step, timestep, values):
            if step % 5 == 0:
                print("VIDEO_STEP", job["id"], step + 1, job["steps"], round(time.monotonic() - started, 1), flush=True)
            return values
        torch.cuda.reset_peak_memory_stats()
        frames = pipe(image=image, prompt=job["prompt"], negative_prompt=queue["negativePrompt"],
                      height=job["size"][1], width=job["size"][0], num_frames=job["frames"],
                      num_inference_steps=job["steps"], guidance_scale=5.0,
                      output_type="pil",
                      generator=torch.Generator("cuda").manual_seed(job["seed"]),
                      callback_on_step_end=progress).frames[0]
        if len(frames) != job["frames"]:
            raise ValueError("Incomplete generated animation")
        records = []
        for i, frame in enumerate(frames):
            file = folder / ("frame-%03d.png" % i)
            frame.save(file)
            records.append({"file": file.name, "sha256": sha(file)})
        export_to_video(frames, str(video), fps=job["fps"])
        sheet = Image.new("RGB", (128 * 8, 156), "white")
        draw = ImageDraw.Draw(sheet)
        for i in range(8):
            frame_index = round(i * (len(frames) - 1) / 7)
            sheet.paste(frames[frame_index].resize((128, 128)), (i * 128, 20))
            draw.text((i * 128 + 4, 2), str(frame_index), fill="black")
        sheet.save(folder / "contact.jpg", quality=92)
        record = {"id": job["id"], "clip": job["clip"], "direction": job["direction"],
                  "fingerprint": fingerprint, "videoSha256": sha(video), "frames": records,
                  "seconds": time.monotonic() - started, "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
                  "qualityStatus": "UNREVIEWED"}
        state["clips"] = [r for r in state["clips"] if r["id"] != job["id"]] + [record]
        state_file.write_text(json.dumps(state, indent=2))
        print("VIDEO_READY", job["id"], record["seconds"], flush=True)
    state["status"] = "generated-review-required"
    state_file.write_text(json.dumps(state, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--model-root", type=Path, default=Path("/tmp/ki-wan22"))
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()
    if args.validate:
        print(json.dumps({"valid": True, "clips": len(validate(args.root)["jobs"])}))
    else:
        run(args.root, args.model_root)
