# KI Legends Android — projekt Godot 4

Dokumentacja samodzielnego prototypu **Twierdzy Popiołu (Pyra)**, stan 15.11.2026.
Repozytorium: `circus574-cpu/pixel-playground-launch`.
Gałąź: `feat/godot-pyra-android-20261115`, [PR #170](https://github.com/circus574-cpu/pixel-playground-launch/pull/170).

**Korekta wstępu w źródłach:** napis silnika zastąpiono oryginalnym SVG Godot
z oficjalnego press kitu, także w boot splash. Nowy ekran z konkretną ilustracją
właściciela oczekuje dostarczenia jej pliku; podgląd w wiadomości nie został
udostępniony w środowisku jako obraz do odczytu. APK 0.2.0 poniżej jest wcześniejszą
paczką — nie przedstawiamy go jako realizacji nowego wstępu.

To natywna aplikacja Godot, napisana w GDScript. Nie wymaga uruchamiania React,
Phasera ani serwera gry. Projekt jest próbą migracji jednego miasta; obecna gra WWW
pozostaje osobnym produktem. Nie przeniesiono całego kontynentu ani całej gry.

## 1. Co działa

| Obszar | Wdrożony zakres |
| --- | --- |
| Miasto | Źródłowy układ Pyry, 53 obiekty otoczenia, kolizje i granica próby |
| Postać | Legenda, osiem kierunków animacji idle/walk, ruch 170 j./s |
| Dotyk | Joystick 360°, osobny palec interakcji, anulowanie dotyku i utrata fokusu |
| Budynki | Sala, sklep, arena, kuźnia, depozyt, gospoda; sześć wnętrz i powroty |
| NPC | Osiem postaci ze źródłowymi nazwami i tekstami rozmów |
| Interfejs | Interakcja, dialogi, menu, safe area i poziomy układ ekranu |
| Start i ikona | Ekran KI LEGENDS, „Powered by GODOT ENGINE”, wejście do Pyry, ikony Android |
| Zapis | Lokalny checkpoint pozycji, pomieszczenia i miejsca powrotu do miasta |
| Licencje silnika | Pełne informacje Godot i bibliotek w menu aplikacji |

**Poza zakresem:** walka, aktywne zdolności, progresja, wykonywanie questów,
ekwipunek, handel, crafting i przedmioty depozytu, audio, konta oraz synchronizacja
zapisów z WWW. Obecność sklepu, skrzyni czy tekstu zadania nie oznacza wdrożenia tych
systemów. Miasto jest bezpieczne i nie zawiera przeciwników.

## 2. Instalacja gotowego APK

[APK Android ARM64](https://github.com/circus574-cpu/pixel-playground-launch/raw/refs/heads/feat/godot-pyra-android-20261115/deliveries/godot-pyra-android-20261115-title/ki-legends-pyra-debug.apk)
ma **47 117 009 bajtów**. Wymaga Androida 7.0 lub nowszego i obsługi `arm64-v8a`.
Nie jest paczką dla emulatora x86 ani telefonu wyłącznie 32-bitowego.

1. Pobierz APK na telefon.
2. Otwórz plik i zezwól użytej aplikacji na instalowanie pobranych APK, jeżeli
   Android o to poprosi. Nie wyłączaj Play Protect.
3. Uruchom **KI LEGENDS**, obróć telefon poziomo i wybierz **WEJDŹ DO PYRY**.
4. Lewym kciukiem poruszaj postacią, prawym wybieraj interakcję przy NPC lub drzwiach.

Alternatywnie, z komputera po włączeniu debugowania USB i zatwierdzeniu połączenia:

```sh
adb devices
adb install -r deliveries/godot-pyra-android-20261115-title/ki-legends-pyra-debug.apk
```

Identyfikator aplikacji: `pl.kilegends.godot.pyra`. Wersja `0.2.0-pyra`, kod 2,
min SDK 24, target SDK 36, orientacja `USER_LANDSCAPE`, renderer OpenGL ES 3.
APK jest podpisany certyfikatem debug; nie jest wydaniem Google Play.
Nie żąda internetu ani uprawnień do pamięci zewnętrznej.

SHA-256 aktualnego APK z ekranem startowym:

```text
7adb4d2f3dc59d3bc927a69adfb6f1a4133b60748076f50853311cc13621899d
```

**Instalacja i wydajność na fizycznym Androidzie pozostają niezweryfikowane.**
Paczka i testy desktopowe nie dowodzą płynności na konkretnym telefonie.

## 3. Uruchomienie w edytorze

Wymagany **Godot 4.6.3 Standard**, bez .NET. Projekt używa renderera Compatibility.
Node i Python nie są potrzebne do uruchomienia gotowych zasobów.

- Z pełnego repozytorium: zaimportuj `ports/godot-pyra/project.godot`.
- Z [ZIP-a projektu](https://github.com/circus574-cpu/pixel-playground-launch/raw/refs/heads/feat/godot-pyra-android-20261115/deliveries/godot-pyra-android-20261115-title/ki-legends-pyra-godot-project.zip): rozpakuj i zaimportuj `godot-pyra/project.godot`.
- Poczekaj na import tekstur, następnie uruchom projekt klawiszem **F5**.

Polecenia poniżej zakładają katalog główny pełnego repozytorium. W samodzielnym
ZIP-ie zastąp ścieżkę `ports/godot-pyra` ścieżką do rozpakowanego `godot-pyra`.

```sh
godot --headless --editor --path ports/godot-pyra --import
godot --path ports/godot-pyra
```

Opcja `-- --fresh` pomija odczyt checkpointu przy tym uruchomieniu. Nie usuwa pliku
i nie oznacza bezpiecznego resetu danych; zapis z menu nadal może zapisać nową pozycję.

| Czynność | Komputer | Android |
| --- | --- | --- |
| Wejście z ekranu startowego | Enter / Spacja / przycisk | Przycisk WEJDŹ DO PYRY |
| Ruch | WASD / strzałki | Lewy joystick |
| Rozmowa / drzwi | E / Spacja / przycisk interakcji | Prawy przycisk interakcji |
| Zamknięcie dialogu / wyjście / menu | Esc | Wstecz / elementy HUD |
| Pełny ekran | F11 | Tryb immersyjny aplikacji |
| Zapis pozycji | Opcja w menu | Opcja w menu |

## 4. Architektura i pliki

| Plik lub katalog w projekcie Godot | Odpowiedzialność |
| --- | --- |
| `project.godot` | Scena startowa, Compatibility, fizyka 60 Hz, skalowanie, katalog zapisu |
| `scenes/city.tscn` | Punkt wejścia sceny |
| `scenes/title.tscn`, `scripts/title_screen.gd` | Ekran startowy i ładowanie miasta po zatwierdzeniu |
| `scripts/city_game.gd` | Budowanie miasta i wnętrz, kolizje, interakcje, checkpoint |
| `scripts/player.gd` | CharacterBody2D, ruch i wejście klawiatury/joysticka |
| `scripts/actor_view.gd` | Klatki, kierunki, kotwice, lustrzane animacje |
| `scripts/touch_controls.gd` | Niezależne identyfikatory palców, joystick i interakcja |
| `scripts/hud.gd` | HUD, dialog, menu, bezpieczne marginesy ekranu |
| `data/source.generated.json` | Zrzut kontraktów źródłowych do odtworzenia eksportu |
| `data/city.generated.json` | Dane lokalne czytane przez runtime |
| `data/provenance.json` | Pochodzenie i SHA-256 źródeł oraz tekstur |
| `assets/` | Osobne podłoże, obiekty, postacie i oryginalne wnętrza |
| `assets/branding/` | Znak KI, ikony Android, boot splash, Cinzel i pełna licencja OFL |
| `tests/smoke.gd` | Integracyjne próby w rzeczywistym silniku |
| `export_presets.cfg` | Eksport Android ARM64 i pomocniczy Linux x86_64 |

Źródło geometrii: `acceptedSource` stolicy z
`public/game/worlds/superior-v2/pyra/world.json`. Dane i materiały prototypu zostały
wyeksportowane z `0b69c28e4b45a59f32251f5ac6d54e1365660d98`.
Późniejsza integracja `main@5e5bc00e` nie zmieniła tego zrzutu.

Współrzędne portu = współrzędne źródłowe miasta minus `(1094,566)`.
Wycinek ma 2562×2390 jednostek. `sourceWorld.superiorOffset` zachowuje przesunięcie
do układu Superiora. Kolizje pochodzą z danych, nie z przezroczystości obrazu.
Wnętrza zachowują kontrakt `cityRoom` i rozmiar 1920×1280.

Sama scena miasta zawiera 44 tekstury, w tym 16 kafli podłoża do 512×512 px.
Arkusze postaci mają najwyżej 2048×2048 px. Szacunek aktywnych tekstur zewnętrznych
to 75,05 MiB RGBA, **bez** UI, viewportu, silnika i alokacji przejściowych.
Nie jest to całkowite zużycie RAM. Pełny kontynent wymaga osobnego streamingu
i sortowania regionalnego; obecnego ładowania miasta nie należy rozszerzać na całą planetę.

## 5. Odtwarzanie danych i grafiki

Ta część wymaga **pełnego repozytorium**, zależności z `package-lock.json`, Pythona 3
i Pillow. Sam ZIP Godot zawiera już wynik eksportu, lecz nie zawiera źródeł WWW ani
narzędzi mostu. `sharp` z zależności repo jest używany przy źródłowych SVG.

```sh
npm ci
python3 -m venv .venv-godot
.venv-godot/bin/python -m pip install Pillow 'fonttools[woff]'
npx tsx scripts/godot/export-pyra-source.ts
.venv-godot/bin/python scripts/godot/prepare_pyra.py
.venv-godot/bin/python scripts/godot/prepare_branding.py
godot --headless --editor --path ports/godot-pyra --import
npx vitest run src/test/godot-pyra-export.test.ts
```

Most TypeScript czyta bieżące kontrakty i grafiki; Python odtwarza marginesy
przyciętych atlasów, origin/mirrored oraz kafle podłoża. Nie generuje nowego świata
ani ilustracji zastępującej scenę. Ponowienie na nowszym commicie może zmienić dane;
sprawdź diff, pochodzenie i testy przed zaakceptowaniem wyniku.
Nie edytuj ręcznie plików `*.generated.json`, aby obejść rozbieżność kontraktów.

`prepare_branding.py` adaptuje istniejący `public/ki-favicon.svg` i konwertuje
repozytoryjny Cinzel z WOFF2 do TTF. Wymaga `fonttools[woff]` (w tym Brotli).
Nie tworzy nowej grafiki świata. `assets/branding/provenance.json` zapisuje SHA
źródeł i wyników. Pełny OFL jest w paczce i dostępny w menu licencji.
Ekran startowy używa „Powered by” i oryginalnego logotypu Godot; boot splash
pokazuje oryginalny logotyp. Plik `godot/logo-large-color-dark.svg` pochodzi
z oficjalnego press kitu, bez zmian liter, kolorów lub proporcji. Jego źródło
i SHA zapisano w `godot/provenance.json`, a atrybucję CC BY 4.0 dołączono do
zasobów i menu licencji. Wstęp oparty na ilustracji właściciela wymaga jej pliku.
Miasto powstaje dopiero po zatwierdzeniu przycisku, z ochroną przed wielokrotnym
uruchomieniem i przejęciem dotyku startowego przez sterowanie gry.

## 6. Budowanie Androida

Sprawdzona konfiguracja: Godot 4.6.3 + oficjalne **Export Templates 4.6.3**,
JDK 21, Android SDK `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`.
Licencje SDK należy przyjąć lokalnie. Standardowy eksport nie wymaga Gradle,
NDK ani wynajmowanego GPU. Nie dodawaj do Git lokalnych ścieżek SDK lub kluczy.

Z katalogu głównego pełnego repozytorium:

```sh
python3 scripts/godot/build_android.py --sdk /sciezka/Android/Sdk --java /sciezka/JDK
```

Wynik: `ports/godot-pyra/builds/ki-legends-pyra-debug.apk`.
Opcje: `--godot`, `--output`, `--debug-keystore`; zamiast ścieżek można ustawić
`ANDROID_HOME` / `JAVA_HOME`. Skrypt eksportuje debug APK, sprawdza podpis i wypisuje
rozmiar oraz SHA-256. W samym ZIP-ie skonfiguruj SDK/JDK w ustawieniach edytora
Godot, zainstaluj szablony i użyj **Project → Export → Android → Export Project**,
pozostawiając włączony eksport debug.

Klucz debug jest tworzony przy pierwszym eksporcie i zachowywany poza repozytorium:
`~/.local/share/ki-legends-godot/debug.keystore`. Zachowaj go, aby kolejne własne
APK dało się instalować jako aktualizacje. Odtworzenie builda na innym komputerze
z innym kluczem zmieni podpis i SHA; Android może odmówić aktualizacji istniejącej
aplikacji. Nie odinstalowuj jej bez kopii danych, jeżeli checkpoint jest potrzebny.
Do wydania sklepowego potrzebny będzie osobny proces release i bezpieczny klucz.

Przykładowe sprawdzenie i instalacja własnego builda:

```sh
/sciezka/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose ports/godot-pyra/builds/ki-legends-pyra-debug.apk
/sciezka/Android/Sdk/build-tools/36.0.0/zipalign -c -P 16 4 ports/godot-pyra/builds/ki-legends-pyra-debug.apk
adb install -r ports/godot-pyra/builds/ki-legends-pyra-debug.apk
```

## 7. Zapisy i ochrona danych

Checkpoint: `user://city-checkpoint-v1.json`, format `ki-godot-pyra-save-1`, wersja 1.
Zapisuje pozycję, identyfikator wnętrza i pozycję powrotu; nie zapisuje ekwipunku,
statystyk ani questów. Odczyt następuje przy starcie, zapis jest ręczny z menu.
Najpierw powstaje plik tymczasowy, potem atomowa zmiana nazwy.
Nieznany, nowszy lub niepoprawny checkpoint blokuje nadpisanie.

Na desktopie projekt używa własnego katalogu `ki-legends-godot-pyra-prototype`
w katalogu danych aplikacji Godot; dokładną ścieżkę zwraca
`ProjectSettings.globalize_path("user://")`. Na Androidzie dane są prywatne dla
pakietu aplikacji. Backup Androida jest wyłączony; odinstalowanie aplikacji może
usunąć checkpoint. Zapisy WWW v5 i postacie kont nie są odczytywane ani migrowane.

## 8. Testy, dowody i odbiór

```sh
godot --headless --path ports/godot-pyra --script res://tests/smoke.gd -- --fresh --qa-output /tmp/pyra-headless
xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra --rendering-method gl_compatibility --script res://tests/smoke.gd -- --fresh --qa-output /tmp/pyra-native
```

Druga komenda jest dla Linuxa z Xvfb i Mesa. Bez Xvfb uruchom ten sam test w sesji
graficznej, pomijając prefiks `xvfb-run ... env ...`. Wyniki zapisują `result.json`;
tryb graficzny dodaje obrazy viewportu. Headless nie jest dowodem wyglądu.

Na commicie **`01ff5f91d571d2b408c07374298a869065bcfb79`**:

- **52/52** kontrole Godot headless i **52/52** z natywnym renderowaniem.
- [CI Godot — SUCCESS](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/43744276908).
- [Główna bramka repozytorium — SUCCESS](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/43744276811).
- Sześć testów Vitest sprawdza zgodność eksportu z rzeczywistymi źródłami.
- Próby obejmują ruch, kontakt z kolizją, dwa palce i cancel, rozmowy, sześć wnętrz,
  powroty, checkpoint i nowszy format, limity 30/120 FPS oraz trzy poziome viewporty.

Wersja **0.2.0-pyra** rozszerza tę samą regresję do **64/64** w każdym trybie.
Dodatkowe próby obejmują rzeczywistą scenę startową, trzy rozmiary ekranu, cancel,
utratę fokusu, dwa palce, pojedyncze ładowanie i brak dotyku odziedziczonego przez
miasto. APK sprawdzono pod kątem ikon dla gęstości Androida, koła bezpiecznego
ikony adaptacyjnej, monochromu, podpisu, wyrównania i dołączonej licencji.
Nowe dowody są w `docs/zmiany/2026-11-15/qa/godot-pyra-title/`; starsze 52/52
oraz pierwszy APK pozostają w swoim pierwotnym katalogu.

[Raport, zrzuty i nagranie z silnika](https://github.com/circus574-cpu/pixel-playground-launch/tree/feat/godot-pyra-android-20261115/docs/zmiany/2026-11-15/qa/godot-pyra).
Workflow `.github/workflows/godot-pyra.yml` wykonuje import, headless i render natywny;
nie buduje ani nie publikuje APK automatycznie. Starszy wynik CI dotyczy wskazanego
SHA, nie dowolnej przyszłej zmiany dokumentacji lub kodu.

Próba na telefonie powinna objąć: instalację, safe area i czytelność, jednoczesny
ruch/interakcję, powrót po rozmowie, wejście i wyjście z każdego budynku, przycisk
Wstecz, uśpienie/wznowienie, zapis po ponownym starcie oraz pomiary FPS/RAM/temperatury.
Zapisz model telefonu, Android, SHA APK i faktyczny wynik; niczego z tej listy
nie oznaczono jako zaliczonego bez urządzenia.

## 9. Dalsza praca i granice projektu

1. Najpierw wykonać odbiór na fizycznym Androidzie i usunąć potwierdzone problemy.
2. Uzgodnić kolejny zakres: usługi miasta lub prototyp walki poza bezpieczną strefą.
3. Przenosić istniejące kanoniczne reguły, zamiast wprowadzać uproszczony balans.
4. Przed całym kontynentem wdrożyć streaming zasobów i pomiary pamięci urządzenia.
5. Zaprojektować osobno wersjonowanie oraz migrację pełnych postaci; obecny checkpoint
   nie jest zamiennikiem zapisu gry.

Pracować na osobnych gałęziach; bez zmian produkcji, scalenia i publikacji bez
decyzji właściciela. Nie modyfikować infrastruktury GPU. Zachować oryginalne assety,
historię i dowody pochodzenia. Prawa do grafik pozostają według rejestru projektu;
sam eksport do Godot nie nadaje nowych uprawnień komercyjnych.

Ta instrukcja jest osobną dokumentacją projektu Android, zamówioną przez właściciela.
Dokumentacja gry WWW nadal ma dziesięć plików tematycznych w `docs/`;
chronologiczne zmiany portu zapisujemy w istniejącym dzienniku dnia.
