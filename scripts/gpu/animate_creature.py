"""Animate a monster from its five painted master views by procedural mesh deformation (no skeleton, no per-frame redraw).
Eight directions: down, down-right, right, up-right, up are rendered; left, down-left, up-left are exact mirrors of right, down-right, up-right.
  /opt/rembg-venv/bin/python animate_creature.py <id> <roster.json> <masters-dir (enemies-masters-<tag>)> [--review]
Output (KI_OUT_ROOT, default /opt/renders): enemy-<id>/<state>/<direction>/<NN>.png  512x512 RGBA, ready for assets:pack --profile=enemy.
Archetypes: blob (hop), quad (trot), crawl (leg shuffle), slither (wave), plant (sway), turret (static), fly (wing flap), hover (float), stomp (heavy step).
"""
import hashlib, json, math, os, sys, time
from pathlib import Path
import cv2, numpy as np

mid = sys.argv[1]; roster = {m["id"]: m for m in json.loads(Path(sys.argv[2]).read_text())["monsters"]}; M = roster[mid]; MAST = Path(sys.argv[3]) / mid
REVIEW = "--review" in sys.argv; ARCH = M["archetype"]; A = M["scale"] / 0.8
OUT = Path(os.environ.get("KI_OUT_ROOT", "/opt/renders")) / ("enemy-%s%s" % (mid, "-review" if REVIEW else "")); SAFE = int(os.environ.get("KI_SAFE", "22"))
meta = json.loads((MAST / "metadata.json").read_text()); GY = float(meta["ground"][1]); LIFT = 409.6 - GY; FLOOR = 409.6
FV = {"down": (0.0, 1.0), "down-right": (.7, .7), "right": (1.0, 0.0), "up-right": (.7, -.7), "up": (0.0, -1.0)}
MIRROR = {"left": "right", "down-left": "down-right", "up-left": "up-right"}
CLIPS = {"idle": (8, 6, True), "walk": (8, 16, True), "attack": (8, 16, False), "skill": (8, 12, False), "hit": (4, 16, False), "death": (8, 10, False), "respawn": (8, 12, False)}
def smooth(p): return p * p * (3 - 2 * p)

class View:
    def __init__(s, name):
        s.name = name; s.fv = FV[name]; img = cv2.imread(str(MAST / (name + ".png")), cv2.IMREAD_UNCHANGED).astype(np.float32); a = img[:, :, 3:4] / 255.0
        s.pm = np.concatenate([img[:, :, :3] * a, img[:, :, 3:4]], axis=2); alpha = (img[:, :, 3] > 8).astype(np.uint8); ys, xs = np.nonzero(alpha); s.x0, s.x1, s.y0, s.y1 = xs.min(), xs.max(), ys.min(), ys.max()
        gx, gy = np.meshgrid(np.arange(0, 513, 8), np.arange(0, 513, 8)); s.W = gx.shape[1]; V = np.stack([gx.ravel(), gy.ravel()], 1).astype(np.float32); dil = cv2.dilate(alpha, np.ones((25, 25), np.uint8))
        keep = dil[np.clip(V[:, 1].astype(int), 0, 511), np.clip(V[:, 0].astype(int), 0, 511)] > 0; tris = []
        for r in range(gx.shape[0] - 1):
            for c in range(s.W - 1):
                i = r * s.W + c; q = [i, i + 1, i + s.W, i + s.W + 1]
                if any(keep[j] for j in q): tris += [(q[0], q[1], q[2]), (q[1], q[3], q[2])]
        s.V = V; s.tris = np.array(tris, np.int32); sol = cv2.dilate(alpha, np.ones((9, 9), np.uint8)); s.solid = sol[np.clip(V[:, 1].astype(int), 0, 511), np.clip(V[:, 0].astype(int), 0, 511)] > 0
        s.u = np.clip((V[:, 0] - s.x0) / max(1, s.x1 - s.x0), 0, 1); s.v = np.clip((V[:, 1] - s.y0) / max(1, s.y1 - s.y0), 0, 1)
        s.legw = np.clip((s.v - .62) / .38, 0, 1); s.wing = np.clip((np.abs(s.u - .5) - .25) / .25, 0, 1) * np.clip((.75 - s.v) / .5, 0, 1)
    def render(s, P, fade=1.0, dark=1.0, bright=1.0, flash=0.0):
        mx = np.full((512, 512), -1, np.float32); my = np.full((512, 512), -1, np.float32)
        for t in s.tris:
            dst = P[t].astype(np.float32); src = s.V[t]; x0, y0 = np.floor(dst.min(0)).astype(int) - 1; x1, y1 = np.ceil(dst.max(0)).astype(int) + 1; x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, 512), min(y1, 512)
            if x1 <= x0 or y1 <= y0: continue
            Aff = cv2.getAffineTransform(dst, src); mask = np.zeros((y1 - y0, x1 - x0), np.uint8); cv2.fillConvexPoly(mask, np.round((dst - [x0, y0]) * 16).astype(np.int32), 255, lineType=cv2.LINE_8, shift=4)
            yy, xx = np.nonzero(mask)
            if len(xx) == 0: continue
            X = xx + x0; Y = yy + y0; mx[Y, X] = Aff[0, 0] * X + Aff[0, 1] * Y + Aff[0, 2]; my[Y, X] = Aff[1, 0] * X + Aff[1, 1] * Y + Aff[1, 2]
        o = cv2.remap(s.pm, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)); a = o[:, :, 3:4]; rgb = np.where(a > 0, o[:, :, :3] / np.maximum(a / 255.0, 1e-3), 0)
        rgb = np.clip(rgb * dark * bright, 0, 255); rgb = rgb * (1 - flash) + 255 * flash; a = a * fade
        return np.clip(np.concatenate([rgb, a], 2), 0, 255).astype(np.uint8)

