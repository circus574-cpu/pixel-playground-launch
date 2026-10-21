# GPU runtime odtworzony — 2026-10-21

**Środowisko działa na podzie `8yts4ka55ffhxs` (`accessible_black_sheep`).**
Właściciel uruchomił pod i zlecił odtworzenie oprogramowania. W tym zadaniu nie
wykonano Start, Stop, Restart ani Terminate poda ani zmian jego konfiguracji.
**Wyłącznie właściciel steruje zasilaniem i cyklem życia podów.** Ta zasada
zastępuje historyczne zalecenia automatycznego zatrzymywania wynajmu podczas testów CPU.

## Co przywrócono

- Blender/bpy **4.5.3 LTS**, prywatny Python **3.11.13**.
- ComfyUI **0.3.76**, prywatny **PyTorch 2.4.1+cu124**, torchvision 0.19.1+cu124,
  torchaudio 2.4.1+cu124 i rzeczywiste biblioteki NVIDIA w venv.
- Bazowy Python 3.12 i **PyTorch 2.8.0+cu128 pozostają niezmienione**.
  Sterownik NVIDIA pozostał 595.91.07.
- Przypięte modele Animagine XL 3.1 i DreamShaper XL Turbo 2.1 na woluminie:
  ponownie odczytano całe pliki i porównano ich SHA-256 oraz rozmiary.
- Kompletny checkpoint Planetarnego: **416 klatek**, rig i edytowalne źródło
  w `/opt/ki-legends-gpu/planetary-motion-v2` i `planetary-rig-v2`.
- Aktualne narzędzia z kodu `ff56cfc8666c1c61624bc0a83a5b65c1b76c107c`,
  `/opt/ki-legends-project-current`. Transfer archiwum Git bez `.env` i bez
  poświadczeń GitHub; zależności z cache o identycznym SHA lockfile.

Usunięto wyłącznie zerwane dowiązania w odtwarzanych prywatnych venv i zastąpiono
je właściwymi paczkami. Archiwalna kopia runtime v1 pozostała zachowana. ComfyUI
ma SQLite w lokalnym POSIX `/opt/ki-legends-gpu/user/comfyui.db`, zamiast
nieistniejącego domyślnego katalogu. Przeładowano wyłącznie własny proces ComfyUI
po sprawdzeniu pustej kolejki; nie restartowano poda.

## Wykonane testy

| Kontrola | Wynik |
| --- | --- |
| `pip check`, ComfyUI i Blender | PASS / PASS |
| Mnożenie macierzy PyTorch na CUDA | PASS, 2.4.1+cu124 / RTX A6000 |
| Rzeczywisty render Blender Cycles CUDA | PASS, 512×512 RGBA, 16 samples, 2,506 s |
| Rzeczywisty inference Animagine | PASS, 512×512, 2 kroki, zapisany PNG z SHA |
| ComfyUI frontend / JavaScript | HTTP 200 / 200 po uwierzytelnieniu |
| WebSocket | PASS, zdarzenie `status` |
| Dostęp anonimowy do lokalnego proxy | HTTP 401 |
| SQLite | Utworzona baza na POSIX |
| Aktualne narzędzia `assets:check` | PASS dla produkcji i preview |
| Ponowny bootstrap | PASS, ten sam PID ComfyUI, brak drugiego procesu |

Inference był testem uruchomienia modelu, **nie produkcyjną grafiką ani oceną
jakości**. Pierwsze załadowanie modelu i test trwały 121,3 s. Klatki Planetarnego
nie zostały zmienione. Odbiór wizualny z PR #9 pozostaje osobnym etapem.

Raport maszynowy: [restoration-report.json](qa/runtime-restore-20261021/restoration-report.json).
Log powtórnego bootstrapu: [bootstrap-v2-test.txt](qa/runtime-restore-20261021/bootstrap-v2-test.txt).
Dowody i skrypty na woluminie:
`/workspace/ki-legends-gpu/resumes/runtime-restore-20261021-8yts4ka55ffhxs/`.

## Poprawiona kopia runtime

Nowa kopia zawiera rzeczywiste prywatne paczki torch/CUDA, zamiast zerwanych
dowiązań do globalnych bibliotek starego obrazu:

- `runtime-cache/runtime-20261021-py311-cu124-v2.tar.gz`
- **4 151 697 010 B**, **105 179 wpisów**.
- SHA-256: **43e13e2d67bbc1a4ce785b3672a962096c59f9e46d5fc01674e3b143314c8c77**.
- Zapis i ponowny odczyt z docelowego woluminu: zgodne SHA.
- Wykluczono auth, `.env`, `.git`, bazę użytkownika, logi, wagi modeli i rendery.

Oryginalny bootstrap zachowano jako `bootstrap-20261020-v1.original.sh`.
`/workspace/ki-legends-gpu/bootstrap.sh` korzysta teraz z kopii v2.
Jego wersja źródłowa: [bootstrap-runtime-v2.sh](../scripts/gpu/bootstrap-runtime-v2.sh).

## Użycie

Środowisko jest już uruchomione. Polecenia oprogramowania w terminalu poda:

```sh
ki-gpu-check
ki-blender-python SCRIPT.py
ki-assets-current run assets:check
ki-comfy-start
```

`ki-comfy-start` obsługuje usługę ComfyUI, nie uruchamia ani nie zatrzymuje poda.
Backend działa lokalnie na **8189**, Nginx z Basic Auth na **8188**. Hasło pochodzi
z istniejącego `JUPYTER_PASSWORD`; wartości nie zapisano w raportach ani kopii.
Port `8188/http` nie jest wystawiony w konfiguracji tego poda. Praca jest możliwa
przez aktualny Jupyter 8888 i lokalne API; nie deklarujemy działającego publicznego
adresu ComfyUI i nie zmieniano portów zasobu.

Na przyszłym podzie wybranym i uruchomionym przez właściciela, z zachowanym woluminem
i `/usr/bin/python3.11`, odtworzenie oprogramowania:

```sh
bash /workspace/ki-legends-gpu/bootstrap.sh
```

Nowy kontener nie gwarantuje zachowania lokalnego hooka `/post_start.sh`.
Nie zmieniano polecenia startowego w panelu. **Pełnego cyklu Stop/Start nie
wykonywano**; sprawdzono faktyczne odtworzenie brakującego `/opt`, kopię z readbackiem
i idempotentne ciepłe uruchomienie. Kopii modeli i runtime w dodatkowym trwałym
storage poza tym woluminem nadal nie potwierdzono. Nie usuwano Qwen/Ollama,
historycznych wyników ani poprzednich checkpointów.
