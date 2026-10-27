import subprocess, numpy as np, sys
W,H=180,320
raw=subprocess.run(["ffmpeg","-nostdin","-loglevel","error","-i",sys.argv[1],"-vf",f"scale={W}:{H}","-f","rawvideo","-pix_fmt","gray","-"],capture_output=True).stdout
g=np.frombuffer(raw,np.uint8).reshape(-1,H,W).astype(float)[:, int(H*0.5):]
a=4
print("CYC", " ".join(f"{b}:{np.abs(g[a]-g[b]).mean():.1f}" for b in range(a+8, min(len(g),a+44))))
