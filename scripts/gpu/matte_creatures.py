"""Cut the five chosen views of each monster out of the white background and place them on the 512 production canvas (enemy profile: ground point (256, 409.6)).
  /opt/rembg-venv/bin/python matte_creatures.py <tag> <roster.json> <views-dir with best.json> [ids]   -> renders/enemies-masters-<tag>/<id>/{<view>.png, metadata.json, sheet.jpg}
One scale per monster (same scale for all views), size class from the roster; flyers float 36 px above the ground point.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from rembg import new_session, remove

tag = sys.argv[1]; roster = {m["id"]: m for m in json.loads(Path(sys.argv[2]).read_text())["monsters"]}; vdir = Path(sys.argv[3]); best = json.loads((vdir / "best.json").read_text())
ids = sys.argv[4].split(",") if len(sys.argv) > 4 else list(best)
OUT = Path("/workspace/ki-legends-gpu/renders") / ("enemies-masters-%s" % tag); OUT.mkdir(parents=True, exist_ok=True)
session = new_session("isnet-anime"); GROUND = 409.6
for mid in ids:
    m = roster[mid]; cut = {}
    for view, info in best[mid].items():
        rgba = remove(Image.open(vdir / info["file"]).convert("RGB"), session=session); a = np.array(rgba)[:, :, 3]; a[a < 24] = 0; rgba.putalpha(Image.fromarray(a))
        bb = rgba.getchannel("A").getbbox(); cut[view] = (rgba.crop(bb), bb)
    k = min(380 * m["scale"] / max(c.size[1] for c, _ in cut.values()), 470 * m["scale"] / max(c.size[0] for c, _ in cut.values()))
    lift = 36 if m["archetype"] in ("fly", "hover") else 0; d = OUT / mid; d.mkdir(exist_ok=True); meta = {"id": mid, "scale": k, "ground": [256, GROUND - lift], "views": {}}
    for view, (c, bb) in cut.items():
        w, h = max(1, round(c.size[0] * k)), max(1, round(c.size[1] * k)); r = c.resize((w, h), Image.LANCZOS)
        arr = np.array(r.getchannel("A")); low = arr[int(h * .8):]; cols = np.where(low.max(axis=0) > 0)[0]; fx = (cols.min() + cols.max()) / 2 if len(cols) else w / 2
        canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); x = round(256 - fx); y = round(GROUND - lift - h); canvas.alpha_composite(r, (max(0, x), max(0, y)))
        canvas.save(d / (view + ".png")); meta["views"][view] = {"bounds": canvas.getchannel("A").getbbox(), "source": info["file"]}
    sh = Image.new("RGB", (5 * 200, 200), (70, 70, 70))
    for i, view in enumerate(cut):
        im = Image.open(d / (view + ".png")).resize((200, 200), Image.LANCZOS); bg = Image.new("RGBA", (200, 200), (70, 70, 70, 255)); bg.alpha_composite(im); sh.paste(bg.convert("RGB"), (i * 200, 0))
    sh.save(d / "sheet.jpg", quality=88); (d / "metadata.json").write_text(json.dumps(meta, indent=1)); print("MASTERS", mid, flush=True)
print("CREATURES_MATTED", flush=True)
