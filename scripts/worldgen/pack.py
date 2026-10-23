#!/usr/bin/env python3
"""Build an inspectable CPU tool bundle containing no repository credentials or runtime secrets."""
import argparse,hashlib,io,json,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--context',required=True);p.add_argument('--output',required=True);a=p.parse_args()
files={name:(ROOT/'scripts/worldgen'/name).read_bytes() for name in ['generate.py','requirements.txt','test_generator.py','planet_generate.py','planet_viewer.py','planet_travel.py','spawn_generate.py','test_planet.py']}
files['context.json']=Path(a.context).read_bytes()
manifest={'format':1,'files':{name:hashlib.sha256(data).hexdigest() for name,data in files.items()}}
files['bundle-manifest.json']=json.dumps(manifest,sort_keys=True,indent=2).encode()
output=Path(a.output);output.parent.mkdir(parents=True,exist_ok=True)
with tarfile.open(output,'w:gz') as tar:
 for name,data in sorted(files.items()):
  info=tarfile.TarInfo(name);info.size=len(data);info.mtime=0;info.mode=0o644;tar.addfile(info,io.BytesIO(data))
print(json.dumps({'bundle':str(output),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'files':list(files)},indent=2))
