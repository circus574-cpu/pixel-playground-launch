export HF_HOME=/root/hfcache
. /root/wanenv/bin/activate
cd /root/Wan2.2
mkdir -p /root/wanout
python3 -c "
from PIL import Image
im=Image.open('/workspace/hero2/legend/final/cut-birefnet-general.png').convert('RGBA')
bg=Image.new('RGB',im.size,(255,255,255)); bg.paste(im,mask=im.split()[3]); bg.save('/root/wanout/ref.png')"
python3 wan/modules/animate/preprocess/preprocess_data.py --ckpt_path /root/m/Wan2.2-Animate-14B/process_checkpoint \
  --video_path /root/wanout/drive2s.mp4 --refer_path /root/wanout/ref.png \
  --save_path /root/wanout/proc --resolution_area 720 1280 --retarget_flag && echo PRE_DONE
python3 generate.py --task animate-14B --ckpt_dir /root/m/Wan2.2-Animate-14B/ --src_root_path /root/wanout/proc/ \
  --refert_num 1 --offload_model True --convert_model_dtype --save_file /root/wanout/legend-test.mp4 && echo WAN_GEN_DONE
