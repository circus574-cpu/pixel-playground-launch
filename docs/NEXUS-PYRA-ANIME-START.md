# Nexus-9 i Pyra — anime punkty startowe do oceny

Nowe niezależne obrazy podłoża i obiektów są dostępne wyłącznie w podglądzie:

- `/?ki-nexus-art=1` → Androidy.
- `/?ki-pyra-art=1` → Legendy.
- Można łączyć parametry z `ki-aether-art=1`. Verdantia zachowuje zaakceptowaną grafikę.

Paczki `nexus-start` oraz `pyra-start`, wersja 1.0.0, mają `previewOnly: true`.
Bez parametrów pozostają stare zasoby. Nie publikowano i nie zmieniano GPU.

Każda paczka ma cztery powtarzalne tekstury (podłoże, ścieżka, plac i ściana)
oraz sześć niezależnych obiektów PNG z przezroczystością:

- Nexus-9: laboratorium, reaktor, terminal, kryształ, pylon i ogród technologiczny.
- Pyra: forteca, świątynia klanowa, posąg, bazalt, wulkan i sztandar.

Styl: anime 2D cel-shading, światło z północnego zachodu, perspektywa gry z góry.
Źródła wygenerowano narzędziem obrazowym Lovable. `scripts/prepare_region_start.py`
przygotowuje przezroczystość, rozmiary i kafle; istniejący importer GPU waliduje
oraz instaluje gotowe zasoby i manifesty. Nie jest to render z instancji GPU.

Bindingi `origin` ustawiają namalowane podstawy na istniejących pozycjach obiektów.
Układ regionów, footprinty kolizji, spawn, ścieżki, postacie, HUD, zadania, mechanika
oraz format zapisu pozostają bez zmian. Animacje odłożone zgodnie z poleceniem.
Nie przedstawiać statycznych grafik jako nowych animacji ani wydajności na
fizycznym telefonie jako zmierzonej.
