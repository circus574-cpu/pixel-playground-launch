import sys, subprocess, numpy as np
for f in sys.argv[1:]:
    raw = subprocess.run(["ffmpeg","-nostdin","-loglevel","error","-i",f,"-vf","scale=180:320","-f","rawvideo","-pix_fmt","gray","-"],capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1,320,180)
    nz = [(a > 30).sum() for a in fr]
    print("POSE", f.split("/")[-3], "frames", len(fr), "min", min(nz), "median", int(np.median(nz)))
