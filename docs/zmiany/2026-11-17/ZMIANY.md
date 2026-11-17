# Zmiany 2026-11-17

## 1. Przygotowanie następnej próby GPU na CPU

Zlecenie właściciela: przygotować następną sesję przed wynajmem GPU.
Gałąź `prep/vace-cpu-ready-20261117`, baza `2fbd6db0b91d4dee0a4cb4b20227720024ddedac`.
Zakres: narzędzia i izolowany podgląd. Bez wdrożenia, nowego APK, zmian statystyk,
świata, produkcyjnych atlasów lub zapisów. Nie uruchamiano instancji GPU.

### Co jest gotowe

| Element | Zmiana | Dowód |
| --- | --- | --- |
| Kontrola chodu | 8 rzeczywistych klatek Legendy, 5 kluczy zamykających pętlę, 33 klatki wejściowe 512², maski VACE | [Manifest](qa/vace-cpu-ready/control/control.json), [klucz](qa/vace-cpu-ready/control/control/key-1.png) |
| Adapter VACE 14B | Przypięty model, odczyt offline, SHA-256, jeden seed, budżet czasu, blokada równoległych zadań i bezpieczne wznowienie | [Kod](../../../scripts/gpu/vace_motion.py), [15 testów](qa/vace-cpu-ready/unit-vace.txt); inferencja GPU **nieuruchomiona** |
| Cache wag | CPU kopiuje istniejące wagi na lokalny SSD, sprawdza sumy i wolne miejsce; źródła nie nadpisuje | [Kod](../../../scripts/gpu/vace_stage.py), testy małych plików wejściowych; pełne 75 GB **niekopiowane tutaj** |
| Pakowanie | Matting białego tła, jedna skala całego klipu, kotwica stóp, bezstratny atlas 800², 16 klatek przy 32 FPS | [Kod](../../../scripts/gpu/vace_pack.py), [pakiet testowy](qa/vace-cpu-ready/fixture-pack/animation-pack.json), [plansza](qa/vace-cpu-ready/fixture-pack/contact.jpg) |
| Rzeczywisty Godot | Ruch gracza, wybór animacji, odczyt wszystkich klatek z atlasu i zachowanie czasu ośmiu kierunków | [Skrypt](../../../ports/godot-pyra/tests/preview_vace_motion.gd), [54/54 headless](qa/vace-cpu-ready/godot-headless.json), [54/54 X11](qa/vace-cpu-ready/godot-native.json) |
| Gotowy transfer | Narzędzia, klucze, źródłowe klatki, rejestr wag i polecenia w małej paczce, bez modeli i sekretów | [ZIP](qa/vace-cpu-ready/vace-starter.zip), [zawartość i sumy](qa/vace-cpu-ready/starter-manifest.json), [polecenia](qa/vace-cpu-ready/commands.json) |

