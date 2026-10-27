# For each job "race motion dir": preprocess pose (GPU0) then enqueue for the persistent worker.
. /root/wanenv/bin/activate; cd /root/Wan2.2; export HF_HOME=/root/hfcache CUDA_VISIBLE_DEVICES=1
Q=/workspace/hero2/queue; mkdir -p $Q
while read race motion dir; do
  [ -z "$race" ] && continue
  O=/root/wanout/$race-$motion-$dir; mkdir -p $O /workspace/hero2/$race/wan
  [ -f $O/ref.png ] || python3 < /dev/null -c "
from PIL import Image
R='/workspace/hero2/$race/final/cut-birefnet-general.png'; V={'side':'side','up':'back'}.get('$dir'.split('-')[0]); import os; R=f'/workspace/hero2/$race/{V}/final.png' if V and os.path.exists(f'/workspace/hero2/$race/{V}/final.png') else R; print('REF',R); im=Image.open(R).convert('RGBA')
im=im.crop(im.getbbox()); w,h=im.size; P=float('${PAD:-0}')
bg=Image.new('RGB',(int(w*(1+P)),int(h*(1+2*P))),(255,255,255)); bg.paste(im,((bg.width-w)//2,int(h*P)),im); bg.save('$O/ref.png')"
  ffmpeg -nostdin -y -loglevel error -i /root/mocap/$motion-$dir.mp4 -frames:v ${NFR:-49} $O/drive.mp4
  python3 wan/modules/animate/preprocess/preprocess_data.py --ckpt_path /root/m/Wan2.2-Animate-14B/process_checkpoint \
    --video_path $O/drive.mp4 --refer_path $O/ref.png --save_path $O/proc --resolution_area 720 1280 --retarget_flag < /dev/null > $O/prep.log 2>&1 \
    && echo "$O/proc/ /workspace/hero2/$race/wan/$motion-$dir.mp4" > ${QDIR:-/workspace/hero2/queue-hold}/$(date +%s%N)-$race-$motion-$dir.job && echo "QUEUED $race $motion $dir" || echo "PREP_FAIL $race $motion $dir"
done < ${JOBS:-/workspace/hero2/jobs.txt}
echo PREP_DONE
