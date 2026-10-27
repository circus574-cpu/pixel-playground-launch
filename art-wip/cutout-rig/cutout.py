"""CPU cut-out rig proof: split a front master into limb layers (rigid parts, hidden torso filled by inpainting),
then animate with a 2-bone IK leg solver and layered compositing. No image warping.
  python3 cutout.py <cut.png> <kp.json> <out_prefix>
"""
import json, math, sys
import numpy as np, cv2
from PIL import Image

img = np.array(Image.open(sys.argv[1]).convert("RGBA"))
H, W = img.shape[:2]
kp = [np.array([k[0] * W, k[1] * H]) if k else None for k in json.load(open(sys.argv[2]))]
out = sys.argv[3]
J = {"neck": kp[1], "rsh": kp[2], "rel": kp[3], "rwr": kp[4], "lsh": kp[5], "lel": kp[6], "lwr": kp[7],
     "rhip": kp[8], "rkn": kp[9], "rank": kp[10], "lhip": kp[11], "lkn": kp[12], "lank": kp[13]}
alpha = img[:, :, 3] > 40

def capsule(a, b, r, extend=0.0):
    m = np.zeros((H, W), np.uint8)
    d = b - a; a2 = a - d * 0.08; b2 = b + d * extend
    cv2.line(m, tuple(int(v) for v in a2), tuple(int(v) for v in b2), 255, int(2 * r))
    return (m > 0) & alpha

limbW = W * 0.075
PARTS = {  # name: (joint a, joint b, radius, extend past b)
    "rua": ("rsh", "rel", limbW, 0.0), "rfa": ("rel", "rwr", limbW * 0.95, 0.35),
    "lua": ("lsh", "lel", limbW, 0.0), "lfa": ("lel", "lwr", limbW * 0.95, 0.35),
    "rth": ("rhip", "rkn", limbW * 1.15, 0.0), "rsn": ("rkn", "rank", limbW * 1.05, 0.30),
    "lth": ("lhip", "lkn", limbW * 1.15, 0.0), "lsn": ("lkn", "lank", limbW * 1.05, 0.30),
}
masks = {k: capsule(J[a], J[b], r, e) for k, (a, b, r, e) in PARTS.items()}
# lower segments take priority over upper ones where they overlap
for up, lo in (("rua", "rfa"), ("lua", "lfa"), ("rth", "rsn"), ("lth", "lsn")):
    masks[up] &= ~masks[lo]
def largest(m, min_frac=0.0):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    if n <= 1: return m
    keep = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    return lab == keep
# shoulder pads / armour stay on the torso: cut a disc around each shoulder out of the upper arm
SHR = float(__import__("os").environ.get("SHR", "1.7"))
for arm, sh in (("rua", "rsh"), ("lua", "lsh")):
    disc = np.zeros((H, W), np.uint8); cv2.circle(disc, tuple(int(v) for v in J[sh]), int(limbW * SHR), 255, -1)
    masks[arm] &= disc == 0
masks = {k: largest(m) for k, m in masks.items()}
limbs = np.zeros((H, W), bool)
for m in masks.values(): limbs |= m

