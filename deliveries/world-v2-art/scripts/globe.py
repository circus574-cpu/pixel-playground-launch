import json, numpy as np
from PIL import Image
I = json.load(open("world/index.json")); R = I["planet"]["radius"]
feats = {f["feature"]: f for f in I["features"]}
W, H = 4096, 2048
lon = (np.arange(W) + .5) / W * 360 - 180; lat = 90 - (np.arange(H) + .5) / H * 180
LON, LAT = np.meshgrid(np.radians(lon), np.radians(lat))
# ocean base
def vn(sc, seed):
    r = np.random.default_rng(seed).random((H // sc + 2, W // sc + 2)).astype(np.float32)
    return np.asarray(Image.fromarray(r).resize((W + 2 * sc, H + 2 * sc), Image.BICUBIC))[:H, :W]
n = vn(256, 1) * .6 + vn(64, 2) * .3 + vn(16, 3) * .1
out = np.array([18, 52, 100], np.float32) * (.85 + .3 * n[..., None])
for name in ["verdant", "pyra", "aether", "nexus"] + [f"island-{i}" for i in range(1, 7)]:
    f = feats[name]; pf = I["planet"]["features"][name]
    l0, p0 = np.radians(pf["lon"]), np.radians(pf["lat"])
    cosc = np.sin(p0) * np.sin(LAT) + np.cos(p0) * np.cos(LAT) * np.cos(LON - l0)
    c = np.arccos(np.clip(cosc, -1, 1)); k = np.where(c > 1e-9, c / np.sin(np.maximum(c, 1e-9)), 1)
    xp = k * np.cos(LAT) * np.sin(LON - l0); yp = k * (np.cos(p0) * np.sin(LAT) - np.sin(p0) * np.cos(LAT) * np.cos(LON - l0))
    X = f["anchor"]["x"] + xp * R; Y = f["anchor"]["y"] - yp * R
    img = np.asarray(Image.open(f"maps/{name}-map2.jpg").convert("RGB"), np.float32)
    msk = np.load(f"maps/{name}-map2.jpg.mask.npy")[0].astype(np.float32)
    ih, iw = img.shape[:2]; upp = f["width"] / iw
    px = (X / upp).astype(int); py = (Y / upp).astype(int)
    ok = (c < 1.4) & (px >= 0) & (py >= 0) & (px < iw) & (py < ih)
    pxc, pyc = np.clip(px, 0, iw - 1), np.clip(py, 0, ih - 1)
    a = np.clip((msk[pyc, pxc] - .15) / .3, 0, 1) * ok
    out = out * (1 - a[..., None]) + img[pyc, pxc] * a[..., None]
    print(name, "pixels", int(ok.sum()))
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save("maps/globe-equirect.jpg", quality=90)
Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((2048, 1024)).save("qa-shots/globe-small.jpg", quality=85)
