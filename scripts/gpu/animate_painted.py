"""Animate painted base views by 2D skeletal mesh deformation (linear blend skinning), no per-frame redraw.
Each of the eight painted masters (512x512 RGBA, feet at 256,486.4) is skinned to a 2D skeleton projected from the rig
keypoints; the clips are procedural. Output: 512x512 RGBA frames {state}-{direction}-{NN}.png + json, fixed anchor and
one global shrink factor so that no frame crosses the 8px margin.
  /opt/rembg-venv/bin/python animate_painted.py <race> <masters-dir> <painted-dir-with-keypoints> <out-tag> [--review]
"""
import hashlib, json, math, sys, time
from pathlib import Path
import cv2, numpy as np

race, MAST, KPDIR, TAG = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4]
REVIEW = "--review" in sys.argv
OUT = Path("/workspace/ki-legends-gpu/renders") / ("%s-painted-motion-%s%s" % (race, TAG, "-review" if REVIEW else "")); OUT.mkdir(parents=True, exist_ok=True)
DIRS = ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"]
FACING = {"down": 0, "down-left": -.7, "left": -1, "up-left": -.7, "up": 0, "up-right": .7, "right": 1, "down-right": .7}
CLIPS = {"idle": (8, 6, True), "walk": (8, 16, True), "attack": (8, 16, False), "skill": (8, 12, False), "hit": (4, 16, False), "death": (8, 10, False), "respawn": (8, 12, False)}
ANCHOR = np.array([256.0, 486.4])
meta_m = json.loads((MAST / "metadata.json").read_text()); kp_all = json.loads((KPDIR / "keypoints.json").read_text())

def rotm(theta, c):  # positive = clockwise on screen (y down), about point c
    ct, st = math.cos(theta), math.sin(theta)
    return np.array([[ct, -st, c[0] - ct * c[0] + st * c[1]], [st, ct, c[1] - st * c[0] - ct * c[1]], [0, 0, 1.0]])
def transl(x, y): return np.array([[1, 0, x], [0, 1, y], [0, 0, 1.0]])
def smooth(p): return p * p * (3 - 2 * p)
def seg_dist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-6), 0, 1); return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)

