"""Watch finished Wan jobs, pick frames per motion, cut background (CPU), write frames + a contact sheet."""
import os, glob, time, cv2, numpy as np
from PIL import Image
from rembg import remove, new_session
PICK = {"walk": list(range(0, 32, 4)), "run": list(range(0, 40, 5)), "punch": [int(i * 72 / 7) for i in range(8)],
        "kick": [int(i * 76 / 7) for i in range(8)], "spin": [int(i * 76 / 7) for i in range(8)], "dodge": [int(i * 76 / 7) for i in range(8)]}
Q = "/workspace/hero2/queue"; s = new_session("birefnet-general", providers=["CPUExecutionProvider"])
while True:
    for done in sorted(glob.glob(Q + "/*.done")):
        if os.path.exists(done + ".pp"): continue
        src, mp4 = open(done.replace(".done", ".done")).read().split()[:2] if False else (None, None)
        name = os.path.basename(done)[:-5].split("-", 1)[1]           # race-motion-dir
        race, motion, d = name.split("-")
        mp4 = f"/workspace/hero2/{race}/wan/{motion}-{d}.mp4"
        cap = cv2.VideoCapture(mp4); fr = []
        while True:
            ok, f = cap.read()
            if not ok: break
            fr.append(f)
        out = f"/workspace/hero2/{race}/frames/{motion}-{d}"; os.makedirs(out, exist_ok=True)
        cuts = []
        for n, i in enumerate(PICK[motion]):
            im = Image.fromarray(cv2.cvtColor(fr[min(i, len(fr) - 1)], cv2.COLOR_BGR2RGB))
            c = remove(im, session=s); c.save(f"{out}/{n:02d}.png"); cuts.append(c)
        th = [c.resize((c.width // 4, c.height // 4)) for c in cuts]
        sheet = Image.new("RGB", (sum(t.width for t in th), th[0].height), (70, 90, 60)); x = 0
        for t in th: sheet.paste(t, (x, 0), t); x += t.width
        sheet.save(f"{out}/sheet.jpg", quality=80)
        open(done + ".pp", "w").write("ok"); print("PP_DONE", name, len(fr), flush=True)
    time.sleep(20)
