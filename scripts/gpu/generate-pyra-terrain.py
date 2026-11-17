#!/usr/bin/env python3
"""GPU texture authoring only; never edits the game or controls pods.

Run in the prepared SDXL venv. Source model and raw generations are retained.
Derived height/normal/roughness are artistic approximations, not measured PBR.
"""
import argparse
import hashlib
import json
import math
import shutil
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw
from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler

MATERIALS = {
    "ground-warm-ash": "warm russet volcanic ash soil, fine ochre grains, scattered tiny charcoal pebbles",
    "ground-charcoal": "dark charcoal volcanic soil, dense granular ash, muted ember brown minerals",
    "ground-basalt-gravel": "irregular small angular basalt gravel, warm reddish mineral dust between dark stones",
    "ground-dry-earth": "dry red ochre volcanic earth, subtle natural cracks and scattered fine grit",
    "road-packed-ash": "compacted dark ochre ash road surface, fine crushed rock, subtle wheel wear, no road borders",
    "road-basalt-pavers": "irregular fitted basalt paving stones, warm grey worn edges, muted red dust in joints",
    "road-broken-cobbles": "ancient uneven charcoal cobblestones, cracked worn stones, sparse reddish ash filled gaps",
    "road-ceremonial": "large dark basalt ceremonial flagstones, restrained amber mineral veins, natural worn masonry",
    "mountain-columnar": "dense angular volcanic basalt rock faces, columnar fractures, rich charcoal and rust mineral detail",
    "mountain-strata": "weathered volcanic rock strata, layered black basalt and warm red tuff, natural irregular fractures",
    "mountain-cliff": "rugged broken charcoal basalt cliff material, large angular rock plates, ochre mineral seams",
    "mountain-scree": "loose volcanic mountain scree, different sized sharp basalt fragments, rusty dust crevices",
    "pit-inner-rock": "dark volcanic crater inner wall rock material, deep irregular fractures, reddish weathered mineral deposits",
    "pit-rim": "fractured basalt rock rim material, irregular cracked stone plates, fine pale ash in deep joints",
    "valley-silt": "warm grey alluvial volcanic silt, flowing fine mineral sediment patterns, small scattered basalt pebbles",
    "valley-creek-bed": "dry creek bed material, worn dark volcanic pebbles, fine ochre sand and natural mineral deposits",
    "lowland-loam": "rich dark reddish volcanic loam, sparse tiny muted olive moss flecks, natural fine soil granules",
    "lowland-gravel": "broad lowland volcanic gravel material, small rounded black pebbles, warm fine brown sand",
    "lava-cold-crust": "cooled black lava crust, wrinkled folded rock, rough obsidian basalt, subtle muted rust cracks",
    "lava-ember-cracks": "charcoal volcanic lava crust, sparse thin deep orange ember fissures, mostly dark solid rough rock",
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def periodicize(image):
    """Moisan periodic/smooth decomposition on GPU, no mirrored quadrants."""
    u = torch.tensor(np.asarray(image).copy(), device="cuda", dtype=torch.float32).permute(2, 0, 1) / 255
    v = torch.zeros_like(u)
    v[:, 0, :] = u[:, -1, :] - u[:, 0, :]
    v[:, -1, :] = -v[:, 0, :]
    v[:, :, 0] += u[:, :, -1] - u[:, :, 0]
    v[:, :, -1] -= u[:, :, -1] - u[:, :, 0]
    h, w = u.shape[1:]
    yy = torch.arange(h, device="cuda")[:, None]
    xx = torch.arange(w, device="cuda")[None, :]
    denominator = 2 * torch.cos(2 * math.pi * xx / w) + 2 * torch.cos(2 * math.pi * yy / h) - 4
    denominator[0, 0] = 1
    smooth_fft = torch.fft.fft2(v) / denominator
    smooth_fft[:, 0, 0] = 0
    result = (u - torch.fft.ifft2(smooth_fft).real).clamp(0, 1)

    def metrics(t):
        edge = ((t[:, 0, :] - t[:, -1, :]).abs().mean() + (t[:, :, 0] - t[:, :, -1]).abs().mean()) / 2
        interior = ((t[:, 1:, :] - t[:, :-1, :]).abs().mean() + (t[:, :, 1:] - t[:, :, :-1]).abs().mean()) / 2
        return {"edge_mean_255": float(edge * 255), "interior_mean_255": float(interior * 255), "seam_ratio": float(edge / interior.clamp_min(1e-6))}

    return result, {"before": metrics(u), "after": metrics(result)}


def pil(tensor):
    return Image.fromarray((tensor.clamp(0, 1).permute(1, 2, 0).detach().cpu().numpy() * 255).round().astype("uint8"))


def derived_maps(albedo):
    lum = albedo[0] * .2126 + albedo[1] * .7152 + albedo[2] * .0722
    height = ((lum - lum.mean()) * .65 + .5).clamp(.05, .95)
    dx = (torch.roll(height, -1, 1) - torch.roll(height, 1, 1)) * 2
    dy = (torch.roll(height, -1, 0) - torch.roll(height, 1, 0)) * 2
    normal = torch.stack((-dx, dy, torch.ones_like(height)))
    normal = normal / torch.linalg.vector_norm(normal, dim=0)
    roughness = (.84 - (lum - lum.mean()) * .15).clamp(.60, .98)
    return {"normal": normal * .5 + .5, "height": height.expand(3, -1, -1), "roughness": roughness.expand(3, -1, -1)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="/workspace/ki-premium/model")
    parser.add_argument("--out", default="/workspace/ki-iso-art2/terrain-production")
    parser.add_argument("--variants", type=int, default=3)
    parser.add_argument("--steps", type=int, default=14)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(8)
    pipeline = StableDiffusionXLPipeline.from_pretrained(args.model, torch_dtype=torch.float16, variant="fp16", use_safetensors=True, local_files_only=True)
    pipeline.scheduler = DPMSolverMultistepScheduler.from_config(pipeline.scheduler.config, algorithm_type="sde-dpmsolver++", use_karras_sigmas=True)
    pipeline.to("cuda")
    pipeline.enable_vae_slicing()
    # Circular convolution supports repeating features; measured postprocessing
    # separately removes the remaining border discontinuity from generated RGB.
    for module in pipeline.unet.modules():
        if isinstance(module, torch.nn.Conv2d) and module.padding != (0, 0):
            module.padding_mode = "circular"
    record = {
        "model": "Lykon/dreamshaper-xl-v2-turbo", "revision": "f70ad5bce436c640d23fc02cd0a6ccc787280b6e",
        "gpu": torch.cuda.get_device_name(), "torch": torch.__version__, "cuda": torch.version.cuda,
        "status": "GPU-generated candidates; visual review pending", "steps": args.steps, "guidance": 2.0,
        "seam_processing": "GPU FFT periodic plus smooth decomposition; no mirroring",
        "derived_maps": "luminance-derived artistic approximations, OpenGL normals; not measured PBR",
        "geometry": "material textures only; no actual mountains, holes, valleys or collision geometry changed",
        "items": [],
    }
    manifest = out / "manifest.json"
    if manifest.exists():
        record["items"] = json.loads(manifest.read_text())["items"]
    completed = {item["id"] for item in record["items"]}
    negative = "horizon, sky, perspective, landscape, buildings, trees, text, letters, watermark, frame, border, shadows, vignette, grid, checkerboard"
    for index, (name, material) in enumerate(MATERIALS.items()):
        prompt = f"Seamless tileable game material, top down orthographic flat surface, {material}, detailed hand painted fantasy RPG texture, rich restrained natural colors, even diffuse light, edge to edge."
        for variant in range(args.variants):
            identifier = f"{name}-{variant + 1}"
            if identifier in completed:
                continue
            directory = out / identifier
            directory.mkdir(exist_ok=True)
            seed = 1711202600 + index * 100 + variant
            started = time.monotonic()
            image = pipeline(prompt=prompt, negative_prompt=negative, width=1024, height=1024, num_inference_steps=args.steps, guidance_scale=2.0, generator=torch.Generator("cuda").manual_seed(seed)).images[0].convert("RGB")
            image.save(directory / "source.png")
            albedo, seam = periodicize(image)
            baked = pil(albedo)
            baked.save(directory / "albedo.png")
            baked.save(directory / "albedo.webp", quality=94, method=6)
            baked.resize((512, 512), Image.Resampling.LANCZOS).save(directory / "albedo-512.webp", quality=92, method=6)
            for role, data in derived_maps(albedo).items():
                pil(data).save(directory / f"{role}.png")
            preview = Image.new("RGB", (768, 768))
            small = baked.resize((256, 256), Image.Resampling.LANCZOS)
            for y in range(3):
                for x in range(3):
                    preview.paste(small, (x * 256, y * 256))
            preview.save(directory / "repeat-3x3.jpg", quality=90)
            files = {p.name: {"bytes": p.stat().st_size, "sha256": digest(p)} for p in directory.iterdir() if p.is_file()}
            record["items"].append({"id": identifier, "category": name, "seed": seed, "prompt": prompt, "negative": negative, "seconds": round(time.monotonic() - started, 3), "seams": seam, "files": files})
            manifest.write_text(json.dumps(record, indent=2) + "\n")
            print("TEXTURE_DONE", identifier, "seconds", record["items"][-1]["seconds"], "seam", round(seam["after"]["seam_ratio"], 3), flush=True)
    shutil.copyfile(Path(args.model) / "README.md", out / "MODEL-README.txt")
    shutil.copyfile(Path(args.model).parent / "model-download.json", out / "model-download.json")
    thumbs = Image.new("RGB", (6 * 256, math.ceil(len(record["items"]) / 6) * 280), (27, 22, 24))
    draw = ImageDraw.Draw(thumbs)
    for index, item in enumerate(record["items"]):
        x, y = index % 6 * 256, index // 6 * 280
        thumbs.paste(Image.open(out / item["id"] / "albedo.png").resize((256, 256)), (x, y))
        draw.text((x + 4, y + 258), item["id"], fill=(248, 222, 175))
    thumbs.save(out / "contact-sheet.jpg", quality=92)
    print("COMPLETE", len(record["items"]), flush=True)


if __name__ == "__main__":
    main()
