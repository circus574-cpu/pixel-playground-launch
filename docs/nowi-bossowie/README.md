# NOWI BOSSOWIE — KI LEGENDS

**Pakiet koncepcyjny 10 nowych legendarnych bossów**, przygotowany do późniejszego modelowania 3D/2.5D, riggowania, animacji i integracji z Godot 4.6.3.

**To nie jest zestaw aktualnych bossów w grze.** Istniejące `ports/godot-pyra/data/bosses.json` definiuje osiem INNYCH bossów i pozostaje bez zmian. Nowe projekty są osobnym katalogiem.

## Zawartość

- `images/00_ATLAS_10_BOSSOW.png` — wspólny atlas.
- `images/01_...png` do `images/10_...png` — 10 ilustracji, każda z widokami z przodu, z boku i z tyłu, na białym tle.
- `bosses_design.json` — dane projektowe: wygląd, arena, mechaniki, fazy, ataki, łupy i SHA256 ilustracji.
- `NOWI_BOSSOWIE_DOKUMENTACJA.md` — pełen opis każdej z 10 postaci.
- `CODEX_IMPLEMENTACJA.md` — wymagania techniczne dla agenta.
- `zbuduj_paczke.py` — tworzy i weryfikuje kompletny ZIP lokalnie z plików znajdujących się w repo. Sam ZIP nie jest obecnie zapisany w GitHubie (ograniczenie wielkości przesyłania).

## Stan przygotowania grafik

- Bossowie **1–6** mają osobne karty referencyjne o wymiarach **1774×887 px**.
- Bossowie **7–10** mają mniejsze karty wycięte z atlasu; wymagają osobnych, wielkoformatowych turnaroundów przed finalnym image-to-3D.
- Zawartość jest **grafiką koncepcyjną**, nie gotowymi modelami GLB, riggami, sprite sheetami ani animacjami.
- Przed rekonstrukcją 3D konieczne są kontrola proporcji, spójności trzech widoków i korekta błędów anatomicznych/uzbrojenia; AI generuje przybliżone, nie geometrycznie idealne ortografie.

## Kontynenty

| Kontynent | Nowi bossowie |
|---|---|
| Pyra | AZH'KAR, VARKESSA, NHAR'ROK |
| Verdantia | GHORUM, ELARIS, MORGATH |
| Aetheria | SHIROKAN, TENSHU |
| Nexus-9 | AXIOM-OMEGA, LEVIATAN ZERO |

**Nie wdrażać na serwer i nie modyfikować APK ani produkcyjnych danych bossów bez osobnego zlecenia.**
## Paczka ZIP

Po pobraniu katalogu uruchom `python3 zbuduj_paczke.py` w folderze `docs/nowi-bossowie`. Skrypt weryfikuje 10 referencji i tworzy `KI_LEGENDS_10_BOSSOW_3_WIDOKI_KOMPLET.zip` obejmujący atlas, 10 obrazów PNG i dokumentację. Wszystkie pliki źródłowe są już częścią repozytorium.
