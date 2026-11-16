#!/usr/bin/env python3
"""Bounded SDXL img2img trials over existing Godot terrain. No installation or pod control.

Inputs and model provenance are mandatory. Outputs are candidates for review, never
written into the game. Run --validate on CPU before sending a queue to the GPU.
"""
import argparse
import hashlib
import json
from pathlib import Path
import time


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def read_queue(root):
    root = Path(root).resolve()
    queue = json.loads((root / "queue.json").read_text())
    if not queue.get("jobs") or len(queue["jobs"]) > 24:
        raise ValueError("Pilot must contain 1–24 jobs")
    seen = set()
    for job in queue["jobs"]:
        if job["id"] in seen or not job["id"].replace("-", "").isalnum():
            raise ValueError("Duplicate or unsafe job ID")
        seen.add(job["id"])
        source = (root / job["input"]).resolve()
        if not source.is_relative_to(root) or digest(source) != job["inputSha256"]:
            raise ValueError("Input missing, outside pilot root, or hash mismatch")
        if not 0.0 < job["strength"] <= 0.65:
            raise ValueError("Pilot strength must preserve the source composition")
        if "runtimeSize" in job:
            from PIL import Image
            with Image.open(source) as source_image:
                if tuple(job["runtimeSize"]) != source_image.size:
                    raise ValueError("Native-size export must preserve the source texture budget")
        width, height = job.get("renderSize", [1024, 1024])
        if any(not isinstance(n, int) or n < 128 or n % 8 for n in [width, height]) or width * height > 1536 * 1024:
            raise ValueError("Invalid or excessive pilot render dimensions")
    return queue


def seam_metrics(image):
    import numpy as np
    a = np.asarray(image.convert("RGB"), dtype=np.float32)
    edge = float((abs(a[0] - a[-1]).mean() + abs(a[:, 0] - a[:, -1]).mean()) / 2)
    interior = float((abs(a[1:] - a[:-1]).mean() + abs(a[:, 1:] - a[:, :-1]).mean()) / 2)
    return {"edgeMeanAbs": edge, "interiorMeanAbs": interior,
            "edgeToInterior": edge / max(interior, 0.001)}


def reusable(record, fingerprint, output, runtime=None):
    intact = bool(record and record.get("fingerprint") == fingerprint
                  and output.is_file() and record.get("sha256") == digest(output))
    if intact and runtime is not None:
        intact = runtime.is_file() and record.get("runtimeSha256") == digest(runtime)
    return intact


