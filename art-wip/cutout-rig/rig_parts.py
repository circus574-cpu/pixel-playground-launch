"""Rig from a painted parts sheet (Gemini, front view): matte each part, assemble at joints, animate with mocap directions.
  python3 rig_parts.py <sheet.jpg> <mocap.json> <out prefix>
"""
import json, math, subprocess, sys
import numpy as np, cv2
from PIL import Image

sheet = cv2.cvtColor(cv2.imread(sys.argv[1]), cv2.COLOR_BGR2RGB)
MOC = json.load(open(sys.argv[2]))["frames"]
out = sys.argv[3]

def cut(x0, y0, x1, y1):
    """part RGBA: background = region flood-filled from the box border (near-white, low saturation)"""
    rgb = sheet[y0:y1, x0:x1].copy(); h, w = rgb.shape[:2]
    f = rgb.astype(np.float32); bright = f.min(2); sat = f.max(2) - f.min(2)
    bgc = (bright > 215) & (sat < 22)
    lab_n, lab = cv2.connectedComponents(bgc.astype(np.uint8), connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = (~bg).astype(np.uint8)
    n, l2, st, _ = cv2.connectedComponentsWithStats(fg, 8)
    keep = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); fg = (l2 == keep).astype(np.float32)
    a = cv2.GaussianBlur(fg, (5, 5), 0) * 255
    return np.dstack([rgb, a.astype(np.uint8)]), np.array([x0, y0], float)

# parts: box on the sheet + joints in sheet coordinates (a = parent joint, b = child joint)
P = {}
def part(name, box, a, b):
    img, o = cut(*box); P[name] = {"img": img, "o": o, "a": np.array(a, float), "b": np.array(b, float)}

part("torso", (472, 465, 995, 1127), (733, 1100), (733, 490))           # waist -> neck
part("head", (541, 15, 938, 457), (738, 440), (738, 60))
part("rua", (39, 788, 351, 1060), (175, 820), (165, 1045))              # right upper arm (screen left)
part("rfa", (39, 1030, 351, 1471), (165, 1045), (160, 1440))
part("lua", (1148, 765, 1463, 1045), (1285, 800), (1300, 1030))
part("lfa", (1148, 1015, 1463, 1456), (1300, 1030), (1310, 1420))
part("rth", (313, 1141, 680, 1825), (520, 1170), (470, 1790))
part("lth", (755, 1157, 1113, 1837), (920, 1185), (960, 1800))
part("rsn", (181, 1873, 532, 2528), (335, 1960), (330, 2420))
part("lsn", (894, 1896, 1209, 2531), (1045, 1980), (1050, 2440))
part("rpad", (0, 323, 460, 767), (330, 560), (330, 560))
part("lpad", (1024, 317, 1465, 765), (1140, 560), (1140, 560))
part("sash", (1163, 1482, 1611, 2354), (1270, 1515), (1270, 1515))

# skeleton in output space: torso placed as on the sheet, children snapped to parents
T = P["torso"]
J = {"waist": T["a"], "neck": T["b"], "rsh": np.array([470, 600.]), "lsh": np.array([1000, 600.]),
     "rhip": np.array([640, 1105.]), "lhip": np.array([830, 1105.])}
Lb = {k: np.linalg.norm(P[k]["b"] - P[k]["a"]) for k in P}
CW, CH = 1500, 2700; OFF = np.array([0, 60.])

def put(can, name, a1, b1):
    p = P[name]; a0, b0 = p["a"], p["b"]
    d0 = b0 - a0; d1 = b1 - a1
    ang = 0.0 if np.linalg.norm(d0) < 1 or np.linalg.norm(d1) < 1 else math.atan2(d1[1], d1[0]) - math.atan2(d0[1], d0[0])
    c, s = math.cos(ang), math.sin(ang)
    M = np.array([[c, -s, 0], [s, c, 0]], float)
    M[:, 2] = (a1 + OFF) - M[:, :2] @ (a0 - p["o"])
    w = cv2.warpAffine(p["img"], M, (CW, CH), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0)).astype(float)
    al = w[:, :, 3:4] / 255.0
    can[:, :, :3] = can[:, :, :3] * (1 - al) + w[:, :, :3] * al
    can[:, :, 3:4] = np.maximum(can[:, :, 3:4], w[:, :, 3:4])

