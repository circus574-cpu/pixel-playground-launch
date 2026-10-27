import sys, subprocess, numpy as np
for f in sys.argv[1:]:
    w, h = 360, 640
    raw = subprocess.run(["ffmpeg","-nostdin","-loglevel","error","-i",f,"-vf",f"scale={w}:{h}","-f","rawvideo","-pix_fmt","gray","-"],capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w)
    head, cx, top = [], [], []
    for a in fr:
        m = a < 200 if a.mean() > 128 else a > 60
        ys, xs = np.nonzero(m)
        top.append(ys.min()); hy = ys.min() + 40
        hx = xs[(ys < hy)]; head.append(hx.mean()); cx.append(xs.mean())
    print(f.split("/")[-1], "frames", len(fr), "head_x range %.1f" % (max(head)-min(head)), "body_x range %.1f" % (max(cx)-min(cx)), "top_y range %d" % (max(top)-min(top)))
