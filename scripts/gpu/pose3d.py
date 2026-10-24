"""Procedural 3D humanoid pose animation projected to OpenPose keypoints for the eight game directions.

One 3D skeleton drives all races and all directions, so limb motion is real (a leg swings, a knee bends, the
body falls), instead of deforming a painted picture. Output: keypoints per clip/direction/frame in the same
normalised 1024-canvas convention as `keypoints.json` of the painted views (standing pose = the accepted rig).

  python3 pose3d.py [out.json]          writes {clip: {direction: [ {keypoint: [x, y]} * frames ]}}
  python3 pose3d.py --sheet out.png     contact sheet of skeletons (review)

Camera: high-angle (elevation E), orthographic; feet of the standing pose stay on the anchor line.
Contract (docs/GPU_ASSET_PIPELINE.md): idle 8, walk 8, attack 8, skill 8, hit 4, death 8, respawn 8; the
contact frame of attack and skill is frame 0.
"""
import json, math, sys
import numpy as np

E = 0.45  # camera elevation (rad); matches the high-angle painted masters
COSE, SINE = math.cos(E), math.sin(E)
DIRS = ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"]
YAW = {"down": 0, "down-left": -45, "left": -90, "up-left": -135, "up": 180, "up-right": 135, "right": 90, "down-right": 45}
CLIPS = {"idle": 8, "walk": 8, "attack": 8, "skill": 8, "hit": 4, "death": 8, "respawn": 8}
ORDER = ["nose", "neck", "r_sho", "r_elb", "r_wri", "l_sho", "l_elb", "l_wri", "r_hip", "r_kne", "r_ank",
         "l_hip", "l_kne", "l_ank", "r_eye", "l_eye", "r_ear", "l_ear"]
A_Y = 0.757  # ankle line of the standing pose (canvas y)

# rest pose of the accepted rig (front view keypoints), converted to body units (Y up from the ankle)
def yb(y):
    return (A_Y - y) / COSE


REST = {  # side sign: r = -1 (character's right is screen-left when facing the viewer), l = +1
    "hip_x": 0.061, "hip_y": yb(0.411), "knee_y": yb(0.593), "knee_x": 0.086, "ank_x": 0.109,
    "sho_x": 0.105, "sho_y": yb(0.237), "elb_x": 0.139, "elb_y": yb(0.334), "wri_x": 0.155, "wri_y": yb(0.472),
    "neck_y": yb(0.192), "nose_y": yb(0.169), "eye_y": yb(0.156), "ear_y": yb(0.126),
}
HIP = np.array([REST["hip_x"], REST["hip_y"], 0.0])
L_THIGH = math.hypot(REST["hip_x"] - REST["knee_x"], REST["hip_y"] - REST["knee_y"])
L_SHIN = math.hypot(REST["knee_x"] - REST["ank_x"], REST["knee_y"])
UARM = np.array([REST["elb_x"] - REST["sho_x"], REST["elb_y"] - REST["sho_y"], 0.0])
FARM = np.array([REST["wri_x"] - REST["elb_x"], REST["wri_y"] - REST["elb_y"], 0.0])
L_UARM, L_FARM = np.linalg.norm(UARM), np.linalg.norm(FARM)
PELVIS_Y = REST["hip_y"]


def rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


D = math.radians


def smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def pose_default():
    return {"root": np.zeros(3), "lean": 0.0, "roll": 0.0, "twist": 0.0, "pelvis_twist": 0.0, "pitch": 0.0,
            "head": [0.0, 0.0], "ground": True,
            "legs": {"l": {"swing": 0.0, "abd": 0.0, "knee": 0.0}, "r": {"swing": 0.0, "abd": 0.0, "knee": 0.0}},
            "arms": {"l": {"swing": 0.0, "abd": 0.0, "elbow": 0.0, "twist": 0.0},
                     "r": {"swing": 0.0, "abd": 0.0, "elbow": 0.0, "twist": 0.0}}}