def frame(v, state, i, n):
    fx, fy = v.fv; sg = fx if abs(fx) > .3 else 1.0; side = abs(fx) > .5; p = i / max(1, n - 1); w = math.tau * i / n; u, vv = v.u, v.v
    tx = ty = rr = 0.0; sx = sy = 1.0; dx = np.zeros_like(u); dy = np.zeros_like(u); fade = dark = bright = 1.0; flash = 0.0; clamp = FLOOR if (ARCH in ("fly", "hover") and state in ("death", "respawn")) else GY
    if state in ("idle", "walk"):
        k = 1.0 if state == "walk" else .35; ww = w * (1 if state == "walk" else 1)
        if ARCH == "blob": h = 20 * A * k * max(0, math.sin(ww)); ty = -h; sy = 1 + .14 * k * math.sin(ww) + (0 if state == "walk" else .03 * math.sin(ww)); sx = 1 - .10 * k * math.sin(ww)
        elif ARCH == "quad": ty = -4 * A * k * abs(math.sin(2 * ww)); rr = .025 * sg * k; dy = -9 * A * k * v.legw * np.maximum(0, np.sin(ww + 4 * math.pi * u)); dx = 6 * A * k * v.legw * (fx if side else 0) * np.sin(ww + 4 * math.pi * u + math.pi / 2); sy = 1 + .012 * math.sin(w)
        elif ARCH == "crawl": ty = -1.5 * A * k * abs(math.sin(4 * ww)); tx = 2 * A * k * math.sin(2 * ww); dy = -5 * A * k * v.legw * np.sin(4 * ww + 8 * math.pi * u)
        elif ARCH == "slither":
            amp = (9 if state == "walk" else 4) * A
            if side: dy = amp * np.sin(math.tau * 1.3 * u - ww)
            else: dx = amp * np.sin(math.tau * 1.3 * vv - ww)
        elif ARCH == "plant": dx = (5 if state == "walk" else 3) * A * (1 - vv) ** 1.5 * math.sin(w); sy = 1 + .02 * math.sin(2 * w)
        elif ARCH == "turret": dx = 1.0 * (1 - vv) * math.sin(4 * w) * (1 if state == "walk" else .3)
        elif ARCH == "fly": ty = -(11 if state == "walk" else 6) * A * math.sin(w); dy = -(16 if state == "walk" else 10) * A * v.wing * np.sin(2 * w + (u > .5) * math.pi) * (1 if not side else .5); rr = .03 * math.sin(w) * k
        elif ARCH == "hover": ty = -(9 if state == "walk" else 6) * A * math.sin(w); sx = 1 + .03 * math.sin(2 * w); sy = 1 - .03 * math.sin(2 * w)
        elif ARCH == "stomp": ty = -6 * A * k * abs(math.sin(ww)); rr = .03 * k * math.sin(ww); dy = -6 * A * k * v.legw * np.maximum(0, np.sin(ww + math.pi * (u > .5))); sy = 1 + .01 * math.sin(w)
    elif state == "attack":
        f = (1 - p) ** 1.3; tx = fx * 30 * A * f; ty = fy * 18 * A * f; rr = -.10 * sg * f * (1 if side else .3)
        if fy > .5: sy = 1 + .16 * f
        if fy < -.5: sy = 1 - .08 * f
        if ARCH == "blob": sx = 1 + .18 * f
        if ARCH in ("hover", "fly"): ty += 14 * A * f; sx = sy = 1 + .08 * f
    elif state == "skill":
        pl = math.sin(math.pi * p); sx = sy = 1 + .14 * pl; ty = -12 * A * pl; bright = 1 + .35 * pl
    elif state == "hit":
        f = 1 - p; tx = -fx * 14 * A * f; ty = -fy * 8 * A * f; sy = 1 - .12 * f; sx = 1 + .06 * f; flash = [.6, .35, .15, 0][i]
    else:
        q = smooth(p) if state == "death" else 1 - smooth(p); d_ = -sg
        if ARCH == "blob": sy = 1 - .62 * q; sx = 1 + .40 * q; fade = 1 - .15 * q; dark = 1 - .25 * q
        elif ARCH == "quad": rr = d_ * (math.pi / 2 - .1) * q if side else (math.pi / 2 - .1) * q; dark = 1 - .15 * q
        elif ARCH == "crawl": rr = (math.pi - .25) * q * (1 if sg >= 0 else -1); dark = 1 - .25 * q
        elif ARCH == "slither": sy = 1 - .55 * q; sx = 1 + .15 * q; dark = 1 - .2 * q; dy = 9 * A * (1 - q) * np.sin(math.tau * 1.3 * u - w) if side else dy
        elif ARCH == "plant": dx = d_ * 18 * A * (1 - vv) ** 1.4 * q; sy = 1 - .45 * q; dark = 1 - .3 * q
        elif ARCH == "turret": rr = .22 * q; sy = 1 - .12 * q; dark = 1 - .5 * q; fade = 1 - .1 * q
        elif ARCH == "fly": ty = LIFT * q; rr = (d_ if side else 1.0) * 1.35 * q; dy = 14 * A * v.wing * q; dark = 1 - .2 * q
        elif ARCH == "hover": ty = LIFT * q; fade = 1 - .55 * q; sx = sy = 1 - .12 * q; dark = 1 - .3 * q
        elif ARCH == "stomp": sy = 1 - .45 * q; sx = 1 + .12 * q; rr = d_ * .25 * q if side else .25 * q; dark = 1 - .35 * q
    X = v.V[:, 0] + dx; Y = v.V[:, 1] + dy; cx, cy = 256.0, GY  # global transform about the ground point
    X = (X - cx) * sx; Y = (Y - cy) * sy; c, s_ = math.cos(rr), math.sin(rr); X, Y = c * X - s_ * Y, s_ * X + c * Y; P = np.stack([X + cx + tx, Y + cy + ty], 1).astype(np.float32)
    low = P[v.solid][:, 1].max()
    if state in ("death", "respawn") or ARCH not in ("fly", "hover"):
        if low > clamp + 2: P[:, 1] -= low - clamp - 2
    return P, fade, dark, bright, flash

