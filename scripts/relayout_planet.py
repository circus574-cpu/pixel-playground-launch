#!/usr/bin/env python3
"""Re-lay planet Superior so the four main cities form a regular tetrahedron on the sphere.

Every pair of main cities is exactly CITY_DISTANCE (80 000 game units) apart along the surface,
which fixes the planet radius R = CITY_DISTANCE / acos(-1/3). The six quest islands sit on the
midpoints of the six tetrahedron edges (40 000 units from the two nearest cities); the rest is
water. Continents and islands are cut from the ORIGINAL painted atlas along their traced outlines,
shrunk by SCALE and re-projected around their new centre (azimuthal equidistant, so every shape
keeps its true size and the distance from its centre). No new land is painted.

Inputs (kept in the repo so the script can be re-run):
  art/production/planet/atlas-source-3840.webp, art/production/planet/atlasRegions.source.json
Outputs:
  src/assets/planet-map/atlas-3840.webp, atlas-1920.webp      new equirectangular 2:1 atlas
  src/components/planet-map/atlasRegions.json                 outlines in the new atlas
  src/components/planet-map/planetLayout.json                 settlement points and labels
  src/game/world/planet.json                                  constants and feature anchors

Usage: python3 scripts/relayout_planet.py && python3 scripts/build_globe_textures.py
Requires numpy, Pillow, opencv-python-headless, scipy.
"""
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[1]
SRC_ATLAS = ROOT / "art/production/planet/atlas-source-3840.webp"
SRC_OUTLINES = ROOT / "art/production/planet/atlasRegions.source.json"
OUT_ATLAS = ROOT / "src/assets/planet-map"
OUT_OUTLINES = ROOT / "src/components/planet-map/atlasRegions.json"
OUT_LAYOUT = ROOT / "src/components/planet-map/planetLayout.json"
OUT_PLANET = ROOT / "src/game/world/planet.json"

MAP_W, MAP_H = 2000, 1000
CITY_DISTANCE = 80000.0
THETA = math.acos(-1 / 3)  # angle between two tetrahedron vertices
RADIUS = CITY_DISTANCE / THETA
UNITS_PER_MAP = 2 * math.pi * RADIUS / MAP_W  # game units per map unit along the equator
SCALE = 0.5  # continents and islands are shrunk so they fit between the cities
YAW = math.radians(16)  # keeps every continent clear of the atlas seam
SHORE = 22  # map units of coast/shallows carried with every cut-out

CITY_SOURCE = {  # settlement points in the source atlas (map units)
    "verdant": (755, 498),
    "aether": (1396, 273),
    "nexus": (1453, 711),
    "pyra": (750, 688),
}
LABEL_SOURCE = {
    "verdant": (470, 470),
    "aether": (1250, 395),
    "nexus": (1260, 820),
    "pyra": (400, 850),
    "island-1": (975, 158),
    "island-2": (1000, 540),
    "island-3": (1850, 258),
    "island-4": (1830, 730),
    "island-5": (160, 225),
    "island-6": (975, 905),
}
# Tetrahedron vertices (before yaw): aether/verdant north of the equator, pyra/nexus south.
VERTEX = {
    "aether": (1, 1, 1),
    "verdant": (-1, -1, 1),
    "pyra": (1, -1, -1),
    "nexus": (-1, 1, -1),
}
# Island -> pair of cities whose edge midpoint it occupies.
ISLAND_EDGE = {
    "island-1": ("aether", "verdant"),  # north pole
    "island-2": ("aether", "pyra"),
    "island-3": ("aether", "nexus"),
    "island-4": ("verdant", "nexus"),
    "island-5": ("verdant", "pyra"),
    "island-6": ("pyra", "nexus"),  # south pole
}


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def yawed(v):
    c, s = math.cos(YAW), math.sin(YAW)
    x, y, z = v
    return np.array([c * x - s * y, s * x + c * y, z])


def lonlat(v):
    return math.degrees(math.atan2(v[1], v[0])), math.degrees(math.asin(max(-1, min(1, v[2]))))


def to_map(lon, lat):
    return (lon + 180) / 360 * MAP_W, (90 - lat) / 180 * MAP_H


def forward(src, anchor, lon0, lat0):
    """Source map point -> (lon, lat) around the new centre (azimuthal equidistant)."""
    dx, dy = src[0] - anchor[0], src[1] - anchor[1]
    x, y = dx * UNITS_PER_MAP * SCALE / RADIUS, -dy * UNITS_PER_MAP * SCALE / RADIUS
    rho = math.hypot(x, y)
    p0, l0 = math.radians(lat0), math.radians(lon0)
    if rho < 1e-12:
        return lon0, lat0
    lat = math.asin(math.cos(rho) * math.sin(p0) + y * math.sin(rho) * math.cos(p0) / rho)
    lon = l0 + math.atan2(x * math.sin(rho), rho * math.cos(p0) * math.cos(rho) - y * math.sin(p0) * math.sin(rho))
    return math.degrees(lon), math.degrees(lat)


