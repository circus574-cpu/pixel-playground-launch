#!/usr/bin/env python3
"""Pack independently gzipped browser assets with byte ranges and original JSON hashes."""
import argparse,gzip,json,hashlib
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--world',required=True);p.add_argument('--output',required=True);a=p.parse_args();root=Path(a.world);output=Path(a.output)
 if output.exists():raise FileExistsError(str(output))
 output.mkdir(parents=True);report=json.loads((root/'conversion-report.json').read_text());features=[]
 for row in report['features']:
  feature=row['feature'];directory=root/feature;entries={};offset=0;data=bytearray()
  for path in sorted(directory.rglob('*.json')):
   if path.name in ['collision-fixtures.json','engine-navigation.json','route-tests.json']:continue
   relative=str(path.relative_to(directory));raw=path.read_bytes();compressed=gzip.compress(raw,compresslevel=6,mtime=0);entries[relative]={'offset':offset,'length':len(compressed),'sha256':hashlib.sha256(raw).hexdigest()};data.extend(compressed);offset+=len(compressed)
  (output/(feature+'.pack')).write_bytes(data);index={'format':'superior-range-pack-1','feature':feature,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'entries':entries};(output/(feature+'.index.json')).write_text(json.dumps(index,separators=(',',':')))
  features.append({'feature':feature,'pack':feature+'.pack','index':feature+'.index.json','bytes':len(data),'indexSha256':hashlib.sha256((output/(feature+'.index.json')).read_bytes()).hexdigest()})
 (output/'planet.json').write_bytes((root/'planet.json').read_bytes());(output/'travel-links.json').write_bytes((root/'travel-links.json').read_bytes());(output/'packs.json').write_text(json.dumps({'format':'superior-range-pack-1','features':features},indent=2));print(json.dumps({'features':len(features),'bytes':sum(f['bytes']for f in features)}))
if __name__=='__main__':main()