views = {n: View(n) for n in FV}; plan = []
for n_, v in views.items():
    for state, (n, fps, loop) in CLIPS.items():
        if REVIEW and state not in ("walk", "attack", "death", "respawn"): continue
        for i in range(n): plan.append((n_, state, i, n, fps, loop) + frame(v, state, i, n))
allv = np.concatenate([p[6][views[p[0]].solid] for p in plan]); dxs = np.abs(allv[:, 0] - 256); top = 409.6 - allv[:, 1]
shrink = min(1.0, (256 - SAFE) / max(dxs.max(), 1), (409.6 - SAFE) / max(top.max(), 1)); print("SHRINK", round(float(shrink), 3), "frames", len(plan), flush=True)
mf = []; bad = []; t0 = time.time(); GR = np.array([256.0, 409.6])
for n_, state, i, n, fps, loop, P, fade, dark, bright, flash in plan:
    Ps = (P - GR) * shrink + GR; img = views[n_].render(Ps, fade, dark, bright, flash)
    for dname, mir in [(n_, False)] + [(k, True) for k, vv in MIRROR.items() if vv == n_]:
        im = cv2.flip(img, 1) if mir else img; d = OUT / state / dname; d.mkdir(parents=True, exist_ok=True); cv2.imwrite(str(d / ("%02d.png" % i)), im)
        x, y, w, h = cv2.boundingRect((im[:, :, 3] > 0).astype(np.uint8)); mf.append(hashlib.sha256(im.tobytes()).hexdigest()[:8])
        if w == 0 or x < 8 or y < 8 or x + w > 504 or y + h > 504: bad.append((state, dname, i, (x, y, w, h)))
(OUT / "report.json").write_text(json.dumps({"id": mid, "archetype": ARCH, "shrink": float(shrink), "violations": bad[:10], "frames": len(mf)}, indent=1)); print("BOUNDS_VIOLATIONS", len(bad), bad[:3], round(time.time() - t0), "s"); print("ENEMY_DONE", mid, flush=True)
