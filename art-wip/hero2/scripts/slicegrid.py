# slice 4x2 sprite grid -> 8 cut frames at 128px (shared transform keeps bob/stride), sheet + preview mp4
import sys, os, subprocess, numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
CW, CH, COLS = 384, 512, 4
g = Image.open(src).convert("RGB"); s = None if os.environ.get("KEY") else new_session("birefnet-general")
def clean(c):
    a = np.array(c); al = a[:, :, 3]
    al[: int(al.shape[0] * 0.06)] = 0  # strip feet bleeding in from the row above
    lab, n = ndimage.label(al > 40)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1)); keep = 1 + int(np.argmax(sizes))
        al[(lab != keep) & (lab > 0)] = 0
    a[:, :, 3] = al; return Image.fromarray(a)
def key(c):
    a = np.asarray(c).astype(np.float32); H_, W_ = a.shape[:2]; m = 4
    sm = lambda v: ndimage.uniform_filter1d(v, 41, axis=0)
    top, bot = sm(a[:m].mean(0)), sm(a[-m:].mean(0)); lef, rig = sm(a[:, :m].mean(1)), sm(a[:, -m:].mean(1))
    u = np.linspace(0, 1, W_)[None, :, None]; v = np.linspace(0, 1, H_)[:, None, None]
    c00, c01, c10, c11 = a[:m, :m].mean((0, 1)), a[:m, -m:].mean((0, 1)), a[-m:, :m].mean((0, 1)), a[-m:, -m:].mean((0, 1))
    bg = (1 - v) * top[None] + v * bot[None] + (1 - u) * lef[:, None] + u * rig[:, None] - ((1 - u) * (1 - v) * c00 + u * (1 - v) * c01 + (1 - u) * v * c10 + u * v * c11)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    edge_d = np.concatenate([d[:m].ravel(), d[-m:].ravel(), d[:, :m].ravel(), d[:, -m:].ravel()])
    tol = max(10.0, float(np.percentile(edge_d, 99)) * 1.5)
    cand = d < tol
    lab, n = ndimage.label(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgm = np.isin(lab, list(edge))
    al = np.where(bgm, 0, 255).astype(np.float32)
    al = ndimage.gaussian_filter(al, 0.7)
    return Image.fromarray(np.dstack([np.asarray(c), al.clip(0, 255).astype(np.uint8)]), "RGBA")
crops = [g.crop(((k % COLS) * CW, (k // COLS) * CH, (k % COLS + 1) * CW, (k // COLS + 1) * CH)) for k in range(8)]
if os.environ.get("WHOLE"):
    full = remove(g, session=s)
    cells = [clean(full.crop(((k % COLS) * CW, (k // COLS) * CH, (k % COLS + 1) * CW, (k // COLS + 1) * CH))) for k in range(8)]
else:
    cells = [clean(key(c) if os.environ.get("KEY") else remove(c, session=s)) for c in crops]
H = 122; sc = H / CH; w = int(CW * sc)
frames = []
for c in cells:
    t = c.resize((w, H), Image.LANCZOS); can = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    can.paste(t, ((128 - w) // 2, 128 - H - 2), t); frames.append(can)
for i, f in enumerate(frames): f.save(f"{out}/{i:02d}.png")
sheet = Image.new("RGBA", (128 * 8, 128)); [sheet.paste(f, (i * 128, 0)) for i, f in enumerate(frames)]; sheet.save(f"{out}/sheet.png")
for i, f in enumerate(frames):
    bg = Image.new("RGBA", (128, 128), (92, 120, 70, 255)); bg.alpha_composite(f); bg.convert("RGB").resize((384, 384), Image.NEAREST).save(f"/tmp/sg_{i:02d}.png")
subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-stream_loop", "5", "-framerate", "10", "-i", "/tmp/sg_%02d.png", "-c:v", "libx264", "-pix_fmt", "yuv420p", f"{out}/preview.mp4"])
print("SLICE_OK", out)
