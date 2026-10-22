#!/usr/bin/env python3
"""Fetch only public source/licensing evidence; never contact GPU or private storage."""
import concurrent.futures, hashlib, json, pathlib, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/licenses/evidence'

def fetch(item):
    name,url,expected=item
    receipt={'id':name,'url':url,'retrievedOn':'2026-10-22'}
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Ki-Legends-license-audit/1.0'}),timeout=45) as r:
            b=r.read(12*1024*1024);receipt.update(httpStatus=r.status,finalUrl=r.url)
        sha=hashlib.sha256(b).hexdigest(); receipt.update(bytes=len(b),sha256=sha)
        if expected:receipt.update(expectedSha256=expected,hashMatches=sha==expected)
        # Only retain license/text/terms documents, not duplicate model/art binaries.
        if name.startswith(('makehuman-license','animagine-','terms-')):
            p=OUT/(name+('.html' if b'<html' in b[:1000].lower() else '.txt'));p.write_bytes(b);receipt['file']=p.relative_to(ROOT).as_posix()
    except Exception as e:receipt['error']=str(e)[:300]
    return receipt

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m=json.loads((ROOT/'scripts/gpu/planetary-rig-base.json').read_text());tasks=[]
    for f in m['files']:
        n=f['file'];p='LICENSE.ASSETS.md' if n.startswith('LICENSE') else 'makehuman/data/'+('3dobjs/' if n.endswith('.obj') else 'rigs/' if n.endswith(('.mhw','.mhskel')) else 'targets/macrodetails/')+n
        tasks.append(('makehuman-'+('license' if n.startswith('LICENSE') else n),'https://raw.githubusercontent.com/'+m['source']+'/'+m['revision']+'/'+p,f['sha256']))
    rev='483f0c322568ed13697ed01dd0be07204746d12b'
    tasks += [('animagine-base-license','https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/raw/main/LICENSE.md',None),('animagine-readme','https://huggingface.co/cagliostrolab/animagine-xl-3.1/raw/'+rev+'/README.md',None),('terms-gnu-lgpl3','https://www.gnu.org/licenses/lgpl-3.0.txt',None),('terms-gnu-gpl3','https://www.gnu.org/licenses/gpl-3.0.txt',None),('terms-lovable','https://lovable.dev/terms',None),('terms-openai','https://openai.com/policies/row-terms-of-use/',None)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:receipts=list(ex.map(fetch,tasks))
    (OUT/'source-receipts.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(receipts,indent=2))
if __name__=='__main__':main()
