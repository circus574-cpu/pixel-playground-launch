#!/usr/bin/env python3
"""The entry film of the Android game from the owner's source film (art/production/intro/intro-source.mp4) -> ports/godot-pyra/assets/branding/.

The source has two English captions baked into the picture: "LOADING..." (about 5.0-7.8 s, above the loading bar) and "TOUCH TO START" (from about
7.5 s to the end). For a language other than English they are blurred out and replaced by the translated text on a small dark plate with a gold
edge (like the loading bar). Godot plays only Ogg Theora, so the film is written as .ogv (libtheora q7 + Vorbis) in one pass; the last frame is
saved as a still (the game holds it after the film until the player touches the screen).

  python3 scripts/godot/make_intro.py [--lang pl] [--source FILE] [--font FILE] [--out DIR]

Languages: `pl` (default, the game is Polish for now) writes intro.ogv and intro-last.webp. Add a language by adding an entry to TEXTS; an English
version needs no overlay (the captions are already English): `--lang en` keeps the source picture and writes intro-en.ogv / intro-last-en.webp.
"""
import argparse
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FONT = "/mnt/skills/examples/canvas-design/canvas-fonts/Lora-Bold.ttf"   # a serif with the whole Polish alphabet (Cinzel lacks Ą Ę Ł Ż)

# (loading label, touch label, loading label size, touch label size)
TEXTS = {
    "pl": ("WCZYTYWANIE...", "DOTKNIJ, ABY ROZPOCZĄĆ", 21, 25),
}

# regions in the 1280x720 picture (x, y, w, h) and the seconds in which each caption is on screen
LOADING = {"blur": (547, 596, 186, 32), "plate": (548, 597, 184, 30), "from": 4.95, "to": 7.45, "text_y": 602}
TOUCH = {"blur": (461, 573, 358, 48), "plate": (462, 574, 356, 46), "from": 7.45, "to": 10.1, "text_y": 584}


def filter_graph(font: str, texts: tuple[str, str, int, int], files: tuple[Path, Path]) -> str:
    parts = ["[0:v]split=3[base][ra][rb]"]
    chain = "base"
    for tag, region in (("a", LOADING), ("b", TOUCH)):
        x, y, w, h = region["blur"]
        window = f"between(t,{region['from']},{region['to']})"
        r, c = h // 2 - 1, h // 4 - 1   # boxblur needs a radius below half the height of the plane (the chroma planes are half as tall)
        parts.append(f"[r{tag}]crop={w}:{h}:{x}:{y},boxblur=luma_radius={r}:luma_power=4:chroma_radius={c}:chroma_power=4[bl{tag}]")
        parts.append(f"[{chain}][bl{tag}]overlay={x}:{y}:enable='{window}'[o{tag}]")
        chain = f"o{tag}"
    for tag, region, size, text_file in (("a", LOADING, texts[2], files[0]), ("b", TOUCH, texts[3], files[1])):
        x, y, w, h = region["plate"]
        window = f"between(t,{region['from']},{region['to']})"
        parts.append(f"[{chain}]drawbox=x={x}:y={y}:w={w}:h={h}:color=0x0a1226@0.66:t=fill:enable='{window}',"
                     f"drawbox=x={x}:y={y}:w={w}:h={h}:color=0xd8b25a@0.9:t=2:enable='{window}'[p{tag}]")
        if tag == "a":
            alpha = f"min(1,(t-{region['from']})/0.3)*min(1,({region['to']}-t)/0.15)"
        else:
            alpha = f"min(1,(t-{region['from']})/0.35)*(0.85+0.15*cos(2*PI*(t-10)/1.6))"
        parts.append(f"[p{tag}]drawtext=fontfile={font}:textfile={text_file}:fontsize={size}:fontcolor=0xe9f7ff:"
                     f"borderw=1:bordercolor=0x2f6fa0@0.8:shadowcolor=0x06101f@0.9:shadowx=0:shadowy=2:"
                     f"x=(w-text_w)/2:y={region['text_y']}:alpha='{alpha}':enable='{window}'[t{tag}]")
        chain = f"t{tag}"
    parts[-1] = parts[-1].replace(f"[{chain}]", "[out]")
    return ";".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", default="pl")
    parser.add_argument("--source", default=str(ROOT / "art/production/intro/intro-source.mp4"))
    parser.add_argument("--font", default=DEFAULT_FONT)
    parser.add_argument("--out", default=str(ROOT / "ports/godot-pyra/assets/branding"))
    args = parser.parse_args()
    out = Path(args.out)
    suffix = "" if args.lang == "pl" else f"-{args.lang}"
    video, still = out / f"intro{suffix}.ogv", out / f"intro-last{suffix}.webp"
    codec = ["-c:v", "libtheora", "-q:v", "7", "-pix_fmt", "yuv420p", "-c:a", "libvorbis", "-q:a", "4"]
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        if args.lang in TEXTS:
            texts = TEXTS[args.lang]
            files = (tmp_path / "loading.txt", tmp_path / "touch.txt")
            files[0].write_text(texts[0], encoding="utf-8")
            files[1].write_text(texts[1], encoding="utf-8")
            graph = filter_graph(args.font, texts, files)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", args.source, "-filter_complex", graph, "-map", "[out]", "-map", "0:a", *codec, str(video)], check=True)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", args.source, "-filter_complex", graph, "-map", "[out]", "-ss", "9.95", "-frames:v", "1", str(tmp_path / "last.png")], check=True)
        else:   # the source already has English captions
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", args.source, *codec, str(video)], check=True)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "9.95", "-i", args.source, "-frames:v", "1", str(tmp_path / "last.png")], check=True)
        from PIL import Image
        Image.open(tmp_path / "last.png").convert("RGB").save(still, quality=92, method=6)
    print(f"{video.name} {video.stat().st_size / 1e6:.1f} MB, {still.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
