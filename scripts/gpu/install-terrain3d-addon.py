#!/usr/bin/env python3
"""Install the pinned Terrain3D authoring dependency. Not required by the isometric 2D runtime."""
import argparse,hashlib,json,tempfile,urllib.request,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--project',type=Path,required=True);a=p.parse_args()
lock=json.loads((Path(__file__).resolve().parents[2]/'ports/godot-terrain3d/dependencies.json').read_text())['terrain3d']
with tempfile.TemporaryDirectory(prefix='ki-terrain3d-') as temp:
 archive=Path(temp)/'terrain3d.zip';urllib.request.urlretrieve(lock['url'],archive)
 assert hashlib.sha256(archive.read_bytes()).hexdigest()==lock['sha256'],'Dependency checksum mismatch'
 with zipfile.ZipFile(archive) as bundle:
  for info in bundle.infolist():
   parts=Path(info.filename).parts
   marker=next((i for i in range(len(parts)-1) if parts[i:i+2]==('addons','terrain_3d')),None)
   if marker is None or info.is_dir():continue
   relative=Path(*parts[marker:]);assert not relative.is_absolute() and '..' not in relative.parts
   dest=a.project/relative;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(bundle.read(info))
print('Terrain3D',lock['version'],'installed; pod lifecycle untouched')
