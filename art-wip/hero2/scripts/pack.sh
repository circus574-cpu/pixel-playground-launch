# pack character work into /tmp/hero2-pack (compact, repo-friendly)
set -e; G=/workspace/hero2; P=/tmp/hero2-pack; rm -rf $P; mkdir -p $P/scripts $P/races $P/clips
cp $G/*.py $G/*.sh $G/race_desc.json $P/scripts/ 2>/dev/null || true
for r in legend planetary sage android; do D=$P/races/$r; mkdir -p $D/masters $D/grids $D/game
  cp $G/$r/final/cut-birefnet-general.png $D/masters/front.png 2>/dev/null || true
  for v in side back; do [ -f $G/$r/$v/final.png ] && cp $G/$r/$v/final.png $D/masters/$v.png; done
  [ -d $G/$r/game ] && cp -r $G/$r/game/. $D/game/
  for f in $G/$r/grid/*.png; do [ -f "$f" ] || continue; python3 -c "
from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGB'); im.thumbnail((1024,1024)); im.save(sys.argv[2],'WEBP',quality=82)" "$f" "$D/grids/$(basename ${f%.png}).webp"; done
  for f in $G/$r/wan/*.mp4; do [ -f "$f" ] || continue; ffmpeg -nostdin -y -loglevel error -i $f -vf scale=360:-2 -c:v libx264 -crf 28 -pix_fmt yuv420p $P/clips/$r-wan-$(basename $f); done
done
du -sh $P; find $P -type f | wc -l
tar -C /tmp -czf /tmp/hero2-pack.tgz hero2-pack; ls -la /tmp/hero2-pack.tgz; echo PACK_OK
