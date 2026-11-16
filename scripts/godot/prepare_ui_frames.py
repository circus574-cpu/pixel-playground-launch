#!/usr/bin/env python3
"""UI frames of the Godot port: the owner's two sheets of frame parts (art/production/ui/frames-1.png and frames-2.png, transparent, lava-stone and gold)
-> ports/godot-pyra/assets/ui/frames/*.webp, ready for scripts/skin.gd (PyraSkin), which styles every window, button and ring of the game with them.

Halo: the sheets carry a faint glow made of semi-transparent reddish/greenish specks around the glowing parts. Everything below alpha 40 is cut away and floating
specks (small separate blobs) are dropped before a piece is used, so the pieces have a clean edge on any background.

Outputs (all lossless WebP):
  window.webp            9-slice window frame (stone border with a lava line, stars in the corners; the inside is left clear): margin WINDOW_MARGIN
  button*.webp           9-slice pill buttons: normal, hover, pressed, disabled: margins BUTTON_MARGIN_X / BUTTON_MARGIN_Y
  ring-star / ring-plain / ring-flower.webp   round frames (portrait, minimap, medallions)
  plaque.webp, divider.webp, star-*.webp      title plaque, gold divider, decorative stars

  ui-art.json (ports/godot-pyra/data): the window frame and the owner's stone texture as base64 WebP, read by scripts/look.gd; it travels with
  server updates (the core carries data/*.json, an installed APK keeps its own pictures)

  python3 scripts/godot/prepare_ui_frames.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art" / "production" / "ui"
OUT = ROOT / "ports" / "godot-pyra" / "assets" / "ui" / "frames"
ALPHA_CUT = 40
WINDOW_SIZE = 0           # set from the tile period: the middle slice of the 9-slice must be a whole number of periods, or the edge shows a seam
WINDOW_MARGIN = 64        # corner slice of window.webp
BAND = 26                 # thickness of the stone border in window.webp
BUTTON_SIZE = (256, 56)
BUTTON_MARGIN_X = 40
BUTTON_MARGIN_Y = 22

# boxes (x0, y0, x1, y1) in the sheets, from the component analysis
SHEET1 = {"bar": (44, 43, 2128, 136), "divider3": (27, 141, 2144, 283), "pill_orange": (41, 289, 2131, 329), "pill_dark": (42, 356, 2130, 402),
          "star_a": (612, 556, 772, 687), "star_b": (478, 571, 577, 671), "star_c": (341, 577, 439, 666), "star_big": (814, 552, 1014, 709)}
SHEET2 = {"ring_star": (11, 13, 526, 549), "ring_plain": (527, 48, 988, 520), "ring_flower": (993, 85, 1405, 491), "plaque": (19, 575, 526, 836),
          "divider": (29, 900, 631, 1007), "star": (1223, 586, 1420, 790)}


def clean(image: Image.Image) -> Image.Image:
    """No halo: alpha below the cut is removed, loose specks are dropped."""
    a = np.array(image.convert("RGBA"))
    a[a[..., 3] < ALPHA_CUT] = 0
    labels, count = ndimage.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    if count:
        areas = ndimage.sum(np.ones_like(labels), labels, index=np.arange(1, count + 1))
        keep = [i + 1 for i, area in enumerate(areas) if area >= max(60, 0.02 * areas.max())]
        a[~np.isin(labels, keep)] = 0
    return Image.fromarray(a, "RGBA")


def crop(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    piece = clean(sheet.crop(box))
    bbox = piece.getbbox()
    return piece.crop(bbox) if bbox else piece


def scale(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def fit_height(image: Image.Image, height: int) -> Image.Image:
    return scale(image, (max(1, round(image.width * height / image.height)), height))


def fit_width(image: Image.Image, width: int) -> Image.Image:
    return scale(image, (width, max(1, round(image.height * width / image.width))))


def seamless_tile(bar: Image.Image, start: int, end: int, blend: int = 40) -> Image.Image:
    """The stretch of the stone bar between two lava cracks as a tile that repeats without a visible seam (the end is blended into what precedes the start)."""
    segment = np.array(bar.crop((start - blend, 0, end, bar.height))).astype(np.float32)
    tile = segment[:, blend:].copy()
    ramp = np.linspace(0.0, 1.0, blend, dtype=np.float32)[None, :, None]
    tile[:, -blend:] = tile[:, -blend:] * (1.0 - ramp) + segment[:, :blend] * ramp
    return Image.fromarray(tile.astype(np.uint8), "RGBA")


def tiled(tile: Image.Image, length: int) -> Image.Image:
    strip = Image.new("RGBA", (length, tile.height), (0, 0, 0, 0))
    for x in range(0, length, tile.width):
        strip.paste(tile, (x, 0))
    return strip


def window_frame(bar: Image.Image, star: Image.Image) -> Image.Image:
    band = BAND
    tile = seamless_tile(fit_height(bar, band), round(903 * band / bar.height), round(1285 * band / bar.height))
    size = 2 * WINDOW_MARGIN + 2 * tile.width
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # dark stone inside, a little lighter towards the middle
    fill = np.zeros((size, size, 4), np.uint8)
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.hypot(xx - size / 2, yy - size / 2) / (size / 2)
    shade = np.clip(1.0 - 0.35 * d, 0.6, 1.0)
    fill[..., 0] = (24 * shade).astype(np.uint8)
    fill[..., 1] = (19 * shade).astype(np.uint8)
    fill[..., 2] = (24 * shade).astype(np.uint8)
    fill[..., 3] = 0   # the inside is the owner's stone texture, drawn by PyraSkin under the frame (assets/ui/backgrounds/stone.webp)
    canvas = Image.alpha_composite(canvas, Image.fromarray(fill, "RGBA"))
    # lava line just inside the border, with a soft glow
    line = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inset = band + 2
    from PIL import ImageDraw
    draw = ImageDraw.Draw(line)
    draw.rectangle((inset, inset, size - inset - 1, size - inset - 1), outline=(255, 156, 52, 255), width=2)
    glow = line.filter(ImageFilter.GaussianBlur(3))
    canvas = Image.alpha_composite(canvas, glow)
    canvas = Image.alpha_composite(canvas, line)
    # stone edges
    top = tiled(tile, size)
    canvas.alpha_composite(top, (0, 0))
    canvas.alpha_composite(top.transpose(Image.FLIP_TOP_BOTTOM), (0, size - band))
    side = tiled(tile, size - 2 * band).rotate(90, expand=True)   # the strip runs top to bottom between the horizontal edges
    canvas.alpha_composite(side, (0, band))
    canvas.alpha_composite(side.transpose(Image.FLIP_LEFT_RIGHT), (size - band, band))
    # stars over the four corners
    s = fit_height(star, 54)
    for cx, cy in ((band // 2 + 2, band // 2 + 2), (size - band // 2 - 2, band // 2 + 2), (band // 2 + 2, size - band // 2 - 2), (size - band // 2 - 2, size - band // 2 - 2)):
        canvas.alpha_composite(s, (cx - s.width // 2, cy - s.height // 2))
    return canvas


def pill(piece: Image.Image) -> Image.Image:
    """A pill piece as a 256x56 button face: the two rounded ends are kept as they are, the middle is stretched."""
    w, h = BUTTON_SIZE
    face = fit_height(piece, h)
    cap = min(face.width // 3, 90)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.alpha_composite(face.crop((0, 0, cap, h)), (0, 0))
    out.alpha_composite(face.crop((face.width - cap, 0, face.width, h)), (w - cap, 0))
    # the middle is a piece of the pill's middle at its own scale (stretching a long stretch of stone into a short one would streak it)
    centre = face.width // 2
    out.alpha_composite(face.crop((centre - (w - 2 * cap) // 2, 0, centre - (w - 2 * cap) // 2 + (w - 2 * cap), h)), (cap, 0))
    return out


def tint(image: Image.Image, brightness: float, color: float = 1.0) -> Image.Image:
    alpha = image.getchannel("A")
    rgb = ImageEnhance.Color(ImageEnhance.Brightness(image.convert("RGB")).enhance(brightness)).enhance(color)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def save(image: Image.Image, name: str) -> None:
    image.save(OUT / name, "WEBP", lossless=True, quality=100, method=6)
    print(name, image.size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    one = Image.open(SRC / "frames-1.png").convert("RGBA")
    two = Image.open(SRC / "frames-2.png").convert("RGBA")
    pieces = {k: crop(one, v) for k, v in SHEET1.items()} | {k: crop(two, v) for k, v in SHEET2.items()}
    frame = window_frame(pieces["bar"], pieces["star_a"])
    save(frame, "window.webp")
    # the pictures that must reach an installed app with a server update: inside data/ (the core carries data/*.json, not pictures)
    import base64, io, json
    def b64(image: Image.Image, lossless: bool) -> str:
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", lossless=lossless, quality=100 if lossless else 90, method=6)
        return base64.b64encode(buffer.getvalue()).decode("ascii")
    stone = Image.open(SRC / "stone-bg.png").convert("RGB")
    data = {"format": "ki-ui-art-1", "pictures": {"window": b64(frame, True), "stone": b64(stone, False)}}
    target = ROOT / "ports" / "godot-pyra" / "data" / "ui-art.json"
    target.write_text(json.dumps(data, separators=(",", ":")))
    print("ui-art.json", round(target.stat().st_size / 1024), "KB")
    base = pill(pieces["pill_dark"])
    save(base, "button.webp")
    save(tint(base, 1.45, 1.25), "button-hover.webp")
    save(tint(base, 0.7), "button-pressed.webp")
    save(tint(base, 0.6, 0.4), "button-disabled.webp")
    for name in ("ring_star", "ring_plain", "ring_flower"):
        save(fit_height(pieces[name], 320), name.replace("_", "-") + ".webp")
    save(fit_width(pieces["plaque"], 420), "plaque.webp")
    save(fit_width(pieces["divider"], 480), "divider.webp")
    save(fit_height(pieces["star_a"], 96), "star-a.webp")
    save(fit_height(pieces["star_b"], 64), "star-b.webp")
    save(fit_height(pieces["star_big"], 128), "star-big.webp")


if __name__ == "__main__":
    main()