def fk(p):
    """3D joints in body space (facing +Z, right of the character at -X, Y up). Returns dict of np arrays."""
    Rb = rx(p["pitch"]) @ rz(p["roll"])  # whole body tilt about the pelvis
    Rp = Rb @ ry(p["pelvis_twist"])
    Rc = Rb @ ry(p["twist"]) @ rx(p["lean"])  # chest
    pel = np.array([0.0, PELVIS_Y, 0.0])
    J = {}
    for side, sx in (("r", -1), ("l", 1)):
        leg, arm = p["legs"][side], p["arms"][side]
        hip = pel + Rp @ np.array([sx * REST["hip_x"], 0, 0])
        Rt = Rp @ rz(sx * leg["abd"]) @ rx(leg["swing"])
        knee = hip + Rt @ np.array([sx * (REST["knee_x"] - REST["hip_x"]) / 1.0, -L_THIGH * 0.98, 0.0]) * 1.0
        # keep the rest lateral offset only at rest: use a straight vector scaled to the bone length
        v = np.array([sx * (REST["knee_x"] - REST["hip_x"]), REST["knee_y"] - REST["hip_y"], 0.0])
        v = v / np.linalg.norm(v) * L_THIGH
        knee = hip + Rt @ v
        Rs = Rt @ rx(-leg["knee"])  # knee flexes the shin backwards
        w = np.array([sx * (REST["ank_x"] - REST["knee_x"]), -REST["knee_y"], 0.0])
        w = w / np.linalg.norm(w) * L_SHIN
        ank = knee + Rs @ w
        J[side + "_hip"], J[side + "_kne"], J[side + "_ank"] = hip, knee, ank
        sho = pel + Rc @ np.array([sx * REST["sho_x"], REST["sho_y"] - PELVIS_Y, 0.0])
        Ra = Rc @ rz(sx * arm["abd"]) @ rx(arm["swing"]) @ ry(sx * arm["twist"])
        u = np.array([sx * UARM[0], UARM[1], 0.0])
        elb = sho + Ra @ u
        Rf = Ra @ rx(-arm["elbow"])
        f = np.array([sx * FARM[0], FARM[1], 0.0])
        wri = elb + Rf @ f
        J[side + "_sho"], J[side + "_elb"], J[side + "_wri"] = sho, elb, wri
    neck = pel + Rc @ np.array([0.0, REST["neck_y"] - PELVIS_Y, 0.0])
    Rh = Rc @ ry(p["head"][0]) @ rx(p["head"][1])
    J["neck"] = neck
    J["nose"] = neck + Rh @ np.array([0.0, REST["nose_y"] - REST["neck_y"], 0.05])
    J["r_eye"] = neck + Rh @ np.array([-0.019, REST["eye_y"] - REST["neck_y"], 0.04])
    J["l_eye"] = neck + Rh @ np.array([0.019, REST["eye_y"] - REST["neck_y"], 0.04])
    J["r_ear"] = neck + Rh @ np.array([-0.055, REST["ear_y"] - REST["neck_y"], -0.005])
    J["l_ear"] = neck + Rh @ np.array([0.055, REST["ear_y"] - REST["neck_y"], -0.005])
    return J


def place(J, root, ground):
    """Translate: keep the lowest ankle on the ground line unless the clip is airborne/lying."""
    if ground:
        low = min(J["r_ank"][1], J["l_ank"][1])
        off = np.array([0.0, -low, 0.0])
    else:
        off = np.zeros(3)
    return {k: v + off + root for k, v in J.items()}


def project(J, direction):
    R = ry(D(YAW[direction]))
    out = {}
    for k, v in J.items():
        w = R @ v
        out[k] = [0.5 + w[0], A_Y - w[1] * COSE + w[2] * SINE]
    return out


