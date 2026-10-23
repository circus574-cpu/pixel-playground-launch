#!/usr/bin/env python3
"""Reproducible source and standalone Node tool pack; no credentials, venvs or production assets."""
import argparse,hashlib,io,json,subprocess,tarfile,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();files={}
 for path in sorted((ROOT/'scripts/worldgen').glob('*')):
  if path.suffix in ['.py','.ts','.mjs','.txt']:files[str(path.relative_to(ROOT))]=path.read_bytes()
 for path in [ROOT/'src/game/navigation.ts',ROOT/'src/game/session.ts',*sorted((ROOT/'src/game/world/generated').glob('*.ts'))]:files[str(path.relative_to(ROOT))]=path.read_bytes()
 with tempfile.TemporaryDirectory()as temp:
  for source,target in [('simulate-balance.ts','simulate-balance-final.mjs'),('check-navigation.ts','check-navigation-final.mjs'),('check-content.ts','check-content.mjs')]:
   target_path=Path(temp)/target;subprocess.run([str(ROOT/'node_modules/.bin/esbuild'),str(ROOT/'scripts/worldgen'/source),'--bundle','--platform=node','--format=esm','--outfile='+str(target_path),'--log-level=warning'],cwd=ROOT,check=True);files['compiled/'+target]=target_path.read_bytes()
 files['THIRD-PARTY-NOTICES.txt']=b'Bundled standalone balance simulator includes Zod, distributed under the following license:\n\n'+(ROOT/'node_modules/zod/LICENSE').read_bytes()
 manifest={'format':1,'baseGitSha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'files':{name:hashlib.sha256(data).hexdigest()for name,data in files.items()}}
 files['source-manifest.json']=json.dumps(manifest,indent=2).encode()
 output=Path(a.output);output.parent.mkdir(parents=True,exist_ok=True)
 with tarfile.open(output,'w:gz')as archive:
  for name,data in sorted(files.items()):
   info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o644;info.mtime=0;archive.addfile(info,io.BytesIO(data))
 print(json.dumps({'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'files':len(files),'compiled':{k:hashlib.sha256(v).hexdigest()for k,v in files.items()if k.startswith('compiled/')}}))
if __name__=='__main__':main()
