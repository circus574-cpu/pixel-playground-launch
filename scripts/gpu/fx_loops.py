"""Turn painted energy VFX stills (gen_world_kit.py fx-<race>, black background) into 8-frame loops for additive blending.

  python3 fx_loops.py <renders dir> <out dir> [seed]
    -> <out>/<race>/<fx>.png (8 x 256 px horizontal strip, RGBA) + <fx>.gif preview
Alpha comes from brightness, so the black background disappears; motion is procedural per effect type.
"""
import glob, math, os, sys
import numpy as np
from PIL import Image, ImageChops

src, out = sys.argv[1], sys.argv[2]
seed = sys.argv[3] if len(sys.argv) > 3 else "7510101"
S, N = 256, 8


def to_rgba(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    alpha = a.max(2)
    alpha = np.clip((alpha - 18) * 1.25, 0, 255)
    rgba = np.dstack([a, alpha]).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    box = img.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox() or (0, 0, im.width, im.height)
    img = img.crop(box)
    side = max(img.size)
    can = Image.new("RGBA", (side, side))
    can.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return can.resize((S, S), Image.LANCZOS)


def place(img, scale=1.0, angle=0.0, alpha=1.0, dx=0, dy=0, sx=None, sy=None):
    w = max(1, int(S * (sx if sx else scale))); h = max(1, int(S * (sy if sy else scale)))
    t = img.resize((w, h), Image.LANCZOS).rotate(angle, resample=Image.BICUBIC, expand=False)
    if alpha < 1:
        t.putalpha(t.getchannel("A").point(lambda v: int(v * alpha)))
    can = Image.new("RGBA", (S, S))
    can.alpha_composite(t, ((S - w) // 2 + dx, (S - h) // 2 + dy)) if w <= S and h <= S else can.paste(
        t.crop(((w - S) // 2, (h - S) // 2, (w - S) // 2 + S, (h - S) // 2 + S)), (0, 0))
    return can


def frames(kind, img):
    fr = []
    for i in range(N):
        p = i / N; s = math.sin(p * 2 * math.pi)
        if kind == "orb":
            fr.append(place(img, 0.92 + 0.08 * s, p * 90))
        elif kind == "comet":
            fr.append(place(img, sx=1.0 + 0.06 * s, sy=0.94 + 0.06 * math.cos(p * 2 * math.pi), alpha=0.85 + 0.15 * s))
        elif kind == "beam":
            fr.append(ImageChops.offset(img, int(p * S), 0))
        elif kind == "impact":
            fr.append(place(img, 0.35 + 0.75 * p, p * 30, alpha=1.0 if p < 0.5 else 1.0 - (p - 0.5) * 1.8))
        elif kind == "ring":
            fr.append(place(img, 0.25 + 0.85 * p, 0, alpha=1.0 - p * 0.9))
        elif kind == "aura":
            fr.append(place(img, sx=0.96 + 0.04 * s, sy=0.98 + 0.06 * math.sin(p * 4 * math.pi), alpha=0.8 + 0.2 * abs(s), dy=int(-4 * s)))
        elif kind == "sparks":
            fr.append(place(img, 0.8 + 0.3 * p, p * 45, alpha=1.0 - p * 0.7))
        elif kind == "charge":
            fr.append(place(img, 1.15 - 0.6 * p, -p * 120, alpha=0.7 + 0.3 * p))
        else:
            fr.append(img)
    return fr


for d in sorted(glob.glob(os.path.join(src, "kit-fx-*-v1-dream"))):
    race = os.path.basename(d).split("kit-fx-")[1].split("-v1-dream")[0]
    os.makedirs(os.path.join(out, race), exist_ok=True)
    for f in sorted(glob.glob(os.path.join(d, "obj-*-s%s.png" % seed))):
        kind = os.path.basename(f)[4:].rsplit("-s", 1)[0]
        fr = frames(kind, to_rgba(f))
        strip = Image.new("RGBA", (S * N, S))
        for i, x in enumerate(fr):
            strip.paste(x, (i * S, 0))
        strip.save(os.path.join(out, race, kind + ".png"), optimize=True)
        prev = [Image.alpha_composite(Image.new("RGBA", (S, S), (20, 24, 32, 255)), x).convert("P") for x in fr]
        prev[0].save(os.path.join(out, race, kind + ".gif"), save_all=True, append_images=prev[1:], duration=80, loop=0)
    print("FX_LOOPS", race, flush=True)
