S=/workspace/hero2/slicem.sh
bash $S attack legend front=punch-frontw-2 fside=punch-fsidew-0 side=punch-sidew-0 bside=punch-bsidew-0 back=punch-backw-0 > /workspace/hero2/sa-legend.log 2>&1 &
bash $S attack planetary front=punch-frontw-0 fside=punch-fsidew-0 side=punch-sidew-0 bside=punch-bsidew-2 back=punch-backw-0 > /workspace/hero2/sa-planetary.log 2>&1 &
bash $S attack android front=punch-frontw-0 fside=punch-fsidew-0 side=punch-sidew-1 bside=punch-bsidew-1 back=punch-backw-0 > /workspace/hero2/sa-android.log 2>&1 &
wait; echo SLICE_ATT_DONE > /workspace/hero2/sa-done.log
