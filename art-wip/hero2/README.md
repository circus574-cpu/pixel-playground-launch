# Postacie ras v3 — praca w toku (27.10.2026), wstrzymana przez właściciela

Nie jest zainstalowane w grze. Zebrane z poda (2×A40), żeby nie zostało tylko na serwerze.
Pełne pliki źródłowe (siatki 1536×1024, klipy 720×1280, modele) zostają na network volume w `/workspace/hero2`.

## Zawartość

- `races/<rasa>/masters/` — zaakceptowane wzorce przodem (`front.png`) oraz wzorce bok/tył (`side.png`, `back.png`, niezaakceptowane).
- `races/<rasa>/grids/` — siatki 8 klatek (4×2) z SDXL + ControlNet openpose z Blendera (zmniejszone do 1024, WebP):
  `<kierunek>w-<seed>` chód, `punch-<kierunek>w-<seed>` atak, `sideb-*` pierwszy test boku Legendy, `pose-*` szkielety.
- `races/<rasa>/game/<ruch>-<kierunek>/` — pocięte klatki 128 px (`00..07.png`), `sheet.png`, `preview.mp4`.
- `clips/` — klipy Wan2.2-Animate (zmniejszone do 360 px).
- `preview/` — podglądy MP4 wysłane właścicielowi.
- `scripts/` — skrypty z poda (Wan worker, przygotowanie, manekin Blender z eksportem stawów, generator siatek, cięcie).

## Stan i ocena

- Wan2.2-Animate: poprawny tylko chód przodem; bok i tył rozmyte, ciosy rozmazane.
- Siatka 8 klatek: ruch spójny we wszystkich kierunkach, ale postacie odbiegają od zaakceptowanych projektów
  (strój Legendy, twarz Androida, Mędrczyni wychodzi poza kadr). Właściciel ocenił wynik negatywnie.
- Nieprzetestowany pomysł (nie wdrożony): siatka img2img startująca od wzorca, żeby trzymać projekt postaci.
