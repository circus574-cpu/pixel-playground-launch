import base64, json, subprocess, time, os, sys
race, src, normal_rig, out = sys.argv[1:5]
API = "https://api.meshy.ai/openapi/v1/"
os.makedirs(out + "/anims", exist_ok=True); os.makedirs(out + "/normal-anims", exist_ok=True)
def call(method, path, body=None, t=60):
    cmd = ["curl", "-s", "-m", str(t), "-X", method, API + path]
    if body is not None:
        open(out + "/body.json", "w").write(json.dumps(body)); cmd += ["-H", "Content-Type: application/json", "-d", "@" + out + "/body.json"]
    try: return json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)
    except Exception: return {}
start = call("GET", "balance")["balance"]
def spent(): return start - call("GET", "balance")["balance"]
def wait(path, tid, tries=90, step=15):
    for _ in range(tries):
        d = call("GET", f"{path}/{tid}")
        if d.get("status") in ("SUCCEEDED", "FAILED", "CANCELED"): return d
        time.sleep(step)
    return {}
png = open(src, "rb").read()
r = call("POST", "image-to-3d", {"image_url": "data:image/png;base64," + base64.b64encode(png).decode(), "ai_model": "meshy-6", "model_type": "standard", "topology": "triangle", "target_polycount": 200000, "symmetry_mode": "auto", "should_remesh": True, "should_texture": True, "enable_pbr": False, "pose_mode": "a-pose", "remove_lighting": True, "image_enhancement": True}, 120)
m = wait("image-to-3d", r["result"]); print(race, "model", m.get("status"), m.get("task_error"))
if m.get("status") != "SUCCEEDED": sys.exit(1)
subprocess.run(["curl", "-s", "-m", "60", "-o", out + "/thumb.png", m["thumbnail_url"]])
g = call("POST", "rigging", {"input_task_id": r["result"], "height_meters": 1.8})
gd = wait("rigging", g["result"], step=10); print(race, "rig", gd.get("status"), gd.get("task_error"))
if gd.get("status") != "SUCCEEDED": sys.exit(1)
ba = gd["result"]["basic_animations"]
subprocess.run(["curl", "-s", "-m", "400", "-o", out + "/anims/walk.glb", ba["walking_glb_url"]]); subprocess.run(["curl", "-s", "-m", "400", "-o", out + "/anims/run.glb", ba["running_glb_url"]])
want = [("ki", n, a) for n, a in {"idle": 0, "attack": 103, "attack2": 92, "skill": 17, "skillb": 18, "skillc": 19, "finisher": 102, "dodge": 156, "guard": 138, "hit": 178, "hitheavy": 7, "death": 8, "respawn": 3, "victory": 59, "channel": 125, "transform": 51}.items()]
want.append(("normal", "transform", 51))
rigs = {"ki": g["result"], "normal": normal_rig}
tasks = {}
for which, name, aid in want:
    if spent() + 3 > 100: print("STOP: limit at", name); break
    x = call("POST", "animations", {"rig_task_id": rigs[which], "action_id": aid})
    if "result" in x: tasks[(which, name)] = x["result"]
    else: print("submit error", which, name, str(x)[:100])
for (which, name), t in tasks.items():
    d = wait("animations", t, step=5)
    dest = f"{out}/anims/{name}.glb" if which == "ki" else f"{out}/normal-anims/{name}.glb"
    if d.get("status") == "SUCCEEDED": subprocess.run(["curl", "-s", "-m", "400", "-o", dest, d["result"]["animation_glb_url"]])
    else: print(which, name, "failed")
print(race, "animations", len(tasks), "spent", spent())
