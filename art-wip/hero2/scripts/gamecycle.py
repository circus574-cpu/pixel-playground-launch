# game-ready walk cycle: find loop, pick 8 frames, cut bg, stabilize on torso, 128px
import sys, subprocess, numpy as np, os
from PIL import Image
from rembg import remove, new_session
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
W, H = 360, 640
raw = subprocess.run(["ffmpeg","-nostdin","-loglevel","error","-i",src,"-vf",f"scale={W}:{H}","-f","rawvideo","-pix_fmt","rgb24","-"],capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
g = fr.mean(3)
legs = g[:, int(H*0.55):, :]
a = 4; best = min(range(a+20, len(fr)), key=lambda b: np.abs(legs[a]-legs[b]).mean())
cyc = int(os.environ.get("CYC", best - a)); best = a + cyc; print("cycle", a, best, cyc)
idx = [a + round(i*cyc/8) for i in range(8)]
s = new_session("birefnet-general")
from scipy import ndimage
def clean(rgb, c):
    a = np.array(c); al = a[:, :, 3].astype(np.int32)
    white = (rgb.min(2) > 238) & (al > 0)
    lab, n = ndimage.label(white)
    near = ndimage.binary_dilation(al < 20, iterations=2)
    for k in range(1, n + 1):
        comp = lab == k
        if (comp & near).any() or comp.sum() > 400: al[comp] = 0
    a[:, :, 3] = al.astype(np.uint8); return Image.fromarray(a)
cuts = [clean(fr[i], remove(Image.fromarray(fr[i]), session=s)) for i in idx]
boxes = [c.getbbox() for c in cuts]
x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
# torso center per frame for stabilization
cs = []
for c, b in zip(cuts, boxes):
    al = np.array(c)[:, :, 3]; top = b[1]; hh = b[3]-b[1]
    band = al[top+int(hh*0.15):top+int(hh*0.45)]
    cs.append(np.nonzero(band > 128)[1].mean())
ref = np.mean(cs); side = max(x1-x0, y1-y0) + 20
frames = []
for c, cx in zip(cuts, cs):
    dx = int(round(ref - cx))
    can = Image.new("RGBA", (side, side), (0,0,0,0))
    can.paste(c.crop((x0, y0, x1, y1)), ((side-(x1-x0))//2 + dx, side-(y1-y0)-6))
    t = can.resize((128,128), Image.LANCZOS); frames.append(t)
for i, t in enumerate(frames): t.save(f"{out}/{i:02d}.png")
sheet = Image.new("RGBA", (128*8, 128), (0,0,0,0))
for i, t in enumerate(frames): sheet.paste(t, (i*128, 0))
sheet.save(f"{out}/sheet.png")
# preview mp4: 3x nearest on grass-ish bg, 10 fps, 4 loops
for i, t in enumerate(frames):
    bg = Image.new("RGBA", (128,128), (92,120,70,255)); bg.alpha_composite(t)
    bg.convert("RGB").resize((384,384), Image.NEAREST).save(f"/tmp/gc_{i:02d}.png")
subprocess.run(["ffmpeg","-nostdin","-y","-loglevel","error","-stream_loop","5","-framerate","10","-i","/tmp/gc_%02d.png","-c:v","libx264","-pix_fmt","yuv420p",f"{out}/preview.mp4"])
print("GC_OK", idx)
