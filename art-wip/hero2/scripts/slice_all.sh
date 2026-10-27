cd /tmp; export WHOLE=1 HF_HOME=/root/hfcache CUDA_VISIBLE_DEVICES=
G=/workspace/hero2
s() { r=$1; shift; for p in "$@"; do v=${p%%=*}; f=${p##*=}; python3 $G/slicegrid.py $G/$r/grid/$f.png $G/$r/game/walk-$v 2>&1 | grep -a SLICE_OK; done; }
s legend front=frontw-1 fside=fsidew-1 side=sideb-0 bside=bsidew-2 back=backw-1 > $G/sl-legend.log &
s planetary front=frontw-0 fside=fsidew-0 side=sidew-0 bside=bsidew-0 back=backw-0 > $G/sl-planetary.log &
s sage front=frontw-2 fside=fsidew-2 side=sidew-1 bside=bsidew-0 back=backw-0 > $G/sl-sage.log &
s android front=frontw-0 fside=fsidew-1 side=sidew-1 bside=bsidew-1 back=backw-1 > $G/sl-android.log &
wait
for r in legend planetary sage android; do
  ins=""; for v in front fside side bside back; do ins="$ins -i $G/$r/game/walk-$v/preview.mp4"; done
  ffmpeg -nostdin -y -loglevel error $ins -filter_complex "hstack=inputs=5,scale=1280:-2" -c:v libx264 -pix_fmt yuv420p /tmp/walk5-$r.mp4
done
echo SLICE_ALL_DONE
