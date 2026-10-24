import sys,glob,numpy as np
from PIL import Image,ImageFilter
from scipy import ndimage
for f in glob.glob(sys.argv[1]+"/*-[0-9].png"):
    if any(k in f for k in ("-boulder-","-rocks-","-stump-")) and "nexus" not in f: pass
    im=Image.open(f).convert("RGBA");a=np.asarray(im).copy()
    hsv=np.asarray(im.convert("RGB").convert("HSV")).astype(np.float32)/255
    al=a[...,3]>8
    grey=(hsv[...,1]<.13)&(hsv[...,2]>.3)&al
    if any(k in f for k in ("-boulder-","-rocks-")): grey&=(hsv[...,2]>.62)
    outside=~al
    # grey regions touching transparent area
    lab,n=ndimage.label(grey)
    touch=np.unique(lab[ndimage.binary_dilation(outside,iterations=2)&grey])
    rem=np.isin(lab,touch[touch>0])
    m=al&~rem
    if not any(k in f for k in ("-boulder-","-rocks-","-log-","-stump-","verdant-tree2","aether-")):
        holes=(hsv[...,1]<.14)&(hsv[...,2]>.62)
        lh,nh=ndimage.label(holes)
        if nh:
            sz=ndimage.sum(holes,lh,range(1,nh+1));big=1+np.where(sz>40)[0]
            m&=~np.isin(lh,big)
    m=ndimage.binary_opening(m,iterations=1)
    lab2,n2=ndimage.label(m)
    if n2:
        s=ndimage.sum(m,lab2,range(1,n2+1));m=np.isin(lab2,1+np.where(s>s.max()*.08)[0])
    alpha=np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1)))
    a[...,3]=np.minimum(a[...,3],alpha)
    out=Image.fromarray(a);bb=out.getbbox()
    if bb: out.crop(bb).save(f)
