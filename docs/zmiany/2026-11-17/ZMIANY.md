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
