import sys,glob,numpy as np
from PIL import Image,ImageFilter
for f in sys.argv[1:]:
    im=Image.open(f).convert("RGBA");a=np.asarray(im).copy();H,W=a.shape[:2]
    hsv=np.asarray(im.convert("RGB").convert("HSV")).astype(np.float32)
    h,s,v=hsv[...,0]*360/255,hsv[...,1]/255,hsv[...,2]/255
    brown=((h>12)&(h<50)&(s>.2)&(v<.75))|(v<.18)
    keep=Image.fromarray((brown*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    keep=np.asarray(keep)>0
    y0=int(H*.70)
    green=(h>55)&(h<160)
    rm=np.zeros((H,W),bool);rm[y0:]=green[y0:]&~keep[y0:]
    # also fade any non-trunk pixel in bottom 8%
    rm[int(H*.93):]&=True
    a[...,3]=np.where(rm,0,a[...,3])
    al=Image.fromarray(a[...,3]).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))
    a[...,3]=np.minimum(a[...,3],np.asarray(al))
    o=Image.fromarray(a);o.crop(o.getbbox()).save(f)
