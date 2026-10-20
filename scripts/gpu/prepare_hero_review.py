"""Prepare one non-animated approval master; never installs an actor in the game."""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageDraw,ImageFont
from rembg import remove,new_session
ROOT=Path.cwd();SOURCE=ROOT/'art/production/heroes/planetary/v1/sources/planetary-master.png';OUT=ROOT/'docs/qa/hero-planetary-v1';OUT.mkdir(exist_ok=True)
image=remove(Image.open(SOURCE).convert('RGB'),session=new_session('u2net',providers=['CPUExecutionProvider']))
a=image.getchannel('A').point(lambda v:0 if v<10 else v);image.putalpha(a);box=a.getbbox();assert box
crop=image.crop(box);scale=min(496/crop.width,478/crop.height);crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
sprite=Image.new('RGBA',(512,512));sprite.alpha_composite(crop,((512-crop.width)//2,486-crop.height));sprite.save(OUT/'planetary-design-master-512.png',optimize=True)
for side in [128,60,46]:sprite.resize((side,side),Image.Resampling.LANCZOS).save(OUT/f'planetary-scale-{side}.png',optimize=True)
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold_path='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(size,bold=False):return ImageFont.truetype(bold_path if bold else font_path,size)
W,H=960,1320;board=Image.new('RGB',(W,H),'#10191b');d=ImageDraw.Draw(board)
for y in range(H):
 t=max(0,1-abs(y-540)/650);d.line((0,y,W,y),fill=(round(15+8*t),round(24+13*t),round(26+8*t)))
d.rectangle((26,26,W-27,H-27),outline='#806a3e',width=2);d.line((50,145,W-50,145),fill='#806a3e',width=1)
d.text((50,49),'KI LEGENDS',font=font(24,True),fill='#d5ba80');d.text((50,87),'PLANETARNI',font=font(40,True),fill='#f6edd8');d.text((W-245,64),'WZORZEC 01',font=font(23),fill='#cfb67a');d.text((W-245,99),'Do akceptacji',font=font(19),fill='#b0c5b8')
hero=sprite.resize((800,800),Image.Resampling.LANCZOS);board.paste(hero,(80,142),hero)
d.line((50,970,W-50,970),fill='#806a3e');d.text((50,993),'SYLWETKA · STRÓJ · WYPOSAŻENIE',font=font(22,True),fill='#e2cea2')
colors=['#81502d','#c76d24','#d7d1bf','#34363a','#4e4737','#b49762']
for i,c in enumerate(colors):d.rounded_rectangle((52+i*61,1042,98+i*61,1072),radius=5,fill=c)
d.text((50,1100),'Atletyczna sylwetka, bursztynowy szal, jasna tunika,',font=font(19),fill='#dce3dc');d.text((50,1129),'skórzane pasy i stalowo-brązowe rękawice.',font=font(19),fill='#dce3dc')
for x,side,label in [(660,60,'komputer'),(805,46,'telefon')]:
 d.rounded_rectangle((x-22,1030,x+side+22,1150),radius=8,outline='#4b6661',width=1);thumb=sprite.resize((side,side),Image.Resampling.LANCZOS);board.paste(thumb,(x,1050),thumb);d.text((x-15,1120),label,font=font(15),fill='#b8c9bd')
d.text((50,1195),'Podgląd skali postaci — nie zrzut z gry.',font=font(18),fill='#a6b9ae');d.text((50,1227),'Animacje i kolejne rasy dopiero po Twojej akceptacji.',font=font(18),fill='#cfb67a')
board.save(OUT/'approval-board.png',optimize=True);board.save('/workspace/artifacts/ki-legends-planetarni-wzorzec-01.png',optimize=True)
report={'race':'planetary','world':'verdant','status':'awaiting-user-approval','source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'source_foreground_bbox':box,'master_size':[512,512],'design_origin':[.5,.95],'scale_previews':{'desktop':{'sprite_size_world':96,'zoom':.62,'canvas_px':60},'mobile':{'sprite_size_world':96,'zoom':.48,'canvas_px':46}},'not_installed':True,'animations_generated':0,'other_races_generated':0,'files':[]}
for p in sorted(OUT.glob('*.png')):report['files'].append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'review-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
