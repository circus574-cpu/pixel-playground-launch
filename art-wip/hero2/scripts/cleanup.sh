while ! grep -q "HY_MODEL_OK" /workspace/hero2/restore.log; do sleep 15; done
ok=1
for m in Wan2.2-Animate-14B Hunyuan3D-2; do
  a=$(du -sb /workspace/hero2-cache/m/$m | cut -f1); b=$(du -sb /root/m/$m | cut -f1)
  na=$(find /workspace/hero2-cache/m/$m -type f | wc -l); nb=$(find /root/m/$m -type f | wc -l)
  echo "$m vol=$a/$na local=$b/$nb"; [ "$a" = "$b" ] && [ "$na" = "$nb" ] || ok=0
done
if [ $ok = 1 ]; then rm -rf /workspace/hero2-cache/m && echo CLEANUP_DONE; else echo CLEANUP_SKIPPED_MISMATCH; fi
du -sh /workspace/hero2-cache
