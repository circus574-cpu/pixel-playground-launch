#!/usr/bin/env python3
"""
Extracts & builds the cohesive AAA Architecture Pack (Pyra, Verdantia, Aetheria, Nexus-9)
and AAA Ornate Dark-Fantasy RPG UI Pack (portraits, filigree frames, beveled medallions,
116+ canonical painted icons, and 29-node progression JSON) for ports/godot-isometric-world.
"""

import json
import shutil
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REPO = Path(__file__).resolve().parents[2]
ART_DIR = Path("/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/48b1af26-2be3-4934-914d-17ea6b155df5")
OUT_OBJ = REPO / "ports/godot-isometric-world/assets/objects"
OUT_UI = REPO / "ports/godot-isometric-world/assets/ui"
OUT_ICONS = OUT_UI / "icons"
OUT_DATA = REPO / "ports/godot-isometric-world/data"

OUT_OBJ.mkdir(parents=True, exist_ok=True)
OUT_UI.mkdir(parents=True, exist_ok=True)
OUT_ICONS.mkdir(parents=True, exist_ok=True)
OUT_DATA.mkdir(parents=True, exist_ok=True)


def border_floodfill(cand: np.ndarray) -> np.ndarray:
    """Fast 4-connected BFS floodfill seeded from all True pixels along the 4 edges."""
    h, w = cand.shape
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        if cand[0, x] and not visited[0, x]:
            visited[0, x] = True
            q.append((0, x))
        if cand[h - 1, x] and not visited[h - 1, x]:
            visited[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(h):
        if cand[y, 0] and not visited[y, 0]:
            visited[y, 0] = True
            q.append((y, 0))
        if cand[y, w - 1] and not visited[y, w - 1]:
            visited[y, w - 1] = True
            q.append((y, w - 1))
    while q:
        cy, cx = q.popleft()
        if cy > 0 and cand[cy - 1, cx] and not visited[cy - 1, cx]:
            visited[cy - 1, cx] = True
            q.append((cy - 1, cx))
        if cy + 1 < h and cand[cy + 1, cx] and not visited[cy + 1, cx]:
            visited[cy + 1, cx] = True
            q.append((cy + 1, cx))
        if cx > 0 and cand[cy, cx - 1] and not visited[cy, cx - 1]:
            visited[cy, cx - 1] = True
            q.append((cy, cx - 1))
        if cx + 1 < w and cand[cy, cx + 1] and not visited[cy, cx + 1]:
            visited[cy, cx + 1] = True
            q.append((cy, cx + 1))
    return visited


def keep_main_components(fg_bin: np.ndarray, min_abs: int = 160, min_frac: float = 0.015) -> np.ndarray:
    """Keeps significant 4-connected foreground components (downsampled 2x for speed then dilated back)."""
    h, w = fg_bin.shape
    # Downsample 2x via PIL max-pooling for ultra-fast component labeling
    pil_small = Image.fromarray((fg_bin.astype(np.uint8) * 255), mode="L").resize(
        (max(1, w // 2), max(1, h // 2)), Image.Resampling.NEAREST
    )
    sm = np.asarray(pil_small, dtype=np.uint8) > 127
    sh, sw = sm.shape
    labels = np.zeros((sh, sw), dtype=np.int32)
    cur_label = 0
    sizes: list[int] = [0]
    for y in range(sh):
        for x in range(sw):
            if sm[y, x] and labels[y, x] == 0:
                cur_label += 1
                q: deque[tuple[int, int]] = deque([(y, x)])
                labels[y, x] = cur_label
                cnt = 0
                while q:
                    cy, cx = q.popleft()
                    cnt += 1
                    if cy > 0 and sm[cy - 1, cx] and labels[cy - 1, cx] == 0:
                        labels[cy - 1, cx] = cur_label
                        q.append((cy - 1, cx))
                    if cy + 1 < sh and sm[cy + 1, cx] and labels[cy + 1, cx] == 0:
                        labels[cy + 1, cx] = cur_label
                        q.append((cy + 1, cx))
                    if cx > 0 and sm[cy, cx - 1] and labels[cy, cx - 1] == 0:
                        labels[cy, cx - 1] = cur_label
                        q.append((cy, cx - 1))
                    if cx + 1 < sw and sm[cy, cx + 1] and labels[cy, cx + 1] == 0:
                        labels[cy, cx + 1] = cur_label
                        q.append((cy, cx + 1))
                sizes.append(cnt)
    if cur_label <= 1:
        return fg_bin
    max_sz = max(sizes[1:])
    thr = max(min_abs // 4, int(max_sz * min_frac))
    keep_lut = np.zeros(cur_label + 1, dtype=bool)
    for lid in range(1, cur_label + 1):
        if sizes[lid] >= thr:
            keep_lut[lid] = True
    kept_sm = keep_lut[labels]
    kept_up = Image.fromarray((kept_sm.astype(np.uint8) * 255), mode="L").resize((w, h), Image.Resampling.NEAREST)
    kept_dil = kept_up.filter(ImageFilter.MaxFilter(5))
    return np.asarray(kept_dil, dtype=np.uint8) > 127


def extract_quadrant_rgba(
    img: Image.Image,
    qx: int,
    qy: int,
    bg_mode: str = "white",
    margin_frac: float = 0.015,
) -> Image.Image:
    """Cleanly extracts one quadrant (qx, qy in {0,1}) from a 2x2 sheet with border-seeded
    floodfill, anti-aliased alpha feathering, color decontamination, and speckle removal."""
    W, H = img.size
    hw, hh = W // 2, H // 2
    mx, my = int(hw * margin_frac), int(hh * margin_frac)
    x0 = qx * hw + mx
    y0 = qy * hh + my
    x1 = (qx + 1) * hw - mx
    y1 = (qy + 1) * hh - my
    crop = img.crop((x0, y0, x1, y1)).convert("RGB")
    arr = np.asarray(crop, dtype=np.float32)
    ch, cw, _ = arr.shape

    border_px = np.concatenate([arr[0, :], arr[-1, :], arr[:, 0], arr[:, -1]], axis=0)
    bg_col = np.median(border_px, axis=0)
    dist = np.sqrt(np.sum((arr - bg_col[None, None, :]) ** 2, axis=-1))
    sat = np.max(arr, axis=-1) - np.min(arr, axis=-1)
    lum = np.mean(arr, axis=-1)

    if bg_mode == "white":
        bg_cand = (dist < 44.0) | ((lum > 226.0) & (sat < 24.0))
    else:
        bg_cand = (dist < 28.0) | (lum < 22.0)

    # Border-seeded floodfill so bright windows/smoke/marble INSIDE the building are NEVER punched out!
    is_bg = border_floodfill(bg_cand)
    fg_raw = ~is_bg

    # Compute 2-3px inner boundary fringe using PIL MinFilter erosion
    fg_pil = Image.fromarray((fg_raw.astype(np.uint8) * 255), mode="L")
    fg_erode1 = np.asarray(fg_pil.filter(ImageFilter.MinFilter(3)), dtype=np.uint8) > 127
    fg_erode2 = np.asarray(fg_pil.filter(ImageFilter.MinFilter(5)), dtype=np.uint8) > 127
    fringe1 = fg_raw & (~fg_erode1)
    fringe2 = fg_erode1 & (~fg_erode2)

    alpha = fg_raw.astype(np.float32)
    if bg_mode == "white":
        soft_w = np.clip((dist - 18.0) / 42.0, 0.0, 1.0)
        alpha = np.where(fringe1, soft_w * 0.78, alpha)
        alpha = np.where(fringe2, np.minimum(1.0, 0.45 + soft_w * 0.55), alpha)
        # Decontaminate white halo on semi-transparent boundary pixels
        decont_mask = (fringe1 | fringe2) & (alpha > 0.06) & (alpha < 0.98)
        fg_rgb = np.clip(
            (arr - bg_col[None, None, :] * (1.0 - alpha[..., None])) / np.maximum(alpha[..., None], 0.16),
            0.0,
            255.0,
        )
        rgb = np.where(decont_mask[..., None], fg_rgb, arr)
    else:
        soft_d = np.clip((dist - 12.0) / 30.0, 0.0, 1.0)
        alpha = np.where(fringe1, soft_d * 0.82, alpha)
        alpha = np.where(fringe2, np.minimum(1.0, 0.50 + soft_d * 0.50), alpha)
        rgb = arr

    # Keep only significant foreground components (prune tiny detached specks)
    keep_mask = keep_main_components(alpha > 0.25, min_abs=180, min_frac=0.012)
    alpha = np.where(keep_mask, alpha, 0.0)

    rgba = np.zeros((ch, cw, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)

    out = Image.fromarray(rgba, mode="RGBA")
    bbox = out.getbbox()
    if bbox:
        pad = 6
        bx0 = max(0, bbox[0] - pad)
        by0 = max(0, bbox[1] - pad)
        bx1 = min(cw, bbox[2] + pad)
        by1 = min(ch, bbox[3] + pad)
        out = out.crop((bx0, by0, bx1, by1))
    return out


def clean_existing_webp(src: Path, dst: Path, prune_specks: bool = True) -> None:
    """Copies an existing realistic ki-v2 building sprite while removing stray floating specks."""
    img = Image.open(src).convert("RGBA")
    arr = np.asarray(img, dtype=np.uint8).copy()
    if prune_specks:
        keep_mask = keep_main_components(arr[..., 3] > 28, min_abs=450, min_frac=0.03)
        arr[..., 3] = np.where(keep_mask, arr[..., 3], 0)
    out = Image.fromarray(arr, mode="RGBA")
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    out.save(dst, "WEBP", quality=92, method=5)


def extract_all_buildings() -> None:
    sheets = [
        (
            ART_DIR / "pyra_arch_sheet_1_1795077094273.jpg",
            "white",
            [
                (0, 0, "pyra-aaa-hall.webp"),
                (1, 0, "pyra-aaa-smithy.webp"),
                (0, 1, "pyra-aaa-inn.webp"),
                (1, 1, "pyra-aaa-shop.webp"),
            ],
        ),
        (
            ART_DIR / "pyra_arch_sheet_2_1795077088896.jpg",
            "white",
            [
                (0, 0, "pyra-aaa-arena.webp"),
                (1, 0, "pyra-aaa-depot.webp"),
                (0, 1, "pyra-aaa-house.webp"),
                (1, 1, "pyra-aaa-altar.webp"),
            ],
        ),
        (
            ART_DIR / "verdant_arch_sheet_1_1795077092188.jpg",
            "white",
            [
                (0, 0, "verdant-aaa-smithy.webp"),
                (1, 0, "verdant-aaa-inn.webp"),
                (0, 1, "verdant-aaa-shop.webp"),
                (1, 1, "verdant-aaa-arena.webp"),
            ],
        ),
        (
            ART_DIR / "verdant_arch_sheet_2_1795077094684.jpg",
            "white",
            [
                (0, 0, "verdant-aaa-depot.webp"),
                (1, 0, "verdant-aaa-house.webp"),
                (0, 1, "verdant-aaa-forge.webp"),
                (1, 1, "verdant-aaa-cottage.webp"),
            ],
        ),
        (
            ART_DIR / "aether_arch_sheet_1_1795077208330.jpg",
            "dark",
            [
                (0, 0, "aether-aaa-hall.webp"),
                (1, 0, "aether-aaa-smithy.webp"),
                (0, 1, "aether-aaa-inn.webp"),
                (1, 1, "aether-aaa-shop.webp"),
            ],
        ),
    ]

    for sheet_path, bg_mode, mapping in sheets:
        assert sheet_path.exists(), f"Missing sheet: {sheet_path}"
        im = Image.open(sheet_path)
        for qx, qy, out_name in mapping:
            spr = extract_quadrant_rgba(im, qx, qy, bg_mode=bg_mode)
            spr.save(OUT_OBJ / out_name, "WEBP", quality=92, method=5)
            print(f"  [AAA building] {out_name} -> {spr.size}")

    # Copy & clean dark realistic ki-v2-buildings for Nexus-9 and secondary Aetheria buildings
    ki_v2_dir = REPO / "public/game/assets/gpu/ki-v2-buildings/1.2.0-5b3473709d23"
    ki_v2_map = {
        "ki-v2-buildings-aether-arena.webp": "aether-aaa-arena.webp",
        "ki-v2-buildings-aether-depot.webp": "aether-aaa-depot.webp",
        "ki-v2-buildings-aether-house.webp": "aether-aaa-house.webp",
        "ki-v2-buildings-nexus-hall.webp": "nexus-aaa-hall.webp",
        "ki-v2-buildings-nexus-arena.webp": "nexus-aaa-arena.webp",
        "ki-v2-buildings-nexus-depot.webp": "nexus-aaa-depot.webp",
        "ki-v2-buildings-nexus-market.webp": "nexus-aaa-shop.webp",
        "ki-v2-buildings-nexus-smithy.webp": "nexus-aaa-smithy.webp",
        "ki-v2-buildings-nexus-inn.webp": "nexus-aaa-inn.webp",
        "ki-v2-buildings-nexus-house.webp": "nexus-aaa-house.webp",
    }
    for src_name, dst_name in ki_v2_map.items():
        src_p = ki_v2_dir / src_name
        if src_p.exists():
            clean_existing_webp(src_p, OUT_OBJ / dst_name, prune_specks=True)
            print(f"  [ki-v2 cleaned] {dst_name}")


def make_beveled_ring(size: int, r_outer: float, r_inner: float, gold_rgb: tuple, dark_rgb: tuple, glow_rgb: tuple | None = None, prongs: bool = True) -> Image.Image:
    """Renders a high-resolution sculpted metallic beveled ring with specular highlights,
    inner engraved rim, subtle drop shadow, and 4 cardinal filigree diamond clasps."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) * 0.5
    dx = (xx - c) / (size * 0.5)
    dy = (yy - c) / (size * 0.5)
    rad = np.sqrt(dx * dx + dy * dy)
    ang = np.arctan2(dy, dx)

    rgba = np.zeros((size, size, 4), dtype=np.float32)

    # Soft outer drop shadow / optional radiant aura glow
    if glow_rgb is not None:
        g_ring = np.exp(-((rad - (r_outer + 0.03)) ** 2) / (2.0 * 0.065 ** 2))
        rgba[..., 0] += glow_rgb[0] * g_ring * 0.65
        rgba[..., 1] += glow_rgb[1] * g_ring * 0.65
        rgba[..., 2] += glow_rgb[2] * g_ring * 0.65
        rgba[..., 3] = np.maximum(rgba[..., 3], g_ring * 0.55)
    else:
        sh = np.exp(-((rad - (r_outer + 0.02)) ** 2) / (2.0 * 0.045 ** 2))
        rgba[..., 3] = np.maximum(rgba[..., 3], sh * 0.58)

    # Ring band mask with crisp AA
    ring_w = r_outer - r_inner
    u = (rad - r_inner) / max(ring_w, 1e-4)  # 0 at inner edge, 1 at outer edge
    aa = 2.0 / size
    in_ring = np.clip((rad - (r_inner - aa)) / (2 * aa), 0.0, 1.0) * np.clip(((r_outer + aa) - rad) / (2 * aa), 0.0, 1.0)

    # Sculpted curved cross-section normal + filigree ridging
    ridge = np.sin(np.clip(u, 0.0, 1.0) * np.pi)
    groove = 0.88 + 0.12 * np.cos(u * np.pi * 4.0)
    # Brushed directional lighting from top-left (-0.65, -0.75)
    light = 0.52 + 0.48 * (-dx * 0.65 - dy * 0.75) / np.maximum(rad, 0.15)
    spec = np.clip(light, 0.0, 1.0) ** 3.2 * 0.55
    # Engraved notch detail around perimeter
    engrave = 0.94 + 0.06 * np.cos(ang * 24.0)

    shade = np.clip((0.38 + 0.62 * ridge) * groove * (0.62 + 0.55 * light) * engrave, 0.15, 1.45)
    base_col = np.array(dark_rgb, dtype=np.float32) * (1.0 - ridge[..., None]) + np.array(gold_rgb, dtype=np.float32) * ridge[..., None]
    col = np.clip(base_col * shade[..., None] + spec[..., None] * np.array([1.0, 0.96, 0.85]), 0.0, 1.0)

    # Dark engraved bevel edges at u near 0 and u near 1
    edge_dark = np.clip(np.minimum(u, 1.0 - u) / 0.16, 0.35, 1.0)
    col *= edge_dark[..., None]

    # Blend ring over aura/shadow
    rgba[..., :3] = rgba[..., :3] * (1.0 - in_ring[..., None]) + col * in_ring[..., None]
    rgba[..., 3] = np.clip(rgba[..., 3] * (1.0 - in_ring) + in_ring, 0.0, 1.0)

    out = Image.fromarray(np.clip(rgba * 255.0, 0, 255).astype(np.uint8), mode="RGBA")

    if prongs:
        # Draw 4 sculpted metallic 3D-faceted cardinal diamond clasps
        draw = ImageDraw.Draw(out)
        r_mid = (r_outer + r_inner) * 0.5 * (size * 0.5)
        pr_len = max(4.5, ring_w * size * 0.44)
        pr_w = max(3.2, ring_w * size * 0.28)
        g_lit = tuple(int(min(255, v * 255 * 1.18 + 18)) for v in gold_rgb) + (255,)
        g_mid = tuple(int(min(255, v * 255 * 0.90)) for v in gold_rgb) + (255,)
        g_shd = tuple(int(max(0, v * 255 * 0.72)) for v in dark_rgb) + (255,)
        g_rim = tuple(int(max(0, v * 255 * 0.42)) for v in dark_rgb) + (255,)
        for ax, ay in [(0, -1), (1, 0), (0, 1), (-1, 0)]:
            px, py = c + ax * r_mid, c + ay * r_mid
            tip_out = (px + ax * pr_len, py + ay * pr_len)
            tip_in = (px - ax * pr_len * 0.74, py - ay * pr_len * 0.74)
            side_l = (px - ay * pr_w, py + ax * pr_w)
            side_r = (px + ay * pr_w, py - ax * pr_w)
            ctr = (px, py)
            # 4 metallic facets for true 3D jewel relief
            draw.polygon([tip_out, side_l, ctr], fill=g_lit)
            draw.polygon([tip_out, side_r, ctr], fill=g_mid)
            draw.polygon([tip_in, side_l, ctr], fill=g_mid)
            draw.polygon([tip_in, side_r, ctr], fill=g_shd)
            draw.line([tip_out, side_l, tip_in, side_r, tip_out], fill=g_rim, width=2)
            gem_r = pr_w * 0.34
            draw.ellipse([px - gem_r, py - gem_r, px + gem_r, py + gem_r], fill=(255, 248, 224, 255), outline=g_rim)

    return out


def make_skill_slot_frame(size: int = 128) -> Image.Image:
    """Renders a sculpted dark-obsidian & antique-gold beveled square RPG skill socket frame
    with ornate metallic corner brackets and inner depth recess."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    m = 5.0
    dx = np.maximum(m - xx, xx - (size - 1 - m))
    dy = np.maximum(m - yy, yy - (size - 1 - m))
    d_box = np.maximum(dx, dy)
    in_outer = (d_box <= 1.0) & (d_box >= -7.5)
    t = np.clip((-d_box) / 7.5, 0.0, 1.0)
    ridge = np.sin(t * np.pi)
    light = 0.55 + 0.45 * (-(xx - size * 0.5) * 0.7 - (yy - size * 0.5) * 0.7) / (size * 0.7)

    gold_hi = np.array([0.88, 0.71, 0.38], dtype=np.float32)
    gold_lo = np.array([0.28, 0.20, 0.10], dtype=np.float32)
    col = (gold_lo * (1.0 - ridge[..., None]) + gold_hi * ridge[..., None]) * np.clip(0.55 + 0.65 * light[..., None], 0.3, 1.3)

    arr = np.zeros((size, size, 4), dtype=np.float32)
    out_sh = np.clip(1.0 - np.maximum(d_box, 0.0) / 5.0, 0.0, 1.0) * (d_box > 0.0)
    arr[..., 3] = out_sh * 0.55
    arr[..., :3] = np.where(in_outer[..., None], col, arr[..., :3])
    arr[..., 3] = np.where(in_outer, 0.98, arr[..., 3])
    in_inner = (d_box < -7.5) & (d_box > -15.0)
    in_v = np.clip((d_box + 15.0) / 7.5, 0.0, 1.0) * 0.48
    arr[..., 3] = np.where(in_inner, in_v, arr[..., 3])

    out = Image.fromarray(np.clip(arr * 255.0, 0, 255).astype(np.uint8), mode="RGBA")
    draw = ImageDraw.Draw(out)
    corners = [(4, 4, 1, 1), (size - 5, 4, -1, 1), (4, size - 5, 1, -1), (size - 5, size - 5, -1, -1)]
    for cx, cy, sx, sy in corners:
        pts = [
            (cx, cy),
            (cx + sx * 17, cy),
            (cx + sx * 13, cy + sy * 5),
            (cx + sx * 5, cy + sy * 5),
            (cx + sx * 5, cy + sy * 13),
            (cx, cy + sy * 17),
        ]
        draw.polygon(pts, fill=(214, 174, 96, 255), outline=(58, 40, 18, 255))
        draw.ellipse([cx + sx * 3 - 2, cy + sy * 3 - 2, cx + sx * 3 + 2, cy + sy * 3 + 2], fill=(255, 244, 206, 255))
    return out


def build_ui_assets() -> None:
    # 1) Ornate gilded obsidian constellation tablet backdrop for [K] & [I]
    tb_src = ART_DIR / "talent_tree_backdrop_1795077096126.jpg"
    assert tb_src.exists(), f"Missing talent backdrop: {tb_src}"
    tb_img = Image.open(tb_src).convert("RGB")
    tb_img.resize((1376, 768), Image.Resampling.LANCZOS).save(OUT_UI / "talent_backdrop.webp", "WEBP", quality=92)
    print(f"  [UI] talent_backdrop.webp -> (1376, 768)")

    # 2) Extract the REAL painted top-center antique gold Fleur-de-lis crest finial from talent_tree_backdrop!
    W, H = tb_img.size
    crest_crop = tb_img.crop((int(W * 0.40), 0, int(W * 0.60), int(H * 0.19))).convert("RGB")
    carr = np.asarray(crest_crop, dtype=np.float32)
    lum = 0.299 * carr[..., 0] + 0.587 * carr[..., 1] + 0.114 * carr[..., 2]
    warm = carr[..., 0] - carr[..., 2]
    dark_bg = (lum < 34.0) & (warm < 18.0)
    is_bg = border_floodfill(dark_bg)
    ca_img = Image.fromarray(((~is_bg).astype(np.uint8) * 255), mode="L").filter(ImageFilter.GaussianBlur(0.8))
    ca = np.asarray(ca_img, dtype=np.float32) / 255.0
    ca = np.where(is_bg, 0.0, ca)
    # Remove any tiny floating dust specks below the crest
    crest_main = keep_main_components(ca > 0.30, min_abs=300, min_frac=0.04)
    ca = np.where(crest_main, ca, 0.0)
    cw_c = carr.shape[1]
    x_norm = np.abs((np.arange(cw_c, dtype=np.float32) / max(cw_c - 1, 1)) - 0.5) * 2.0
    ca *= np.clip(1.0 - np.maximum(x_norm - 0.62, 0.0) / 0.38, 0.0, 1.0)
    c_rgba = np.zeros((carr.shape[0], cw_c, 4), dtype=np.uint8)
    c_rgba[..., :3] = carr.astype(np.uint8)
    c_rgba[..., 3] = np.clip(ca * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(c_rgba, mode="RGBA").save(OUT_UI / "hud_crest_top.png")
    print("  [UI] hud_crest_top.png extracted from painted filigree (spotless)")

    # 3) Sculpted metallic rings & skill slot frame
    make_beveled_ring(256, 0.92, 0.77, (0.92, 0.74, 0.38), (0.34, 0.23, 0.10), glow_rgb=None, prongs=True).save(OUT_UI / "hud_portrait_ring.png")
    make_beveled_ring(128, 0.90, 0.72, (0.50, 0.48, 0.46), (0.20, 0.19, 0.21), glow_rgb=None, prongs=False).save(OUT_UI / "hud_node_ring_locked.png")
    make_beveled_ring(128, 0.91, 0.72, (0.44, 0.88, 0.98), (0.14, 0.36, 0.48), glow_rgb=(0.24, 0.82, 1.0), prongs=True).save(OUT_UI / "hud_node_ring_avail.png")
    make_beveled_ring(128, 0.92, 0.72, (0.98, 0.80, 0.40), (0.42, 0.27, 0.10), glow_rgb=(1.0, 0.78, 0.28), prongs=True).save(OUT_UI / "hud_node_ring_unlocked.png")
    make_beveled_ring(160, 0.92, 0.73, (1.0, 0.86, 0.46), (0.48, 0.26, 0.08), glow_rgb=(1.0, 0.56, 0.18), prongs=True).save(OUT_UI / "hud_node_ring_keystone.png")
    make_skill_slot_frame(128).save(OUT_UI / "hud_skill_slot.png")
    print("  [UI] Sculpted gold/bronze/cyan bezel rings & skill socket frame generated")

    # 4) Crop the 4 Canonical Hero Portraits from public/game/assets/brand/heroes-700.webp (700x670)
    heroes_src = REPO / "public/game/assets/brand/heroes-700.webp"
    if heroes_src.exists():
        hi = Image.open(heroes_src).convert("RGB")
        # Verified coordinates on heroes-700.webp (700 x 670):
        # Sage (Aetheria): top-left (100..265, 35..200)
        # Legend (Pyra): center (275..445, 95..265)
        # Android (Nexus-9): top-right (435..595, 55..215)
        # Planetary (Verdantia): mid-right (505..670, 225..390)
        crops = {
            "portrait_aether.webp": (105, 42, 265, 202),
            "portrait_pyra.webp": (282, 102, 442, 262),
            "portrait_nexus.webp": (438, 60, 598, 220),
            "portrait_verdant.webp": (508, 232, 668, 392),
        }
        for fname, box in crops.items():
            hi.crop(box).resize((224, 224), Image.Resampling.LANCZOS).save(OUT_UI / fname, "WEBP", quality=92)
            print(f"  [UI portrait] {fname}")

    # 5) Extract clean painted RPG menu emblems from public/game/assets/ui-v2.webp (3x3 grid!)
    uiv2_src = REPO / "public/game/assets/ui-v2.webp"
    if uiv2_src.exists():
        u2 = Image.open(uiv2_src).convert("RGB")
        uw, uh = u2.size
        cw3, ch3 = uw // 3, uh // 3
        u2_cells = {
            "emblem_crystal.webp": (1, 0),
            "emblem_slash.webp": (2, 0),
            "emblem_shield.webp": (0, 1),
            "emblem_potion.webp": (1, 1),
            "emblem_pack.webp": (2, 1),
            "emblem_scroll.webp": (0, 2),
            "emblem_gear.webp": (1, 2),
            "emblem_swords.webp": (2, 2),
        }
        for fname, (cx, cy) in u2_cells.items():
            pad = 8
            cell = u2.crop((cx * cw3 + pad, cy * ch3 + pad, (cx + 1) * cw3 - pad, (cy + 1) * ch3 - pad))
            cell.resize((128, 128), Image.Resampling.LANCZOS).save(OUT_ICONS / fname, "WEBP", quality=90)
        print("  [UI emblems] 8 painted emblems extracted from ui-v2.webp")

    # 6) Copy all 116+ canonical painted skill/talent/HUD icons from icons-v3 and gear icons from icons-v2
    v3_dir = REPO / "public/game/icons-v3"
    count_v3 = 0
    if v3_dir.exists():
        for p in v3_dir.glob("*.webp"):
            shutil.copy2(p, OUT_ICONS / p.name)
            count_v3 += 1
    v2_dir = REPO / "public/game/icons-v2"
    count_v2 = 0
    if v2_dir.exists():
        for p in v2_dir.glob("*.webp"):
            shutil.copy2(p, OUT_ICONS / f"gear-{p.name}")
            count_v2 += 1
    print(f"  [UI icons] Copied {count_v3} icons-v3 + {count_v2} icons-v2 gear icons")

    # 7) Export canonical 29-node racial progression JSON to ports/godot-isometric-world/data/progression.json
    prog_src = REPO / "docs/design/data/character-progression-1-20.json"
    if prog_src.exists():
        shutil.copy2(prog_src, OUT_DATA / "progression.json")
        print("  [Data] Exported canonical progression.json (4 races x 29 nodes)")


if __name__ == "__main__":
    print("=== Extracting AAA Buildings & Ornate RPG UI Pack ===")
    extract_all_buildings()
    build_ui_assets()
    print("=== DONE ===")
