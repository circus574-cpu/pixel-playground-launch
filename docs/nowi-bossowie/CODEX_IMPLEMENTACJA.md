# Zlecenie dla Codex — nowi bossowie KI LEGENDS

Wczytaj `README.md`, `NOWI_BOSSOWIE_DOKUMENTACJA.md`, `bosses_design.json` oraz 10 ilustracji z `images/`. To 10 **NOWYCH** bossów, nie osiem istniejących w `ports/godot-pyra/data/bosses.json`.

1. Sprawdź aktywną architekturę gry i parser bossów; niczego nie nadpisuj w produkcji.
2. Przygotuj bezpieczny plan dodania 10 nowych bossów (ID, nazwy, lokacje, questy, fazy, ataki, loot) bez kolizji ze starymi.
3. Opracuj pipeline modelowania lub renderowania 2.5D z referencji 3-widokowych, uwzględniając, że cztery ostatnie są niższej rozdzielczości.
4. Dopiero po zatwierdzeniu wybierz jednego bossa (np. AZH'KAR) jako prototyp z uruchamialną sceną, przeciwnikiem, AI, hurtbox, telegraphami i testami Godot.
5. Nie edytuj APK, VPS, bazy danych i aktywnych release; nie zużywaj płatnego GPU bez zgody.
6. Nie deklaruj wygenerowania prawdziwych modeli GLB/FBX — w tym pakiecie są tylko obrazy, opis i dane projektowe.