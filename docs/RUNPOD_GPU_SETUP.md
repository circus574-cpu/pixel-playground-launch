# RunPod — naprawa i uruchomienie GPU, 2026-10-20

## Stan i dowody

Pod `uywsfhvthv4n4k`: **narzędzia uruchomione, GPU sprawdzone rzeczywistym obliczeniem i renderem**. To osobne środowisko produkcji zasobów. W tej sesji nie wykonano wdrożenia gry ani scalenia do main.

- [Wyniki maszynowe](qa/runpod-20261020/setup-report.json).
- [Techniczny render PNG](qa/runpod-20261020/gpu-calibration.png): neutralny manekin, nie ilustracja rasy ani docelowy sprite. Obraz obejrzano; cała sylwetka mieści się w kadrze.
- Kod narzędzi dostarczony na GPU: `b51fc1928a6600035cc6c169205dd7adceb5fe86`, bez długoterminowych poświadczeń GitHub. PR gry [#2](https://github.com/circus574-cpu/pixel-playground-launch/pull/2) został już scalony poza tą operacją (`d0a2ba6`, 15:41 UTC). Końcowa kontrola repozytorium: main `8045a0b`. Raport GPU powstaje na osobnej gałęzi `docs/runpod-gpu-setup-20261020`; narzędzia na GPU zachowują wcześniej przetestowany snapshot `b51fc19`.

## Potwierdzone przyczyny i poprawki

1. Polecenie kontenera przekazywało cały tekst `/bash -c '…'` jako jeden argument. NVIDIA entrypoint próbował wykonać go jako nazwę pliku; kontener restartował się zamiast uruchamiać usługę. Użytkownik zastosował poprawną tablicę argumentów: `{"cmd":["/bin/bash","-c","exec /start.sh"]}`. Usunięto instalator z krytycznej ścieżki startu. Poprzedni instalator dodatkowo mieszał lokalizację `/tmp` z oczekiwanym `/workspace`.
2. `/workspace` jest woluminem `fuse.geesefs`, bez wymaganej semantyki chmod. Git/venv/SQLite przeniesiono na lokalny POSIX `/opt`; dane, modele, wyniki i kopię odtworzeniową pozostawiono na woluminie. Kopiowanie danych nie polega na zachowaniu uprawnień POSIX.
3. Aktualne ComfyUI master wymagało API `torch.library.custom_op` niezgodnego z zastanym PyTorch 2.4. Zainstalowano kompatybilne ComfyUI **v0.3.76**, commit `30c259cac8c08ff8d015f9aff3151cb525c9b702`, zamiast wymieniać działający stos CUDA. Czysty venv korzysta z istniejących bibliotek torch/CUDA przez lokalne dowiązania; `pip check` przechodzi. Nie należy aktualizować ComfyUI bez ponowienia testów zgodności.
4. Blenderowi brakowało bibliotek systemowych, m.in. `libXrender.so.1`. Uzupełniono zależności bez zmiany sterownika NVIDIA.
5. ComfyUI wystawiono przez osobny Nginx z uwierzytelnianiem i obsługą WebSocket. Nie zmieniano bazowego serwera Jupyter.

## Działające usługi i polecenia

| Element | Wersja / lokalizacja |
|---|---|
| GPU | NVIDIA RTX A6000; sterownik 595.91.07 |
| CUDA / torch | runtime 12.4; PyTorch 2.4.1+cu124 |
| ComfyUI | v0.3.76, `/opt/ComfyUI`; backend lokalny 8189 |
| Interfejs ComfyUI | https://uywsfhvthv4n4k-8188.proxy.runpod.net/ |
| Blender | 4.5.3 LTS, oficjalny headless moduł `bpy`; bez GUI i osobnego programu `blender` |
| Node | 22.23.3 |
| Projekt / narzędzia | `/opt/ki-legends-project` |
| Trwałe dane | `/workspace/ki-legends-gpu` |

Login ComfyUI: **`kilegends`**. Hasło: istniejąca wartość **`JUPYTER_PASSWORD`** z konfiguracji poda. Wartości hasła, prywatnego adresu terminala i tokenów nie zapisano w repozytorium ani kopii runtime. Warstwa Nginx bez uwierzytelnienia zwraca HTTP 401. Końcowy publiczny test klientem urllib bez nagłówków przeglądarki zwrócił HTTP 403; ponowienie z nagłówkiem przeglądarki i poprawnym uwierzytelnieniem dało 200, działający JavaScript, WebSocket i workflow. Nie oznaczamy tego odrzuconego żądania jako PASS ani awarii CUDA.

W terminalu poda:

```bash
ki-gpu-check
ki-comfy-start
ki-blender-python /opt/ki-legends-gpu/scripts/gpu_calibration.py
ki-assets run assets:check
```

`ki-comfy-start` jest idempotentny. ComfyUI działa bez zewnętrznych API nodes i custom nodes. Modele trafiają do `models/`, pliki do `input/`, `output/`, `renders/`, `deliveries/`; specyfikacje do `config/`, testy i metadane do `technical/`. Logi bieżącego runtime: `/opt/ki-legends-gpu/logs/`.

## Wykonane testy

| Test | Wynik rzeczywisty |
|---|---|
| Obliczenie torch na CUDA | PASS, iloczyn macierzy i synchronizacja GPU |
| Spójność zależności ComfyUI | PASS, `pip check`: brak konfliktów |
| Frontend + JavaScript po autoryzacji | HTTP 200 / 200 |
| WebSocket | PASS, odebrano zdarzenie statusu |
| Nieautoryzowany dostęp | Wcześniej 401; końcowy urllib publicznie 403, usługa nieudostępniona anonimowo |
| Blender Cycles na CUDA A6000 | PASS, 512×512 RGBA, 16 samples, **3.057 s** |
| ComfyUI LoadImage → JoinImageWithAlpha → SaveImage | PASS; 512×512 RGBA, różnica alfa maks. 1, przezroczysty margines 8 px |
| `assets:check` na GPU | PASS |
| Unit narzędzi/animacji/cache | **15 PASS, 0 FAIL, 0 SKIP**, w tym techniczne pakowanie 416 klatek |
| Import rzeczywistego renderu | PASS, dry run; 160098 B PNG → 44940 B lossless WebP; rejestr gry bez zmian |
| Powtórne uruchomienie bootstrapu | PASS, ten sam proces ComfyUI, bez duplikatu |
| Kopia runtime | PASS, SHA-256 i odczyt 89777 wpisów; 1169795882 B |
| Pełny Stop/Start poda i zimne odtworzenie | **NIEWYKONANE** |
| Inference z modelem AI | **NIEWYKONANE**, pobrano 0 checkpointów |

Pomiar renderu dotyczy jednej prostej sceny kalibracyjnej, nie wydajności pełnych animacji anime. OptiX wykryto, ale test renderu używał CUDA. Nie zastępuje to testu gry na fizycznym Androidzie. Wyniki wcześniejszych testów silnika pozostają w [raporcie stabilizacji](PRE_GPU_STABILIZATION.md).

## Odtworzenie po restarcie

Lokalny `/post_start.sh` wywołuje trwały `/workspace/ki-legends-gpu/bootstrap.sh`. Ciepłe uruchomienie sprawdzono. Po pełnym odtworzeniu kontenera lokalny hook może zniknąć; **nie zmieniono pola startowego w panelu RunPod i nie wykonano restartu**.

Aby automatyczne odtworzenie działało również po utracie lokalnego `/opt`, przy planowanym restarcie trzeba ustawić w panelu **Container Start Command**:

```json
{"cmd":["/bin/bash","-c","bash /workspace/ki-legends-gpu/bootstrap.sh; exec /start.sh"]}
```

Bootstrap sprawdza sumę archiwum `runtime-cache/runtime-20261020-v1.tar.gz`, odtwarza runtime na POSIX, uzupełnia brakujące biblioteki systemowe i uruchamia usługi. Kopia nie zawiera hasła/htpasswd, kluczy SSH ani poświadczeń GitHub. Hasło musi nadal być skonfigurowane w zmiennych poda. Wymagane zachowanie tego samego woluminu `/workspace`; sama kopia na nim nie chroni przed usunięciem woluminu. Pełne odtworzenie po Stop/Start pozostaje do testu w zaplanowanym oknie.

## Następny etap produkcji grafiki

Specyfikacja: [GPU_ASSET_PIPELINE.md](GPU_ASSET_PIPELINE.md), również na podzie w `config/`. Blender może już renderować klatki techniczne. Narzędzia walidują PNG/WebP, spritesheety/atlasy i metadane; pełny standard aktora pozostaje zdefiniowany w specyfikacji gry, nie przez pojedynczy render kalibracyjny.

Nie pobierano dużych modeli AI, nie generowano pełnych postaci anime ani nie podmieniano tymczasowego człowieka w grze. Generowanie obrazów przez AI wymaga jeszcze doboru i instalacji checkpointu oraz testu inference. Najpierw należy zatwierdzić jedną kanoniczną postać i animację w grze, zanim powstaną wszystkie zestawy ras.

**Status: GOTOWE WARUNKOWO** — runtime CUDA/Blender/ComfyUI i import sprawdzono praktycznie; brak modelu AI, próby zimnego odtworzenia i zatwierdzonej pierwszej postaci produkcyjnej.
