#!/usr/bin/env python3
"""
Builds the canonical, owner-reference-faithful (1794997646341.jpg) cartographic assets
for KI Legends Planet Superior:
  1. 1024x1024 painterly continent relief maps: regions/<land>/map_art.png
  2. 256x256 sculpted 3D island heightmaps: regions/<land>/relief_3d.r32 (for [M] Mapa 3D)
  3. 1024x1024 premium cartographic minimap textures: regions/<land>/minimap_hq.png
  4. 2048x1024 Planet Superior 2D Atlas & 3D Globe texture:
       atlas/planet_real_world.png + assets/map/globe-real-world.webp
"""

import json
import struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[2]
ISO_ROOT = REPO_ROOT / "ports/godot-isometric-world"
ART_DIR = Path(
    "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/48b1af26-2be3-4934-914d-17ea6b155df5"
)

CONTINENT_SOURCES = {
    "verdant": ART_DIR / "verdantia_cartography_ref_1795069767315.jpg",
    "aether": ART_DIR / "aetheria_cartography_ref_1795069769337.jpg",
    "nexus": ART_DIR / "nexus_cartography_ref_1795069770945.jpg",
    "pyra": ART_DIR / "pyra_cartography_ref_1795069772869.jpg",
}


def compute_ocean_bg_color(arr: np.ndarray) -> np.ndarray:
    """Sample deep ocean color from the 4 corners of the source art."""
    h, w, _ = arr.shape
    m = 28
    samples = np.concatenate(
        [
            arr[:m, :m].reshape(-1, 3),
            arr[:m, w - m :].reshape(-1, 3),
            arr[h - m :, :m].reshape(-1, 3),
            arr[h - m :, w - m :].reshape(-1, 3),
        ],
        axis=0,
    )
    return np.median(samples, axis=0)


def extract_land_mask(arr: np.ndarray, land_id: str) -> tuple[np.ndarray, np.ndarray]:
    """Return (land_mask_0_1, ocean_color_rgb) cleanly separating the island from ocean."""
    h, w, _ = arr.shape
    ocean = compute_ocean_bg_color(arr)
    dist = np.linalg.norm(arr - ocean[None, None, :], axis=2)

    # Also detect turquoise coastal glow vs deep ocean
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    is_deep_blue = (b > r + 14.0) & (b > g + 4.0) & (dist < 42.0)

    if land_id == "aether":
        # Snow-white & icy blue land is bright compared to dark slate ocean
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        raw = ((dist > 28.0) | (lum > 118.0)) & (~is_deep_blue)
    elif land_id == "pyra":
        # Clean stray island fragment at very top / top-right border of pyra source
        raw = (dist > 26.0) & (~is_deep_blue)
        raw[:105, :] = False
        raw[:145, int(w * 0.86) :] = False
    else:
        raw = (dist > 26.0) & (~is_deep_blue)

    # Keep only the main island + close coastal islets via flood-fill from borders
    # (anything touching the outer border is ocean)
    mask_u8 = (raw.astype(np.uint8)) * 255
    pil_m = Image.fromarray(mask_u8, mode="L")
    # Close tiny internal lake holes so island mask is coherent
    pil_closed = pil_m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(7))
    soft = np.asarray(pil_closed.filter(ImageFilter.GaussianBlur(radius=3.5)), dtype=np.float32) / 255.0
    return np.clip(soft, 0.0, 1.0), ocean


