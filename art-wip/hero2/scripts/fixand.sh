cd /tmp; G=/workspace/hero2
WHOLE=1 HF_HOME=/root/hfcache CUDA_VISIBLE_DEVICES= python3 $G/slicegrid.py $G/android/grid/sidew-1.png $G/android/game/walk-side 2>&1 | tail -2
ins=""; for v in front fside side bside back; do ins="$ins -i $G/android/game/walk-$v/preview.mp4"; done
ffmpeg -nostdin -y -loglevel error $ins -filter_complex "hstack=inputs=5,scale=1280:-2" -c:v libx264 -pix_fmt yuv420p /tmp/walk5-android.mp4 && echo HSTACK_OK