# ----------------------------------------------------------------------------------------------- clips
def clip_pose(name, i, n):
    p = pose_default()
    t = i / n
    A = p["arms"]
    L = p["legs"]
    if name == "idle":
        b = math.sin(2 * math.pi * t)
        p["root"] = np.array([0.0, 0.004 * b, 0.0])
        p["lean"] = D(1.5) * b
        A["l"].update(swing=D(-6) + D(2) * b, abd=D(10), elbow=D(22))
        A["r"].update(swing=D(-6) - D(2) * b, abd=D(10), elbow=D(22))
        p["head"] = [D(2) * math.sin(2 * math.pi * t + 1), 0.0]
        L["l"]["knee"] = D(4) + D(2) * b
        L["r"]["knee"] = D(4) - D(2) * b
        L["l"]["abd"] = D(2)
        L["r"]["abd"] = D(2)
    elif name == "walk":
        ph = 2 * math.pi * t
        s = math.sin(ph)
        for side, sg in (("l", 1), ("r", -1)):
            q = ph + (0 if sg > 0 else math.pi)
            L[side]["swing"] = D(30) * math.sin(q)
            L[side]["knee"] = D(8) + D(46) * max(0.0, math.sin(q + math.pi / 2)) ** 1.5
            A[side].update(swing=-D(26) * math.sin(q), abd=D(8), elbow=D(30) + D(14) * max(0.0, -math.sin(q)))
        p["root"] = np.array([0.0, 0.012 * abs(math.cos(ph)) - 0.006, 0.0])
        p["twist"] = D(7) * s
        p["pelvis_twist"] = -D(5) * s
        p["lean"] = D(5)
        p["head"] = [-D(3) * s, 0.0]
    elif name == "attack":  # frame 0 = contact of a straight strike with the right arm, then recovery to guard
        k = i / (n - 1)
        ext = 1.0 - smooth(k * 1.6)  # strike extension fades out
        back = smooth(max(0.0, k - 0.45) / 0.55)  # return to guard
        A["r"].update(swing=D(95) * ext - D(10) * back, abd=D(8), elbow=D(8) * ext + D(75) * (1 - ext), twist=0.0)
        A["l"].update(swing=-D(35) * ext + D(25) * (1 - ext), abd=D(20), elbow=D(95))
        p["twist"] = -D(28) * ext + D(6) * (1 - ext)
        p["pelvis_twist"] = -D(12) * ext
        p["lean"] = D(14) * ext + D(5) * (1 - ext)
        L["r"].update(swing=-D(18) * ext, knee=D(10) + D(14) * ext)
        L["l"].update(swing=D(28) * ext, knee=D(8) + D(22) * ext)
        L["l"]["abd"] = D(6)
        L["r"]["abd"] = D(6)
        p["root"] = np.array([0.0, -0.012 * ext, 0.03 * ext])
        p["head"] = [D(4) * ext, -D(4) * ext]
    elif name == "skill":  # frame 0 = release: both palms thrown forward; ki surge then relax
        k = i / (n - 1)
        ext = 1.0 - smooth(k * 1.5)
        rel = smooth(max(0.0, k - 0.5) / 0.5)
        for side in "lr":
            A[side].update(swing=D(88) * ext + D(15) * (1 - ext) * (1 - rel), abd=D(14) * ext + D(18) * (1 - ext),
                           elbow=D(10) * ext + D(70) * (1 - ext))
        p["lean"] = D(10) * ext
        p["pitch"] = 0.0
        L["l"].update(swing=D(22) * ext, knee=D(12) + D(14) * ext)
        L["r"].update(swing=-D(16) * ext, knee=D(8) + D(10) * ext)
        L["l"]["abd"] = D(6)
        L["r"]["abd"] = D(6)
        p["root"] = np.array([0.0, -0.01 * ext, 0.02 * ext])
        p["head"] = [0.0, -D(5) * ext]
    elif name == "hit":
        k = i / (n - 1)
        r = 1.0 - smooth(k)  # strongest at the first frame
        p["lean"] = -D(16) * r
        p["pitch"] = -D(4) * r
        p["head"] = [0.0, D(18) * r]
        A["l"].update(swing=D(30) * r - D(6), abd=D(32) * r + D(10), elbow=D(30) + D(20) * r)
        A["r"].update(swing=D(18) * r - D(6), abd=D(38) * r + D(10), elbow=D(30) + D(30) * r)
        L["l"].update(swing=-D(14) * r, knee=D(10) + D(18) * r)
        L["r"].update(swing=D(10) * r, knee=D(8) + D(10) * r)
        p["root"] = np.array([0.0, -0.012 * r, -0.04 * r])
    elif name in ("death", "respawn"):
        k = i / (n - 1)
        if name == "respawn":
            k = 1.0 - k
        stag = smooth(min(1.0, k * 2.2))  # stagger and kneel
        fall = smooth(max(0.0, (k - 0.35) / 0.65))  # topple onto the back
        p["pitch"] = -D(88) * fall - D(10) * stag
        p["lean"] = -D(10) * stag
        p["head"] = [0.0, D(20) * stag]
        A["l"].update(swing=D(50) * stag, abd=D(20) + D(50) * fall, elbow=D(45) * (1 - fall) + D(20))
        A["r"].update(swing=D(30) * stag, abd=D(24) + D(40) * fall, elbow=D(60) * (1 - fall) + D(15))
        L["l"].update(swing=-D(35) * stag * (1 - fall) + D(5) * fall, knee=D(30) * stag + D(35) * (1 - fall) * stag)
        L["r"].update(swing=D(20) * stag * (1 - fall), knee=D(60) * stag * (1 - fall) + D(10))
        L["l"]["abd"] = D(5) + D(10) * fall
        L["r"]["abd"] = D(5) + D(14) * fall
        p["ground"] = False
        # root: lowers while kneeling, ends lying with the back on the ground
        p["root"] = np.array([0.0, 0.0, -0.10 * fall])
        p["_k"] = (stag, fall)
    return p


