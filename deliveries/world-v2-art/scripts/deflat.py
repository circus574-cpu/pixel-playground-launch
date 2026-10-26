import sys,numpy as np
from PIL import Image,ImageFilter
for f in sys.argv[1:]:
    im=Image.open(f).convert("RGBA");a=np.asarray(im).copy()
    hsv=np.asarray(im.convert("RGB").convert("HSV")).astype(np.float32)/255
    s,v=hsv[...,1],hsv[...,2]
    V=Image.fromarray((v*255).astype(np.uint8))
    m1=np.asarray(V.filter(ImageFilter.BoxBlur(4)),np.float32)/255
    m2=np.asarray(Image.fromarray((v*v*255).astype(np.uint8)).filter(ImageFilter.BoxBlur(4)),np.float32)/255
    std=np.sqrt(np.clip(m2-m1*m1,0,1))
    flat=(s<.15)&(v>.55)&(std<.035)
    fm=Image.fromarray((flat*255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5))
    fm=np.asarray(fm)>0
    a[...,3]=np.where(fm,0,a[...,3])
    Image.fromarray(a).save(f)
