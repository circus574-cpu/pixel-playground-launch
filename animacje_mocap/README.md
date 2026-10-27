# KI Legends — biblioteka ruchów CMU (14 plików BVH)

**Źródło:** CMU Motion Capture Database (https://mocap.cs.cmu.edu/), konwersja do BVH według kolekcji https://github.com/una-dinosauria/cmu-mocap. Ruchy są darmowe do wykorzystania w projektach, również komercyjnych (sprawdź oryginalny READMEFIRST.txt i warunki zasobów dodatkowych). Zachowaj informację o autorstwie i źródle.

**To są rzeczywiste animacje szkieletowe 3D, a nie gotowe sprite'y KI Legends.** Wgrano je bez zmiany plików gry, bez uruchamiania GPU i bez publikowania.

| Kategoria | Pliki | Numery nagrań CMU |
|---|---:|---|
| Chód w przód / tył / bok | 6 | 07_01, 106_31, 106_32, 106_33, 143_39, 143_40 |
| Ciosy | 3 | 76_01, 76_02, 143_23 |
| Uniki / obrona | 5 | 76_03, 76_11, 77_09, 128_09, 76_04 |

Wykaz i dokładne nazwy są w `manifest.json`.

## Jak użyć

1. Blender: `File → Import → Motion Capture (.bvh)`; importuj wybrany klip.
2. Wybierz docelową postać z osobnym, zgodnym rigiem; retargetuj ruch do jej szkieletu. **Nie należy** traktować surowego BVH jako gotowej animacji sprite'ów.
3. Ustaw kamerę ortograficzną i nagrywaj widoki: przód, tył, lewy bok, prawy bok. Dla KI Legends zalecane wszystkie osiem kierunków (również przekątne) i znormalizowany rozmiar postaci.
4. Przejrzyj nagranie i wytnij odpowiedni zakres; np. `76_01` zawiera także chód wstecz, a `128_09` to sekwencja biegu/przewrotu.
5. Renderuj klatki PNG z przezroczystym tłem i atlas JSON/WebP dla Phaser. Zadbaj o stabilny punkt stóp, klatkę trafienia i pozbawiony poślizgu cykl chodu.
6. Testuj kolizje, liczbę klatek i płynność na telefonie. Kod obsługi joysticka i przycisków pozostaje niezmieniony.

**MediaPipe nie jest tu potrzebne do ekstrakcji pozy:** BVH zawiera już współrzędne/ruch szkieletu. MediaPipe jest przydatne, gdy źródłem jest wideo.

## Status bezpieczeństwa

Zawartość tylko na gałęzi `assets/mocap-ruch-walka-20261027`. Nie scalać automatycznie do `main`, nie publikować. Wymagane są retargeting, wybór zakresów klatek, kontrola licencji, test renderowania i odbiór wizualny przed użyciem w grze.
