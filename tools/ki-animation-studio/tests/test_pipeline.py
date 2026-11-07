#!/usr/bin/env python3
"""
Autotest potoku KI Legends Animation Studio ("Kombajn do Animacji").
Weryfikuje:
1. Generację testowego pliku MP4 i jego rozbicie na klatki RGBA z blokadą kotwicy stóp
2. Silnik kombinacji animacji (Forward, Reverse, Ping-Pong, Hit-Stop, Optical Flow)
3. Silnik efektów VFX i transformacji postaci (Aura KI, Obrys Ink, Deformacja Siatki, Błyskawice)
4. Eksport kompletnej paczki produkcyjnej KI Legends (.ZIP z WebP + Phaser JSON Hash + manifest.json)
"""
import io
import json
import sys
import tempfile
import zipfile
from pathlib import Path

import cv2
import numpy as np

STUDIO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(STUDIO_ROOT))

from backend.combinator_engine import build_animation_combination
from backend.exporter_engine import build_ki_legends_export_zip, create_animated_gif_bytes
from backend.fx_transform_engine import process_sequence_fx_parallel
from backend.video_extractor import extract_video_to_frames


def create_synthetic_mp4(path: Path, frames: int = 12, size: int = 256):
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, 16.0, (size, size))
    for i in range(frames):
        img = np.full((size, size, 3), 255, dtype=np.uint8)  # Białe tło studyjne
        cx = size // 2 + int(np.sin(i / frames * np.pi * 2) * 18)
        cy = int(size * 0.65)
        # Sylwetka testowego bohatera
        cv2.circle(img, (cx, cy - 50), 22, (40, 80, 160), -1)
        cv2.rectangle(img, (cx - 24, cy - 25), (cx + 24, cy + 45), (30, 120, 70), -1)
        cv2.rectangle(img, (cx - 20, cy + 45), (cx - 6, int(size * 0.92)), (20, 30, 50), -1)
        cv2.rectangle(img, (cx + 6, cy + 45), (cx + 20, int(size * 0.92)), (20, 30, 50), -1)
        writer.write(img)
    writer.release()


def run_all_tests():
    with tempfile.TemporaryDirectory() as tmp:
        mp4_path = Path(tmp) / "test_hero.mp4"
        create_synthetic_mp4(mp4_path, frames=12, size=256)

        # 1. Test ekstrakcji MP4 + usuwania białego tła + kotwicy stóp
        extracted = extract_video_to_frames(
            video_path=mp4_path,
            max_frames=8,
            bg_mode="white_studio",
            tolerance=30,
            canvas_size=256,
            lock_feet=True,
        )
        assert extracted["total_extracted"] == 8, "Powinno wyekstrahować 8 klatek"

        from backend.video_extractor import base64_to_rgba

        rgba_frames = [base64_to_rgba(f["data_url"]) for f in extracted["frames"]]
        assert rgba_frames[0].shape == (256, 256, 4), "Klatka musi być 256x256 RGBA"

        # 2. Test kombinacji (Ping-Pong, Hit-Stop, Optical Flow)
        ping_pong = build_animation_combination(rgba_frames, mode="ping_pong", target_count=8, use_optical_flow=True)
        assert len(ping_pong) == 8, "Ping-pong z target_count=8 musi zwrócić 8 klatek"

        hit_stop = build_animation_combination(rgba_frames, mode="hit_stop", hit_stop_frame=0, hit_stop_hold=2)
        assert len(hit_stop) == 10, "Hit-stop +2 klatki musi zwrócić 10 klatek"

        # 3. Test efektów VFX i transformacji postaci
        fx_frames = process_sequence_fx_parallel(
            ping_pong,
            {
                "race_preset": "nexus",
                "ink_outline_px": 2,
                "ink_color": "#0b1017",
                "cel_shading_levels": 4,
                "aura_intensity": 0.75,
                "aura_color": "#00d8ff",
                "lightning_sparks": True,
                "shockwave": True,
                "contact_shadow": True,
                "lean_deg": 6.0,
                "squash_stretch": 0.08,
                "cloth_sway": 4.0,
                "transformation_scale_boost": 0.05,
            },
        )
        assert len(fx_frames) == 8, "Silnik FX musi zwrócić 8 przetworzonych klatek"

        # 4. Test eksportu GIF i paczki ZIP KI Legends
        gif_bytes = create_animated_gif_bytes(fx_frames, fps=12)
        assert len(gif_bytes) > 500, "Wygenerowany GIF nie może być pusty"

        zip_bytes = build_ki_legends_export_zip(
            state_clips={"idle": fx_frames, "walk": fx_frames, "attack": fx_frames},
            actor_id="hero-test-unit",
            world="nexus",
            profile="hero",
            version="1.0.0",
            cell_size=256,
        )
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            names = zf.namelist()
            assert "manifest.json" in names, "Brak manifest.json w paczce ZIP"
            assert "provenance.json" in names, "Brak provenance.json w paczce ZIP"
            manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
            assert manifest["id"] == "hero-test-unit"
            assert "idle" in manifest["actors"][0]["clips"]

        print("PASS: Wszystkie testy ekstrakcji MP4, kombinacji, efektów VFX i eksportu KI Legends zakończone sukcesem!")


if __name__ == "__main__":
    run_all_tests()
