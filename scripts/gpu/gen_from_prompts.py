#!/usr/bin/env python3
"""World textures, roads, transitions, nature sprites, buildings and interiors straight from the prompt files in
art/pipeline/prompts/world/*.md (every prompt there is complete and self-contained).

  python3 gen_from_prompts.py --dry-run                      plan only (CPU, no torch needed)
  python3 gen_from_prompts.py --tag v1 --only pyra-          render every prompt whose file name contains "pyra-"
  python3 gen_from_prompts.py --tag v1 --variants 3 --refine render all, 3 seeds each, with a 2x refine pass

Same engine as gen_terrain_textures.py / gen_nature_assets.py (SDXL from /workspace/ki-legends-gpu/models/checkpoints):
  tile      terrain, roads: circular convolutions, seamless on the tile edges
  plain     transition tiles: no circular padding (left and right halves differ on purpose)
  sprite    trees, plants, rocks, props, building exteriors: drawn on pure white, matted by rembg (isnet-anime) to RGBA
  room      building interiors: one whole room, landscape (or portrait for the Pyra smithy)
The long prompts are written for large image models; SDXL has a 77-token window, so the Subject and the palette are
cut out of each prompt and combined with a short style/negative prompt per mode (as in the existing scripts).
Output: renders/prompts-<tag>/<file>-v<i>.png + metadata.json + one contact sheet per group. GPU work only on a pod the
owner has started; this script never starts, stops or changes a pod.
"""
import argparse, hashlib, json, re, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROMPT_DIR = HERE.parent.parent / "art" / "pipeline" / "prompts" / "world"
ROOT = Path("/workspace/ki-legends-gpu")

# mode -> (width, height) SDXL renders and the final size after upscaling
SIZES = {
    "tile": ((1024, 1024), (2048, 2048)),
    "road": ((1536, 768), (2048, 1024)),
    "plain": ((1024, 1024), (2048, 2048)),
    "sprite": ((1024, 1024), (1536, 1536)),
    "room": ((1216, 960), (1920, 1520)),
    "room-portrait": ((640, 1344), (1080, 2200)),
}
STYLE = {
    "tile": "seamless tileable game texture, flat top-down orthographic view, stylized hand painted anime fantasy game environment art, even lighting, no perspective, no objects, no characters, no text, full frame uniform pattern, high quality",
    "road": "seamless horizontal strip, one winding road running left to right through the middle with organic irregular edges, flat top-down view, stylized hand painted anime fantasy game environment art, even lighting, no characters, no text, high quality",
    "plain": "game texture, left half and right half of different terrain blended along a wavy boundary, flat top-down view, stylized hand painted anime fantasy game environment art, even lighting, no characters, no text, high quality",
    "sprite": "single isolated game sprite, three-quarter top-down view, centered, whole object visible, stylized hand painted anime fantasy art with clean outlines, pure white background, no ground, no shadow, no text, high quality",
    "room": "interior of one room, three-quarter top-down JRPG view, back wall at the top, front wall cut away, empty walkable floor in the centre, stylized hand painted anime fantasy art, no characters, no text, high quality",
}
NEG = {
    "tile": "perspective, 3d render, vignette, border, frame, shadow gradient, single large object, person, character, creature, building, text, logo, watermark, blurry, low quality, visible seams, cropped",
    "sprite": "ground, grass patch, shadow on the ground, background scenery, multiple objects, person, character, text, logo, watermark, blurry, low quality, cropped, cut off",
    "room": "person, character, creature, text, logo, watermark, blurry, low quality, objects blocking the centre of the floor, cropped",
}
NEG["road"] = NEG["plain"] = NEG["tile"]
SPRITE_HINTS = ("-tree-", "-plant-", "-rock-", "-water-", "-decor-", "-exterior")


def mode_of(name, size):
    if name.endswith("-interior"):
        return "room-portrait" if ("1080" in size or "540:1100" in size) else "room"
    if any(h in name for h in SPRITE_HINTS):
        return "sprite"
    if "-trans-" in name:
        return "plain"
    if "-road-" in name:
        return "road" if "2048×1024" in size else "tile"
    return "tile"


ENTRY = re.compile(
    r"### (\d+)\. (?P<title>[^\n]*)\n\*\*Plik:\*\* `(?P<name>[^`]+)` · \*\*Rozmiar:\*\* (?P<size>[^\n·]*?)(?: ·[^\n]*)?\n\n```\n(?P<prompt>.*?)\n```",
    re.S,
)


def parse_prompts(directory=PROMPT_DIR):
    entries = []
    for f in sorted(Path(directory).glob("*.md")):
        for m in ENTRY.finditer(f.read_text(encoding="utf-8")):
            name, size, prompt = m["name"], m["size"].strip(), m["prompt"].strip()
            entries.append({"name": name, "title": m["title"], "size": size, "prompt": prompt,
                            "mode": mode_of(name, size), "source": f.name})
    # A later file overrides an earlier one with the same name (files are read in alphabetical order, so the
    # corrected WNETRZA-v2-*.md interiors replace the old v1 interiors inside BUDYNKI-*.md).
    by_name = {}
    for e in entries:
        by_name[e["name"]] = e
    return list(by_name.values())