Pakiet startowy: **631 718 B**, SHA-256
`aeb88611de895960e062288a052693741e969966f12c4b71d20931965fcf21ab`.
[Sprawdzenie po rozpakowaniu](qa/vace-cpu-ready/portable-check.txt): wszystkie
20 plików z rejestru zgodne z rozmiarami i SHA-256, walidacja kontrolnych klatek PASS.
Polecenia przyszłej próby i bramka oceny: [GPU i zasoby](../../GPU-I-ZASOBY.md#android--przygotowanie-próby-vace-na-cpu-17112026).
Pakiet nie zawiera testowego `reference-fixture`, aby nie mylić go z przyszłym wynikiem GPU.

### Testy i nagranie

- Nowe testy Python: **15/15**, bez uruchomienia CUDA. Obejmują rzeczywiste wejścia,
  odbicie kierunku, maski, czas pętli, pełny round-trip RGBA, limit atlasu, matting,
  kotwicę, brak plików modelu, blokady, kontrolę miejsca i uszkodzonego cache.
- Dotychczasowe testy narzędzi premium: **8/8** ([log](qa/vace-cpu-ready/unit-premium.txt)).
- Pełne `npm run typecheck`: **PASS**, trzy konfiguracje ([log](qa/vace-cpu-ready/typecheck.txt)).
- Godot 4.6.3: **54/54 headless** i **54/54 X11 / OpenGL Compatibility / llvmpipe**.
  [Log headless](qa/vace-cpu-ready/godot-headless.txt), [log graficzny](qa/vace-cpu-ready/godot-native.txt).
- Kontrola dokumentacji: [log](qa/vace-cpu-ready/documentation-check.txt).

[Zrzut 844×390](qa/vace-cpu-ready/godot-cpu-reference.png) i
[nagranie 48 klatek z viewportu Godota](qa/vace-cpu-ready/godot-cpu-reference.mp4)
pochodzą z rzeczywistego uruchomienia gry. Widoczny banner oznacza **test CPU na
istniejących klatkach**, bez generowania nowej animacji. Film kodowano przy 32 FPS
zgodnie z krokiem próby; nie jest pomiarem wydajności ani nagraniem z telefonu.
Test potwierdza transport, dekodowanie i integrację prezentacji, a nie jakość VACE.

W logach pozostają ostrzeżenia `ObjectDB instances leaked at exit` oraz w X11
brak obsługi zmiany V-Sync przez sterownik. Nie wystąpił błąd asercji próby.
Nie uruchamiano pełnego webowego Playwright/Vitest ani nowego buildu Androida:
produkcja i logika gry nie były zmieniane. Fizyczny telefon pozostaje niezweryfikowany.

### Co wymaga GPU i dalszej oceny

1. Właściciel uruchamia wybraną maszynę. Zweryfikować faktyczny dostęp do istniejących
   wag, CUDA, pakietów i wolnego miejsca; niczego nie wynajmować automatycznie.
2. Jeden klip VACE 33 klatki / 30 kroków. Ograniczenie czasu procesu nie zatrzymuje poda
   ani naliczania jego kosztu. Po błędzie lub braku poprawnego ruchu nie odpalać kolejki.
3. Usunięcie tła i ocena sylwetki, twarzy, ruchu nóg, kotwicy oraz pętli. Opcjonalny
   rembg wymaga lokalnego ONNX; ta ścieżka nie była tu sprawdzana.
4. Podgląd prawdziwego wyniku w Godocie i próba na fizycznym Androidzie. Dopiero po
   odbiorze decyzja o następnych kierunkach/rasach i ewentualnym imporcie.

Dotychczasowe dwa chody I2V pozostają odrzucone. Idle/attack i 15 grafik terenowych
z 16.11 nie uzyskały tym testem nowego odbioru. Istniejący obraz Legendy jest
referencją tej próby; nie zmieniano kanonu ani praw do zasobów.

## 2. Rzeczywista proba VACE — RTX 6000 Ada

Właściciel uruchomił pod `y5q593yyn2addz` i zlecił wykonanie próby. Gałąź
`trial/vace-rtx6000-20261117` od `f0211ba4354a7f8120c052594a7fc8e38e862243`.
Nie wykonywano operacji start/stop/restart, wynajmu ani zmian konfiguracji instancji.
Nie zmieniano świata, statystyk, zapisów, produkcyjnych atlasów ani APK.

### Co faktycznie wykonano

| Element | Wynik | Dowód |
| --- | --- | --- |
| Istniejące wagi | 29 plików, 75 143 392 259 B, sumy sprawdzone przy kopii i ponownie przed inferencją; SSD 94,81 s | [Rejestr SSD](qa/vace-rtx6000/pilot/stage-verified.json), [sesja](qa/vace-rtx6000/session.json) |
| Jedna inferencja VACE | 33 nowe obrazy 512², 30 kroków, seed 5741117; proces z weryfikacją i ładowaniem 420,49 s | [Wynik i SHA-256 każdej klatki](qa/vace-rtx6000/pilot/trial/generated-1794889591402385071/result.json), [log](qa/vace-rtx6000/pilot/infer.log) |
| Zasoby maszyny | RTX 6000 Ada 48 GB; limit RAM kontenera 61 999 996 928 B; szczyt PyTorch 34,86 GiB, próbki VRAM do 36 631 MiB | [Pomiary co 10 s](qa/vace-rtx6000/pilot/gpu-metrics.jsonl), [wersje bibliotek](qa/vace-rtx6000/pilot/packages.json) |
| Pierwsza alfa | Prosty biały klucz zatrzymywał zamknięte białe pola; segmentacja zmniejszyła obrys, ale również część pól zachowała | [Biały klucz](qa/vace-rtx6000/pilot/candidate/contact.jpg), [IS-Net Anime](qa/vace-rtx6000/matting/candidate-rembg/contact.jpg) |
| Końcowy atlas próbny | Doczyszczenie alfa na CPU; 16 klatek / 32 FPS / 0,5 s; komórka 200², rozmiar 133², kotwica 0,5/0,95 | [Manifest](qa/vace-rtx6000/candidate-final/animation-pack.json), [plansza](qa/vace-rtx6000/candidate-final/contact.jpg) |
| Integracja podglądu | Prawdziwy gracz rusza się i odtwarza nowy klip w Godocie; pozostałe kierunki zachowują czas cyklu | [54/54 headless](qa/vace-rtx6000/godot-final-headless.json), [54/54 X11](qa/vace-rtx6000/godot-final-native.json) |

### Matting i naprawa adaptera

Zainstalowano `rembg[cpu]==2.0.67`, przygotowano `isnet-anime.onnx` (176 069 933 B)
ze źródła wskazanego przez bibliotekę i sprawdzono jej zarejestrowaną sumę MD5
oraz zapisano SHA-256. [Pochodzenie, sumy i biblioteki](qa/vace-rtx6000/matting/matting-result.json).
Nie deklaruje to rozstrzygnięcia licencji wag do publikacji komercyjnej.
Adapter korzysta wyłącznie z lokalnego pliku i `CPUExecutionProvider`.

Naprawa `scripts/gpu/vace_pack.py`: rembg buduje ścieżkę z `U2NET_HOME`, ignorując
wartość zwrotną pobieracza. Adapter ustawia teraz właściwy katalog na czas tworzenia
sesji i przywraca środowisko. [Wykonany adapter](qa/vace-rtx6000/matting/vace_pack_rembg.py)
ma SHA-256 `76bff752f9d03fb88ba7ca7029a2d8a8c7bf6463cedd70641d1d52266d917a58`.
Generator GPU pozostaje dokładnie z `f0211ba4`; korekta adaptera dotyczy wyłącznie CPU.

Końcowe doczyszczenie to [powtarzalny skrypt QA](qa/vace-rtx6000/refine_legend.py).
Próg wielkości jasnych neutralnych pól oblicza z 8 źródłowych klatek: największy
refleks ma 22 px, zachowywany limit wynosi 44 px. RGB nie jest zmieniane;
usuwana jest wyłącznie alfa większych neutralnych pól. Test sprawdza niezmienione
granice każdej sylwetki i wszystkie pozostałe piksele. [Parametry i wynik](qa/vace-rtx6000/alpha-refinement.txt).
To korekta tej czarno-czerwonej postaci, **nie ogólny algorytm dla czterech ras**.
Nie stosować jej do białych włosów ani jasnych strojów.

### Zapis i odtworzenie

Wszystkie 33 surowe klatki, film źródłowy, wejścia, wersje narzędzi i logi znajdują
się w [archiwum GPU](qa/vace-rtx6000/rtx6000-pilot.zip): **4 594 271 B**, SHA-256
`4afd9947c72dc64bf725e202be33e9300c9ef9ea04d3019a02a39338ff617600`.
Archiwum mattingu CPU: [ZIP](qa/vace-rtx6000/rtx6000-matting.zip), **345 227 B**, SHA-256
`cb111de3c5e6d4f8025d0031e9378f44896b64bdbd6fe8a20452cdaec8687e74`.
Kopie poza podem sprawdzono po rozpakowaniu, wraz z każdym hashem klatki i atlasu:
[kontrola transferu](qa/vace-rtx6000/transfer-check.txt).
Modele pozostają na trwałym woluminie, bez dodawania 75 GB wag do repozytorium.

Powtórzenie doczyszczenia z katalogu projektu:

```sh
python3 docs/zmiany/2026-11-17/qa/vace-rtx6000/refine_legend.py --reference docs/zmiany/2026-11-17/qa/vace-rtx6000/pilot/trial --candidate docs/zmiany/2026-11-17/qa/vace-rtx6000/matting/candidate-rembg/animation-pack.json --out /tmp/ki-legend-alpha-review
```

Podgląd Godota opisany w instrukcji GPU uruchamiać z manifestem
`candidate-final/animation-pack.json` tej dostawy i osobnym `XDG_DATA_HOME`.

### Weryfikacja i granice wyniku

- Nowe i dotychczasowe zabezpieczenia VACE: **16/16**, w tym kontrakt lokalnej
  ścieżki rembg, brak pobierania i odmowa uszkodzonego modelu ([log](qa/vace-rtx6000/unit-vace.txt)).
- Pełne `npm run typecheck`: **PASS**, trzy konfiguracje ([log](qa/vace-rtx6000/typecheck.txt)).
- Końcowy atlas: **54/54 Godot headless i 54/54 X11 / llvmpipe**, osobno od
  wcześniejszego testu CPU ([log graficzny](qa/vace-rtx6000/godot-final-native.txt)).
- Kontrola dokumentacji: [log](qa/vace-rtx6000/documentation-check.txt).

[Film końcowego atlasu w rzeczywistym Godocie](qa/vace-rtx6000/godot-final.mp4),
[zrzut 844×390](qa/vace-rtx6000/godot-final.png).
To 48 zapisanych klatek viewportu przy kontrolowanym kroku próby; nie benchmark FPS.
[Film surowej generacji](qa/vace-rtx6000/pilot/trial/generated-1794889591402385071/generated-source.mp4)
jest materiałem modelu i nie stanowi dowodu działania gry.

Technicznie próba działa na 48 GB VRAM i daje różne pozy nóg. **Nie jest to odbiór
premium:** zamach ramion pozostaje mały, a dłuższy odbiór pętli, spójności twarzy
i stroju oraz fizyczny Android nie zostały zatwierdzone. Generowano wyłącznie chód
Legendy w prawo; inne kierunki i rasy pozostają dotychczasowe. Brak podmiany
produkcyjnej. W Godocie pozostają wcześniejsze ostrzeżenia ObjectDB przy wyjściu
i V-Sync w sterowniku programowym. Nie uruchamiano pełnego webowego CI, Playwright
ani nowego buildu APK. Następna generacja wymaga najpierw poprawy kontroli ruchu
ramion i oceny tej próbki; nie odpalano kolejnych seedów automatycznie.

## 3. Kolory czterech ras — pełne atlasy i trzy próbki detali GPU

Właściciel zlecił dalszą pracę i wskazał wyblakłe kolory postaci. Kontynuacja
na `trial/vace-rtx6000-20261117`, od `e18cd17b416248dfc336a8219838c9b7e5a18c2b`.
Zakres tej partii: podgląd pełnej korekty kolorów czterech grywalnych ras i osobne
statyczne warianty poprawy detali Legendy. Bez podmiany produkcyjnej i bez nowego APK.

### Diagnoza i korekta

W `actor_view.gd` nie znaleziono stałego filtra rozjaśniającego postać. Mignięcie
po trafieniu wraca do bieli. Dzienny `CanvasModulate` oraz modulate bohatera
sprawdzono w prawdziwej scenie wszystkich czterech ras: białe, bez redukcji alfa.
Źródłowa alfa we wnętrzu większości postaci wynosi 253–255/255, więc sama ta
różnica nie tłumaczy dużego wyblaknięcia. Nie wyłącza to innych różnic fizycznego
ekranu/sterownika; telefonu nie testowano. Nocne oświetlenie pozostaje celowe.

`scripts/gpu/character_color.py` przygotował **49 atlasów / 144 definicje animacji**
czterech bohaterów: Legendy, Planetarni, Mędrcy i Androidy. Jeden stały profil
zwiększa chromę i kontrast, łagodniej traktuje skórę i mocne światła, kompresuje
kolor do gamutu zamiast osobno obcinać kanały. Bez automatycznej ekspozycji
poszczególnych klatek, wyostrzania przez granice atlasu lub losowego odmalowywania.
To korekta kolorów istniejącego rysunku, nie nowa generacja szczegółów.

Każdy bajt alfa i wymiar każdego arkusza jest identyczny ze źródłem. Prostokąty,
kotwice, rozmiary świata, odbicia, kolejność klatek, FPS, pętle oraz dane postaci
pozostają niezmienione. Budżet rozkodowanych tekstur nie rośnie; rozmiary plików
mogą się różnić. [Rejestr wszystkich arkuszy, sum i profilu](qa/character-colors/complete-pack/color-pack.json).
[Porównanie czterech ras](qa/character-colors/four-races-before-after.jpg).

### Rzeczywisty Godot i testy

`preview_character_colors.gd` uruchamia istniejące `PyraGame` kolejno dla czterech
ras, odczytuje wszystkie 36 klipów na rasę i osiem kierunków. Po podmianie tekstur
sprawdza SHA-256 źródeł/kandydatów, rozmiary, liczbę klatek, FPS i pętle wszystkich
klipów. Rejestruje ruch prawdziwego gracza oraz odtworzenie animacji ataku;
to nie jest test obrażeń lub balansu walki. Zapisy są izolowane przez `XDG_DATA_HOME`.

- **3678/3678 headless**, [raport](qa/character-colors/godot-headless.json).
- **3678/3678 X11 / OpenGL Compatibility / llvmpipe**, [raport](qa/character-colors/godot-native.json), [log](qa/character-colors/godot-native.txt).
- **4/4** testy koloru: niezmieniona alfa/ukryte RGB, neutralne szarości i biel,
  zachowanie barwy czerwieni, ochrona skóry, brak ekspozycji zależnej od klatki
  ([log](qa/character-colors/unit-colors.txt)).
- **18/18** testy VACE, w tym bezpieczne uwolnienie ramion i źródła kierunku
  diagonalnego ([log](qa/character-colors/unit-vace.txt)).
- Pełny TypeScript: [log](qa/character-colors/typecheck.txt).
- Kontrola dokumentacji: [log](qa/character-colors/documentation-check.txt).

[Film ruchu czterech ras w Godocie](qa/character-colors/four-races-runtime.mp4).
Zrzuty przed/po: [Legendy przed](qa/character-colors/legend-before.png) / [po](qa/character-colors/legend-after.png),
[Planetarni przed](qa/character-colors/planetary-before.png) / [po](qa/character-colors/planetary-after.png),
[Mędrcy przed](qa/character-colors/sage-before.png) / [po](qa/character-colors/sage-after.png),
[Androidy przed](qa/character-colors/android-before.png) / [po](qa/character-colors/android-after.png).
To nagranie viewportu z kontrolowanym krokiem, nie benchmark telefonu.

W pierwszej wersji skryptu wystąpił błąd zwalniania dwóch zasobów przy zakończeniu;
przeniesienie zamykania do odroczonej funkcji usunęło ten błąd w końcowym przebiegu.
Pozostało wcześniejsze ostrzeżenie ObjectDB i ograniczenie V-Sync sterownika.
Nie wykonano nowego webowego Playwright/builda APK ani publikacji.

### Trzy oddzielne warianty detali GPU

RTX 6000 Ada wykonał trzy statyczne próby SDXL img2img na jednej zatwierdzonej
klatce Legendy: siła 0,22 / 0,32 / 0,32 z nasyceniem wejścia ×1,22. Model
`Lykon/dreamshaper-xl-v2-turbo@f70ad5bce436c640d23fc02cd0a6ccc787280b6e`,
wagi istniejące, sprawdzone przed użyciem. Każdy wariant: 1024² oraz podgląd
w oryginalnej komórce 200² z identyczną alfą. Sama zgodność alfa nie potwierdza
zgodności wewnętrznej pozy lub kostiumu. **Nie są to nowe animacje.**

[Porównanie GPU](qa/character-colors/gpu-detail/comparison.jpg),
[wyniki, czasy i sumy](qa/character-colors/gpu-detail/result.json),
[skrypt wykonany na podzie](qa/character-colors/gpu-detail/character_color_trial.py).
Archiwum: [ZIP](qa/character-colors/gpu-detail-pilot.zip), 964 043 B, SHA-256
`a4ed66d0a773bf88c0fa6916786666ad4caa6fe2ac13db9e4df6322ba2c81aea`.
[Kontrola transferu](qa/character-colors/transfer-check.txt).
Zysk detalu przy tych małych siłach jest umiarkowany; nie oznaczono ich jako
pełnego odmalowania premium ani nie rozpropagowano osobnych losowych wyników
na wszystkie klatki. Prowadziłoby to do ryzyka migotania twarzy i stroju.

### Dalszy ruch — osobna próba

Po ponownym zleceniu właściciela uruchomiono jedną próbę VACE z maską uwalniającą
obszar ramion w środkowych kluczach (8/16/24), zachowując kontrolę twarzy i nóg
oraz pełne klucze początku/końca pętli. Profil jest ograniczony do widoku w prawo.
Pakowanie i narzędzia obsługują też osiem kierunków; przygotowano
[wejście diagonalne](qa/character-colors/diagonal-starter.zip), ale samo przygotowanie
nie jest dowodem generacji ani działania tego kierunku w grze. Odbiór ruchu
jest oddzielny od powyższej korekty kolorów.

## 4. Odbiór dalszych prób — technika i jakość osobno

Po poleceniu kontynuacji wykonano dwa nowe klipy VACE: maska ramion widoku w prawo
i źródło opisane jako `down-right`. Oba mają 33 surowe klatki 512², 30 kroków,
16 eksportowanych klatek przy 32 FPS i cykl 0,5 s. Dodatkowo wykonano dwa mocniejsze
statyczne warianty detali SDXL (0,48 i 0,58). Kolejka była sekwencyjna, bez
równoczesnego ładowania dwóch ciężkich modeli i bez operacji cyklu życia poda.

| Próba | Wynik techniczny | Odbiór wizualny |
| --- | --- | --- |
| Uwolnione ramiona | 417,78 s z ładowaniem i sprawdzaniem wag; 54/54 headless + 54/54 X11 | Zmiana ruchu ramion pozostaje niewielka. Brak odbioru naturalnego zamachu. |
| `down-right` | 410,06 s z ładowaniem i sprawdzaniem wag; 54/54 headless + 54/54 X11 | Źródło pod tą nazwą jest frontalne i wynik zachowuje ten widok. Nie przyjęto jako wiarygodnego ujęcia po skosie. |
| SDXL 0,48 / 0,58 | Nowe obrazy 1024², pliki z sumami, oryginalna alfa wersji 200² zachowana | Więcej wyraźnych detali i połysku, ale zmiana naramienników i szczegółów kostiumu. Brak automatycznej podmiany. |

Szczyt alokacji PyTorch obu klipów VACE: 37 427 428 352 B (34,86 GiB).
Wyniki techniczne nie oznaczają odbioru artystycznego:
[jawna ocena](qa/motion-v2/quality-review.json).

Materiały ramion: [klatki i rejestr](qa/motion-v2/arms/trial/),
[plansza po korekcie alfa i koloru](qa/motion-v2/arms-colored/contact.jpg),
[film z gry](qa/motion-v2/arms-game.mp4), [raport X11](qa/motion-v2/arms-native.json).
Materiały kierunku: [wejście źródłowe](qa/motion-v2/diagonal/trial/control/key-0.png),
[plansza wyniku](qa/motion-v2/diagonal/candidate/contact.jpg),
[film z gry](qa/motion-v2/diagonal-game.mp4), [raport X11](qa/motion-v2/diagonal-native.json).
Korekta koloru i matowanie są osobnymi etapami: zastosowano istniejące doczyszczenie
alfa i ten sam profil koloru co w czterech rasach, zachowując metadane pochodzenia.
[Powtarzalne nałożenie profilu](qa/motion-v2/compose_colors.py).

Archiwa zabezpieczone poza podem i sprawdzone po transferze:

- [Ramiona](qa/motion-v2/arms-pilot.zip): 4 601 448 B,
  SHA-256 `1b8962b78053185b7cf3e7976ff21352195ffe33f9ddd72df4ef967ef32cc032`.
- [Kierunek](qa/motion-v2/diagonal-pilot.zip): 5 288 230 B,
  SHA-256 `92d7782445e752509c9a79f92f1612454ed9ec81d788aaebf4eba051c00279da`.
- [Mocniejsze detale](qa/character-colors/gpu-detail-strong.zip): 691 065 B,
  SHA-256 `fcdcf38138c552171c7a49ac24e5afef591f2c0c738a68089ec9ed17b851926a`;
  [porównanie](qa/character-colors/gpu-detail-strong/comparison.jpg),
  [parametry i sumy](qa/character-colors/gpu-detail-strong/result.json).

[Kontrola obu filmów/atlasów i 66 hashy klatek](qa/motion-v2/transfer-check.txt).
Pełny zestaw lokalnych testów narzędzi GPU/koloru: **30/30**
([log](qa/motion-v2/all-gpu-tests.txt)). Pełny TypeScript zaliczono dla kodu
tej partii w sekcji 3; później dodano dowody, skrypt QA kompozycji i dokumentację.
[Kontrola dokumentacji](qa/motion-v2/documentation-check.txt).
Wszystko pozostaje na gałęzi testowej, bez publikacji, podmiany źródeł lub nowego APK.

Pomiary korekty barw na dopasowanych pikselach czterech źródłowych klatek idle:
[dane](qa/character-colors/measurements.json). Średnie nasycenie wzrosło około
12–19%, a zakres luminancji P95–P05 około 4–7%. To opis koloru, nie punktacja
jakości artystycznej. Alphę zachowano dokładnie. W imporcie źródeł Godota znaleziono
również stratną kompresję `compress/mode=1`, `lossy_quality=0.92`; nie zmieniano jej
ani nie uznano bez pomiaru za główną przyczynę wyblaknięcia.

## 5. Kierunek Meshy — kontrakt wejścia do istniejącego Godota

Właściciel zadeklarował zakup Meshy.ai do tworzenia postaci. Po tej informacji
nie uruchamiano następnej generacji GPU; domknięto zapis wcześniejszej kolejki.
Proponowana ścieżka dla obecnej gry 2D: model 3D → humanoidalny rig → animacje →
stały render ortograficzny ośmiu rzeczywistych kierunków → atlasy obecnego aktora.
Pozwala to zachować istniejący Phaser/Godot 2D, logikę walki, kolizje i HUD.
Nie wdrażano tu pełnej sceny 3D do gry.

[Kontrakt eksportu](qa/character-colors/meshy-import-contract.json) powstał z
rzeczywistego `actors.json`: cztery rasy, 144 klipy, ich FPS, pętle, liczby klatek,
czasy i obecne rozmiary/kotwice. Zawiera także wymóg ruchu w miejscu i weryfikacji
faktycznych kątów. To **specyfikacja, nie ukończony importer Meshy**.
Żadnego modelu Meshy nie otrzymano ani nie zaimportowano.

Pierwszy test powinien obejmować jedną kompletną Legendę: GLB z osadzonymi
teksturami lub FBX z teksturami, skórkowaną siatkę, szkielet i idle/walk.
Do rigowania A-pose/T-pose z odseparowanymi kończynami; źródłowy sprite idle
nie jest taką pozą. Sprawdzić szkielet, materiały i animacje przed większą serią.
Nie zakładać prawidłowych kierunków na podstawie samych nazw. Referencje ras
i kanon pozostają w dokumencie ras; źródłowy PDF i prawa do materiałów pozostają
oddzielnymi dowodami. Nie użyto API ani kredytów Meshy.

## 6. Pierwszy model z Meshy — audyt GLB i osiem widoków

Właściciel przekazał [folder „Blender”](https://drive.google.com/drive/folders/1fo8e99WxocqXh_FcgaIYFlUbr55-VpCB).
Odczytano go przez integrację Dysku Google, pobrano kompletny ZIP, sprawdzono
nazwy/rozmiary wpisów i odczytano GLB. Organizacja i udostępnianie Dysku bez zmian.
Gałąź `trial/meshy-import-20261117`, baza `afb7a092f0ece62624f44391892b2bea865150c6`.

Paczka [Meshy_models_20261117_064147.zip](https://drive.google.com/file/d/1opKqonp-EdkYamwVi6gOVTrcV0RLsm4q/view)
ma 40 460 528 B, SHA-256 `08a78afbb8329e02de2a6c8c23cc4b9e47f12b0623809979bbf39738d5676893`.
W środku jeden folder `Meshy_AI_Anime_Sorceress_Emerald_Gold_20261117_image-to-3d-texture_62fb35c8`
i jeden `Meshy_AI_model.glb`, 51 304 748 B, SHA-256
`e27008ebb782e7edcc4afd88ad7d7522efe3a8ac2648e88a420a3b202f244fa3`.
Oryginał zachowano na Dysku oraz lokalnie poza drzewem kodu, bez ponownego
publicznego umieszczania całego pliku źródłowego. W Git są metadane, narzędzie
audytu i podglądy. Nazwa paczki i deklaracja usługi nie są dowodem licencji.

### Faktyczna zawartość

| Element | Wynik |
| --- | --- |
| Format | GLB/glTF 2.0, poprawna zadeklarowana długość i odczyt danych |
| Siatka | 1, 820 637 wierzchołków, 4 589 646 indeksów, 1 529 882 trójkąty |
| Materiał | 1, PBR metallic/roughness, dwustronny i nieprzezroczysty |
| Tekstury | 3 osadzone JPEG 2048×2048: base color, metallic/roughness, normal |
| Szkielet i skiny | 0 |
| Animacje | 0 |

[Odczyt źródła i sumy](qa/meshy-first-model/source-audit.json).
Godot potwierdził tę samą strukturę po zaimportowaniu: jedna siatka, jeden
materiał, brak `Skeleton3D` i `AnimationPlayer` z klipami. Nie przydzielano
modelu do grywalnej rasy i nie zmieniano kanonu ani bohaterów istniejącej gry.

### Podgląd w rzeczywistym silniku

Nowy `ports/godot-pyra/tests/audit_meshy_glb.gd` używa `GLTFDocument`, odczytuje
model z zewnętrznej ścieżki i buduje izolowane studio 3D. Kamera ortograficzna,
stała skala i oświetlenie; osiem obrotów co 45°. Pierwszą próbę o zbyt mocnym
oświetleniu zastąpiono łagodniejszym zestawem lamp, zachowując źródłowe materiały.
Nie odmalowywano tekstur modelu i nie generowano obrazów zastępujących render.

[Osiem widoków](qa/meshy-first-model/eight-views.jpg),
[przód / obrót 0°](qa/meshy-first-model/view-000.png),
[bok / obrót 90°](qa/meshy-first-model/view-090.png),
[tył / obrót 180°](qa/meshy-first-model/view-180.png).
[Raport X11](qa/meshy-first-model/native.json), [log](qa/meshy-first-model/native.txt),
[raport headless](qa/meshy-first-model/headless.json),
[sprawdzenie ośmiu zapisanych klatek](qa/meshy-first-model/render-check.json).
Renderer X11/OpenGL Compatibility/llvmpipe, bez testu fizycznego Androida.
Pełny TypeScript: PASS ([log](qa/meshy-first-model/typecheck.txt));
kontrola dokumentacji: [log](qa/meshy-first-model/documentation-check.txt).
Pozostało ostrzeżenie sterownika o V-Sync; brak błędu importu w obu przebiegach.

Odtworzenie po pobraniu pliku z Dysku:

```sh
XDG_DATA_HOME=/tmp/ki-meshy-review godot --audio-driver Dummy --path ports/godot-pyra --script res://tests/audit_meshy_glb.gd -- --model=/absolutna/sciezka/Meshy_AI_model.glb --out=/tmp/ki-meshy-evidence
```

To **statyczny podgląd modelu, nie animacja idle/walk, gotowy atlas ani integracja
z rozgrywką**. Następny eksport powinien zawierać skórkowaną siatkę, szkielet
i przynajmniej idle/walk. Nie tworzono sztucznego chodu przez przesuwanie tej bryły.
Duża siatka może służyć jako źródło renderów offline; nie umieszczano jej bezpośrednio
na telefonie. Bez scalenia, publikacji, nowego APK lub operacji na instancjach GPU.

## 7. Darmowe materiały całej planety — Meshy w przeglądarce i CPU

Zlecenie właściciela: przygotować bezpłatnie grafiki i materiały po sprawdzeniu
przeglądarkowych narzędzi Meshy. Gałąź `trial/free-materials-20261117`, baza
`d509bac79c85db2e427b1e5beb3a09230228f8d7`.

### Wykonane pliki

Pakiet `deliveries/free-materials-20261117/` obejmuje 98 tekstur terenowych
z `ports/godot-pyra/assets/lands/*/terrain`: **86 unikalnych materiałów, 344 mapy**.
Duplikaty źródeł współdzielą materiał. 71 kwadratowych powierzchni rzeczywiście
przetworzono w anonimowej sesji przeglądarkowego Meshy i pobrano darmowy PNG.
15 prostokątnych pasów zachowuje kształt i układ oryginału. Każdy materiał zawiera:

- Kolor bazowy w rozdzielczości oryginału, bezstratny WebP.
- Normalną OpenGL (+Y), zgodną z Godotem/glTF.
- Szacowaną wysokość i szorstkość powierzchni.
- Sumy, wymiary i pochodzenie w `manifest.json`; kwadratowe powierzchnie także
  indywidualny dowód eksportu `browser-export.json`.

Mapy pochodne powstały we własnym kodzie CPU, do 256 px na telefon; wariant 512 px
lub większy można odtworzyć parametrem `--map-size`. Nie przedstawiać ich jako
pomiaru PBR ani eksportu z płatnego AI Meshy. Nie generowano AO/metaliczności.
ZIP PBR w Meshy wymaga darmowego konta; nie pobierano go ani nie obchodzono bramki.
Nie użyto kredytów, płatnego AI, nowych modeli ani poda GPU.

10 galerii i `gallery.html` są w pakiecie. Przykłady:
[Pyra](../../../deliveries/free-materials-20261117/pyra-review.jpg),
[wyspa I](../../../deliveries/free-materials-20261117/island-1-review.jpg),
[Nexus-9](../../../deliveries/free-materials-20261117/nexus-review.jpg).
[Manifest](../../../deliveries/free-materials-20261117/manifest.json).
Prawa do źródeł pozostają dziedziczone z istniejącego rejestru, nie otrzymują
automatycznie nowej licencji dzięki darmowej obróbce.

### Sprawdzenia

- [7/7 testów CPU](qa/free-texture-tools/unit-tests.txt): płaska powierzchnia,
  kierunki normalnych X/Y, brzegi okresowe, długość wektorów, mokra szorstkość,
  brak modyfikacji wejścia i bezstratne odtworzenie WebP.
- [344/344 plików, 86/86 materiałów, 98/98 wiązań](qa/free-texture-tools/pack-validation.json):
  hashe, wymiary, wektory normalnych oraz nienaruszone źródła. 71 metryk krawędzi
  bez przekroczenia progu flagi; to kontrola numeryczna, nie pełny odbiór artystyczny.
  Same mapy zajmują 37 101 076 B, około 35,4 MiB.
- [Eksporty przeglądarkowe](qa/free-texture-tools/browser-exports.txt).
- [Galeria przy 390×844](qa/free-texture-tools/gallery-mobile.json): 10/10 obrazów
  wczytanych, bez przewijania poziomego i błędów JavaScript;
  [zrzut](qa/free-texture-tools/gallery-mobile.png). To test galerii, nie telefonu z grą.
- Pełny [TypeScript](qa/free-texture-tools/typecheck.txt) i
  [lint](qa/free-texture-tools/lint.txt): zakończone kodem 0; lint ma 0 błędów
  i 17 ostrzeżeń w niezmienianych plikach projektu.
- [Studio Godota: 10/10 lądów](qa/free-texture-tools/material-studio.json),
  [rzeczywisty render](qa/free-texture-tools/material-studio.png),
  [log](qa/free-texture-tools/material-studio.txt): kolor, normalna i szorstkość
  na kulach; wysokość nie jest używana przez ten podgląd. To studio materiałów,
  nie zrzut rozgrywki ani dowód wdrożenia PBR.
- [Podgląd w rzeczywistej Pyrze](qa/free-texture-tools/game-preview/pyra-candidate.png),
  [przed](qa/free-texture-tools/game-preview/pyra-before.png),
  [98 wiązań i zachowana geometria/pozycja](qa/free-texture-tools/game-preview/runtime-preview.json).
  [Log gry](qa/free-texture-tools/game-preview.txt) zawiera ostrzeżenie V-Sync
  oraz zgłoszenie dwóch zasobów pozostających w użyciu przy zamykaniu fixture.
  Nie przedstawiać tego jako bezbłędnej pełnej regresji gry.

Renderer: X11/OpenGL Compatibility/llvmpipe na CPU. Fizyczny Android,
Canvas/Software WebGL przeglądarkowej gry i pełna regresja walki nie były częścią
tej kontroli pakietu. Żaden zasób zainstalowanej gry ani zapis nie został zmieniony.

### Jak obejrzeć i co pozostało

Galeria działa z lokalnych plików. Narzędzia:
`scripts/art/free_materials.py`, `scripts/art/meshy_free_browser.cjs` oraz
`ports/godot-pyra/tests/preview_free_materials.gd`. Studio:

```sh
DISPLAY=:101 LIBGL_ALWAYS_SOFTWARE=1 XDG_DATA_HOME=/tmp/ki-material-review godot --audio-driver Dummy --rendering-method gl_compatibility --path ports/godot-pyra --script res://tests/preview_free_materials.gd -- --pack=/absolutna/sciezka/pakietu --out=/tmp/ki-material-studio
```

Izolowana próba w grze: istniejący `preview_premium_terrain.gd` z
`--bindings=<pakiet>/godot-preview.json`. Źródłowe pliki pozostają nienaruszone.
Obecny shader podłoża 2D używa koloru, nie pełnego PBR. Do przyszłej integracji
potrzebne są obsługa oświetlenia/normalnych i strumieniowanie tylko widocznych map,
pomiar pamięci i odbiór na telefonie. Ten pakiet nie zastępuje modeli postaci,
rigowania lub animacji. Bez scalenia, publikacji i nowego APK.

## 8. Budynki — miękki styk z podłożem w Godocie

Właściciel poprosił o obróbkę budynków, które wyglądają jak wklejone. Gałąź
`trial/building-grounding-20261117`, baza `191769ae84281f7c3b7041600eaa66bf62eba222`.

### Diagnoza i poprawka

[Audyt 28 źródeł](qa/building-grounding/source-audit.json): mają przezroczyste tło;
część budynków ma jednak ostro obrysowaną podstawę/podest. Renderer Godota nie
dodawał cienia kontaktowego do malowanych budynków. Zamiast kolejnego wycinania
tła przygotowano bezpłatną obróbkę w rendererze Godota, bez API, kredytów i poda GPU.

| Element | Przed | Zmiana | Dowód |
| --- | --- | --- | --- |
| 22 malowane warianty | Brak kontaktowego cienia silnika | Miękki cień pod podstawą | Cztery pary rzeczywistych kadrów |
| 6 podestów Verdantii | Ostry ciemny kontur zielonej podstawy | Wygaszenie alfa brzegu podestu; RGB bez zmiany | Shader i kontrola pikseli w SubViewport |
| 6 starszych grafik | Mają już własny cień | Pozostawione bez dodatkowego cienia | Rozpoznanie profilu i test wykluczenia |
| Streaming | Sprite bez elementu kontaktowego | Cień należy do tego samego chunka; sprzątany z budynkiem | Test faktycznego usunięcia obu węzłów i wpisu rejestru |
| Geometria i źródła | Opublikowane kotwice, kolizje i obrazy | Zachowane | Hash maski przejścia, konfiguracja krainy, transformacje i 28 hashy źródeł |

Nowy `scripts/building_grounding.gd` w projekcie Android tworzy teksturę 128×64
na CPU i materiał podestu na żądanie, po jednym na krainę. Nie powstaje osobna
tekstura dla każdego budynku. `assets/continent/building_platform.gdshader`
próbkuje 5 punktów, wygaszając tylko alfę dolnej krawędzi/podestu. Kolory dachu,
ścian i schodów nie są przemalowywane. Cień jest w warstwie `below`, pod aktorami.
`continent.gd` obsługuje streaming i sprzątanie, a `city_game.gd` także sześć osobno
rysowanych budynków stolicy Pyry. Nie zmieniono świata, footprintów, drzwi i usług.

### Podgląd i sprawdzenia

[Porównanie czterech miast — przed/po](qa/building-grounding/comparison.jpg).
Oddzielne kadry: [Pyra](qa/building-grounding/legend-after.jpg),
[Verdantia](qa/building-grounding/planetary-after.jpg),
[Aetheria](qa/building-grounding/sage-after.jpg),
[Nexus-9](qa/building-grounding/android-after.jpg).
To zrzuty rzeczywistego runtime Godota. W fixture ukryto HUD i ustawiono kamerę
na budynek przy powiększeniu 1,0; te ustawienia nie zmieniają zwykłej gry.

`tests/preview_building_grounding.gd`: **52/52 sprawdzenia X11**
([wyniki](qa/building-grounding/results.json), [log](qa/building-grounding/native.txt))
i **49/49 headless** ([wyniki](qa/building-grounding/headless/results.json),
[log](qa/building-grounding/headless.txt)). Obejmuje cztery rasy/krainy, zachowanie
geometrii i pozycji, właściwą warstwę cienia, brak dodatkowego cienia w starszych
grafikach, sprzątanie węzłów i rejestru po wyładowaniu chunka, współdzielenie
tekstury oraz brak dodatkowych elementów przy wyłączonym efekcie. Trzy dodatkowe
sprawdzenia natywne czytają piksele z SubViewport: kolor/nieprzezroczystość dachu,
wygaszenie brzegu i zachowana nieprzezroczystość środka podestu.

Pełny [TypeScript](qa/building-grounding/typecheck.txt) i
[lint](qa/building-grounding/lint.txt) zakończyły się kodem 0; lint ma 17 ostrzeżeń
w niezmienianych plikach. Renderer: X11/OpenGL Compatibility/llvmpipe na CPU.
Pozostały ostrzeżenia V-Sync i ObjectDB przy kończeniu fixture; nie uznawać
liczby zaliczonych asercji za pełną, bezostrzeżeniową regresję całej gry.
Fizyczny Android oraz wpływ na FPS telefonu nie zostały sprawdzone.

### Włączenie próby i ograniczenia

Efekt jest domyślnie wyłączony. Normalna ścieżka nie tworzy cieni/materiałów tej
poprawki. Do lokalnego uruchomienia gry dodać `KI_BUILDING_GROUNDING=1`.
Odtworzenie porównań (osobny katalog danych użytkownika):

```sh
KI_BUILDING_GROUNDING=1 DISPLAY=:101 LIBGL_ALWAYS_SOFTWARE=1 XDG_DATA_HOME=/tmp/ki-building-review godot --audio-driver Dummy --rendering-method gl_compatibility --path ports/godot-pyra --script res://tests/preview_building_grounding.gd -- --out=/tmp/ki-building-compare
```

To korekta styku z podłożem, nie odmalowanie wszystkich budynków ani naprawa
różnic perspektywy w źródłowych ilustracjach. Wymaga odbioru artystycznego przed
domyślnym włączeniem. Bez scalenia, publikacji i nowego APK. Pliki źródłowe,
kanon, infrastruktura GPU oraz zapisy graczy pozostały nienaruszone.

## 9. Historia w terenie — pierwsza próba Pyry i naprawa opisów lokacji

Właściciel wskazał szablonowość terenu i brak odczuwalnej historii. Gałąź
`trial/pyra-story-sites-20261117`, baza `599ea5b6479a620a08b007eeea68a007f2cc305b`.
Zakres: pierwszy prototyp miejsc opowiadających istniejącą fabułę, nie przebudowa
całej planety. [Kierunek i kolejne warstwy](../../SWIAT-I-MIASTA.md#świat-z-historią--kierunek-i-pierwszy-prototyp-17112026).

### Audyt i wdrożony fragment

Katalog Androida już zawiera 16 znanych miejsc z historią, 102 grywalne zadania
i 14 wydarzeń. Interakcja ze znanym miejscem nadal wyświetlała jednak komunikat:
„Znane miejsce Pyry. Odkrywanie lokacji i zadania będą przeniesione razem z mechaniką
questów.” Usunięto ten zastępnik; wszystkie 16 miejsc czytają istniejący tekst
`lore`, z pominięciem technicznego identyfikatora mapy w nawiasie. Sam odczyt
nie zmienia stanu zadania, monet, XP ani nie nadaje ponownie nagrody odkrycia.

`scripts/story_places.gd` w projekcie Android komponuje cztery sceny z aktualnych
zasobów. To osobne, autorskie układy, odczytujące dotychczasowy postęp:

| Miejsce z katalogu | Pokazana historia | Dotychczasowy stan zadania |
| --- | --- | --- |
| Bastion Złamanej Przysięgi | Ruiny, znaki i chorągwie wokół miejsca ręcznego alarmu | `O-P06`: ogień sygnałowy zapala się po ukończeniu |
| Kaplica Dezerterów Popiołu | Cztery czerwone chorągwie i podtrzymywany ogień ratowników | `H-P01`: jaśniejsze znaki po poznaniu przysięgi |
| Ołtarz Płomiennego Pojedynku | Dwa stanowiska i otwarty środek miejsca pojedynku | `O-P05`: zmieniony wygląd chorągwi |
| Kolos Areny Dziedzictwa | Wóz i drewno odnoszące się do ewakuacji rzemieślników | `O-P01`: zmieniony wygląd chorągwi |

Jest to interpretacja scenograficzna istniejących wpisów do oceny właściciela;
nie dodano nowej historii, frakcji, nagród lub finałów questów do kanonu. Ogień
jest istniejącym efektem `PyraAmbient`. Przedmioty są niekolizyjną warstwą
dekoracyjną; punkt zablokowany przez wodę/przeszkodę jest pomijany. Źródłowe
współrzędne lokacji, maska chodzenia, spawny i grafiki pozostają bez zmian.

Sceny budzą się do 1150 j., usypiają po 1600 j. i sprawdzają stan co 0,5 s.
Jedno miejsce ma do 6 rekwizytów i 1 efekt, łącznie cztery definicje; w badanych
punktach aktywne było tylko najbliższe miejsce. Wyjście do wnętrza lub odejście
usuwa scenę. Wczytanie istniejącego stanu questów odtwarza wygląd, także po powrocie
do starszego zapisu. Nowych pól zapisu nie ma. Wygaszanie scen nie usuwa postępu.

### Rzeczywiste kadry i sprawdzenia

[Cztery miejsca przed/po](qa/story-places/comparison.jpg),
[Kaplica](qa/story-places/famous-pyra-2-after.jpg),
[Bastion po zadaniu — stan ustawiony w fixture](qa/story-places/fortress-completed-fixture.jpg),
[działająca interakcja i historia](qa/story-places/fortress-history-dialog.jpg).
Kadry pochodzą z runtime Godota. W porównaniach ukryto HUD i ustawiono kamerę 1,0.
Nie przechodzono całego prologu: stan ukończenia zadania w scenariuszu jest
syntetyczny i służy sprawdzeniu reakcji oraz odczytu istniejącego zapisu.

- **54/54 X11** ([wyniki](qa/story-places/results.json), [log](qa/story-places/native.txt))
  i **54/54 headless** ([wyniki](qa/story-places/headless/results.json),
  [log](qa/story-places/headless.txt)): 16 tekstów historii, brak dodatkowej
  nagrody, cztery sceny, osiągalne kotwice, limity i sprzątanie, reakcja na zadanie,
  round-trip stanu questów i przywrócenie wcześniejszego wyglądu, zachowanie
  geometrii, rzeczywista interakcja. W logach pozostało ostrzeżenie ObjectDB
  przy zamykaniu; X11 także V-Sync.
- Pełny [TypeScript](qa/story-places/typecheck.txt) oraz
  [lint](qa/story-places/lint.txt): kod 0; lint: 0 błędów, 17 ostrzeżeń w innych plikach.
- **Szersza regresja NIE jest zielona: 533/539**, 6 nieudanych asercji w istniejącym
  `tests/smoke.gd` ([raport](qa/story-places/smoke/result.json),
  [log](qa/story-places/smoke.txt)). Powtórzono ją na bazowym `599ea5b6` w izolowanym
  projekcie z osobnym katalogiem danych: **również 533/539 i dokładnie te same
  6 asercji** ([porównanie](qa/story-places/smoke-comparison.json),
  [raport bazy](qa/story-places/baseline-smoke/result.json),
  [log bazy](qa/story-places/baseline-smoke.txt)). Dotyczą footprintu, jednoczesnego
  ataku i joysticka, ruchu przy 30/120 FPS, otwarcia/zamknięcia dialogu oraz wejścia
  do sali. Nie osłabiano ani nie modyfikowano tych testów. Przy kończeniu obu
  przebiegów występują także komunikaty o zasobach RID/ObjectDB. To oddzielna
  blokada pełnego odbioru gry; zgodność z bazą nie naprawia istniejących usterek.

Fizyczny Android i przeglądarkowy Phaser/Canvas/WebGL nie były testowane tym
runnerem. Zmiana dotyczy portu Godot. Nie tworzono ani nie wydawano APK.

### Co działa, co pozostało

Naprawiony odczyt historii działa normalnie dla istniejących lokacji. Nowa
scenografia pozostaje podglądem `KI_STORY_PLACES=1`, domyślnie wyłączonym.
Odtworzenie:

```sh
KI_STORY_PLACES=1 DISPLAY=:101 LIBGL_ALWAYS_SOFTWARE=1 XDG_DATA_HOME=/tmp/ki-story-review godot --audio-driver Dummy --rendering-method gl_compatibility --path ports/godot-pyra --script res://tests/preview_story_places.gd -- --out=/tmp/ki-story-evidence
```

Dalszy zakres: autorskie szlaki pomiędzy miejscami, czynne trasy pracy i dostaw
NPC, regionalne spotkania w sensownych miejscach, konsekwencje w osadach,
przyroda i osobne opracowania sześciu wysp. Ten prototyp ich nie wdraża i nie
oznacza, że cała planeta już żyje. Nie użyto płatnego AI ani poda GPU.
Bez scalenia i publikacji. Wszystkie dotychczasowe postacie i dane świata zachowano.

## 10. Polskie litery w nagłówkach dialogów

Właściciel wskazał małe „ę” w tytule „Przysięgi”, pośród znaków wyglądających jak
wersaliki. Wcześniejszą uwagę błędnie odczytano jako ocenę scenerii.
Gałąź `fix/android-polish-headings-20261117`, baza `e7a1dc0c`.

Przyczyna potwierdzona odczytem cmap TTF: stary `cinzel-bold.ttf` był podzbiorem
latin, bez 16 z 18 polskich liter. Font Cinzel przedstawiał zwykłe litery jako
kapitaliki, a brakujące „ę” pochodziło z systemowego fontu zastępczego i pozostawało
małą literą. `show_dialog` przyjmował też tekst w mieszanej wielkości liter.

Podmieniono TTF na pełny Cinzel, wagę 700, obejmujący polskie znaki. Nie zmieniono
tekstu fabuły ani zwykłej pisowni treści dialogu. Nagłówek używa `to_upper()` oraz
zawijania słów do szerokości ramki. Oryginalny TTF jest zachowany w QA.
Generator `scripts/godot/prepare_branding.py` korzysta teraz z pełnego źródła
`art/source-fonts/cinzel-variable.ttf`; `--font-only` odtwarza font bez ponownego
renderowania ikon i ekranu startowego. Dwukrotne odtworzenie dało identyczne bajty.
Źródło Google Fonts, licencja OFL i sumy: [rejestr](qa/polish-headings/font-source.json).

[Przed — stary font i mieszana wielkość liter](qa/polish-headings/before-font-and-case.jpg),
[po — 1280×720](qa/polish-headings/after-1280x720.jpg),
[po — 852×393](qa/polish-headings/after-852x393.jpg).
To rzeczywisty panel HUD w Godocie, odizolowany od świata gry. Widok „przed” używa
starego fontu/pisowni w poprawionym układzie, aby porównać typografię.

**27/27 kontroli** ([wyniki](qa/polish-headings/results.json),
[log](qa/polish-headings/native.txt)): 18 polskich glifów w zaimportowanym foncie,
poprawne wersaliki, zawijanie długiego nagłówka i obecność całego tytułu na ekranie
w obu rozmiarach. Godot X11/llvmpipe; tylko ostrzeżenie V-Sync. Fizyczny telefon
nie był testowany. Pełny [TypeScript](qa/polish-headings/typecheck.txt) uruchomiono
na tej zmianie. Nie opublikowano ani nie zbudowano nowego APK.


## 11. Mapa Androida — nowy podkład GPT Image i naprawa przeglądu planety

Właściciel odrzucił rozmyty atlas/globus z pojedynczym znacznikiem i polecił
wykorzystać dostępne narzędzia graficzne. Gałąź `fix/android-world-map-20261117`,
baza `d0fba8da` (zachowuje poprawkę polskich liter).

**Rzeczywiście wykonano:** jedną generację GPT Image na podstawie aktualnego
atlasu Superiora; nowy podkład 1774×887 jest osobnym zasobem. Lasy, relief górski,
wulkaniczna Pyra i zimny Nexus są czytelniejsze. Ten sam obraz i wspólny shader
są podłączone do atlasu i sfery w Godocie. Nazwy i znaczniki pozostają osobnymi
warstwami z rzeczywistych danych. [Pochodzenie](../../../ports/godot-pyra/assets/map/artwork/provenance.json).
Meshy w tej zmianie nie wywoływano: darmowe narzędzia bezszwowe są właściwe dla
powtarzalnych tekstur terenu, nie dla zmiany geografii jednorazowego atlasu.
Nie zużyto płatnych kredytów Meshy ani poda GPU.

| Funkcja | Stan przed | Zmiana | Dowód |
| --- | --- | --- | --- |
| Otwarcie mapy | Globus; atlas śledził pozycję gracza, możliwe kopie planety | Cały pojedynczy atlas 2D przy otwarciu, dopasowanie do widoku | [Przed](qa/planet-map/before/atlas.jpg), [po](qa/planet-map/after/live-game-atlas.jpg) |
| Podkład | Szum biome/koloru z dużym zoomem | Relief GPT Image, wspólna kompozycja 2D/3D | [Globus z gry](qa/planet-map/after/live-game-globe.jpg) |
| Osady | Tylko bieżąca kraina, np. 4 w Verdantii | 22 osady z wszystkich 10 lądów, prawdziwe transformacje | [Testy](qa/planet-map/after/results.json) |
| Szczegóły obcej krainy | Dostępne tylko dla aktualnej krainy | Przegląd bez teleportacji, bez fikcyjnego gracza | [Pyra](qa/planet-map/after/detail-pyra.jpg), [Nexus](qa/planet-map/after/detail-nexus.jpg), [wyspa III](qa/planet-map/after/detail-island-3.jpg) |
| Zoom i powrót | Atlas do ×14, możliwość wykadrowania globusa | Duży zoom prowadzi do szczegółów; ŚWIAT przywraca planetę, TY wskazuje postać | [852×393](qa/planet-map/after/overview-852x393.jpg) |
| Przyciski | Małe pole kolumny ucinało przyciski | Przyciski w granicach ekranu; lekki czytelny opis | [1280×576](qa/planet-map/after/overview-1280x576.jpg) |

Zmiany kodu: `map_screen.gd`, `atlas_view.gd`, `globe_view.gd`,
`continent_map_view.gd`, dwa shadery w `shaders/`, nowy test `preview_planet_map.gd`.
W `smoke.gd` zmieniono oczekiwany pierwszy widok na pełny atlas; test globusa
pozostaje i uruchamia jawnie jego zakładkę. Nie usunięto asercji.

**Weryfikacja:** 74/74 kontrole w Godocie X11/llvmpipe: 22 współrzędne osad,
10 podglądów lądów, brak podróży podczas przeglądania, jawny przycisk podróży,
przejście zoom → szczegóły, przywracanie całości i granice przycisków w dwóch
rozmiarach. Wśród nich odczyt bufora rzeczywistego shadera: 27 448 próbek poza
progiem kwantyzacji, zero rozbieżności klasyfikacji barw ląd/woda względem starej
tekstury. To test prezentacji, nie dowód identycznego reliefu ani geometrii.
Otwarto też mapę przez `PyraGame.open_map()` i zamknięto ją z przywróceniem
sterowania. [Wyniki](qa/planet-map/after/results.json),
[log natywny](qa/planet-map/native.txt). Kadry `live-game-*` pochodzą z gry;
pozostałe z rzeczywistego komponentu mapy w tym samym silniku.

Pełny [TypeScript](qa/planet-map/typecheck.txt) i [lint](qa/planet-map/lint.txt): PASS (0 błędów, 17 ostrzeżeń w niezmienionych plikach).
Pełny Godot smoke: **533/539, 6 FAIL** ([wyniki](qa/planet-map/smoke-results.json),
[log](qa/planet-map/smoke.txt)). Są to te same sześć usterek co w bazowym teście
opisanym w punkcie 9: footprint, dwa palce, ruch 30/120 FPS, otwarcie/zamknięcie
rozmowy oraz wejście do sali. Wszystkie asercje mapy w smoke przechodzą.
Natywny test mapy zgłosił ostrzeżenie V-Sync i ObjectDB przy zakończeniu gry;
headless smoke zachowuje wcześniejsze ostrzeżenia o zasobach Dummy/RID.
Nie deklaruje się pełnej regresji gry na zielono.

**Granice wykonania:** to poprawa atlasu i jego obsługi. Mapy szczegółowe nadal
używają oryginalnego podkładu danych terenu i dróg. Góry wewnątrz nowego atlasu są
ilustracyjne; nie pochodzą z wysokościowego modelu runtime. Shader brzegowy opiera
się na klasyfikacji kolorów oryginału, więc nie jest niezależnym certyfikatem
geograficznym. [Hashe nietkniętych danych](qa/planet-map/source-hashes.json).
Odbiór artystyczny, fizyczny Android/iOS i wydanie APK pozostają niezweryfikowane.
Nie zmieniono zapisów, kolizji, świata, questów ani produkcji. Bez scalenia i publikacji.


## 12. A40 — próba Pyry 2D izometrycznej i wspólne mapy

Gałąź `trial/pyra-isometric-a40-20261117`, baza `dbebe95a`. Właściciel wybrał
A40 i kontener 300 GB, następnie zmienił cel rozgrywki na **2D izometryczne**.
Wymagał różnorodnego, sensownie rozłożonego terenu i wspólnej siatki dla gry
oraz map 2D/3D. Docelowe budynki mają powstać później, po ustaleniu rzutu/skali.

**Pod uruchomiono:** `9jv4ah7gckh6fc`, A40 48 GB, RAM 50 GB, 9 vCPU, EU-SE-1.
Kontener 300 GB, bez sieciowego woluminu. Około 0,6317 USD/h z dyskiem
([konfiguracja](qa/terrain3d-a40/pod.json)). Nie zmieniono istniejących podów.
Nie wykonywano zatrzymania/restartu ani publikacji gry.

| Funkcja | Wykonanie | Dowód |
| --- | --- | --- |
| Środowisko | Godot 4.6.3, Vulkan na A40, ComfyUI, Blender 4.0.2, Terrain3D 1.1.0, MCP | [Wersje](qa/terrain3d-a40/runtime.txt), [MCP](qa/terrain3d-a40/godot-mcp-probe.json) |
| Teren CPU | Wycinek 1024×1024 m, wysokości co 2 m, płaskowyż, grzbiet, wulkan i rozpadlina | [Dane](../../../ports/godot-isometric-pyra/data/terrain.json) |
| Materiały GPU | 5 wykonanych generacji; 4 eksporty albedo, pierwsza wersja popiołu zachowana jako odrzucona | [Źródła](../../../deliveries/pyra-isometric-a40-20261117/comfy-material-sources.zip), [rejestr](qa/terrain3d-a40/materials-provenance.json) |
| Scena 2D | Godot 2D, osobne podłoże i sprite’y, sześć tymczasowych budynków, animacja Legendy, Kaena | [Zrzut z aplikacji](qa/terrain3d-a40/city-wide.jpg) |
| Układ terenu | Zagajnik na zachodzie, skały przy rozpadlinie, drogi do placu i budynków | [Zachodnia grań](qa/terrain3d-a40/western-ridge.jpg) |
| Mapa 2D | Druga kamera tego samego World2D; siatka 128 m i rzeczywista pozycja postaci | [Mapa](qa/terrain3d-a40/same-world-map.jpg) |
| Mapa 3D | Te same próbki/maski, wspólne tekstury i współrzędne 415 obiektów; obrót | [Mapa 3D](qa/terrain3d-a40/same-world-map-3d.jpg) |
| Nawigacja | CPU sprawdził połączenie 4 punktów; w runtime ruch, grid przejezdności i footprinty budynków | [Wyniki](qa/terrain3d-a40/results.json) |
| Zapisy | Osobna przestrzeń użytkownika prototypu, bez odczytu/nadpisania postaci z gry | `project.godot` prototypu; brak zmian starego projektu |

**14/14 natywnych kontroli Godota**, kod procesu 0 i zero błędów silnika/skryptów
([proces](qa/terrain3d-a40/isometric-process.json), [log](qa/terrain3d-a40/isometric-native.txt),
[pełne wyniki](qa/terrain3d-a40/results.json)). Sprawdzono wspólną scenę mapy 2D,
256 przeliczeń współrzędnych, zgodność kamery i TileMapLayer, wysokości/rzut mapy
3D, współdzielenie zasobów oraz ruch/dwa palce/pointercancel przy limitach 30 i
120 FPS. Postać przebyła około 16 m w około 2 s w obu próbach. Maksymalny błąd
przeliczenia punktów to około 0,000034 m; zgodność rzutu mapy 3D poniżej 0,001 px.
Nie zastępowano testów działania porównaniem samego JSON.

Pod koniec testu raportowano około 48 MiB tekstur. Odczyt FPS pochodzi z ostatniej
próby z limitem 120, a nie z niezależnego benchmarku telefonu. Próba Terrain3D
potwierdziła 4 regiony, stanie na fizycznej powierzchni oraz ruch/dotyk przy obu
limitach ([wyniki 3D](qa/terrain3d-a40/runtime-results.json),
[log](qa/terrain3d-a40/terrain3d-native.txt)).
[SHA wspólnych plików](qa/terrain3d-a40/source-sync.json) potwierdzają identyczne
dane lokalnej próby 2D i pomocniczego projektu Terrain3D.

Pełny [TypeScript](qa/terrain3d-a40/typecheck.txt): PASS.
[Lint](qa/terrain3d-a40/lint.txt): 0 błędów i 17 ostrzeżeń w niezmienionych plikach.
Nie uruchamiano ponownie pełnego Playwright/Vitest ani webowego buildu: zmiana
jest odrębną próbą Godota, bez zmian frontendowego runtime. Nie deklaruje się
pełnego CI ani odbioru Androida. Fizyczny telefon, APK i eksport WebGL pozostają
niezweryfikowane. Dotychczasowe 6 błędów pełnego smoke starego portu opisuje punkt 11.

**Odtworzenie sceny 2D:** po pobraniu tej gałęzi:

```sh
git lfs pull --include="ports/godot-isometric-pyra/**"
godot --path ports/godot-isometric-pyra
```

Wymagany Godot 4.6.3 z rendererem Mobile/Vulkan. `WASD` lub lewy kciuk porusza,
`M` otwiera mapę, przycisk MAPA 2D/3D zmienia jej widok; mapę 3D można obracać.
Na podzie używa się `/workspace/ki-isometric-pyra`. Test na działającym podzie:
`python3 /workspace/ki-terrain3d/scripts/gpu/run-isometric-qa.py`.
Repo zawiera jego źródło, generator CPU, workflowy GPU, przetwarzanie materiałów,
instalator przypiętego Terrain3D, cztery proceduralne modele skał i sumy zależności.
Model SDXL i binaria narzędzi nie są kopiowane do Git; są odtwarzalne z URL/SHA.

**Co pozostaje:** to techniczny prototyp jednego wycinka, nie nowa kompletna
planeta ani port całej rozgrywki. Budynki są tymczasowe. Mapa 3D używa billboardów
obiektów 2D, nie ukończonych modeli domów. Kaena nie ma jeszcze podpiętych usług
lub pełnego przebiegu questów, walka/ekwipunek/zapisy pozostają w dotychczasowym
projekcie gry. Do dopracowania są modelowanie docelowych lokacji, przesłanianie
na stromych stokach, większa różnorodność biomów, strumieniowanie całej planety,
globalna georeferencja Superiora i odbiór na telefonie. Nie zamieniono aktualnego
atlasu/globusa ani wydanej gry na ten prototyp. Płatnego Meshy nie uruchamiano.
