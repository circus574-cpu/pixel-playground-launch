S=/workspace/hero2/slicem.sh
bash $S walk planetary front=frontw-0 fside=fsidew-0 side=sidew-0 bside=bsidew-0 back=backw-0 > /workspace/hero2/rs-planetary.log 2>&1 &
bash $S walk android front=frontw-0 fside=fsidew-1 side=sidew-1 bside=bsidew-1 back=backw-1 > /workspace/hero2/rs-android.log 2>&1 &
wait; echo RESLICE_DONE > /workspace/hero2/rs-done.log