class Hero:
    def __init__(self, d):
        v = next(x for x in meta_m["views"] if x["direction"] == d); self.d = d; self.f = FACING[d]
        self.img = cv2.imread(str(MAST / v["file"]), cv2.IMREAD_UNCHANGED).astype(np.float32); a = self.img[:, :, 3:4] / 255.0
        self.pm = np.concatenate([self.img[:, :, :3] * a, self.img[:, :, 3:4]], axis=2)  # premultiplied
        k = {n: (np.array(p) * 1024 - np.array(v["src_bbox"][:2])) * v["scale"] + np.array(v["place"]) for n, p in kp_all[d].items()}
        pel = (k["l_hip"] + k["r_hip"]) / 2; hc = (k["l_ear"] + k["r_ear"]) / 2
        J = {"pelvis": pel, "neck": k["neck"], "headtop": k["neck"] + (hc - k["neck"]) * 1.9}
        self.joints = k; self.pelvis = pel; self.feet = (k["l_ank"] + k["r_ank"]) / 2; self.feet[1] = ANCHOR[1] - 8
        self.bones = {"torso": (pel, k["neck"], None), "head": (k["neck"], J["headtop"], "torso")}
        for s, S in (("L", "l"), ("R", "r")):
            self.bones["uarm" + s] = (k[S + "_sho"], k[S + "_elb"], "torso"); self.bones["farm" + s] = (k[S + "_elb"], k[S + "_wri"], "uarm" + s)
            self.bones["hand" + s] = (k[S + "_wri"], k[S + "_wri"] + (k[S + "_wri"] - k[S + "_elb"]) * .55, "farm" + s)
            self.bones["thigh" + s] = (k[S + "_hip"], k[S + "_kne"], None); self.bones["shin" + s] = (k[S + "_kne"], k[S + "_ank"], "thigh" + s)
            self.bones["foot" + s] = (k[S + "_ank"], k[S + "_ank"] + (k[S + "_ank"] - k[S + "_kne"]) * .3, "shin" + s)
        alpha = (self.img[:, :, 3] > 8).astype(np.uint8); ys, xs = np.nonzero(cv2.dilate(alpha, np.ones((25, 25), np.uint8)))
        self.step = 8; gx, gy = np.meshgrid(np.arange(0, 513, self.step), np.arange(0, 513, self.step)); self.shape = gx.shape
        V = np.stack([gx.ravel(), gy.ravel()], 1).astype(np.float32); dil = cv2.dilate(alpha, np.ones((25, 25), np.uint8))
        keep = dil[np.clip(V[:, 1].astype(int), 0, 511), np.clip(V[:, 0].astype(int), 0, 511)] > 0
        tris = []; W = self.shape[1]
        for r in range(self.shape[0] - 1):
            for c in range(W - 1):
                i = r * W + c; q = [i, i + 1, i + W, i + W + 1]
                if any(keep[j] for j in q): tris += [(q[0], q[1], q[2]), (q[1], q[3], q[2])]
        solid = cv2.dilate(alpha, np.ones((9, 9), np.uint8)); self.solid = solid[np.clip(V[:, 1].astype(int), 0, 511), np.clip(V[:, 0].astype(int), 0, 511)] > 0  # vertices on the character, used for the margin fit
        self.V = V; self.tris = np.array(tris, dtype=np.int32); names = list(self.bones)
        D = np.stack([seg_dist(V, np.array(self.bones[n][0]), np.array(self.bones[n][1])) for n in names], 1)
        sig = np.array([22 if n in ("torso",) else 14 if n.startswith(("head",)) else 10 for n in names])
        Wt = np.exp(-(D / sig) ** 2) + 1e-4; Wt[:, names.index("torso")] += .03
        self.W = Wt / Wt.sum(1, keepdims=True); self.names = names
        below = np.clip((V[:, 1] - pel[1]) / 120.0, 0, 1); self.cloth = below * (1 - np.exp(-(np.min(D[:, [names.index(n) for n in names if n.startswith(('thigh', 'shin'))]], axis=1) / 18) ** 2) * 0.5)
    def mats(self, ang, root):
        M = {}
        for n in self.names:
            h, _, par = self.bones[n]; R = rotm(ang.get(n, 0.0), h); M[n] = (M[par] if par else (root if n == "torso" else root)) @ R
        return M
    def pose(self, root, ang, sway, phase):
        M = self.mats(ang, root); Vh = np.concatenate([self.V, np.ones((len(self.V), 1), np.float32)], 1)
        out = np.zeros_like(self.V)
        for i, n in enumerate(self.names): out += self.W[:, i:i + 1] * (Vh @ M[n].T)[:, :2]
        out[:, 0] += sway * self.cloth * np.sin(phase + self.V[:, 1] / 55.0); return out
    def render(self, P):
        mx = np.full((512, 512), -1, np.float32); my = np.full((512, 512), -1, np.float32)
        for t in self.tris:
            dst = P[t].astype(np.float32); src = self.V[t]; x0, y0 = np.floor(dst.min(0)).astype(int) - 1; x1, y1 = np.ceil(dst.max(0)).astype(int) + 1
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, 512), min(y1, 512)
            if x1 <= x0 or y1 <= y0: continue
            A = cv2.getAffineTransform(dst, src); mask = np.zeros((y1 - y0, x1 - x0), np.uint8)
            cv2.fillConvexPoly(mask, np.round((dst - [x0, y0]) * 16).astype(np.int32), 255, lineType=cv2.LINE_8, shift=4)
            yy, xx = np.nonzero(mask)
            if len(xx) == 0: continue
            X = xx + x0; Y = yy + y0; mx[Y, X] = A[0, 0] * X + A[0, 1] * Y + A[0, 2]; my[Y, X] = A[1, 0] * X + A[1, 1] * Y + A[1, 2]
        out = cv2.remap(self.pm, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        a = out[:, :, 3:4]; rgb = np.where(a > 0, out[:, :, :3] / np.maximum(a / 255.0, 1e-3), 0)
        return np.clip(np.concatenate([rgb, a], 2), 0, 255).astype(np.uint8)

def pose_params(h, state, i, n):
    f = h.f; a = max(abs(f), .3); sgn = 1 if f >= 0 else -1; ang = {}; tx = ty = 0.0; rr = 0.0; sway = 3.0; t = i / n; p = i / max(1, n - 1); w = math.tau * t
    def fwd(name, amount): ang[name] = ang.get(name, 0.0) - (f if f else 1) * amount * (1 if f else 0.0) + (0 if f else amount * .0)
    def swing(name, amount):  # forward rotation of a limb hanging down; front/back views swing little
        ang[name] = ang.get(name, 0.0) - (f * amount if f else 0.0)
    if state == "idle":
        ty = 2 * math.sin(w); ang["head"] = .02 * math.sin(w); ang["uarmL"] = .03 * math.sin(w); ang["uarmR"] = -.03 * math.sin(w); sway = 3.5
    elif state == "walk":
        for s, ph in (("L", 0), ("R", math.pi)):
            q = w + ph; swing("thigh" + s, .55 * a * math.sin(q)); swing("shin" + s, -.9 * a * max(0, math.cos(q)) + 0.0)
            ang["thigh" + s] += (.12 if f == 0 else 0) * math.sin(q) * (1 if s == "L" else -1)
            swing("uarm" + s, -.40 * a * math.sin(q)); swing("farm" + s, .25 * a * (1 + math.cos(q)) * -1)
        ty = -4 * a * abs(math.sin(w)) - (3 if f == 0 else 0) * abs(math.sin(w)); rr = .05 * f; sway = 6 * (.4 + a)
    elif state in ("attack", "skill"):
        force = (1 - p) ** 1.4; sway = 5
        if state == "attack":
            swing("uarmR", -1.45 * force * max(a, .4)); swing("farmR", -.35 * force); swing("uarmL", .25 * force); ang["torso"] = ang.get("torso", 0) - .12 * force * (f if f else 1) * (1 if f else .3); tx = f * 10 * force; ty = 3 * force * (1 if f == 0 else 0)
            if f == 0: ang["uarmR"] = ang.get("uarmR", 0) - (.9 if h.d == "down" else -.9) * force
        else:
            for s in "LR": swing("uarm" + s, -2.2 * force * max(a, .5)); swing("farm" + s, -.3 * force)
            if f == 0:
                ang["uarmL"] = ang.get("uarmL", 0) + 1.6 * force; ang["uarmR"] = ang.get("uarmR", 0) - 1.6 * force
            ty = -3 * force
    elif state == "hit":
        force = math.sin((p * .8 + .2) * math.pi) * (1 - p); tx = -f * 12 * force; ang["torso"] = -.15 * force * (f if f else 1) * (1 if f else .4); ang["head"] = -.2 * force * (f if f else 1) * (1 if f else .3); sway = 4
    elif state in ("death", "respawn"):
        q = smooth(p) if state == "death" else 1 - smooth(p); fall = (math.pi / 2 - .12) * q; rr = (-f if f else 1.0) * fall
        for s in "LR": swing("thigh" + s, -.45 * math.sin(min(1, q * 2) * math.pi / 2) * a); swing("shin" + s, .9 * math.sin(min(1, q * 2) * math.pi / 2) * a)
        for s in "LR": swing("uarm" + s, -.5 * q * a)
        sway = 2
    return ang, tx, ty, rr, sway, w

def frames_for(h):
    for state, (n, fps, loop) in CLIPS.items():
        if REVIEW and (state not in ("walk", "attack", "death", "respawn") or h.d not in ("down", "right")): continue
        for i in range(n):
            ang, tx, ty, rr, sway, w = pose_params(h, state, i, n)
            root = transl(tx, ty) @ rotm(rr, h.feet)
            P = h.pose(root, ang, sway, w)
            if state in ("death", "respawn"):  # lie on the ground line and stay centred while falling
                p = i / max(1, n - 1); q = smooth(p) if state == "death" else 1 - smooth(p); Q = P[h.solid]
                P = P + np.array([(256 - (Q[:, 0].min() + Q[:, 0].max()) / 2) * q, min(0.0, ANCHOR[1] - Q[:, 1].max())], np.float32)
            yield state, i, n, fps, loop, P

heroes = {d: Hero(d) for d in DIRS if not REVIEW or d in ("down", "right")}
plan = []
for d, h in heroes.items():
    for state, i, n, fps, loop, P in frames_for(h): plan.append((d, state, i, n, fps, loop, P))
worst = max(((np.abs(P[heroes[d].solid] - heroes[d].V[heroes[d].solid]).max(), d, s, i) for d, s, i, n, fps, loop, P in plan))
print("WORST_DISPLACEMENT", round(float(worst[0]), 1), worst[1:], flush=True)
allv = np.concatenate([P[heroes[d].solid] for d, *_, P in plan]); dx = allv[:, 0] - ANCHOR[0]; dy = allv[:, 1] - ANCHOR[1]
fit = [1.0]
for lo, hi, arr, anc in ((8 - ANCHOR[0], 504 - ANCHOR[0], dx, 0), (8 - ANCHOR[1], 504 - ANCHOR[1], dy, 0)):
    pos = arr[arr > 1e-6]; neg = arr[arr < -1e-6]
    if len(pos): fit.append(hi / pos.max())
    if len(neg): fit.append(lo / neg.min())
shrink = min(fit); print("SHRINK", round(shrink, 4), "frames", len(plan), "fit parts", [round(float(v), 3) for v in fit], flush=True)
if shrink < 0.9:
    for d, s, i, n, fps, loop, P in plan:
        Q = P[heroes[d].solid] - ANCHOR; lo, hi = Q.min(0), Q.max(0)
        if lo[0] < -248 or hi[0] > 248 or lo[1] < -478.4 or hi[1] > 17.6: print("OVER", d, s, i, [round(float(v)) for v in lo], [round(float(v)) for v in hi], flush=True)
meta = {"race": race, "masters": str(MAST), "shrink": shrink, "frames": []}; t0 = time.time(); bad = []
for d, state, i, n, fps, loop, P in plan:
    Ps = (P - ANCHOR) * shrink + ANCHOR; img = heroes[d].render(Ps); name = "%s-%s-%02d" % (state, d, i)
    cv2.imwrite(str(OUT / (name + ".png")), img); sha = hashlib.sha256((OUT / (name + ".png")).read_bytes()).hexdigest()
    bb = cv2.boundingRect((img[:, :, 3] > 8).astype(np.uint8)); x0, y0, w, hh = bb
    if w == 0 or x0 < 8 or y0 < 8 or x0 + w > 504 or y0 + hh > 504: bad.append((name, bb))
    m = {"id": name, "state": state, "direction": d, "index": i, "fps": fps, "loop": loop, "width": 512, "height": 512, "origin": [.5, .95], "world_canvas": [128, 128], "sha256": sha, "bounds": [x0, y0, x0 + w, y0 + hh], "status": "painted-mesh-review-not-installed"}
    (OUT / (name + ".json")).write_text(json.dumps(m, indent=1)); meta["frames"].append(m)
    if i == n - 1: print("CLIP", state, d, round(time.time() - t0, 1), "s", flush=True)
(OUT / "motion.manifest").write_text(json.dumps(meta, indent=1)); print("BOUNDS_VIOLATIONS", len(bad), bad[:3]); print("PAINTED_MOTION_DONE", len(plan), flush=True)
