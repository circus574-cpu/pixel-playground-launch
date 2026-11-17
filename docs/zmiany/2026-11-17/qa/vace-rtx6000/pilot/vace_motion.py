#!/usr/bin/env python3
"""Prepare/check a motion-controlled trial on CPU; inference is explicit and offline.

No downloads, pod lifecycle, production writes or automatic installation. The
reference fixture exercises the transport to Godot and is NEVER a GPU result.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import socket
import time

MODEL = "Wan-AI/Wan2.1-VACE-14B-diffusers"
REVISION = "db79b90c60bbb45ceec9e41b9d5a4df934538ac4"
DIRECTIONS = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"]


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def safe_file(root, relative):
    root = Path(root).resolve()
    if not isinstance(relative, str) or Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise ValueError("Expected a relative artifact path")
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError("Artifact escapes its directory")
    return path


def output_root(path):
    path = Path(path).resolve()
    if "ports" in path.parts or "public" in path.parts:
        raise ValueError("Use an external trial directory; installed assets are read-only")
    path.mkdir(parents=True, exist_ok=True)
    return path


def actor_cell(repo, actor, clip, direction, index):
    from PIL import Image, ImageOps
    spec = actor["clips"][clip]
    entry = spec["directions"][direction][index]
    if not isinstance(entry, list) or len(entry) != 8:
        raise ValueError("Calibration expects the installed trimmed hero frame contract")
    x, y, w, h, mx, my, mw, mh = entry
    cell = int(actor["cell"])
    if w + mw != cell or h + mh != cell or min(mx, my) < 0 or mx + w > cell or my + h > cell:
        raise ValueError("Invalid trim/margin")
    asset = spec["sheet"]
    if not asset.startswith("res://assets/"):
        raise ValueError("Unexpected actor atlas")
    path = safe_file(Path(repo) / "ports/godot-pyra", asset.removeprefix("res://"))
    with Image.open(path) as sheet:
        if x < 0 or y < 0 or x + w > sheet.width or y + h > sheet.height:
            raise ValueError("Frame exceeds atlas bounds")
        image = Image.new("RGBA", (cell, cell))
        image.alpha_composite(sheet.convert("RGBA").crop((x, y, x + w, y + h)), (mx, my))
    if direction in spec.get("mirrored", []):
        image = ImageOps.mirror(image)
    return image, path


def prepare(repo, root):
    from PIL import Image
    repo, root = Path(repo).resolve(), output_root(root)
    manifest_path = root / "control.json"
    if manifest_path.exists():
        raise ValueError("Existing trial: validate it or prepare a new directory")
    source_path = repo / "ports/godot-pyra/data/actors.json"
    actor = json.loads(source_path.read_text())["pyra.hero"]
    clip = actor["clips"]["walk"]
    if actor["cell"] != 200 or actor["origin"] != [0.5, 0.95] or actor["size"] != [133, 133]:
        raise ValueError("Hero presentation contract changed; audit it before preparing")
    count, fps = len(clip["directions"]["right"]), float(clip["fps"])
    if count != 8 or not math.isfinite(fps) or fps <= 0 or not clip["loop"]:
        raise ValueError("Unexpected canonical walking cycle")
    for folder in ["source", "control"]:
        (root / folder).mkdir(exist_ok=True)
    frames, atlases = [], {}
    for i in range(count):
        image, atlas = actor_cell(repo, actor, "walk", "right", i)
        file = "source/frame-%02d.png" % i
        image.save(root / file)
        frames.append({"file": file, "sha256": sha(root / file), "bodyHeight": image.getbbox()[3] - image.getbbox()[1]})
        atlases[str(atlas.relative_to(repo))] = sha(atlas)
    keys = []
    for i, source_index in enumerate([0, 2, 4, 6, 0]):
        with Image.open(root / frames[source_index]["file"]) as image:
            white = Image.new("RGBA", image.size, "white")
            white.alpha_composite(image.convert("RGBA"))
        file = "control/key-%d.png" % i
        white.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS).save(root / file)
        keys.append({"frame": i * 8, "sourceIndex": source_index, "file": file, "sha256": sha(root / file)})
    manifest = {
        "schema": 1, "kind": "vace-walk-calibration", "actor": "pyra.hero", "clip": "walk", "direction": "right",
        "source": {"actorSha256": sha(source_path), "atlases": atlases, "frames": frames,
                   "fps": fps, "frameCount": count, "loop": True, "cell": 200,
                   "origin": actor["origin"], "size": actor["size"]},
        "model": {"repository": MODEL, "revision": REVISION},
        "sampling": {"numFrames": 33, "size": [512, 512], "steps": 30, "guidance": 5.0,
                     "conditioningScale": 1.0, "flowShift": 3.0, "seed": 5741117, "maxSeconds": 2700},
        "keys": keys,
        "export": {"indices": list(range(0, 32, 2)), "fps": fps * 2, "duration": count / fps,
                   "cell": 200, "origin": actor["origin"], "size": actor["size"], "orientation": "displayed"},
        "prompt": "Same adult anime male warrior and the same black and crimson armor, red sash, black spiky hair as the reference frames. Full body right profile walking with alternating leg strides, natural opposite arm swing. Follow the provided key poses. Fixed camera, white background, no props or effects, consistent face and costume.",
        "negativePrompt": "static legs, extra limbs, duplicated body, changing face, changing costume, weapons, turning, zoom, camera movement, text, watermark, cropped feet, scenery",
    }
    write_json(manifest_path, manifest)
    return validate(root)


def validate(root):
    from PIL import Image
    root = Path(root).resolve()
    plan = json.loads((root / "control.json").read_text())
    if plan.get("schema") != 1 or plan.get("kind") != "vace-walk-calibration" or plan.get("model") != {"repository": MODEL, "revision": REVISION}:
        raise ValueError("Wrong trial/model schema")
    source, sampling, export = plan["source"], plan["sampling"], plan["export"]
    if (plan["actor"], plan["clip"], plan["direction"]) != ("pyra.hero", "walk", "right"):
        raise ValueError("This calibration is scoped to the Legend walking right")
    if source["cell"] != 200 or source["origin"] != [0.5, 0.95] or source["size"] != [133, 133] or not source["loop"]:
        raise ValueError("Invalid presentation contract")
    if source["frameCount"] != 8 or len(source["frames"]) != 8 or not math.isfinite(source["fps"]) or source["fps"] <= 0:
        raise ValueError("Invalid source timing")
    if sampling["numFrames"] != 33 or sampling["size"] != [512, 512] or not 10 <= sampling["steps"] <= 50:
        raise ValueError("Trial exceeds its fixed initial budget")
    for name in ["guidance", "conditioningScale", "flowShift", "maxSeconds"]:
        if not isinstance(sampling[name], (int, float)) or not math.isfinite(sampling[name]) or sampling[name] <= 0:
            raise ValueError("Invalid sampler setting")
    if sampling["guidance"] > 10 or sampling["conditioningScale"] > 2 or sampling["maxSeconds"] > 3600:
        raise ValueError("Sampling budget exceeded")
    if not isinstance(sampling["seed"], int) or not 0 <= sampling["seed"] < 2 ** 63:
        raise ValueError("Invalid deterministic seed")
    if export != {"indices": list(range(0, 32, 2)), "fps": source["fps"] * 2,
                  "duration": 8 / source["fps"], "cell": 200, "origin": source["origin"], "size": source["size"], "orientation": "displayed"}:
        raise ValueError("Export changes cycle duration or the hero contract")
    if [(k["frame"], k["sourceIndex"]) for k in plan["keys"]] != list(zip([0, 8, 16, 24, 32], [0, 2, 4, 6, 0])):
        raise ValueError("Invalid loop keyframe order")
    for entry in source["frames"] + plan["keys"]:
        path = safe_file(root, entry["file"])
        if sha(path) != entry["sha256"]:
            raise ValueError("Changed identity/motion reference")
        with Image.open(path) as image:
            expected = (200, 200) if entry in source["frames"] else (512, 512)
            if image.size != expected:
                raise ValueError("Invalid reference dimensions")
    if plan["keys"][0]["sha256"] != plan["keys"][-1]["sha256"]:
        raise ValueError("The final key must close the same cycle")
    return plan


def controls(root, plan):
    from PIL import Image
    keys = {k["frame"]: k for k in plan["keys"]}
    video, masks = [], []
    for i in range(plan["sampling"]["numFrames"]):
        if i in keys:
            with Image.open(safe_file(root, keys[i]["file"])) as image:
                video.append(image.convert("RGB"))
        else:
            video.append(Image.new("RGB", (512, 512), (128, 128, 128)))
        masks.append(Image.new("L", (512, 512), 0 if i in keys else 255))
    return video, masks


def fixture(root):
    """A labeled transport fixture, composed only of existing source cells."""
    from PIL import Image
    root = Path(root).resolve()
    plan = validate(root)
    folder = output_root(root / "reference-fixture")
    rows = []
    for i in range(33):
        index = (i // 4) % 8
        with Image.open(root / plan["source"]["frames"][index]["file"]) as image:
            file = "frame-%03d.png" % i
            image.save(folder / file)
        rows.append({"file": file, "sha256": sha(folder / file)})
    result = {"kind": "reference-fixture-only", "controlSha256": sha(root / "control.json"),
              "frames": rows, "gpuInference": False, "warning": "Existing source frames; no newly generated animation"}
    write_json(folder / "result.json", result)
    return result


def verify_result(root, result_path, allow_fixture=False):
    from PIL import Image
    root, result_path = Path(root).resolve(), Path(result_path).resolve()
    validate(root)
    result = json.loads(result_path.read_text())
    if result.get("kind") not in (["vace-generated", "reference-fixture-only"] if allow_fixture else ["vace-generated"]):
        raise ValueError("A CPU reference fixture cannot stand in for GPU output")
    if result["kind"] == "vace-generated" and (result.get("gpuInference") is not True or result.get("status") != "generated-review-required"):
        raise ValueError("The GPU run did not complete")
    if result["controlSha256"] != sha(root / "control.json") or len(result["frames"]) != 33:
        raise ValueError("Output does not match the trial")
    for entry in result["frames"]:
        path = safe_file(result_path.parent, entry["file"])
        if sha(path) != entry["sha256"]:
            raise ValueError("Incomplete or altered output frame")
        with Image.open(path) as image:
            expected = (200, 200) if result["kind"] == "reference-fixture-only" else (512, 512)
            if image.size != expected:
                raise ValueError("Unexpected output dimensions")
    return result


def infer(root, model_root, receipt_path):
    root, model_root = output_root(root), Path(model_root).resolve()
    plan = validate(root)
    receipt = json.loads(Path(receipt_path).read_text())
    if receipt["repository"] != MODEL or receipt["revision"] != REVISION:
        raise ValueError("Wrong pinned model receipt")
    paths = [entry["file"] for entry in receipt["files"]]
    if "model_index.json" not in paths or not {"transformer", "text_encoder", "vae", "tokenizer"}.issubset({Path(p).parts[0] for p in paths}) or not any(p.endswith(".safetensors") for p in paths):
        raise ValueError("Incomplete model receipt")
    for previous in sorted(root.glob("generated-*/result.json"), reverse=True):
        saved = json.loads(previous.read_text())
        if saved.get("kind") == "vace-generated" and saved.get("runnerSha256") == sha(__file__) and saved.get("modelReceiptSha256") == sha(receipt_path) and saved.get("controlSha256") == sha(root / "control.json"):
            verify_result(root, previous)
            print("VACE_REUSED", previous, flush=True)
            return
    # Offline only: refuse missing files without importing any GPU framework.
    for entry in receipt["files"]:
        path = safe_file(model_root, entry["file"])
        if not path.is_file() or path.stat().st_size != entry["bytes"]:
            raise ValueError("Missing/incomplete model: " + entry["file"])
    lock = root / "inference.lock"
    with lock.open("x") as stream:
        json.dump({"pid": os.getpid(), "host": socket.gethostname()}, stream)
        owned_inode = os.fstat(stream.fileno()).st_ino
    started = time.monotonic()
    folder = output_root(root / ("generated-%d" % time.time_ns()))
    status = {"kind": "vace-generated", "status": "starting", "controlSha256": sha(root / "control.json"),
              "runnerSha256": sha(__file__), "modelReceiptSha256": sha(receipt_path), "gpuInference": False}
    def deadline():
        if time.monotonic() - started > plan["sampling"]["maxSeconds"]:
            raise TimeoutError("Trial time budget exceeded; no pod lifecycle action performed")
    try:
        import torch
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is required for inference; CPU preparation needs no GPU")
        import diffusers
        from diffusers import AutoencoderKLWan, WanVACEPipeline, UniPCMultistepScheduler
        from diffusers.utils import export_to_video
        for entry in receipt["files"]:
            deadline()
            if sha(safe_file(model_root, entry["file"])) != entry["sha256"]:
                raise ValueError("Model SHA-256 mismatch: " + entry["file"])
        status.update({"gpu": torch.cuda.get_device_name(0), "torch": torch.__version__, "diffusers": diffusers.__version__})
        write_json(folder / "run.json", status)
        vae = AutoencoderKLWan.from_pretrained(str(model_root), subfolder="vae", torch_dtype=torch.float32, local_files_only=True)
        pipe = WanVACEPipeline.from_pretrained(str(model_root), vae=vae, torch_dtype=torch.bfloat16, local_files_only=True)
        pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config, flow_shift=plan["sampling"]["flowShift"])
        pipe.enable_model_cpu_offload()
        pipe.vae.disable_tiling()
        video, masks = controls(root, plan)
        def progress(pipeline, step, timestep, values):
            deadline()
            if step % 5 == 0:
                print("VACE_STEP", step + 1, round(time.monotonic() - started, 1), flush=True)
            return values
        deadline()
        torch.cuda.reset_peak_memory_stats()
        status["gpuInferenceAttempted"] = True
        frames = pipe(video=video, mask=masks, prompt=plan["prompt"], negative_prompt=plan["negativePrompt"],
                      height=512, width=512, num_frames=33, num_inference_steps=plan["sampling"]["steps"],
                      guidance_scale=plan["sampling"]["guidance"], conditioning_scale=plan["sampling"]["conditioningScale"],
                      generator=torch.Generator("cuda").manual_seed(plan["sampling"]["seed"]),
                      output_type="pil", callback_on_step_end=progress).frames[0]
        if len(frames) != 33 or any(f.size != (512, 512) for f in frames):
            raise ValueError("Incomplete VACE result")
        rows = []
        for i, image in enumerate(frames):
            file = "frame-%03d.png" % i
            image.save(folder / file)
            rows.append({"file": file, "sha256": sha(folder / file)})
        export_to_video(frames, str(folder / "generated-source.mp4"), fps=24)
        status.update({"status": "generated-review-required", "gpuInference": True, "frames": rows,
                       "seconds": time.monotonic() - started, "peakAllocatedBytes": torch.cuda.max_memory_allocated()})
        write_json(folder / "result.json", status)
        print("VACE_RESULT", folder / "result.json", flush=True)
    except Exception as error:
        status.update({"status": "failed", "error": str(error), "seconds": time.monotonic() - started})
        write_json(folder / "run.json", status)
        raise
    finally:
        if lock.exists() and lock.stat().st_ino == owned_inode:
            lock.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    prep = commands.add_parser("prepare")
    prep.add_argument("--repo", type=Path, default=Path.cwd())
    prep.add_argument("--out", type=Path, required=True)
    for name in ["validate", "fixture", "infer"]:
        cmd = commands.add_parser(name)
        cmd.add_argument("--root", type=Path, required=True)
        if name == "infer":
            cmd.add_argument("--model-root", type=Path, required=True)
            cmd.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "prepare":
        result = prepare(args.repo, args.out)
    elif args.command == "validate":
        result = validate(args.root)
    elif args.command == "fixture":
        result = fixture(args.root)
    else:
        return infer(args.root, args.model_root, args.receipt)
    print(json.dumps({"status": "CPU_VALIDATED", "gpuInference": False,
                      "kind": result.get("kind"), "next": "GPU inference and artistic acceptance remain unverified"}))


if __name__ == "__main__":
    main()
