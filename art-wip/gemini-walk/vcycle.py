import glob, subprocess, sys, numpy as np, cv2
from PIL import Image
import os, json as _j
fs = sorted(glob.glob(os.environ.get("SRC", "gv") + "/*.png"))
SEG = _j.loads(os.environ["SEG"]) if "SEG" in os.environ else {"front": (2, 78), "back": (82, 156), "side": (180, 238)}
def cutout(rgb):
    f = rgb.astype(np.float32); bgc = (f.min(2) > 225) & ((f.max(2) - f.min(2)) < 25)
    n, lab = cv2.connectedComponents(bgc.astype(np.uint8), connectivity=4)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(edge))
    sizes = np.bincount(lab.ravel())
    holes = bgc & ~np.isin(lab, list(edge)) & (sizes[lab] > 40) & (f.min(2) > 238)
    fg = (fg & ~holes).astype(np.uint8)
    n2, l2, st, _ = cv2.connectedComponentsWithStats(fg, 8); big = 1 + np.argsort(st[1:, 4])[::-1]
    m = np.zeros_like(fg)
    for k in big[:6]:
        if st[k, 4] > 0.05 * st[big[0], 4]: m |= (l2 == k).astype(np.uint8)
    a = cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0) * 255
    return np.dstack([rgb, a.astype(np.uint8)])
for name, (s0, s1) in SEG.items():
    imgs = [np.asarray(Image.open(fs[i]).convert("RGB")) for i in range(s0, s1 + 1)]
    cut = [cutout(x) for x in imgs]
    # per-frame silhouettes aligned by bottom-centre of the feet
    sil = []
    for c in cut:
        ys, xs = np.nonzero(c[:, :, 3] > 128); sil.append((xs.mean(), ys.max(), ys.min()))
    small = [cv2.resize(c[:, :, 3], (128, 72)).astype(float) for c in cut]
    best = None
    for L in range(12, min(44, len(cut) - 2)):
        for a in range(0, len(cut) - L):
            d = np.abs(small[a] - small[a + L]).mean()
            if best is None or d < best[0]: best = (d, a, L)
    d, a, L = best
    idx = [a + round(k * L / 8) for k in range(8)]
    H = max(s[1] - s[2] for s in sil) * 1.08
    frames = []
    for k in idx:
        c = cut[k]; cx, by, ty = sil[k]
        sc = 120 / H; img = Image.fromarray(c)
        img = img.resize((int(img.width * sc), int(img.height * sc)), Image.LANCZOS)
        can = Image.new("RGBA", (128, 128)); can.alpha_composite(img, (int(64 - cx * sc), int(124 - by * sc)))
        frames.append(can)
    strip = Image.new("RGBA", (128 * 8, 128)); [strip.paste(f, (i * 128, 0)) for i, f in enumerate(frames)]
    strip.save(f"co/{os.environ.get("PREFIX", "gv")}-{name}-sheet.png")
    for i, f in enumerate(frames):
        bg = Image.new("RGBA", (128, 128), (92, 120, 70, 255)); bg.alpha_composite(f); bg.convert("RGB").resize((384, 384), Image.NEAREST).save(f"/tmp/gv_{i:02d}.png")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "6", "-framerate", "10", "-i", "/tmp/gv_%02d.png", "-c:v", "libx264", "-pix_fmt", "yuv420p", f"co/{os.environ.get("PREFIX", "gv")}-{name}.mp4"])
    print(name, "loop", a, L, "diff", round(d, 2))