def main():
    outlines = json.loads(SRC_OUTLINES.read_text())
    atlas = np.asarray(Image.open(SRC_ATLAS).convert("RGB"), dtype=np.float32)
    H, W = atlas.shape[:2]
    k = W / MAP_W

    # ---- geometry -------------------------------------------------------------------------
    feats = {}
    verts = {c: yawed(unit(v)) for c, v in VERTEX.items()}
    for c, v in verts.items():
        lon, lat = lonlat(v)
        feats[c] = dict(kind="continent", anchor=CITY_SOURCE[c], lon=lon, lat=lat)
    for i, (a, b) in ISLAND_EDGE.items():
        lon, lat = lonlat(unit(verts[a] + verts[b]))
        pts = np.array(outlines[i], float)
        anchor = ((pts[:, 0].min() + pts[:, 0].max()) / 2, (pts[:, 1].min() + pts[:, 1].max()) / 2)
        feats[i] = dict(kind="island", anchor=anchor, lon=lon, lat=lat)
    for a in verts:
        for b in verts:
            if a < b:
                d = math.acos(float(np.clip(verts[a] @ verts[b], -1, 1))) * RADIUS
                assert abs(d - CITY_DISTANCE) < 1e-6, (a, b, d)

    # ---- source masks ---------------------------------------------------------------------
    def poly_mask(pts, grow=0):
        m = np.zeros((H, W), np.uint8)
        cv2.fillPoly(m, [np.round(np.array(pts) * k).astype(np.int32)], 255)
        if grow:
            r = int(round(grow * k))
            m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
        return m

    plain = {i: poly_mask(outlines[i]) for i in feats}
    land_union = np.zeros((H, W), np.uint8)
    for i in feats:
        land_union = np.maximum(land_union, plain[i])
    hole = cv2.dilate(land_union, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * int((SHORE + 14) * k) + 1,) * 2))

    # ---- ocean base (original atlas with every land feature removed) ----------------------
    valid = (hole == 0).astype(np.float32)
    small = cv2.resize(atlas.astype(np.uint8), (W // 8, H // 8), interpolation=cv2.INTER_AREA)
    sf = small.astype(np.float32)
    lum = sf.mean(axis=-1)
    # Fill holes from open deep water only, never from shallows, sand or cloud.
    deep = (sf[..., 2] > 1.25 * sf[..., 0]) & (lum < 120) & (sf[..., 2] > 40)
    deep &= cv2.resize((hole == 0).astype(np.uint8), (W // 8, H // 8), interpolation=cv2.INTER_NEAREST) > 0
    deep = cv2.erode(deep.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    filled = cv2.inpaint(small, (~deep).astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
    smooth = cv2.resize(filled, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    hp = atlas - np.stack([gaussian_filter(atlas[..., c], 4) for c in range(3)], axis=-1)
    acc = np.zeros_like(atlas)
    wsum = np.zeros((H, W, 1), np.float32)
    for dy, dx in ((0, 1100), (300, -800), (-500, 400), (650, -1700)):
        v = np.roll(valid, (dy, dx), axis=(0, 1))[..., None]
        acc += np.roll(hp, (dy, dx), axis=(0, 1)) * v
        wsum += v
    detail = acc / np.maximum(wsum, 1)
    keep = gaussian_filter(valid, 7)[..., None]
    base = atlas * keep + (smooth + detail) * (1 - keep)

    # ---- warp every feature into place ----------------------------------------------------
    lon = (np.arange(W) + 0.5) / W * 360 - 180
    lat = 90 - (np.arange(H) + 0.5) / H * 180
    LON, LAT = np.meshgrid(np.radians(lon), np.radians(lat))
    out = base.copy()
    occupied = np.zeros((H, W), np.float32)
    for i, f in feats.items():
        l0, p0 = math.radians(f["lon"]), math.radians(f["lat"])
        dl = LON - l0
        cosc = np.clip(math.sin(p0) * np.sin(LAT) + math.cos(p0) * np.cos(LAT) * np.cos(dl), -1, 1)
        c = np.arccos(cosc)
        sinc = np.sin(c)
        kk = np.where(sinc > 1e-9, c / np.maximum(sinc, 1e-9), 1.0)
        e = RADIUS * kk * np.cos(LAT) * np.sin(dl)
        n = RADIUS * kk * (math.cos(p0) * np.sin(LAT) - math.sin(p0) * np.cos(LAT) * np.cos(dl))
        ax, ay = f["anchor"]
        sx = ((ax + e / (UNITS_PER_MAP * SCALE)) * k).astype(np.float32)
        sy = ((ay - n / (UNITS_PER_MAP * SCALE)) * k).astype(np.float32)
        near = c < (620 * UNITS_PER_MAP * SCALE / RADIUS)  # no source feature reaches farther from its centre
        sx[~near], sy[~near] = -10, -10
        # Cut-out = own outline + shore, minus every other feature's land.
        own = poly_mask(outlines[i], SHORE)
        others = np.zeros((H, W), np.uint8)
        for j in feats:
            if j != i:
                others = np.maximum(others, plain[j])
        alpha = gaussian_filter(((own > 0) & (others == 0)).astype(np.float32), 4)
        a = cv2.remap(alpha, sx, sy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        rgb = cv2.remap(atlas, sx, sy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        a = np.clip(a, 0, 1)[..., None]
        out = out * (1 - a) + rgb * a
        occupied = np.maximum(occupied, a[..., 0])
        print(i, "lon %.2f lat %.2f" % (f["lon"], f["lat"]))

    img = Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))
    img.save(OUT_ATLAS / "atlas-3840.webp", "WEBP", quality=88, method=6)
    img.resize((1920, 960), Image.LANCZOS).save(OUT_ATLAS / "atlas-1920.webp", "WEBP", quality=86, method=6)

    # ---- outlines, settlement points and labels in the new atlas --------------------------
    new_outlines, layout = {}, {}
    for i, f in feats.items():
        pts = np.array(outlines[i], float)
        dense = []
        for a, b in zip(pts, np.roll(pts, -1, axis=0)):
            steps = max(1, int(np.hypot(*(b - a)) / 1.5))
            for t in range(steps):
                dense.append(a + (b - a) * t / steps)
        mapped = []
        polar = abs(f["lat"]) > 89.9
        for p in dense:
            lo, la = forward(p, f["anchor"], f["lon"], f["lat"])
            d = (lo - f["lon"] + 180) % 360 - 180  # unwrap around the centre
            x, y = to_map(f["lon"] + d, la)
            mapped.append((x, y))
        m = np.array(mapped, np.float32)
        if polar:
            # Envelope of the cap: farthest point from the pole in every 4-unit column.
            edge = 0 if f["lat"] > 0 else MAP_H
            bins = np.clip((m[:, 0] / 4).astype(int), 0, MAP_W // 4 - 1)
            reach = np.full(MAP_W // 4, np.nan)
            for b_, y_ in zip(bins, m[:, 1]):
                far = y_ if f["lat"] > 0 else y_
                if np.isnan(reach[b_]) or (far > reach[b_] if f["lat"] > 0 else far < reach[b_]):
                    reach[b_] = far
            idx = np.arange(len(reach))
            ok = ~np.isnan(reach)
            reach = np.interp(idx, idx[ok], reach[ok], period=len(reach))
            reach = gaussian_filter(reach, 2, mode="wrap")
            m = np.vstack([[0, edge], np.stack([idx * 4 + 2, reach], axis=1), [MAP_W, edge]])
        else:
            assert m[:, 0].min() >= 0 and m[:, 0].max() <= MAP_W, (i, m[:, 0].min(), m[:, 0].max())
        approx = cv2.approxPolyDP(np.ascontiguousarray(m, dtype=np.float32).reshape(-1, 1, 2), 0.35, False if polar else True).reshape(-1, 2)
        new_outlines[i] = [[round(float(x), 1), round(float(y), 1)] for x, y in approx]
        entry = {}
        cx, cy = to_map(f["lon"], f["lat"])
        if f["kind"] == "continent":
            entry["settlementPoint"] = {"x": round(cx, 1), "y": round(cy, 1)}
        if polar:
            entry["label"] = {"x": MAP_W // 2, "y": 22 if f["lat"] > 0 else MAP_H - 22}
        else:
            lo, la = forward(LABEL_SOURCE[i], f["anchor"], f["lon"], f["lat"])
            d = (lo - f["lon"] + 180) % 360 - 180
            lx, ly = to_map(f["lon"] + d, la)
            entry["label"] = {"x": round(lx, 1), "y": round(ly, 1)}
        layout[i] = entry
    OUT_OUTLINES.write_text(json.dumps(new_outlines, separators=(",", ":")) + "\n")
    OUT_LAYOUT.write_text(json.dumps(layout, indent=2) + "\n")

    planet = dict(
        radius=round(RADIUS, 3),
        cityDistance=CITY_DISTANCE,
        scale=SCALE,
        mapUnitsWide=MAP_W,
        unitsPerMapUnit=round(UNITS_PER_MAP, 6),
        features={
            i: dict(kind=f["kind"], lon=round(f["lon"], 6), lat=round(f["lat"], 6),
                    source=dict(x=round(f["anchor"][0], 3), y=round(f["anchor"][1], 3)))
            for i, f in feats.items()
        },
        islandEdges={i: list(e) for i, e in ISLAND_EDGE.items()},
    )
    OUT_PLANET.write_text(json.dumps(planet, indent=2) + "\n")
    print("R", RADIUS, "units/map", UNITS_PER_MAP)


if __name__ == "__main__":
    main()
