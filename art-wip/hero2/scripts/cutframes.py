# cutframes.py <mp4> <outdir> <i0,i1,...>
import sys, os, cv2
from PIL import Image
from rembg import remove, new_session
mp4, out, idx = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3].split(",")]
os.makedirs(out, exist_ok=True)
cap = cv2.VideoCapture(mp4); frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
s = new_session("birefnet-general")
for n, i in enumerate(idx):
    i = min(i, len(frames) - 1)
    im = Image.fromarray(cv2.cvtColor(frames[i], cv2.COLOR_BGR2RGB))
    remove(im, session=s).save(f"{out}/{n:02d}.png")
print("CUT_DONE", mp4, len(frames))