def run(root, model_root=None):
    import platform
    import torch
    import diffusers
    from diffusers import StableDiffusionXLImg2ImgPipeline, DPMSolverMultistepScheduler
    from PIL import Image, ImageDraw

    root = Path(root).resolve()
    model_root = Path(model_root).resolve() if model_root else root / "model"
    queue = read_queue(root)
    provenance = json.loads((root / "model-download.json").read_text())
    if provenance["revision"] != queue["modelRevision"]:
        raise ValueError("Queue/model revision mismatch")
    for entry in provenance["files"]:
        if digest(model_root / entry["file"]) != entry["sha256"]:
            raise ValueError("Downloaded model hash mismatch: " + entry["file"])
    out = root / "candidates"
    out.mkdir(exist_ok=True)
    state_file = out / "results.json"
    state = json.loads(state_file.read_text()) if state_file.exists() else {"items": []}
    state.update({"status": "running", "model": provenance, "queueSha256": digest(root / "queue.json"),
                  "gpu": torch.cuda.get_device_name(0), "torch": torch.__version__,
                  "diffusers": diffusers.__version__, "python": platform.python_version(),
                  "scope": "Terrain candidates only; not installed or published. Quality acceptance pending."})
    pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
        str(model_root), torch_dtype=torch.float16, variant="fp16",
        use_safetensors=True, local_files_only=True).to("cuda")
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config, algorithm_type="sde-dpmsolver++", use_karras_sigmas=True)
    pipe.enable_vae_tiling()
    # Match the existing texture pipeline. Metrics and tiled previews still required:
    # circular convolution alone is not proof of a seamless material.
    convolutions = [module for module in list(pipe.unet.modules()) + list(pipe.vae.modules())
                    if isinstance(module, torch.nn.Conv2d)]
    rows = []
    for job in queue["jobs"]:
        fingerprint = hashlib.sha256(json.dumps({"job": job, "model": queue["modelRevision"],
                                                "runner": digest(__file__)}, sort_keys=True).encode()).hexdigest()
        target = out / (job["id"] + ".png")
        previous = next((r for r in state["items"] if r["id"] == job["id"]), None)
        original = Image.open(root / job["input"]).convert("RGBA")
        canvas = Image.new("RGBA", original.size, "white")
        canvas.alpha_composite(original)
        source = canvas.convert("RGB").resize(tuple(job.get("renderSize", [1024, 1024])), Image.Resampling.LANCZOS)
        for module in convolutions:
            module.padding_mode = "circular" if job.get("seamless", True) else "zeros"
        if not reusable(previous, fingerprint, target, out / (job["id"] + ".webp")):
            started = time.monotonic()
            torch.cuda.reset_peak_memory_stats()
            image = pipe(prompt=job["prompt"], negative_prompt=queue["negativePrompt"], image=source,
                         strength=job["strength"], num_inference_steps=job["steps"],
                         guidance_scale=job["guidance"], generator=torch.Generator("cuda").manual_seed(job["seed"])).images[0]
            image.save(target)
            runtime = image.resize(tuple(job.get("runtimeSize", [768, 768])), Image.Resampling.LANCZOS)
            if job.get("preserveAlpha", False):
                runtime = runtime.convert("RGBA")
                runtime.putalpha(original.getchannel("A"))
            runtime.save(out / (job["id"] + ".webp"), lossless=True)
            record = {"id": job["id"], "fingerprint": fingerprint, "sha256": digest(target),
                      "seconds": time.monotonic() - started,
                      "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
                      "sourceSeam": seam_metrics(source), "resultSeam": seam_metrics(image),
                      "runtimeBytes": (out / (job["id"] + ".webp")).stat().st_size,
                      "runtimeSha256": digest(out / (job["id"] + ".webp")),
                      "sourceSize": list(original.size), "runtimeSize": list(runtime.size),
                      "alphaPreserved": bool(job.get("preserveAlpha", False))}
            state["items"] = [r for r in state["items"] if r["id"] != job["id"]] + [record]
            state_file.write_text(json.dumps(state, indent=2))
        image = Image.open(target).convert("RGB")
        rows.append((job["id"], source.copy(), image.copy()))
        print("CANDIDATE_READY", job["id"], flush=True)
    sheet = Image.new("RGB", (768, len(rows) * 280), "#28232b")
    draw = ImageDraw.Draw(sheet)
    for i, (name, source, image) in enumerate(rows):
        y = i * 280
        draw.text((8, y + 4), name + " | source / candidate / 2x2 tile preview", fill="white")
        sheet.paste(source.resize((256, 256)), (0, y + 24))
        sheet.paste(image.resize((256, 256)), (256, y + 24))
        tile = image.resize((128, 128))
        for x in range(2):
            for z in range(2):
                sheet.paste(tile, (512 + x * 128, y + 24 + z * 128))
    sheet.save(out / "before-after.jpg", quality=90)
    state["status"] = "candidates-ready-review-required"
    state_file.write_text(json.dumps(state, indent=2))
    print("PILOT_COMPLETE", len(rows), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--model-root", type=Path, help="Optional local SSD cache; hashes still required")
    args = parser.parse_args()
    if args.validate:
        print(json.dumps({"valid": True, "jobs": len(read_queue(args.root)["jobs"])}))
    else:
        run(args.root, args.model_root)