def layer(m):
    m2 = (cv2.dilate(m.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0) & alpha  # overlap hides joint seams
    L = np.zeros_like(img); L[m2] = img[m2]
    L[:, :, 3] = cv2.GaussianBlur(L[:, :, 3], (3, 3), 0); return L

layers = {k: layer(m) for k, m in masks.items()}
# cape / loose cloth below the hips outside the legs: its own layer, swings with the thighs
hipY = (J["rhip"][1] + J["lhip"][1]) / 2
yy, xx = np.mgrid[0:H, 0:W]
outside = (xx > J["lhip"][0] + W * 0.06) | (xx < J["rhip"][0] - W * 0.06)
cape = alpha & ~limbs & (yy > hipY + H * 0.03) & outside
cape = largest(cape) if cape.sum() > 0.004 * H * W else np.zeros_like(cape)
CAPE_SIDE = "l" if cape.any() and xx[cape].mean() > (J["lhip"][0] + J["rhip"][0]) / 2 else "r"
CAPE_PIVOT = J[CAPE_SIDE + "hip"].copy()
capeL = layer(cape) if cape.any() else None
limbs |= cape
# torso/head: everything else; holes left by the limbs inside the body silhouette are inpainted
body = img.copy(); hole = limbs.copy()
hull = cv2.dilate((alpha & ~limbs).astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
fill = hole & hull
rgb = cv2.inpaint(body[:, :, :3].copy(), fill.astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
bm = largest((alpha & ~limbs) | fill)
bm = cv2.morphologyEx(bm.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
body[:, :, :3] = rgb; body[:, :, 3] = np.where(bm, 255, 0).astype(np.uint8)
body[:, :, 3] = cv2.GaussianBlur(body[:, :, 3], (3, 3), 0)
L = {k: np.linalg.norm(J[b] - J[a]) for k, (a, b, _, _) in PARTS.items()}

def place(dst, src, a0, b0, a1, b1):
    """rigid transform (rotation + translation, no stretch) taking rest bone a0->b0 to posed a1->b1"""
    ang = math.atan2(*(b1 - a1)[::-1]) - math.atan2(*(b0 - a0)[::-1])
    c, s = math.cos(ang), math.sin(ang)
    M = np.array([[c, -s, 0], [s, c, 0]], np.float64)
    M[:, 2] = a1 - M[:, :2] @ a0
    warped = cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    a = warped[:, :, 3:4] / 255.0
    dst[:, :, :3] = dst[:, :, :3] * (1 - a) + warped[:, :, :3] * a
    dst[:, :, 3:4] = np.maximum(dst[:, :, 3:4], warped[:, :, 3:4])

def ik(hip, foot, l1, l2, bend):
    """2-bone IK: knee position for given hip and foot targets; bend = +1/-1 picks the side"""
    d = foot - hip; dist = min(np.linalg.norm(d), l1 + l2 - 1e-3)
    ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
    base = math.atan2(d[1], d[0]); a = base + bend * math.acos(max(-1, min(1, ca)))
    return hip + np.array([math.cos(a), math.sin(a)]) * l1

def frame(t, motion):
    s = math.sin(2 * math.pi * t)
    P = {k: v.copy() for k, v in J.items()}; dy = 0.0
    if motion == "walk":
        dy = -0.008 * H * abs(s)
        for side, hip, kn, ank in ((1, "rhip", "rkn", "rank"), (-1, "lhip", "lkn", "lank")):
            lift = max(0.0, side * s)
            foot = J[ank] + np.array([0, -0.06 * H * lift])  # planted foot stays on the ground (IK)
            P[hip] = J[hip] + np.array([0, dy])
            P[kn] = ik(P[hip], foot, L["rth" if side == 1 else "lth"], L["rsn" if side == 1 else "lsn"], side * 0.0 + (1 if side == 1 else -1))
            P[ank] = foot
        for side, sh, el, wr in ((1, "rsh", "rel", "rwr"), (-1, "lsh", "lel", "lwr")):
            sw = -side * s * 0.25
            P[sh] = J[sh] + np.array([0, dy]); P[el] = P[sh] + rot(J[el] - J[sh], sw * (1 if sh == "rsh" else -1))
            P[wr] = P[el] + rot(J[wr] - J[el], sw * 1.4 * (1 if sh == "rsh" else -1))
    elif motion == "idle":
        dy = -0.004 * H * (s + 1)
        for k in ("rsh", "lsh"): P[k] = J[k] + np.array([0, dy])
        for side, sh, el, wr in ((1, "rsh", "rel", "rwr"), (-1, "lsh", "lel", "lwr")):
            P[el] = P[sh] + rot(J[el] - J[sh], side * 0.04 * s); P[wr] = P[el] + rot(J[wr] - J[el], side * 0.06 * s)
    elif motion.startswith("mocap"):
        M = MOC[int(round(t * len(MOC))) % len(MOC)]
        legL = (np.linalg.norm(J["lhip"] - J["lkn"]) + np.linalg.norm(J["lkn"] - J["lank"]))
        off = np.array(M["hip"]) * legL; off[0] *= 0.25; dy = off[1]
        for k in ("rsh", "lsh", "rhip", "lhip", "neck"): P[k] = J[k] + off
        for bone, (a, b) in (("rua", ("rsh", "rel")), ("rfa", ("rel", "rwr")), ("lua", ("lsh", "lel")), ("lfa", ("lel", "lwr")),
                             ("rth", ("rhip", "rkn")), ("rsn", ("rkn", "rank")), ("lth", ("lhip", "lkn")), ("lsn", ("lkn", "lank"))):
            P[b] = P[a] + np.array(M["dir"][bone]) * L[bone]
        P["_off"] = off
    elif motion == "punch":
        a = math.sin(math.pi * t) ** 2
        P["rel"] = J["rsh"] + rot(J["rel"] - J["rsh"], 1.2 * a); P["rwr"] = P["rel"] + rot(J["rwr"] - J["rel"], 1.6 * a)
        P["lel"] = J["lsh"] + rot(J["lel"] - J["lsh"], -0.35 * a); P["lwr"] = P["lel"] + rot(J["lwr"] - J["lel"], -0.9 * a)
    can = np.zeros((H, W, 4), np.float64)
    if capeL is not None:
        th = "lth" if CAPE_SIDE == "l" else "rth"; a, b = PARTS[th][0], PARTS[th][1]
        d0 = J[b] - J[a]; d1 = P[b] - P[a]
        ang = (math.atan2(d1[1], d1[0]) - math.atan2(d0[1], d0[0])) * 0.6
        piv = P[a]; tip = CAPE_PIVOT + np.array([0, 50.0])
        place(can, capeL, CAPE_PIVOT, tip, piv, piv + rot(tip - CAPE_PIVOT, ang))
    # back to front: legs, torso, arms
    for k, (a, b, _, _) in PARTS.items():
        if k[1:] in ("th", "sn"): place(can, layers[k], J[a], J[b], P[a], P[b])
    ox = P["_off"][0] if "_off" in P else 0.0
    M = np.float64([[1, 0, ox], [0, 1, dy]])
    tb = cv2.warpAffine(body, M, (W, H), borderValue=(0, 0, 0, 0)); a = tb[:, :, 3:4] / 255.0
    can[:, :, :3] = can[:, :, :3] * (1 - a) + tb[:, :, :3] * a; can[:, :, 3:4] = np.maximum(can[:, :, 3:4], tb[:, :, 3:4])
    for k, (a, b, _, _) in PARTS.items():
        if k[1:] in ("ua", "fa"): place(can, layers[k], J[a], J[b], P[a], P[b])
    return Image.fromarray(can.clip(0, 255).astype(np.uint8), "RGBA")

def rot(v, ang):
    c, s = math.cos(ang), math.sin(ang); return np.array([c * v[0] - s * v[1], s * v[0] + c * v[1]])

MOC = None
motions = ("idle", "walk", "punch")
if len(sys.argv) > 4:
    MOC = json.load(open(sys.argv[4]))["frames"]; motions = ("mocap-" + sys.argv[5],)
for motion in motions:
    frames = [frame(i / 8, motion) for i in range(8)]
    big = []
    for f in frames:
        bg = Image.new("RGBA", (W, H), (92, 120, 70, 255)); bg.alpha_composite(f)
        g = bg.convert("RGB"); g.thumbnail((360, 640)); big.append(g)
    strip = Image.new("RGB", (big[0].width * 8, big[0].height))
    for i, g in enumerate(big): strip.paste(g, (i * g.width, 0))
    strip.save(f"{out}-{motion}-strip.jpg", quality=88)
    for i, g in enumerate(big): g.save(f"/tmp/co_{i:02d}.png")
    import subprocess
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "5", "-framerate", "8", "-i", "/tmp/co_%02d.png",
                    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", f"{out}-{motion}.mp4"])
    print("OK", motion)
