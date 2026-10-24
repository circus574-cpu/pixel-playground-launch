import sys,glob,numpy as np
from PIL import Image,ImageFilter
from scipy import ndimage
n_ok=0
for d in sys.argv[1:]:
  for f in glob.glob(d+"/*-edge.png"):
    im=Image.open(f).convert("RGB");a=np.asarray(im).astype(np.float32);H,W,_=a.shape
    p=40;c=[a[:p,:p],a[:p,-p:],a[-p:,:p],a[-p:,-p:]]
    cm=[x.reshape(-1,3).mean(0) for x in c]
    yy,xx=np.mgrid[0:H,0:W];u=(xx/(W-1))[...,None];v=(yy/(H-1))[...,None]
    bg=cm[0]*(1-u)*(1-v)+cm[1]*u*(1-v)+cm[2]*(1-u)*v+cm[3]*u*v
    near=np.sqrt(((a-bg)**2).sum(2))<34
    lab,_=ndimage.label(near);edge=set(np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]))-{0}
    m=~np.isin(lab,list(edge));m=ndimage.binary_opening(m,iterations=2)
    l2,n=ndimage.label(m)
    if not n: continue
    s=ndimage.sum(m,l2,range(1,n+1));m=l2==(np.argmax(s)+1);m=ndimage.binary_fill_holes(m)
    if m[0].any() or m[-1].any() or m[:,0].any() or m[:,-1].any() or not(.05<m.mean()<.65): continue
    al=Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    r=im.convert("RGBA");r.putalpha(al);r=r.crop(al.getbbox())
    r.save(f.replace("-edge.png",".png"));n_ok+=1
print("recut ok",n_ok)
