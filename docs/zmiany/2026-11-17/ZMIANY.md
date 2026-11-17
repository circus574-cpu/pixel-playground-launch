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