def frames(name, direction):
    n = CLIPS[name]
    out = []
    for i in range(n):
        p = clip_pose(name, i, n)
        J = fk(p)
        if p["ground"]:
            J = place(J, p["root"], True)
        else:
            stag, fall = p["_k"]
            # keep body parts above the ground: lowest point of the whole skeleton rests on the line
            low = min(v[1] for v in J.values())
            J = {k: v + np.array([0.0, -low + 0.02 * (1 - fall), 0.0]) + p["root"] for k, v in J.items()}
        out.append(project(J, direction))
    return out


def all_keypoints():
    return {c: {d: frames(c, d) for d in DIRS} for c in CLIPS}


def sheet(path, size=140):
    from PIL import Image, ImageDraw
    LIMBS = [("neck", "r_sho"), ("neck", "l_sho"), ("r_sho", "r_elb"), ("r_elb", "r_wri"), ("l_sho", "l_elb"),
             ("l_elb", "l_wri"), ("neck", "r_hip"), ("neck", "l_hip"), ("r_hip", "l_hip"), ("r_hip", "r_kne"),
             ("r_kne", "r_ank"), ("l_hip", "l_kne"), ("l_kne", "l_ank"), ("neck", "nose")]
    cols = 8
    rows = sum(1 for _ in CLIPS) * 1
    # one row per clip, direction "down-left" + "right" first/last frames laid out across 8 columns
    img = Image.new("RGB", (cols * size, len(CLIPS) * 3 * size), "black")
    d = ImageDraw.Draw(img)
    r = 0
    for c, n in CLIPS.items():
        for direction in ("down", "left", "up-right"):
            fr = frames(c, direction)
            for i in range(cols):
                kp = fr[min(i, n - 1)] if n >= cols else fr[int(i * n / cols)]
                ox, oy = i * size, r * size
                d.rectangle((ox, oy, ox + size - 1, oy + size - 1), outline=(40, 40, 40))
                for a, b in LIMBS:
                    d.line([ox + kp[a][0] * size, oy + kp[a][1] * size, ox + kp[b][0] * size, oy + kp[b][1] * size], fill=(255, 190, 0), width=2)
                for k, (x, y) in kp.items():
                    d.ellipse([ox + x * size - 2, oy + y * size - 2, ox + x * size + 2, oy + y * size + 2], fill=(0, 200, 255))
                d.line([ox, oy + A_Y * size, ox + size, oy + A_Y * size], fill=(60, 60, 60))
            d.text((4, r * size + 3), "%s %s" % (c, direction), fill=(255, 255, 255))
            r += 1
    img.save(path)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--sheet":
        sheet(sys.argv[2])
    else:
        out = sys.argv[1] if len(sys.argv) > 1 else "pose3d-keypoints.json"
        json.dump(all_keypoints(), open(out, "w"))
        print("OK", out)
