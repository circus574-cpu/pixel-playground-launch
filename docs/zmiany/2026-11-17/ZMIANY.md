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
