# usage: slicem.sh <motion> <race> dir=file ...   -> game/<motion>-<dir>, preview /tmp/<motion>5-<race>.mp4
cd /tmp; export WHOLE=1 HF_HOME=/root/hfcache CUDA_VISIBLE_DEVICES=; G=/workspace/hero2
m=$1; r=$2; shift 2
for p in "$@"; do v=${p%%=*}; f=${p##*=}; python3 $G/slicegrid.py $G/$r/grid/$f.png $G/$r/game/$m-$v 2>&1 | grep -a SLICE_OK; done
ins=""; for v in front fside side bside back; do ins="$ins -i $G/$r/game/$m-$v/preview.mp4"; done
ffmpeg -nostdin -y -loglevel error $ins -filter_complex "hstack=inputs=5,scale=1280:-2" -c:v libx264 -pix_fmt yuv420p /tmp/${m}5-$r.mp4 && echo "PREVIEW_OK $m $r"
