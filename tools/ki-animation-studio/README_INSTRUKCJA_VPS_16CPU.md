# KI LEGENDS — KOMBAJN DO ANIMACJI & KOORDYNACJI 16 CPU (`v2.0.0`)

## Spis Treści
1. [Architektura Systemu i Zawartość Paczki](#1-architektura-systemu-i-zawartość-paczki)
2. [Szybki Start Krok po Kroku na Serwerze VPS (16 CPU / 32 GB RAM)](#2-szybki-start-krok-po-kroku-na-serwerze-vps-16-cpu--32-gb-ram)
3. [Podłączenie do Sieci i Otwieranie w Przeglądarce (Telefon / Komputer)](#3-podłączenie-do-sieci-i-otwieranie-w-przeglądarce-telefon--komputer)
4. [Uruchomienie jako Usługa 24/7 w Tle (Systemd lub Docker)](#4-uruchomienie-jako-usługa-247-w-tle-systemd-lub-docker)
5. [Instrukcja Obsługi Kombajnu w Przeglądarce (Etapy 1–4)](#5-instrukcja-obsługi-kombajnu-w-przeglądarce-etapy-14)
6. [Integracja z Blenderem 3D i Mocap BVH na 16 CPU](#6-integracja-z-blenderem-3d-i-mocap-bvh-na-16-cpu)
7. [Import Wyeksportowanej Paczki prosto do Gry KI Legends](#7-import-wyeksportowanej-paczki-prosto-do-gry-ki-legends)

---

## 1. Architektura Systemu i Zawartość Paczki

Pakiet `ki-animation-studio-kombajn.zip` to kompletne, samowystarczalne środowisko produkcyjne do tworzenia, przetwarzania i eksportowania animacji postaci, bossów i efektów dla **KI Legends**:

```text
ki-animation-studio/
├── README_INSTRUKCJA_VPS_16CPU.md     # Niniejsza kompletna instrukcja wdrożenia i obsługi
├── install_and_run_16cpu.sh           # Automatyczny instalator i starter pełnego silnika 16 CPU (FastAPI + OpenCV)
├── quick_start_zero_deps.py           # Natychmiastowy serwer (0 zależności pip) — start w 1 sekundę na czystym Pythonie
├── requirements.txt                   # Zależności Python (FastAPI, Uvicorn, OpenCV, NumPy, SciPy, Pillow)
├── ki-animation-studio.service        # Usługa systemowa Linux (systemd) do pracy ciągłej 24/7
├── Dockerfile & docker-compose.yml    # Konteneryzacja z limitem 16 CPU / 24 GB RAM
├── config/
│   ├── studio_config.json             # Kontrakt animacji KI Legends (7 stanów, 8 kierunków, kotwice stóp)
│   ├── blender_contract.json          # Kamera ortograficzna 60°, oświetlenie NW, parametry cel-shadingu
│   └── race_palettes.json             # Palety, aury i presety transformacji 4 ras (Planetarni, Mędrcy, Androidy, Legendy)
├── backend/
│   ├── server.py                      # Serwer sieciowy FastAPI (0.0.0.0:8090)
│   ├── video_extractor.py             # Wielordzeniowy ekstraktor MP4 -> Klatki RGBA + Matting + Foot-Anchor Lock (16 CPU)
│   ├── combinator_engine.py           # Silnik kombinacji (Forward, Reverse, Ping-Pong, Hit-Stop, Optical Flow Farnebäck)
│   ├── fx_transform_engine.py         # Silnik wyglądu, efektów VFX (Aury KI, Błyskawice, Obrys Ink) i deformacji siatki 2D
│   └── exporter_engine.py             # Eksporter paczek KI Legends (.webp + Phaser .json + manifest.json + GIF + ZIP)
├── blender/
│   ├── blender_headless_turntable.py  # Skrypt Blender (bpy): render 8 kierunków × 7 stanów (416 klatek) na 16 wątkach CPU
│   ├── blender_mocap_retarget.py      # Skrypt Blender (bpy): retargeting plików .BVH (CMU Mocap) na szkielet postaci
│   ├── blender_vfx_card_rig.py        # Skrypt Blender (bpy): projekcja klatek MP4 na karty 2.5D z oświetleniem 3D KI
│   └── run_blender_16cpu.sh           # Skrypt wywołujący Blendera w trybie headless (-b -t 16)
└── frontend/
    ├── index.html                     # Panel przeglądarkowy (responsywny: działa na telefonie oraz na PC)
    ├── css/studio.css                 # Ciemny motyw studyjny
    └── js/studio_app.js               # Silnik WebGL/Canvas 60 FPS + mostek API do serwera 16 CPU
```

---

## 2. Szybki Start Krok po Kroku na Serwerze VPS (16 CPU / 32 GB RAM)

### Krok 1: Prześlij plik `ki-animation-studio-kombajn.zip` na swój serwer VPS
Możesz przesłać plik `.zip` przez **OpenWebUI** (upload pliku do katalogu roboczego `/srv/qwen-work`), przez `scp` lub rozpakować go bezpośrednio na serwerze:

```bash
# Utwórz katalog dla Kombajnu na serwerze VPS:
sudo mkdir -p /srv/ki-animation-studio
sudo unzip -o ki-animation-studio-kombajn.zip -d /srv/ki-animation-studio
cd /srv/ki-animation-studio
```

### Krok 2: Uruchomienie (2 warianty do wyboru)

#### Wariant A (Pełny Kombajn 16 CPU — FastAPI + OpenCV + SciPy + FFmpeg):
Wystarczy wykonać jedną komendę. Skrypt sam zainstaluje wymagane biblioteki, otworzy port `8090` w zaporze i uruchomi serwer na 16 rdzeniach:

```bash
cd /srv/ki-animation-studio
chmod +x install_and_run_16cpu.sh blender/run_blender_16cpu.sh
./install_and_run_16cpu.sh
```

#### Wariant B (Błyskawiczny Start w 1 sekundę — bez instalacji pakietów):
Jeśli chcesz otworzyć panel w przeglądarce natychmiast, bez czekania na `pip install`:

```bash
cd /srv/ki-animation-studio
python3 quick_start_zero_deps.py
```

---

## 3. Podłączenie do Sieci i Otwieranie w Przeglądarce (Telefon / Komputer)

Serwer domyślnie bindowany jest do adresu **`0.0.0.0:8090`** (wszystkie interfejsy sieciowe IPv4).

1. **Sprawdź publiczny adres IP swojego VPS** (skrypt instalacyjny wyświetli go automatycznie, lub wpisz):
   ```bash
   curl -s ifconfig.me && echo ""
   ```
2. **Odblokuj port `8090` w firewallu VPS** (jeśli używasz UFW lub iptables):
   ```bash
   sudo ufw allow 8090/tcp
   ```
3. **Otwórz przeglądarkę na telefonie (Chrome / Safari) lub na komputerze i wpisz:**
   ```text
   http://TWOJE_IP_VPS:8090
   ```
   *(Na przykład: `http://79.162.26.185:8090`)*

> **Wskazówka (HTTPS / Domena przez Nginx lub Caddy):**
> Jeśli chcesz podpiąć kombajn pod własną subdomenę (np. `animacje.twojadomena.pl`), w pliku `/etc/caddy/Caddyfile` dodaj:
> ```caddyfile
> animacje.twojadomena.pl {
>     reverse_proxy 127.0.0.1:8090
> }
> ```

---

## 4. Uruchomienie jako Usługa 24/7 w Tle (Systemd lub Docker)

Aby program działał cały czas w tle (nawet po zamknięciu terminala lub restarcie VPS):

### Opcja 1: Systemd (Natywnie na VPS)
```bash
sudo cp /srv/ki-animation-studio/ki-animation-studio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ki-animation-studio
sudo systemctl start ki-animation-studio

# Sprawdzenie statusu:
sudo systemctl status ki-animation-studio
```

### Opcja 2: Docker Compose (Z wbudowanym Blenderem i FFmpeg)
```bash
cd /srv/ki-animation-studio
docker compose up -d --build
```

---

## 5. Instrukcja Obsługi Kombajnu w Przeglądarce (Etapy 1–4)

Po otwarciu adresu `http://IP_VPS:8090` w przeglądarce zobaczysz kompletne studio podzielone na 4 logiczne etapy:

### Etap 1: Wrzutka MP4 i Rozbicie na Klatki
1. Kliknij strefę **„Przeciągnij plik .MP4 / .WEBM / .GIF / Arkusz PNG”** (na telefonie otworzy się galeria/menedżer plików).
2. Wybierz docelową liczbę klatek (np. `8`, `16`, `32`) oraz rozmiar canvasu (`512×512 Master HD` lub `256×256 Klient HD`).
3. Wybierz tryb **Usuwania Tła (Matting)**:
   - `Auto-Krawędź KI` — automatycznie wykrywa tło z narożników i wycina je, chroniąc wewnętrzne kontury i jasne elementy zbroi/oczu.
   - `Green Screen` — usuwa zielone tło z redukcją zielonego zafarbu.
   - `Białe Tło Studyjne` — wycina białe tło wokół postaci.
4. Zaznacz **„Blokuj stopy (Anchor 0.5, 0.95)”** — program automatycznie wykryje najniższy punkt sylwetki i wyrówna stopy we wszystkich klatkach, eliminując ślizganie postaci!
5. Kliknij **„🔄 Rozbij na Klatki Teraz”** (natychmiast w przeglądarce) lub **„⚡ Ekstrakcja Serwerowa 16 CPU”**.

### Etap 2: Kombinacje Animacji i Bank 7 Stanów KI Legends
1. Na dole ekranu pojawi się **Matryca Klatek** z wykresem energii ruchu (`⚡`).
   - Kliknięcie klatki wyświetla ją na scenie.
   - Dwuklik / prawy klik włącza lub wyłącza daną klatkę z sekwencji.
   - Przycisk **„🎯 Ustaw jako Kl. 0”** przesuwa klatkę uderzenia na początek (zgodnie z kontraktem walki KI Legends, gdzie klatka 0 = moment trafienia!).
2. W polu **Tryb Kombinacji Klatek** możesz jednym kliknięciem tworzyć warianty:
   - **Klasyczna Progresja (`0 → N`)**
   - **Odwrócona (`N → 0`)** — np. tworzy animację `respawn` z animacji `death`.
   - **Ping-Pong / Bumerang (`0 → N → 0`)** — tworzy idealnie zapętlony oddech `idle` lub lewitację.
   - **Płynna Pętla (`Seamless Cross-Fade`)** — domyka początek i koniec cyklu `walk`.
   - **Hit-Stop Impact** — zamraża klatkę ciosu i dodaje bojowy wstrząs (`Shake px`).
   - **Seria Bojowa (`Combo Flurry`)** — generuje wielokrotne uderzenie z jednej sekwencji.
   - **🌊 Płynny Optical Flow (16 CPU)** — dogenerowuje brakujące klatki pośrednie metodą gęstego przepływu optycznego Farnebäcka.
3. Kliknij **„⚡ Auto-Wypełnij 7 Stanów”** lub przypisz ręcznie kombinacje do 7 slotów: `IDLE`, `WALK`, `ATTACK`, `SKILL`, `HIT`, `DEATH`, `RESPAWN`.

### Etap 3: Modyfikacja Wyglądu, Efekty VFX i Transformacje Postaci
1. **Transformacje Rasowe (1-Kliknięcie):**
   - Wybierz jeden z 5 presetów: **Planetarni (Gaja)**, **Mędrcy (Astral)**, **Androidy (Rdzeń)**, **Legendy (Żar)** lub **⚡ Złota Transformacja Super KI**.
2. **Wygląd i Styl Anime:**
   - Dodaj **Obrys Tuszem (`Ink Outline 1–8 px`)**, **Cel-Shading (`Anime Toon`)**, zmień barwę (`Hue`), nasycenie oraz **Światło Północno-Zachodnie (`NW Rim Light`)**.
3. **Efekty Specjalne (VFX):**
   - Włącz **Moc Aury KI**, **⚡ Błyskawice KI**, **💥 Falę Uderzeniową (Shockwave)** pod stopami oraz **👻 Smugę Ruchu (Afterimage Trail)**.
4. **Transformacje Geometrii i Siatki Postaci:**
   - **Nachylenie Bojowe (`Lean -25°..+25°`)** — pochyla postać w walce bez odrywania stóp od ziemi.
   - **Squash & Stretch** — dodaje sprężystość mięśni i pancerza w rytmie klatek.
   - **Wiatr Szat / Włosów (`Cloth Wave`)** — wprawia w ruch peleryny, szarfy i włosy.
   - **Wzrost Mocy (`Grow %`)** — progresywnie powiększa sylwetkę podczas transformacji.

### Etap 4: Eksport Gotowej Paczki
1. Kliknij **„📦 Pobierz Kompletną Paczkę KI (.ZIP)”** — otrzymasz gotowe archiwum zawierające:
   - Bezstratny atlas `.webp` + plik metadanych Phaser JSON Hash (`.json`)
   - Plik `pack.json` oraz `manifest.json` zgodny z importerem gry
   - Klatki źródłowe `frames/<stan>/00.png...`
   - Podglądowe animowane pliki `.gif` oraz arkusz `spritesheet.png`
   - Plik `provenance.json` z sumami kontrolnymi `SHA-256`.

---

## 6. Integracja z Blenderem 3D i Mocap BVH na 16 CPU

W katalogu `blender/` znajdują się 3 autonomiczne skrypty współpracujące z Blenderem na 16 wątkach CPU:

1. **Render 8 Kierunków × 7 Stanów (416 klatek) z modelu `.blend`:**
   ```bash
   ./blender/run_blender_16cpu.sh twoja_postac.blend ./renders/hero-planetary-v4 hero-planetary-v4
   ```
2. **Retargeting ruchu Motion Capture (`.bvh` z bazy CMU) na szkielet postaci:**
   ```bash
   blender -b twoja_postac.blend -t 16 -P blender/blender_mocap_retarget.py -- \
     --bvh ./animacje_mocap/data/076/76_01.bvh \
     --rig hero-planetary \
     --frame-start 1 --frame-end 40 \
     --save-blend ./postac_z_ciosem.blend
   ```
3. **Projekcja 2.5D VFX w Blenderze z klatek MP4:**
   ```bash
   blender -b -t 16 -P blender/blender_vfx_card_rig.py -- \
     --frames-dir ./frames/attack \
     --out-dir ./renders/attack_3d_vfx \
     --threads 16
   ```

---

## 7. Import Wyeksportowanej Paczki prosto do Gry KI Legends

Po pobraniu paczki z Kombajnu możesz zaimportować ją bezpośrednio do repozytorium gry:

```bash
# W katalogu głównym repozytorium KI Legends:
npm run assets:import -- sciezka/do/manifest.json --install
npm run assets:check
```
