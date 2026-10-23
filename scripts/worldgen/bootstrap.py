#!/usr/bin/env python3
"""Install isolated CPU-only worldgen tools on an already-running Linux pod.
No pod lifecycle, network configuration, GPU, global Python or existing projects are changed.
Run: python3 bootstrap.py --root /workspace/ki-legends-worldgen --bundle BUNDLE.tar.gz
"""
import argparse,hashlib,json,os,platform,re,shutil,subprocess,tarfile,tempfile,time,urllib.request
from pathlib import Path

def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'KI-Legends-CPU-Worldgen/0.1'})
    with urllib.request.urlopen(request,timeout=90) as response:return response.read()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',default='/workspace/ki-legends-worldgen');parser.add_argument('--bundle',required=True)
    args=parser.parse_args();root=Path(args.root).resolve();root.mkdir(parents=True,exist_ok=True)
    if platform.system()!='Linux' or platform.machine() not in ['x86_64','amd64']:raise SystemExit('This bootstrap targets Linux x86_64')
    started=time.time();runtime=root/'runtime';runtime.mkdir(exist_ok=True);binary=runtime/'micromamba'
    if not binary.exists():
        version='2.3.2'
        metadata=json.loads(fetch('https://api.anaconda.org/package/conda-forge/micromamba/files'))
        candidates=[m for m in metadata if m.get('version')==version and m.get('basename','').startswith('linux-64/') and m['basename'].endswith('.tar.bz2')]
        if not candidates:raise RuntimeError('Pinned micromamba release missing from official metadata')
        record=sorted(candidates,key=lambda m:m['basename'])[-1]
        expected=record.get('sha256') or record.get('attrs',{}).get('sha256')
        if not expected or not re.fullmatch('[a-f0-9]{64}',expected):raise RuntimeError('Official archive SHA-256 missing')
        url='https://api.anaconda.org/download/conda-forge/micromamba/'+version+'/'+record['basename']
        archive=fetch(url)
        if hashlib.sha256(archive).hexdigest()!=expected:raise RuntimeError('Micromamba checksum mismatch')
        import io
        with tarfile.open(fileobj=io.BytesIO(archive),mode='r:bz2') as package:
            stream=package.extractfile('bin/micromamba')
            if stream is None:raise RuntimeError('Missing micromamba executable')
            binary.write_bytes(stream.read());binary.chmod(0o755)
        (runtime/'micromamba-source.json').write_text(json.dumps({'version':version,'basename':record['basename'],'archiveSha256':expected},indent=2)+'\n')
    env=dict(os.environ,MAMBA_ROOT_PREFIX=str(runtime/'mamba'),OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',MKL_NUM_THREADS='1')
    python=root/'env/bin/python'
    if not python.exists():
        subprocess.run([str(binary),'create','-y','-p',str(root/'env'),'-c','conda-forge','python=3.12','pip'],env=env,check=True)
    bundle=Path(args.bundle).resolve()
    # Unpack only plain source/data files. No absolute paths, links or arbitrary archive traversal.
    app=root/'app';app.mkdir(exist_ok=True)
    with tarfile.open(bundle,'r:gz') as package:
        for member in package.getmembers():
            relative=Path(member.name)
            if relative.is_absolute() or '..' in relative.parts or member.issym() or member.islnk():raise RuntimeError('Unsafe source archive path')
            if member.isdir():continue
            if not member.isfile():raise RuntimeError('Unsupported source archive entry')
            dest=app/relative;dest.parent.mkdir(parents=True,exist_ok=True)
            src=package.extractfile(member)
            payload=src.read()
            if dest.exists() and dest.read_bytes()!=payload:
                backups=root/'source-history'/time.strftime('%Y%m%d-%H%M%S')/relative
                backups.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,backups)
            dest.write_bytes(payload)
    manifest=json.loads((app/'bundle-manifest.json').read_text())
    for name,expected in manifest['files'].items():
        if hashlib.sha256((app/name).read_bytes()).hexdigest()!=expected:raise RuntimeError('Source file checksum mismatch: '+name)
    subprocess.run([str(python),'-m','pip','install','--disable-pip-version-check','--progress-bar','off','-r',str(app/'requirements.txt')],env=env,check=True)
    (root/'outputs').mkdir(exist_ok=True)
    launcher=root/'run-worldgen.sh'
    launcher.write_text('#!/bin/sh\nset -eu\nexport OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 KI_WORLDGEN_CPU_BUDGET=8\nexec '+str(python)+' '+str(app/'generate.py')+' --context '+str(app/'context.json')+' "$@"\n');launcher.chmod(0o755)
    report={'status':'CPU_ENVIRONMENT_INSTALLED','installedAtUtc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'elapsedSeconds':round(time.time()-started,2),'root':str(root),'platform':platform.platform(),'hostCpuLogical':os.cpu_count(),'allocatedVcpuBudget':8,'volumeQuotaGb':500,'diskStatsAreBackingFilesystemNotVolumeQuota':True,'disk':dict(zip(['total','used','free'],shutil.disk_usage(root))),'bundleSha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'python':subprocess.check_output([str(python),'--version'],text=True).strip(),'gpuUsed':False}
    (root/'environment-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
