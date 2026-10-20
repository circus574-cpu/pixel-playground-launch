from pathlib import Path
import hashlib,json,urllib.request
manifest=json.loads(Path('/opt/ki-legends-gpu/scripts/planetary-rig-base.json').read_text())
root=Path('/workspace/ki-legends-gpu/source/planetary-rig-base');root.mkdir(exist_ok=True)
base='https://raw.githubusercontent.com/'+manifest['source']+'/'+manifest['revision']+'/'
for f in manifest['files']:
 name=f['file'];path='LICENSE.ASSETS.md' if name.startswith('LICENSE') else 'makehuman/data/'+('3dobjs/' if name.endswith('.obj') else 'rigs/' if name.endswith(('.mhw','.mhskel')) else 'targets/macrodetails/')+name
 p=root/name
 if not p.exists():p.write_bytes(urllib.request.urlopen(base+path,timeout=60).read())
 assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],name+' hash mismatch'
print('CC0 rig source verified:',len(manifest['files']),'files')
