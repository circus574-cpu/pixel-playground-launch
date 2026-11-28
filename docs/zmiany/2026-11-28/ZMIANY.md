# KI Legends — 2026-11-28

## Świat Superior w panelu administratora

Zakładka „Świat Superior” domyślnie pokazuje Androida. Poprzedni atlas przeglądarki jest dostępny przełącznikiem „Przeglądarka · Phaser”. Endpoint zwraca szczegółowe dane tylko zweryfikowanym administratorom i bez zapisywania odpowiedzi w cache. Prywatny plik danych jest poza publicznym repozytorium i poza katalogiem plików statycznych.

- Źródło to opublikowana aktualizacja Androida **1.14.38**. [Manifest OTA](https://kilegends.pl/ws/godot/manifest?client=101)
- Atlas ma podkład planety i czterech kontynentów z paczek Androida. Sześć podkładów wysp odtworzono z kodu proceduralnego Godota. Współrzędne bossów na planecie policzono funkcją projekcji używaną w grze.
- Ujęto osiem aktywnych bossów, 818 zapisanych punktów odrodzenia potworów, 85 NPC, 106 zadań z katalogu (102 włączone w Androidzie), osiem podziemi i 14 zdarzeń. Osobne warstwy pokazują drogi, budynki i wejścia, miasta, skarby, kamienie podróży, faunę, zasoby i dekoracje.
- Atlas pokazuje współrzędne zdarzeń obliczone przez Godota oraz miejsca celów questów i NPC rozpoznawanych przez silnik zadań. Projekty dziesięciu nowych bossów są wymienione bez aren w tej aktualizacji. Pozycje katalogowe bez wiązania do runtime Androida są oznaczone osobno.
- Endpoint API i podkłady map wprowadzono na gałęzi do weryfikacji. Serwis produkcyjny nadal korzysta z aktualnie opublikowanego kodu.

### Odtworzenie atlasu po wydaniu kolejnej aktualizacji

1. Zapisz manifest aktualizacji dla klienta 101 i pobierz pliki `core-c101` oraz `world-regions` według manifestu. Zachowaj commit Androida odpowiadający paczkom.
2. Uruchom `godot --headless --path PROJEKT_ANDROIDA -s SKRYPTY/extract_admin_android_pcks.gd -- CORE.pck REGIONS.pck EKSTRAKCJA`. Ścieżki do paczek, ekstrakcji i skryptów mają być absolutne.
3. W tymczasowym projekcie Godota udostępnij katalogi `scripts/` właściwego commita Androida, `data/` z ekstrakcji i `regions/ID/` z czterema wyekstrahowanymi regionami. Uruchom `godot --headless --path PROJEKT_TYMCZASOWY -s SKRYPTY/export_admin_android_runtime.gd -- EKSTRAKCJA/runtime.json`.
4. Uruchom `python scripts/godot/export_admin_android_world.py EKSTRAKCJA MANIFEST.json CORE.pck REGIONS.pck /katalog-prywatny/android-superior.json`. Eksporter sprawdzi SHA-256 obu paczek. Zapisze publiczne podkłady i osobny plik szczegółów z uprawnieniami 0600.
5. Serwis gry odczytuje ścieżkę do prywatnego pliku ze zmiennej `KI_ANDROID_OVERVIEW_PATH`. Plik musi być dostępny dla procesu serwisu po wdrożeniu. Testy mogą skorzystać z rzeczywistych danych przez `KI_ANDROID_OVERVIEW_QA_SNAPSHOT`. Domyślne dane CI są syntetyczne.

### Weryfikacja panelu

- Playwright na pliku z paczek Androida zaliczył 12/12 scenariuszy w Canvas i Software WebGL. Sprawdzono cztery rozmiary ekranu, odczyt współrzędnych, mapę wyspy, cele questów oraz odmowę dostępu dla gracza anonimowego i GM.
- Test HTTP przeszedł z prywatnym plikiem i z danymi syntetycznymi. Pełny TypeScript i build zakończyły się powodzeniem. Lint zgłosił 16 istniejących ostrzeżeń i zero błędów.
- Drugi eksport dał identyczny plik współrzędnych. Prywatny eksport i zrzut panelu są poza publicznym repozytorium.
