"""Animations of the individual skills (normal form only): one Meshy library motion per active/ultimate skill. 3 credits each, hard cap 27 per race."""
import json, subprocess, sys, time, os
API = "https://api.meshy.ai/openapi/v1/"
BASE = os.path.dirname(os.path.abspath(__file__))
RIGS = {"legend": "01a1e82a-257a-7076-97bf-6cc9e6f97f18", "planetary": "01a1e8e1-f7e7-71a6-a9bf-77b1e5105a3f", "sage": "01a1e8cd-dbd1-73ad-8fa8-29c55ee8d2b4", "android": "01a1e894-7f75-778c-8bcf-2dc0dedd16c3"}
PLAN = {
    "legend":    {"A1": 105, "A4": 97,  "A9": 91,  "B1": 128, "B4": 88,  "B9": 101, "C1": 127, "C4": 100, "C9": 132},
    "planetary": {"A1": 158, "A4": 100, "A9": 87,  "B1": 127, "B4": 94,  "B9": 128, "C1": 31,  "C4": 143, "C9": 27},
    "sage":      {"A1": 129, "A4": 130, "A9": 131, "B1": 144, "B4": 133, "B9": 134, "C1": 54,  "C4": 41,  "C9": 135},
    "android":   {"A1": 95,  "A4": 104, "A9": 98,  "B1": 145, "B4": 90,  "B9": 89,  "C1": 126, "C4": 172, "C9": 26},
}
CAP = 27
race = sys.argv[1]
out = f"{BASE}/{race}"; os.makedirs(out, exist_ok=True)
def call(method, path, body=None):
    cmd = ["curl", "-s", "-m", "60", "-X", method, API + path]
    if body is not None:
        open(out + "/body.json", "w").write(json.dumps(body)); cmd += ["-H", "Content-Type: application/json", "-d", "@" + out + "/body.json"]
    try: return json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)
    except Exception: return {}
assert len(set(PLAN[race].values())) == 9
tasks, spent = {}, 0
for sid, aid in PLAN[race].items():
    if os.path.exists(f"{out}/sk_{sid}.glb") and os.path.getsize(f"{out}/sk_{sid}.glb") > 1000: continue   # already delivered (and paid)
    if spent + 3 > CAP: print("STOP cap"); break
    x = call("POST", "animations", {"rig_task_id": RIGS[race], "action_id": aid})
    if "result" in x: tasks[sid] = (x["result"], aid); spent += 3
    else: print(race, "submit error", sid, aid, str(x)[:120])
old = json.load(open(out + "/tasks.json")) if os.path.exists(out + "/tasks.json") else {}
old.update(tasks); json.dump(old, open(out + "/tasks.json", "w"))
for sid, (tid, aid) in tasks.items():
    for _ in range(120):
        d = call("GET", f"animations/{tid}")
        if d.get("status") in ("SUCCEEDED", "FAILED", "CANCELED"): break
        time.sleep(5)
    if d.get("status") == "SUCCEEDED":
        subprocess.run(["curl", "-s", "-m", "400", "-o", f"{out}/sk_{sid}.glb", d["result"]["animation_glb_url"]])
    else: print(race, sid, "failed", d.get("status"), d.get("task_error"))
print(race, "submitted", len(tasks), "credits counted", spent)
