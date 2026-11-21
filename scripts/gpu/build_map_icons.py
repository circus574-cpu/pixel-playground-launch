#!/usr/bin/env python3
"""
Builds studio-grade painted heraldic map medallions (128x128 RGBA .webp, 4x supersampled)
for KI Legends 2D Atlas, 3D Relief Map, 3D Globe, and Dynamic Minimap — eliminating all
primitive geometric cones, pyramids, and flat circles.
"""

from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[2]
ISO_ROOT = REPO_ROOT / "ports/godot-isometric-world"
UI_DIR = ISO_ROOT / "assets/ui"
ICONS_DIR = UI_DIR / "icons"
OUT_DIR = UI_DIR / "map_icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def make_radial_glow(size: int, inner_rgba: tuple[int, int, int, int], outer_rgba: tuple[int, int, int, int]) -> Image.Image:
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = im.load()
    c = (size - 1) * 0.5
    for y in range(size):
        dy = (y - c) / c
        for x in range(size):
            dx = (x - c) / c
            r = math.hypot(dx, dy)
            if r <= 1.0:
                t = r * r
                col = tuple(int(inner_rgba[i] * (1.0 - t) + outer_rgba[i] * t) for i in range(4))
                px[x, y] = col
    return im


def circular_crop_icon(src_path: Path, target_px: int, zoom: float = 1.0) -> Image.Image:
    im = Image.open(src_path).convert("RGBA")
    w, h = im.size
    side = int(min(w, h) / max(zoom, 1.0))
    x0 = (w - side) // 2
    y0 = int((h - side) * 0.32) if "portrait_" in src_path.name else (h - side) // 2
    y0 = max(0, min(y0, h - side))
    crop = im.crop((x0, y0, x0 + side, y0 + side)).resize((target_px, target_px), Image.Resampling.LANCZOS)
    mask = Image.new("L", (target_px, target_px), 0)
    ImageDraw.Draw(mask).ellipse((2, 2, target_px - 3, target_px - 3), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=1.0))
    out = Image.new("RGBA", (target_px, target_px), (0, 0, 0, 0))
    out.paste(crop, (0, 0), mask)
    return out


