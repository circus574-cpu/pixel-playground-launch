"""BVH -> 2D bone directions for the cut-out rig (no Blender).
  python3 bvh2d.py <file.bvh> <out.json> <mode: punch|kick> [view yaw deg, default 30] [frames, default 8]
Finds the strongest strike (wrist or ankle furthest from the hips), samples 8 frames around it,
projects to a front/three-quarter view and stores per-bone unit directions + hip offset.
"""
import json, math, sys
import numpy as np

path, out, mode = sys.argv[1], sys.argv[2], sys.argv[3]
MIR = float(__import__("os").environ.get("MIR", "1"))
yaw = math.radians(float(sys.argv[4]) if len(sys.argv) > 4 else 30)
NF = int(sys.argv[5]) if len(sys.argv) > 5 else 8
tok = open(path).read().split()
i = 0; joints = []; stack = []
while tok[i] != "MOTION":
    t = tok[i]
    if t in ("ROOT", "JOINT"):
        joints.append({"name": tok[i + 1], "parent": stack[-1] if stack else -1, "ch": [], "off": None}); i += 2; continue
    if t == "End":
        joints.append({"name": "end_" + joints[stack[-1]]["name"], "parent": stack[-1], "ch": [], "off": None}); i += 2; continue
    if t == "{": stack.append(len(joints) - 1); i += 1; continue
    if t == "}": stack.pop(); i += 1; continue
    if t == "OFFSET": joints[stack[-1]]["off"] = np.array([float(x) for x in tok[i + 1:i + 4]]); i += 4; continue
    if t == "CHANNELS":
        n = int(tok[i + 1]); joints[stack[-1]]["ch"] = tok[i + 2:i + 2 + n]; i += 2 + n; continue
    i += 1
nfr = int(tok[i + 2]); ft = float(tok[i + 5]); vals = np.array(tok[i + 6:], float)
nch = sum(len(j["ch"]) for j in joints); data = vals[: nfr * nch].reshape(nfr, nch)

def R(axis, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return {"X": np.array([[1, 0, 0], [0, c, -s], [0, s, c]]), "Y": np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]]),
            "Z": np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])}[axis]

def fk(row):
    pos = {}; rot = {}; k = 0
    for idx, j in enumerate(joints):
        local = np.eye(3); trans = j["off"].copy()
        for c in j["ch"]:
            v = row[k]; k += 1
            if c.endswith("position"): trans["XYZ".index(c[0])] = v if j["parent"] < 0 else trans["XYZ".index(c[0])]
            else: local = local @ R(c[0], v)
        if j["parent"] < 0: rot[idx] = local; pos[idx] = trans
        else:
            p = j["parent"]; rot[idx] = rot[p] @ local; pos[idx] = pos[p] + rot[p] @ j["off"]
    return {joints[n]["name"]: pos[n] for n in pos}

name = {"hip": "Hips", "lhip": "LeftUpLeg", "lkn": "LeftLeg", "lank": "LeftFoot", "rhip": "RightUpLeg", "rkn": "RightLeg", "rank": "RightFoot",
        "lsh": "LeftArm", "lel": "LeftForeArm", "lwr": "LeftHand", "rsh": "RightArm", "rel": "RightForeArm", "rwr": "RightHand", "neck": "Neck"}
P = [fk(data[f]) for f in range(nfr)]
P = [{k: p[v] for k, v in name.items()} for p in P]
# facing: character's left vector (rhip->lhip) at frame 0; forward = up x left ... rotate so forward faces the camera (-Z), then yaw
def face_frame(p):
    left = p["lhip"] - p["rhip"]; left[1] = 0; left /= np.linalg.norm(left) + 1e-9
    fwd = np.cross(left, [0, 1, 0]); return math.atan2(fwd[0], fwd[2])
dists = []
for p in P:
    ends = ("lwr", "rwr") if mode == "punch" else ("lank", "rank")
    base = p["neck"] if mode == "punch" else p["hip"]
    dists.append(max(np.linalg.norm((p[e] - base)[[0, 2]]) for e in ends) if mode == "punch" else max(p[e][1] for e in ends) - min(p[e][1] for e in ends))
dists[:150] = [0] * 150; peak = int(np.argmax(dists)); half = int(0.45 / ft)
lo, hi = max(0, peak - half), min(nfr - 1, peak + half)
idx = [int(round(lo + (hi - lo) * k / (NF - 1))) for k in range(NF)]
ang = face_frame(P[idx[0]])
def proj(v, h0):
    v = v - h0; c, s = math.cos(-ang + math.pi + yaw), math.sin(-ang + math.pi + yaw)
    x = c * v[0] + s * v[2]; return np.array([MIR * x, -v[1]])
h0 = P[idx[0]]["hip"].copy()
BONES = {"rua": ("rsh", "rel"), "rfa": ("rel", "rwr"), "lua": ("lsh", "lel"), "lfa": ("lel", "lwr"),
         "rth": ("rhip", "rkn"), "rsn": ("rkn", "rank"), "lth": ("lhip", "lkn"), "lsn": ("lkn", "lank")}
legl = np.linalg.norm(P[idx[0]]["lhip"] - P[idx[0]]["lank"])
frames = []
for f in idx:
    p = {k: proj(v, h0) for k, v in P[f].items()}
    d = {b: ((p[e] - p[s]) / (np.linalg.norm(p[e] - p[s]) + 1e-9)).tolist() for b, (s, e) in BONES.items()}
    frames.append({"dir": d, "hip": (p["hip"] / legl).tolist(), "src": f})
json.dump({"file": path, "mode": mode, "peak": peak, "frames": frames}, open(out, "w"))
print("BVH2D", path, "frames", nfr, "peak", peak, "window", lo, hi)
