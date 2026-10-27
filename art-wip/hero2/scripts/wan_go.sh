# usage: wan_go.sh <race> <driving.mp4> <tag> [seconds]
export HF_HOME=/root/hfcache
race=$1; drive=$2; tag=$3; secs=${4:-2.2}
while ! grep -q RESTORE_DONE /workspace/hero2/restore.log; do sleep 15; done
. /root/wanenv/bin/activate; cd /root/Wan2.2
O=/root/wanout/$race-$tag; mkdir -p $O
python3 -c "
from PIL import Image
im=Image.open('/workspace/hero2/$race/final/cut-birefnet-general.png').convert('RGBA')
bg=Image.new('RGB',im.size,(255,255,255)); bg.paste(im,mask=im.split()[3]); bg.save('$O/ref.png')"
ffmpeg -y -loglevel error -i $drive -frames:v ${NFR:-61} $O/drive.mp4
python3 wan/modules/animate/preprocess/preprocess_data.py --ckpt_path /root/m/Wan2.2-Animate-14B/process_checkpoint \
  --video_path $O/drive.mp4 --refer_path $O/ref.png --save_path $O/proc --resolution_area ${AREA:-720 1280} --retarget_flag && echo PRE_DONE
python3 generate.py --task animate-14B --ckpt_dir /root/m/Wan2.2-Animate-14B/ --src_root_path $O/proc/ \
  --refert_num 1 --save_file $O/out.mp4 && echo WAN_GEN_DONE
mkdir -p /workspace/hero2/$race/wan && cp $O/out.mp4 /workspace/hero2/$race/wan/$tag.mp4
ffmpeg -y -loglevel error -i $O/out.mp4 -vf "fps=12,scale=360:-1" /workspace/hero2/$race/wan/$tag.gif && echo GIF_DONE
