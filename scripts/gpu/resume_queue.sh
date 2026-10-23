#!/bin/bash
# Restart the GPU queue after a pod change (80 GB pod: three lanes in parallel). Resumable: finished images are skipped.
#   bash /workspace/ki-legends-gpu/scripts/resume_queue.sh
# Prerequisite: the Python environment restored (docs/GPU-RUNTIME-RESTORE-2026-10-21.md) and these pins:
#   transformers==4.57.6 huggingface-hub==0.36.0 peft==0.17.1 numpy==2.0.2 datasets==3.6.0
cd /workspace/ki-legends-gpu
PY=/opt/gen-venv/bin/python
lane() { name=$1; shift; ( for cmd in "$@"; do bash -c "$cmd" >> /root/queue-$name.log 2>&1; done; echo "lane_$name_done $(date +%T)" >> /root/queue.log ) & }
lane A "$PY scripts/gen_turnaround.py hero-android renders/chars-concept-races3/hero-android-front-s7430106.png" \
       "$PY scripts/gen_chars_concept.py races4 7430201,7430202,7430203,7430204,7430205,7430206 hero-planetary,hero-sage"
lane B "for s in city-aether city-nexus city-verdant; do $PY scripts/gen_world_kit.py k1 dream \$s; done"
lane C "for s in biome-forest biome-snow biome-desert biome-volcanic biome-coast ruins-props; do $PY scripts/gen_world_kit.py k1 dream \$s; done" \
       "$PY scripts/gen_city_parts.py c1 anime" "$PY scripts/gen_forge_parts2.py g3 anime 7460101,7460102,7460103,7460104,7460105,7460106"
wait