def frame(F):
    legL = Lb["rth"] + Lb["rsn"]
    off = np.array(F["hip"]) * legL; off[0] = 0
    off[1] = (off[1] - HIP0) * 1.6
    D = {k: np.array(v) for k, v in F["dir"].items()}
    for k, side in (("rua", -1), ("rfa", -1), ("lua", 1), ("lfa", 1)):
        x, y = D[k]; ang = math.atan2(x, y)                     # 0 = straight down
        ang = max(-0.10, min(0.30, ang * side)) * side if True else ang
        D[k] = np.array([math.sin(ang), math.cos(ang)])
    j = {k: v + off for k, v in J.items()}
    j["rel"] = j["rsh"] + D["rua"] * Lb["rua"]; j["rwr"] = j["rel"] + D["rfa"] * Lb["rfa"]
    j["lel"] = j["lsh"] + D["lua"] * Lb["lua"]; j["lwr"] = j["lel"] + D["lfa"] * Lb["lfa"]
    j["rkn"] = j["rhip"] + D["rth"] * Lb["rth"]; j["rank"] = j["rkn"] + D["rsn"] * Lb["rsn"]
    j["lkn"] = j["lhip"] + D["lth"] * Lb["lth"]; j["lank"] = j["lkn"] + D["lsn"] * Lb["lsn"]
    can = np.zeros((CH, CW, 4), float)
    for nm, a, b in (("rsn", "rkn", "rank"), ("lsn", "lkn", "lank"), ("rth", "rhip", "rkn"), ("lth", "lhip", "lkn")):
        put(can, nm, j[a], j[b])
    put(can, "torso", j["waist"], j["neck"])
    sway = (math.atan2(*D["rth"][::-1]) + math.atan2(*D["lth"][::-1])) / 2 - math.pi / 2
    sp = j["waist"] + np.array([0, -30.]); put(can, "sash", sp, sp + np.array([math.sin(-sway * 0.8), math.cos(-sway * 0.8)]) * 100)
    put(can, "head", j["neck"] - np.array([0, 15.]), j["neck"] - np.array([0, 15 + Lb["head"]]))
    for nm, a, b in (("rua", "rsh", "rel"), ("rfa", "rel", "rwr"), ("lua", "lsh", "lel"), ("lfa", "lel", "lwr")):
        put(can, nm, j[a], j[b])
    put(can, "rpad", j["rsh"] + np.array([10, -30.]), j["rsh"] + np.array([10, -30.]))
    put(can, "lpad", j["lsh"] + np.array([-10, -30.]), j["lsh"] + np.array([-10, -30.]))
    return Image.fromarray(can.clip(0, 255).astype(np.uint8), "RGBA")

HIP0 = float(np.mean([f["hip"][1] for f in MOC])) * (Lb["rth"] + Lb["rsn"])
frames = [frame(F) for F in MOC]
big = []
for f in frames:
    bg = Image.new("RGBA", f.size, (92, 120, 70, 255)); bg.alpha_composite(f)
    g = bg.convert("RGB"); g = g.crop(g.getbbox()); g.thumbnail((360, 650)); big.append(g)
W = max(g.width for g in big); H = max(g.height for g in big)
strip = Image.new("RGB", (W * len(big), H), (92, 120, 70))
for i, g in enumerate(big):
    strip.paste(g, (i * W, H - g.height)); c = Image.new("RGB", (W, H), (92, 120, 70)); c.paste(g, ((W - g.width) // 2, H - g.height)); c.save(f"/tmp/rp_{i:02d}.png")
strip.save(out + "-strip.jpg", quality=88)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "5", "-framerate", "8", "-i", "/tmp/rp_%02d.png",
                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", out + ".mp4"])
print("RIG_OK", out)
