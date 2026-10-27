cd /tmp
for t in android/grid/sidew-1 planetary/grid/frontw-0 sage/grid/sidew-1 legend/grid/backw-1; do WHOLE=1 python3 /workspace/hero2/slicegrid.py /workspace/hero2/$t.png /tmp/kt-${t%%/*} 2>&1 | tail -1; done
python3 - <<'PY'
from PIL import Image
o = Image.new("RGBA", (1024, 512), (92, 120, 70, 255))
for i, r in enumerate(["android", "planetary", "sage", "legend"]): o.alpha_composite(Image.open(f"/tmp/kt-{r}/sheet.png"), (0, i * 128))
o.convert("RGB").resize((2048, 1024), Image.NEAREST).save("/tmp/kt.jpg")
PY
echo OKK
