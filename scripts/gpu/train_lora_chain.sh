#!/bin/bash
# Character LoRA for the approved hero concept: setup, dataset, training (Animagine XL 3.1, diffusers example script).
#   train_lora_chain.sh <name> <turnaround dir> <seeds>   -> /workspace/ki-legends-gpu/lora/<name>/pytorch_lora_weights.safetensors
set -u
NAME=$1; TURN=$2; SEEDS=$3
ROOT=/workspace/ki-legends-gpu; PY=/opt/gen-venv/bin/python
cd $ROOT
while pgrep -f "gen_chars_concept.py races3" >/dev/null; do sleep 15; done
$PY -m pip install -q "peft==0.17.1" "datasets==3.6.0" "transformers==4.57.6" "huggingface-hub==0.36.0" "numpy==2.0.2" 2>&1 | tail -1
[ -f lora/train_dreambooth_lora_sdxl.py ] || { mkdir -p lora; curl -sL https://raw.githubusercontent.com/huggingface/diffusers/v0.35.2/examples/dreambooth/train_dreambooth_lora_sdxl.py -o lora/train_dreambooth_lora_sdxl.py; }
[ -d models/animagine-diffusers ] || $PY - <<'EOP'
import torch
from diffusers import StableDiffusionXLPipeline
p = StableDiffusionXLPipeline.from_single_file("/workspace/ki-legends-gpu/models/checkpoints/animagine-xl-3.1.safetensors", torch_dtype=torch.float16)
p.save_pretrained("/workspace/ki-legends-gpu/models/animagine-diffusers")
print("converted")
EOP
rm -rf lora/data-$NAME; $PY scripts/crop_turnaround.py $TURN lora/data-$NAME $SEEDS
ls lora/data-$NAME | wc -l
$PY -m accelerate.commands.launch --mixed_precision=fp16 lora/train_dreambooth_lora_sdxl.py \
  --pretrained_model_name_or_path=models/animagine-diffusers --instance_data_dir=lora/data-$NAME \
  --instance_prompt="ki_legend, 1boy, full body, anime game character" --output_dir=lora/$NAME --resolution=1024 \
  --train_batch_size=1 --gradient_accumulation_steps=2 --gradient_checkpointing --learning_rate=1e-4 --lr_scheduler=constant \
  --max_train_steps=900 --rank=16 --seed=7460101 --mixed_precision=fp16 --checkpointing_steps=450 --center_crop=false 
echo "train_rc=$?"
ls -la lora/$NAME