def compact(entry):
    """Short SDXL prompt: the subject and the palette of the long prompt plus the mode's style line."""
    p = entry["prompt"]
    sub = re.search(r"Subject: (.*?)(?: Colour palette:|$)", p, re.S)
    pal = re.search(r"Colour palette: (.*?)(?: Mood:|$)", p, re.S)
    if entry["mode"] == "plain":
        sub = re.search(r"The left half is (.*?)\. They blend", p, re.S)
        left = sub[1] if sub else ""
        right = re.search(r"the right half is (.*?)\. They blend", p, re.S)
        subject = f"left half {left}, right half {right[1] if right else ''}"
    else:
        subject = (sub[1] if sub else p[:300]).strip().rstrip(".")
    palette = (pal[1].strip().rstrip(".") if pal else "")
    style_key = "room" if entry["mode"] == "room-portrait" else entry["mode"]
    return ", ".join(x for x in (subject, palette, STYLE[style_key]) if x), NEG[style_key]


def plan(entries, only, variants):
    chosen = [e for e in entries if not only or any(o in e["name"] for o in only)]
    counts = {}
    for e in chosen:
        counts[e["mode"]] = counts.get(e["mode"], 0) + 1
    return chosen, counts, len(chosen) * variants


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="v1")
    ap.add_argument("--only", nargs="*", default=[], help="substrings of the prompt file names")
    ap.add_argument("--variants", type=int, default=3)
    ap.add_argument("--seed-base", type=int, default=5741102)
    ap.add_argument("--ckpt", default="DreamShaperXL_Turbo_v2_1.safetensors")
    ap.add_argument("--steps", type=int, default=8)
    ap.add_argument("--guide", type=float, default=2.5)
    ap.add_argument("--refine", action="store_true", help="experimental: 2x img2img refine pass at the final size")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    entries = parse_prompts()
    chosen, counts, total = plan(entries, a.only, a.variants)
    print(f"{len(entries)} prompts in files, {len(chosen)} selected, {total} images ({a.variants} variants); by mode: {counts}")
    if a.dry_run:
        for e in chosen[:3] + chosen[-2:]:
            c, n = compact(e)
            print(f"- {e['name']} [{e['mode']}] {SIZES[e['mode']][0]} -> {SIZES[e['mode']][1]}\n  {c[:200]}...")
        return
    import numpy as np, torch
    from PIL import Image
    from diffusers import StableDiffusionXLPipeline
    out = ROOT / "renders" / f"prompts-{a.tag}"
    out.mkdir(parents=True, exist_ok=True)
    pipe = StableDiffusionXLPipeline.from_single_file(str(ROOT / "models/checkpoints" / a.ckpt), torch_dtype=torch.float16).to("cuda")
    convs = [m for m in list(pipe.unet.modules()) + list(pipe.vae.modules()) if isinstance(m, torch.nn.Conv2d)]
    def circular(on):
        for m in convs:
            m.padding_mode = "circular" if on else "zeros"
    session = None
    def matte(img):
        nonlocal session
        from rembg import new_session, remove
        session = session or new_session("isnet-anime")
        return remove(img.convert("RGB"), session=session, alpha_matting=False)
    def seam(img):
        arr = np.asarray(img.convert("RGB"), dtype=np.float32)
        return round(float((np.abs(arr[:, 0] - arr[:, -1]).mean() + np.abs(arr[0] - arr[-1]).mean()) / 2), 2)
    meta, t0 = {"tag": a.tag, "ckpt": a.ckpt, "steps": a.steps, "guide": a.guide, "images": []}, time.time()
    for e in chosen:
        (w, h), (fw, fh) = SIZES[e["mode"]]
        prompt, neg = compact(e)
        circular(e["mode"] in ("tile", "road"))
        for v in range(a.variants):
            seed = a.seed_base + v
            img = pipe(prompt=prompt, negative_prompt=neg, num_inference_steps=a.steps, guidance_scale=a.guide,
                       width=w, height=h, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
            if e["mode"] == "sprite":
                img = matte(img)
            if img.size != (fw, fh):
                if e["mode"] == "room-portrait":  # keep the aspect: scale to cover, then centre-crop
                    k = max(fw / img.width, fh / img.height)
                    img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
                    left, top = (img.width - fw) // 2, (img.height - fh) // 2
                    img = img.crop((left, top, left + fw, top + fh))
                else:
                    img = img.resize((fw, fh), Image.LANCZOS)
            fn = f"{e['name']}-v{v}.png"
            img.save(out / fn)
            rec = {"file": fn, "name": e["name"], "mode": e["mode"], "seed": seed,
                   "sha256": hashlib.sha256((out / fn).read_bytes()).hexdigest(), "prompt": prompt}
            if e["mode"] in ("tile", "road"):
                rec["seam_error"] = seam(img)
            meta["images"].append(rec)
            print(fn, flush=True)
    # one contact sheet per group (prefix before the first dash) so the owner can pick variants quickly
    groups = {}
    for r in meta["images"]:
        groups.setdefault(r["name"].split("-")[0], []).append(r)
    for g, rows in groups.items():
        cell, cols = 220, 6
        rws = (len(rows) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rws * cell), (70, 50, 90))
        for i, r in enumerate(rows):
            im = Image.open(out / r["file"]).convert("RGBA")
            im.thumbnail((cell - 6, cell - 6))
            sheet.paste(im, ((i % cols) * cell + 3, (i // cols) * cell + 3), im)
        sheet.save(out / f"sheet-{g}.jpg", quality=85)
    (out / "metadata.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    print("GOTOWE:", out, round(time.time() - t0), "s", flush=True)


if __name__ == "__main__":
    main()
