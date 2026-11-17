"""Apply the four-race CPU color profile to a bounded, already-matted VACE pack."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[5]/"scripts/gpu"))
from character_color import PROFILE, grade
from vace_motion import output_root,sha,write_json
from vace_pack import validate_pack


def compose(source,out):
    source=Path(source);pack=validate_pack(source)
    if pack['kind']!='vace-candidate':raise ValueError('Use a genuine generated candidate')
    out=output_root(out)
    if (out/'animation-pack.json').exists():raise ValueError('Keep previous candidates')
    with Image.open(source.parent/pack['atlas']) as image:
        before=image.convert('RGBA');colored=grade(before)
        assert colored.getchannel('A').tobytes()==before.getchannel('A').tobytes()
    updated=copy.deepcopy(pack)
    for frame in updated['frames']:
        x,y,w,h=frame['rect']
        frame['rgbaSha256']=hashlib.sha256(colored.crop((x,y,x+w,y+h)).tobytes()).hexdigest()
    colored.save(out/'atlas.webp',lossless=True,exact=True)
    updated['atlasSha256']=sha(out/'atlas.webp')
    updated['colorProfile']=PROFILE
    updated['colorSourcePackSha256']=sha(source)
    write_json(out/'animation-pack.json',updated)
    preview=Image.new('RGB',(800,830),'#30343a');preview.paste(colored,(0,30),colored.getchannel('A'))
    ImageDraw.Draw(preview).text((12,8),'VACE + CPU COLORS / REVIEW REQUIRED',fill='white')
    preview.save(out/'contact.jpg',quality=94)
    validate_pack(out/'animation-pack.json')
    return {'alphaUnchanged':True,'direction':pack['direction'],'profile':PROFILE,'sourcePackSha256':sha(source),'packSha256':sha(out/'animation-pack.json')}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();print(json.dumps(compose(a.source,a.out)))
