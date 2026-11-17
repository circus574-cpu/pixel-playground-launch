#!/usr/bin/env python3
"""Prepare a review-only material pack. No API, weights or production writes.

Meshy seamless base colors come from meshy_free_browser.cjs. Derived maps use
CPU luminance heuristics, not measured geometry or physically captured PBR.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter

REPO = Path(__file__).resolve().parents[2]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def derived_maps(rgb, tile, wet):
    """Return OpenGL normals and explicitly estimated height/roughness bytes."""
    rgb = np.asarray(rgb, dtype=np.float32) / 255
    srgb = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    lum = srgb @ np.array([.2126, .7152, .0722], dtype=np.float32)
    height = gaussian_filter(lum, .8, mode="wrap" if tile else "reflect")
    lo, hi = np.percentile(height, [2, 98])
    height = np.clip((height - lo) / max(float(hi-lo), .02), 0, 1)
    if tile:
        height[0, :] = height[-1, :] = (height[0, :] + height[-1, :]) * .5
        height[:, 0] = height[:, -1] = (height[:, 0] + height[:, -1]) * .5
        dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * .5
        dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * .5
    else:
        dy, dx = np.gradient(height)
    # Rows increase downward; tangent Y increases upward (OpenGL normal convention).
    normal = np.stack([-dx * 2, dy * 2, np.ones_like(height)], axis=-1)
    if tile:
        normal[0, :] = normal[-1, :] = (normal[0, :] + normal[-1, :]) * .5
        normal[:, 0] = normal[:, -1] = (normal[:, 0] + normal[:, -1]) * .5
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    roughness = np.clip((.27 if wet else .78) + (0.5-height) * .12, .12, .95)
    return {"normal-opengl": np.rint((normal + 1) * 127.5).astype("uint8"),
            "height-estimated": np.rint(height * 255).astype("uint8"),
            "roughness-estimated": np.rint(roughness * 255).astype("uint8")}


def inventory(out):
    groups = {}
    for path in sorted((REPO / "ports/godot-pyra/assets/lands").glob("*/terrain/*.webp")):
        digest = sha(path)
        with Image.open(path) as image:
            width, height = image.size
        entry = groups.setdefault(digest, {
            "id": path.parent.parent.name + "-" + path.stem,
            "sourceSha256": digest, "width": width, "height": height,
            "tileCandidate": width == height, "sources": [],
        })
        entry["sources"].append(path.relative_to(REPO).as_posix())
    out.mkdir(parents=True, exist_ok=True)
    result = {"schema": 1, "sourceCommit": subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
        "scope": "Review pack; not installed in game", "paidApiCalls": 0,
        "provenanceStatus": "Derived from existing assets; original rights status is inherited, not independently proven",
        "tools": {"seamless": "Meshy free browser utility, 50% blend",
                  "derivedMaps": "NumPy/SciPy/Pillow CPU luminance estimation",
                  "normalConvention": "OpenGL +Y; tangent Y points up, image row points down"},
        "materials": list(groups.values())}
    write_json(out / "manifest.json", result)
    print("INVENTORY", len(groups), "materials", sum(len(x["sources"]) for x in groups.values()), "bindings")


def derive(out, map_size=256):
    manifest = json.loads((out / "manifest.json").read_text())
    manifest["derivedMapMaxEdge"] = map_size
    for entry in manifest["materials"]:
        folder = out / entry["id"]
        folder.mkdir(exist_ok=True)
        source = REPO / entry["sources"][0]
        assert sha(source) == entry["sourceSha256"], source
        base_path = folder / "base-color.webp"
        if entry["tileCandidate"]:
            assert base_path.exists(), "Run free browser exporter first: " + entry["id"]
            assert (folder / "browser-export.json").exists()
        else:
            Image.open(source).convert("RGB").save(base_path, lossless=True, method=6)
        role = Path(entry["sources"][0]).stem
        map_input = Image.open(base_path).convert("RGB")
        map_input.thumbnail((map_size, map_size), Image.Resampling.LANCZOS)
        maps = derived_maps(map_input, entry["tileCandidate"], role in ("water", "shore"))
        for name, array in maps.items():
            Image.fromarray(array).save(folder / (name + ".webp"), lossless=True, method=6)
        entry["baseColorMethod"] = "Meshy free browser PNG, lossless WebP transcode" if entry["tileCandidate"] else "Existing non-square source; lossless transcode, layout preserved"
        entry["maps"] = {name: {"file": entry["id"] + "/" + name + ".webp",
                               "sha256": sha(folder / (name + ".webp")),
                               "width": entry["width"] if name == "base-color" else map_input.width,
                               "height": entry["height"] if name == "base-color" else map_input.height,
                               "colorSpace": "sRGB" if name == "base-color" else "linear-data"}
                         for name in ["base-color", *maps]}
        entry["estimatedDecodedRgbaBytesPerMaterial"] = sum(m["width"]*m["height"]*4 for m in entry["maps"].values())
        print("DERIVED", entry["id"], flush=True)
    manifest["limitations"] = [
        "Height and roughness are visual estimates, not physically captured measurements.",
        "No AO or metallic generated: a color image does not prove occlusion or metalness.",
        "Not installed; current 2D ground shader does not automatically consume PBR maps.",
        "Visual seam acceptance is separate from numerical border metrics.",
        "Load only visible materials; four maps cost four decoded textures before mipmaps."]
    write_json(out / "manifest.json", manifest)
    write_json(out / "godot-preview.json", {"assets": [
        {"path": "res://" + source.removeprefix("ports/godot-pyra/"),
         "file": e["maps"]["base-color"]["file"], "sha256": e["maps"]["base-color"]["sha256"]}
        for e in manifest["materials"] for source in e["sources"]]})


def validate(out):
    manifest = json.loads((out / "manifest.json").read_text())
    checks = []; issues = []
    for entry in manifest["materials"]:
        for source in entry["sources"]:
            assert sha(REPO / source) == entry["sourceSha256"], source
        for name, data in entry["maps"].items():
            path = out / data["file"]
            assert sha(path) == data["sha256"], path
            image = Image.open(path).convert("RGB")
            assert image.size == (data["width"], data["height"]), path
            if name == "base-color":
                assert image.size == (entry["width"], entry["height"]), path
                if not entry["tileCandidate"]:
                    np.testing.assert_array_equal(np.asarray(image), np.asarray(Image.open(REPO / entry["sources"][0]).convert("RGB")))
            if name == "normal-opengl":
                n = np.asarray(image, dtype=float) / 127.5 - 1
                assert np.max(np.abs(np.linalg.norm(n, axis=-1)-1)) < .015
                assert np.min(n[:, :, 2]) > 0
            if entry["tileCandidate"] and name != "base-color":
                a = np.asarray(image)
                assert np.array_equal(a[0], a[-1]) and np.array_equal(a[:,0], a[:,-1]), path
            if name == "base-color" and entry["tileCandidate"]:
                a = np.asarray(image, dtype=float)
                source = np.asarray(Image.open(REPO / entry["sources"][0]).convert("RGB"), dtype=float)
                seam = float((np.mean(abs(a[0]-a[-1])) + np.mean(abs(a[:,0]-a[:,-1]))) / 2)
                original = float((np.mean(abs(source[0]-source[-1])) + np.mean(abs(source[:,0]-source[:,-1]))) / 2)
                inside = float((np.mean(abs(np.diff(a,axis=0))) + np.mean(abs(np.diff(a,axis=1)))) / 2)
                metric = {"id":entry["id"],"borderMeanDifference":round(seam,4),"sourceBorderMeanDifference":round(original,4),"internalNeighborDifference":round(inside,4),"reviewFlag":seam>max(inside*2,4)}
                checks.append(metric)
                if metric["reviewFlag"]: issues.append(entry["id"])
    report = {"materialsVerified": len(manifest["materials"]),
              "bindingsVerified": sum(len(x["sources"]) for x in manifest["materials"]),
              "mapsVerified":sum(len(x["maps"]) for x in manifest["materials"]),
              "sourceHashesUnchanged":True,"normalVectorsValid":True,"seamMetrics":checks,
              "seamsRequiringReview":issues,"physicalPhoneTested":False,
              "packBytes":sum(p.stat().st_size for p in out.rglob("*.webp"))}
    write_json(out / "validation.json", report)
    print(json.dumps({k:v for k,v in report.items() if k!="seamMetrics"}, indent=2))


def gallery(out):
    manifest = json.loads((out / "manifest.json").read_text())
    lands = sorted({Path(s).parts[-3] for e in manifest["materials"] for s in e["sources"]})
    for land in lands:
        entries = [e for e in manifest["materials"] if any(Path(s).parts[-3] == land for s in e["sources"])]
        card = Image.new("RGB", (1120, len(entries)*180+65), "#101820")
        draw = ImageDraw.Draw(card); draw.text((20,20), land.upper()+" | ORIGINAL / TILE 2x2 / NORMAL / HEIGHT / ROUGHNESS", fill="white")
        for i,e in enumerate(entries):
            y=65+i*180
            files=[REPO / e["sources"][0], out / e["maps"]["base-color"]["file"], out / e["maps"]["normal-opengl"]["file"], out / e["maps"]["height-estimated"]["file"], out / e["maps"]["roughness-estimated"]["file"]]
            draw.text((10,y+5),e["id"],fill="#ead58b")
            for col,path in enumerate(files):
                im=Image.open(path).convert("RGB");im.thumbnail((160,140))
                if col==1:
                    im.thumbnail((80,70)); tile=Image.new("RGB",(im.width*2,im.height*2))
                    for dx in range(2):
                        for dy in range(2):tile.paste(im,(dx*im.width,dy*im.height))
                    im=tile
                card.paste(im,(195+col*180,y+25))
        card.save(out/(land+"-review.jpg"),quality=85)
    cards="".join('<a href="'+l+'-review.jpg"><img loading="lazy" src="'+l+'-review.jpg" alt="'+l+'"><span>'+l+'</span></a>' for l in lands)
    (out/"gallery.html").write_text('<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>KI Legends — darmowe materiały</title><style>body{background:#101820;color:#eee;font:18px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}a{color:#ead58b}img{width:100%;max-height:420px;object-fit:contain;background:#1b2630}span{display:block;padding:12px}</style><h1>KI Legends — materiały do oceny</h1><p>10 lądów. Kolor, normalne OpenGL, szacowana wysokość i szorstkość. Bez instalacji do gry.</p><main>'+cards+'</main></html>')


if __name__ == "__main__":
    p=argparse.ArgumentParser();p.add_argument("command",choices=["inventory","derive","validate","gallery"]);p.add_argument("--out",type=Path,required=True)
    p.add_argument("--map-size",type=int,default=256,choices=[128,256,512,1024,2048])
    args=p.parse_args()
    if args.command == "derive": derive(args.out.resolve(),args.map_size)
    else: globals()[args.command](args.out.resolve())
