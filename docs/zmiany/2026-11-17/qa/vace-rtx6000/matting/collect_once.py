from pathlib import Path
import json,time,subprocess,sys,zipfile,hashlib
r=Path(__file__).resolve().parent
deadline=time.monotonic()+3500
while time.monotonic()<deadline:
 results=list((r/'trial').glob('generated-*/result.json'))
 if results or not (r/'trial/inference.lock').exists():break
 time.sleep(5)
status={'inferenceComplete':False,'packExitCode':None}
results=list((r/'trial').glob('generated-*/result.json'))
if len(results)==1:
 result=results[0];status['inferenceComplete']=True;status['result']=str(result.relative_to(r))
 cmd=[sys.executable,'vace_pack.py','--root','trial','--result',str(result),'--out','candidate','--matte','white']
 p=subprocess.run(cmd,cwd=r,timeout=120)
 status['packExitCode']=p.returncode
files=[]
for folder in ['candidate','trial']:
 for f in (r/folder).rglob('*'):
  if f.is_file() and f.name!='inference.lock':files.append(f)
for name in ['session.json','packages.json','infer-launch.json','starter-manifest.json','commands.json','requirements-gpu.txt','vace14-model.json','vace_motion.py','vace_stage.py','vace_pack.py','stage.log','infer.log','install.log','gpu-metrics.jsonl']:
 f=r/name
 if f.is_file():files.append(f)
stage=Path('/tmp/ki-vace14/stage-verified.json')
(r/'stage-verified.json').write_bytes(stage.read_bytes());files.append(r/'stage-verified.json')
out=r/'rtx6000-pilot.zip'
with zipfile.ZipFile(out,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(files):z.write(f,f.relative_to(r).as_posix())
status.update(archive=out.name,bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),files=len(files))
(r/'postprocess.json').write_text(json.dumps(status,indent=2))
print(json.dumps(status),flush=True)