def build_medallion(
    out_name: str,
    inner_icon: Path | None,
    rim_gold: tuple[int, int, int],
    rim_dark: tuple[int, int, int],
    core_bg: tuple[int, int, int],
    accent_glow: tuple[int, int, int],
    kind: str = "service",
) -> None:
    S = 256  # 2x supersampling -> resize to 128x128
    cx, cy = S // 2, S // 2
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)

    # Soft contact drop shadow
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    if kind == "town":
        r = 96
        pts_sh = [
            (cx, cy - r + 10),
            (cx + int(r * 0.88), cy - int(r * 0.42) + 10),
            (cx + int(r * 0.78), cy + int(r * 0.44) + 10),
            (cx, cy + r + 10),
            (cx - int(r * 0.78), cy + int(r * 0.44) + 10),
            (cx - int(r * 0.88), cy - int(r * 0.42) + 10),
        ]
        sd.polygon(pts_sh, fill=(0, 0, 0, 170))
    else:
        r = 104 if kind == "capital" else (98 if kind == "hero" else 90)
        sd.ellipse((cx - r, cy - r + 8, cx + r, cy + r + 8), fill=(0, 0, 0, 175))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=10))
    canvas = Image.alpha_composite(canvas, sh)
    d = ImageDraw.Draw(canvas)

    if kind == "capital":
        # Royal 8-point gilded heraldic starburst behind circular obsidian jewel + golden crown fortress
        star_outer = 118
        star_inner = 86
        star_pts = []
        for i in range(16):
            ang = -math.pi * 0.5 + (2.0 * math.pi * i) / 16.0
            rad = star_outer if i % 2 == 0 else star_inner
            star_pts.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad))
        d.polygon(star_pts, fill=(*rim_dark, 255), outline=(30, 18, 6, 255))
        star_pts2 = []
        for i in range(16):
            ang = -math.pi * 0.5 + (2.0 * math.pi * i) / 16.0
            rad = (star_outer - 8) if i % 2 == 0 else (star_inner - 5)
            star_pts2.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad))
        d.polygon(star_pts2, fill=(*rim_gold, 255))

        # Sculpted double bezel
        d.ellipse((cx - 86, cy - 86, cx + 86, cy + 86), fill=(26, 16, 8, 255))
        d.ellipse((cx - 80, cy - 80, cx + 80, cy + 80), fill=(*rim_gold, 255))
        d.ellipse((cx - 68, cy - 68, cx + 68, cy + 68), fill=(*core_bg, 255))
        glow = make_radial_glow(136, (*accent_glow, 110), (*core_bg, 0))
        canvas.alpha_composite(glow, (cx - 68, cy - 68))
        d = ImageDraw.Draw(canvas)

        # Painted Royal Citadel + Crown silhouette inside the jewel
        # Base fortress towers
        gold_hi = (255, 232, 148, 255)
        gold_mid = (224, 174, 76, 255)
        gold_sh = (128, 86, 28, 255)
        # Main keep wall
        d.rectangle((cx - 42, cy - 6, cx + 42, cy + 38), fill=gold_mid, outline=gold_sh, width=3)
        # Left & right turrets
        d.rectangle((cx - 48, cy - 28, cx - 24, cy + 38), fill=gold_hi, outline=gold_sh, width=3)
        d.rectangle((cx + 24, cy - 28, cx + 48, cy + 38), fill=gold_hi, outline=gold_sh, width=3)
        # Central spire
        d.rectangle((cx - 16, cy - 42, cx + 16, cy + 38), fill=gold_hi, outline=gold_sh, width=3)
        # Roof spires
        d.polygon([(cx - 52, cy - 26), (cx - 36, cy - 52), (cx - 20, cy - 26)], fill=gold_hi, outline=gold_sh)
        d.polygon([(cx + 20, cy - 26), (cx + 36, cy - 52), (cx + 52, cy - 26)], fill=gold_hi, outline=gold_sh)
        d.polygon([(cx - 22, cy - 40), (cx, cy - 66), (cx + 22, cy - 40)], fill=(255, 246, 198, 255), outline=gold_sh)
        # Warm glowing arched gate & windows
        d.chord((cx - 11, cy + 12, cx + 11, cy + 44), 180, 360, fill=(42, 18, 6, 255))
        d.rectangle((cx - 11, cy + 26, cx + 11, cy + 38), fill=(42, 18, 6, 255))
        d.ellipse((cx - 5, cy - 28, cx + 5, cy - 16), fill=(255, 168, 48, 255))

    elif kind == "town":
        # Distinct Silver-Steel & Bronze Heraldic Shield Crest for Towns / Castles / Outposts
        r = 98
        pts_out = [
            (cx, cy - r),
            (cx + int(r * 0.88), cy - int(r * 0.42)),
            (cx + int(r * 0.78), cy + int(r * 0.44)),
            (cx, cy + r),
            (cx - int(r * 0.78), cy + int(r * 0.44)),
            (cx - int(r * 0.88), cy - int(r * 0.42)),
        ]
        d.polygon(pts_out, fill=(24, 30, 40, 255))
        pts_rim = [(cx + (x - cx) * 0.91, cy + (y - cy) * 0.91) for x, y in pts_out]
        d.polygon(pts_rim, fill=(*rim_gold, 255))
        pts_in = [(cx + (x - cx) * 0.78, cy + (y - cy) * 0.78) for x, y in pts_out]
        d.polygon(pts_in, fill=(*core_bg, 255))

        glow = make_radial_glow(140, (*accent_glow, 95), (*core_bg, 0))
        canvas.alpha_composite(glow, (cx - 70, cy - 70))
        d = ImageDraw.Draw(canvas)

        # Crisp Battlement Keep Tower icon inside the shield
        sil_hi = (232, 242, 252, 255)
        sil_mid = (168, 194, 218, 255)
        sil_sh = (42, 56, 78, 255)
        d.rectangle((cx - 34, cy - 22, cx + 34, cy + 36), fill=sil_mid, outline=sil_sh, width=3)
        # Crenellations (3 merlons)
        for mx in (-34, -10, 14):
            d.rectangle((cx + mx, cy - 40, cx + mx + 20, cy - 18), fill=sil_hi, outline=sil_sh, width=3)
        # Warm lantern gate
        d.chord((cx - 12, cy + 6, cx + 12, cy + 38), 180, 360, fill=(255, 206, 98, 255), outline=sil_sh, width=2)
        d.rectangle((cx - 12, cy + 22, cx + 12, cy + 36), fill=(255, 206, 98, 255))

    elif kind == "bridge":
        # Sculpted horizontal stone-arch bridge badge
        d.rounded_rectangle((cx - 82, cy - 52, cx + 82, cy + 52), radius=24, fill=(26, 18, 12, 255), outline=(*rim_gold, 255), width=8)
        d.rounded_rectangle((cx - 64, cy - 26, cx + 64, cy + 16), radius=10, fill=(214, 178, 122, 255), outline=(72, 48, 24, 255), width=4)
        # Arch cutout beneath deck
        d.chord((cx - 36, cy - 6, cx + 36, cy + 54), 180, 360, fill=(36, 96, 142, 255), outline=(72, 48, 24, 255), width=3)

    else:
        # Circular sculpted gold/cyan bezel housing a REAL painted icon or Hero Portrait!
        r_out = 98 if kind == "hero" else 90
        r_rim = r_out - 6
        r_in = r_out - 18
        d.ellipse((cx - r_out, cy - r_out, cx + r_out, cy + r_out), fill=(18, 14, 12, 255))
        d.ellipse((cx - r_rim, cy - r_rim, cx + r_rim, cy + r_rim), fill=(*rim_gold, 255))
        d.ellipse((cx - r_in - 3, cy - r_in - 3, cx + r_in + 3, cy + r_in + 3), fill=(*rim_dark, 255))
        d.ellipse((cx - r_in, cy - r_in, cx + r_in, cy + r_in), fill=(*core_bg, 255))

        glow = make_radial_glow(r_in * 2, (*accent_glow, 95), (*core_bg, 0))
        canvas.alpha_composite(glow, (cx - r_in, cy - r_in))

        if inner_icon is not None and inner_icon.exists():
            icon_sz = int(r_in * (1.96 if kind == "hero" else 1.72))
            cropped = circular_crop_icon(inner_icon, icon_sz, zoom=1.18 if kind == "hero" else 1.0)
            canvas.alpha_composite(cropped, (cx - icon_sz // 2, cy - icon_sz // 2))

        # Crisp top specular arc & inner rim highlight
        d = ImageDraw.Draw(canvas)
        d.arc((cx - r_rim + 2, cy - r_rim + 2, cx + r_rim - 2, cy + r_rim - 2), 205, 335, fill=(255, 250, 224, 190), width=4)
        if kind == "hero":
            # Small north-pointing direction caret at top of Hero Portrait Medallion
            d.polygon([(cx, cy - r_out - 14), (cx - 16, cy - r_out + 8), (cx + 16, cy - r_out + 8)], fill=(86, 248, 255, 255), outline=(14, 24, 34, 255))

    final = canvas.resize((128, 128), Image.Resampling.LANCZOS)
    final.save(OUT_DIR / out_name, format="WEBP", quality=94, method=6)
    print(f"  [MAP_ICON] {out_name}")


def main() -> None:
    print("=== Building AAA Painted Heraldic Map Medallions ===")
    build_medallion("pin_capital.webp", None, (246, 204, 96), (138, 92, 26), (34, 20, 12), (255, 192, 64), kind="capital")
    build_medallion("pin_town.webp", None, (196, 222, 244), (78, 102, 128), (22, 34, 52), (112, 186, 242), kind="town")
    build_medallion("pin_bridge.webp", None, (224, 186, 114), (112, 76, 36), (36, 26, 18), (242, 204, 134), kind="bridge")

    # Hero Portrait Medallions for all 4 races
    for land in ("pyra", "verdant", "aether", "nexus"):
        build_medallion(
            f"pin_hero_{land}.webp",
            UI_DIR / f"portrait_{land}.webp",
            (88, 242, 255),
            (22, 92, 118),
            (14, 28, 38),
            (64, 232, 255),
            kind="hero",
        )

    # Enterable Utility Building Medallions (using real painted icons-v3 / ui-v2 art!)
    service_specs = [
        ("pin_hall.webp", ICONS_DIR / "emblem_scroll.webp", (218, 178, 252), (96, 56, 140), (34, 18, 48), (192, 126, 255)),
        ("pin_smithy.webp", ICONS_DIR / "emblem_gear.webp", (255, 152, 68), (144, 62, 16), (44, 18, 8), (255, 116, 34)),
        ("pin_inn.webp", ICONS_DIR / "emblem_potion.webp", (252, 202, 96), (142, 96, 26), (42, 26, 10), (255, 186, 62)),
        ("pin_shop.webp", ICONS_DIR / "gear-coin.webp", (98, 238, 148), (30, 116, 62), (12, 38, 22), (62, 224, 122)),
        ("pin_arena.webp", ICONS_DIR / "emblem_swords.webp", (252, 98, 86), (138, 32, 24), (44, 12, 10), (255, 68, 56)),
        ("pin_depot.webp", ICONS_DIR / "emblem_pack.webp", (98, 212, 252), (32, 98, 138), (12, 32, 46), (62, 196, 255)),
        ("pin_landmark.webp", ICONS_DIR / "emblem_crystal.webp", (246, 210, 112), (134, 96, 32), (36, 26, 12), (255, 208, 88)),
    ]
    for name, src, r_g, r_d, bg, gl in service_specs:
        build_medallion(name, src, r_g, r_d, bg, gl, kind="service")
    print("MAP_ICONS_DONE")


if __name__ == "__main__":
    main()