def build_continent_map_and_relief(land_id: str, src_path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Create 1024x1024 regions/<land>/map_art.png, minimap_hq.png, and 256x256 relief_3d.r32."""
    src = Image.open(src_path).convert("RGB")
    arr = np.asarray(src, dtype=np.float32)
    h, w, _ = arr.shape

    land_mask, ocean_rgb = extract_land_mask(arr, land_id)

    # Clean border artifacts on Pyra by blending masked-out border regions to deep ocean
    if land_id == "pyra":
        clean_border = np.ones((h, w), dtype=np.float32)
        clean_border[:105, :] = 0.0
        clean_border[:145, int(w * 0.86) :] = 0.0
        clean_border = np.asarray(
            Image.fromarray((clean_border * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=6.0)),
            dtype=np.float32,
        ) / 255.0
        arr = arr * clean_border[..., None] + ocean_rgb[None, None, :] * (1.0 - clean_border[..., None])

    # Crop tightly around the continent bounding box (with 7% ocean padding) and center on 1024x1024 square
    ys, xs = np.where(land_mask > 0.35)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    pad = int(max(bw, bh) * 0.08)
    cx, cy = (x0 + x1) * 0.5, (y0 + y1) * 0.5
    side = max(bw, bh) + pad * 2

    # Build a clean 1024x1024 canvas filled with subtle deep ocean color
    target_ocean = np.array([22.0, 58.0, 92.0], dtype=np.float32)
    # Shift source ocean slightly toward unified Planet Superior deep ocean
    ocean_shift = (target_ocean - ocean_rgb) * 0.55
    arr_unified = np.clip(arr + ocean_shift[None, None, :] * (1.0 - land_mask[..., None]), 0, 255)

    canvas_side = int(side)
    sq_rgb = np.broadcast_to(
        np.clip(ocean_rgb + ocean_shift, 0, 255), (canvas_side, canvas_side, 3)
    ).copy()
    sq_mask = np.zeros((canvas_side, canvas_side), dtype=np.float32)

    ox = int(round(canvas_side * 0.5 - cx))
    oy = int(round(canvas_side * 0.5 - cy))
    dst_x0 = max(0, ox)
    dst_y0 = max(0, oy)
    src_x0 = max(0, -ox)
    src_y0 = max(0, -oy)
    copy_w = min(w - src_x0, canvas_side - dst_x0)
    copy_h = min(h - src_y0, canvas_side - dst_y0)

    sq_rgb[dst_y0 : dst_y0 + copy_h, dst_x0 : dst_x0 + copy_w] = arr_unified[
        src_y0 : src_y0 + copy_h, src_x0 : src_x0 + copy_w
    ]
    sq_mask[dst_y0 : dst_y0 + copy_h, dst_x0 : dst_x0 + copy_w] = land_mask[
        src_y0 : src_y0 + copy_h, src_x0 : src_x0 + copy_w
    ]

    # Softly blend outer frame edges into unified deep ocean so zero rectangular seam exists
    base_ocean = np.clip(ocean_rgb + ocean_shift, 0, 255)
    frame_a = np.zeros((canvas_side, canvas_side), dtype=np.float32)
    margin = max(12, int(min(copy_w, copy_h) * 0.04))
    frame_a[
        dst_y0 + margin : dst_y0 + copy_h - margin,
        dst_x0 + margin : dst_x0 + copy_w - margin,
    ] = 1.0
    frame_a = np.asarray(
        Image.fromarray((frame_a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=margin * 0.85)),
        dtype=np.float32,
    ) / 255.0
    eff_a = np.clip(np.maximum(frame_a, sq_mask), 0.0, 1.0)[..., None]
    sq_rgb = sq_rgb * eff_a + base_ocean[None, None, :] * (1.0 - eff_a)

    map_art_img = Image.fromarray(sq_rgb.astype(np.uint8), mode="RGB").resize(
        (1024, 1024), Image.Resampling.LANCZOS
    )
    mask_1024 = (
        np.asarray(
            Image.fromarray((sq_mask * 255).astype(np.uint8), mode="L").resize(
                (1024, 1024), Image.Resampling.BILINEAR
            ),
            dtype=np.float32,
        )
        / 255.0
    )

    rdir = ISO_ROOT / "regions" / land_id
    rdir.mkdir(parents=True, exist_ok=True)
    map_art_img.save(rdir / "map_art.png", optimize=True)

    # Also save crisp cartographic minimap_hq.png directly from the high-craft painted map!
    # (No dartboard circles — genuine painterly fantasy cartography!)
    map_art_img.save(rdir / "minimap_hq.png", optimize=True)

    # Synthesize sculpted 256x256 3D relief heightmap (relief_3d.r32) matching the painted mountains & waters
    art_256 = np.asarray(map_art_img.resize((256, 256), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    m_256 = (
        np.asarray(
            Image.fromarray((mask_1024 * 255).astype(np.uint8), mode="L").resize(
                (256, 256), Image.Resampling.BILINEAR
            ),
            dtype=np.float32,
        )
        / 255.0
    )
    r, g, b = art_256[:, :, 0], art_256[:, :, 1], art_256[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # Compute local contrast / ridge sharpness to detect hand-drawn mountain peaks & ridges
    blur_img = Image.fromarray((np.clip(lum, 0, 1) * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(radius=3.0)
    )
    lum_blur = np.asarray(blur_img, dtype=np.float32) / 255.0
    ridge_detail = np.abs(lum - lum_blur)
    ridge_smooth = (
        np.asarray(
            Image.fromarray((np.clip(ridge_detail * 5.0, 0, 1) * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(radius=4.5)
            ),
            dtype=np.float32,
        )
        / 255.0
    )

    # Detect inland water / lakes / fjords to depress them toward sea level
    inland_water = np.clip(((b - r) - 0.08) * 3.5, 0.0, 1.0) * np.clip(((b - g * 0.85) - 0.02) * 4.0, 0.0, 1.0)

    # Base island elevation from coastal distance
    coast_elev = np.asarray(
        Image.fromarray((m_256 * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=7.0)),
        dtype=np.float32,
    ) / 255.0

    if land_id == "verdant":
        # Snow peaks (bright white) + mountain ridges rise tall; Wielkie Jezioro & ponds dip low
        snow_peak = np.clip((lum - 0.68) * 3.2, 0.0, 1.0) * (1.0 - inland_water)
        h3d = m_256 * (7.0 + 18.0 * coast_elev + 42.0 * ridge_smooth + 58.0 * snow_peak)
        h3d = h3d * (1.0 - 0.85 * inland_water)
    elif land_id == "aether":
        # Dramatic alpine mountain ridges & terraced sanctuary heart
        dark_crevasse = np.clip((0.72 - lum) * 2.4, 0.0, 1.0) * (1.0 - inland_water)
        green_peak = np.clip((g - r - 0.06) * 4.0, 0.0, 1.0)
        h3d = m_256 * (10.0 + 22.0 * coast_elev + 52.0 * ridge_smooth + 30.0 * dark_crevasse + 45.0 * green_peak)
        h3d = h3d * (1.0 - 0.88 * inland_water)
    elif land_id == "nexus":
        # Rugged grey mountains on east/west, recessed megastructure canal
        grey_mtn = np.clip((0.55 - np.abs(r - b) * 2.5), 0.0, 1.0) * ridge_smooth
        h3d = m_256 * (8.0 + 15.0 * coast_elev + 54.0 * grey_mtn + 28.0 * ridge_smooth)
        h3d = h3d * (1.0 - 0.82 * inland_water)
    else:  # pyra
        # Jagged dark volcanic central mountain spine + NE calderas, depressed lava canyons & NW fjords
        lava_glow = np.clip((r - 0.72) * 3.5, 0.0, 1.0) * np.clip((g - 0.25) * 2.0, 0.0, 1.0) * (1.0 - b)
        dark_ridge = np.clip((0.36 - lum) * 3.0, 0.0, 1.0) * (1.0 - inland_water)
        h3d = m_256 * (8.0 + 20.0 * coast_elev + 55.0 * ridge_smooth + 38.0 * dark_ridge)
        h3d = h3d * (1.0 - 0.88 * inland_water) - lava_glow * 7.0

    # Smooth slightly so 3D triangles have crisp yet natural faceted relief
    h_max = max(float(h3d.max()), 1.0)
    h_norm = np.clip(h3d / h_max, 0.0, 1.0)
    h_smooth = (
        np.asarray(
            Image.fromarray((h_norm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=1.2)),
            dtype=np.float32,
        )
        / 255.0
        * h_max
    )
    h_smooth = np.where(m_256 < 0.08, 0.0, np.maximum(h_smooth, 0.5))

    with open(rdir / "relief_3d.r32", "wb") as f:
        f.write(struct.pack(f"<{h_smooth.size}f", *h_smooth.ravel().tolist()))

    # Return cropped tight RGBA of the island for seamless Planet Superior compositing
    crop_rgb = arr_unified[y0 : y1 + 1, x0 : x1 + 1]
    crop_alpha = land_mask[y0 : y1 + 1, x0 : x1 + 1]
    return crop_rgb, crop_alpha


def build_planet_superior_atlas(cropped_continents: dict[str, tuple[np.ndarray, np.ndarray]]) -> None:
    """Composite the 4 canonical painted continents cleanly onto Planet Superior 2048x1024 atlas & 3D globe."""
    base_globe = ISO_ROOT / "assets/map/globe-color.webp"
    map_json_path = ISO_ROOT / "data/map.json"

    base_img = Image.open(base_globe).convert("RGB").resize((2048, 1024), Image.Resampling.LANCZOS)
    canvas = np.asarray(base_img, dtype=np.float32)
    H, W, _ = canvas.shape

    map_data = json.loads(map_json_path.read_text(encoding="utf-8"))
    map_w = float(map_data.get("mapW", 2000.0))
    map_h = float(map_data.get("mapH", 1000.0))
    sx, sy = W / map_w, H / map_h

    # Sample canonical deep ocean color from middle of the Pacific-like ocean on globe-color.webp
    ocean_sample = np.median(canvas[420:540, 820:980].reshape(-1, 3), axis=0)

    # Clean two stray wrap-edge landmass fragments from legacy globe-color.webp (far-right top & far-left bottom)
    rem_mask = np.zeros((H, W), dtype=np.float32)
    rem_mask[56:465, 1900:W] = 1.0
    rem_mask[552:922, 0:136] = 1.0
    rem_soft = (
        np.asarray(
            Image.fromarray((rem_mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=14.0)),
            dtype=np.float32,
        )
        / 255.0
    )
    rem_a = np.clip(rem_soft * 1.45, 0.0, 1.0)[..., None]
    canvas = canvas * (1.0 - rem_a) + ocean_sample[None, None, :] * rem_a

    for region in map_data.get("regions", []):
        rid = str(region.get("id", ""))
        if rid not in cropped_continents:
            continue
        outline = region.get("outline", [])
        if not outline:
            continue

        # 1. Compute exact coastline polygon mask (with wrap-around support)
        mask_img = Image.new("L", (W, H), 0)
        mdraw = ImageDraw.Draw(mask_img)
        pts_base = [(float(pt[0]) * sx, float(pt[1]) * sy) for pt in outline]
        for shift_x in (-W, 0, W):
            mdraw.polygon([(x + shift_x, y) for (x, y) in pts_base], fill=255)

        # Paint out the old flat pixel-art landmass under the continent with smooth ocean + turquoise coastal shelf
        outer_clear = (
            np.asarray(mask_img.filter(ImageFilter.GaussianBlur(radius=14.0)), dtype=np.float32) / 255.0
        )
        coastal_glow = (
            np.asarray(mask_img.filter(ImageFilter.GaussianBlur(radius=7.0)), dtype=np.float32) / 255.0
        )
        clear_alpha = np.clip(outer_clear * 1.45, 0.0, 1.0)[..., None]
        canvas = canvas * (1.0 - clear_alpha) + ocean_sample[None, None, :] * clear_alpha

        # Subtle turquoise shallow shelf around the continent coastline
        shelf_col = np.array([46.0, 128.0, 162.0], dtype=np.float32)
        shelf_alpha = np.clip(coastal_glow * 0.52, 0.0, 0.52)[..., None]
        canvas = canvas * (1.0 - shelf_alpha) + shelf_col[None, None, :] * shelf_alpha

        # 2. Compute unwrapped bounding box around region center
        center = region.get("center", region.get("label", [map_w * 0.5, map_h * 0.5]))
        if isinstance(center, dict):
            cx = float(center.get("x", map_w * 0.5)) * sx
            cy = float(center.get("y", map_h * 0.5)) * sy
        else:
            cx = float(center[0]) * sx
            cy = float(center[1]) * sy

        ux, uy = [], []
        for x, y in pts_base:
            dx = x - cx
            if dx > W * 0.5:
                dx -= W
            elif dx < -W * 0.5:
                dx += W
            ux.append(cx + dx)
            uy.append(y)
        min_x, max_x = min(ux), max(ux)
        min_y, max_y = min(uy), max(uy)
        bw = max(64, int(round(max_x - min_x)))
        bh = max(64, int(round(max_y - min_y)))

        # Resize painted continent art to match the exact coastline bbox
        crop_rgb, crop_alpha = cropped_continents[rid]
        art_resized = np.asarray(
            Image.fromarray(crop_rgb.astype(np.uint8), mode="RGB").resize((bw, bh), Image.Resampling.LANCZOS),
            dtype=np.float32,
        )
        alpha_resized = (
            np.asarray(
                Image.fromarray((crop_alpha * 255).astype(np.uint8), mode="L").resize(
                    (bw, bh), Image.Resampling.BILINEAR
                ),
                dtype=np.float32,
            )
            / 255.0
        )

        # Place into full WxH buffer with horizontal modulo wrap
        full_rgb = np.zeros((H, W, 3), dtype=np.float32)
        full_a = np.zeros((H, W), dtype=np.float32)
        ys = np.arange(bh) + int(round(min_y))
        valid_y = (ys >= 0) & (ys < H)
        ys_v = ys[valid_y]
        xs_mod = (np.arange(bw) + int(round(min_x))) % W
        full_rgb[np.ix_(ys_v, xs_mod)] = art_resized[valid_y, :, :]
        full_a[np.ix_(ys_v, xs_mod)] = alpha_resized[valid_y, :]

        # Clip cleanly to the exact traced data/map.json polygon with soft feathered shoreline!
        poly_soft = (
            np.asarray(mask_img.filter(ImageFilter.GaussianBlur(radius=2.5)), dtype=np.float32) / 255.0
        )
        # Keep the rich painted landmass inside the exact traced coastline
        blend_a = np.clip(np.maximum(poly_soft * 0.96, poly_soft * full_a), 0.0, 1.0)
        # Ensure we use the painted art pixels inside the coastline (dilate painted art slightly near edge if needed)
        blend_3 = blend_a[..., None]
        canvas = canvas * (1.0 - blend_3) + full_rgb * blend_3

    out_img = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), mode="RGB")
    out_png = ISO_ROOT / "atlas/planet_real_world.png"
    out_webp = ISO_ROOT / "assets/map/globe-real-world.webp"
    out_img.save(out_png, optimize=True)
    out_img.save(out_webp, format="WEBP", quality=93, method=6)
    print(f"CANONICAL_MAPS_BUILT: {out_png} & {out_webp}")


def main() -> None:
    cropped = {}
    for land_id, src_path in CONTINENT_SOURCES.items():
        if not src_path.exists():
            raise FileNotFoundError(f"Missing reference cartography: {src_path}")
        print(f"Building canonical map_art.png, minimap_hq.png & relief_3d.r32 for {land_id}...")
        cropped[land_id] = build_continent_map_and_relief(land_id, src_path)
    build_planet_superior_atlas(cropped)


if __name__ == "__main__":
    main()
