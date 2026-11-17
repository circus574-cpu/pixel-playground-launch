from pathlib import Path
import json,urllib.request,hashlib,shutil,subprocess,sys
root=Path('/workspace/ki-premium/pyra-batch2');(root/'inputs').mkdir(exist_ok=True)
q=json.loads((root/'queue.json').read_text())
for j in {x['input']:x for x in q['jobs']}.values():
 data=urllib.request.urlopen('https://raw.githubusercontent.com/circus574-cpu/pixel-playground-launch/'+j['sourceCommit']+'/'+j['sourcePath'],timeout=20).read()
 assert hashlib.sha256(data).hexdigest()==j['inputSha256']
 (root/j['input']).write_bytes(data)
shutil.copyfile(root.parent/'model-download.json',root/'model-download.json')
subprocess.run([sys.executable,str(root/'premium_pilot.py'),'--root',str(root),'--model-root','/tmp/ki-premium-model'],check=True)
