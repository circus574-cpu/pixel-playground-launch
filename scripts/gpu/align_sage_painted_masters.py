from pathlib import Path
import json,hashlib,argparse
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('sources',type=Path);p.add_argument('landmarks',type=Path);a=p.parse_args();r=a.sources;raw=json.loads(a.landmarks.read_text());out=r/'masters-grounded';out.mkdir(exist_ok=False);cfg={};records=[]
for d,c in raw['directions'].items():
 dx,dy=256-c['anchor'][0],384-c['anchor'][1]
 def pt(p):return [p[0]+dx,p[1]+dy]
 source=r/'masters'/(d+'.png');im=Image.open(source).convert('RGBA');canvas=Image.new('RGBA',(512,512));canvas.alpha_composite(im,(dx,dy));dest=out/(d+'.png');canvas.save(dest);b=canvas.getchannel('A').getbbox();assert min(b[:2])>=8 and max(b[2:])<=504
 j={'root':[256,384],'head':pt(c['head']),'neck':pt(c['neck']),'staff-tip':pt(c['staff_tip'])}
 j['pelvis']=[sum(v[0] for v in c['hips'].values())/2+dx,sum(v[1] for v in c['hips'].values())/2+dy];j['chest']=[(j['pelvis'][0]+j['neck'][0])/2,(j['pelvis'][1]+j['neck'][1])/2]
 for src,target in [('shoulders','shoulder'),('elbows','elbow'),('hands','hand'),('hips','hip'),('knees','knee'),('ankles','ankle')]:
  for side in ['L','R']:j[target+'.'+side]=pt(c[src][side])
 for side in ['L','R']:
  other='R' if side=='L' else 'L';sgn=1 if j['shoulder.'+side][0]>j['shoulder.'+other][0] else -1
  j['hair.'+side]=[j['head'][0]+sgn*18,j['neck'][1]+8];j['hair-end.'+side]=[j['head'][0]+sgn*70,j['pelvis'][1]+25]
  j['robe.'+side]=[j['hip.'+side][0]+sgn*16,j['pelvis'][1]+30];j['robe-end.'+side]=[j['pelvis'][0]+sgn*90,350]
 cfg[d]={'joints':j,'staff_hand':'L','anatomical_staff_hand':'left','masks':[{'bone':'staff','polygon':[pt(p) for p in c['staff_polygon']]}],'death':{'angle_degrees':-78,'translate_pixels':[-125,-95]},'anchor_review':{'source':c['anchor'],'translation':[dx,dy],'target':[256,384]}}
 records.append({'direction':d,'input_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'translation':[dx,dy],'alpha_bounds':b})
(out/'alignment.json').write_text(json.dumps(records,indent=2)+'\n');(r/'sage-painted-landmarks.json').write_text(json.dumps(cfg,indent=2)+'\n');(r/'manual-landmarks-initial.json').write_text(json.dumps(raw,indent=2)+'\n')
print('FOOT_ALIGNED',len(cfg))
