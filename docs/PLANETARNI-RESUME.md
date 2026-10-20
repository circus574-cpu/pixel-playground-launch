# Planetarni — punkt wznowienia, 2026-10-20

Użytkownik zakończył pracę na dziś. Render zatrzymano świadomie, bez deklaracji ukończenia rasy.

- **179 z 416** prawdziwych klatek v2, 7 stanów × 8 kierunków (nie wszystkie ukończone).
- Gotowe pełne klipy: idle i walk, po 64 klatki. Attack: 51/64. Skill/hit/death/respawn v2 jeszcze niewyrenderowane.
- Kopia poza GPU: `art/production/heroes/planetary/v1/sources/motion-v2`, Git LFS. `pause.manifest` zawiera dokładną listę 179 klatek z SHA-256. Dodatkowy PNG `planetary-motion-source.png` jest tylko podglądem źródła i nie liczy się do 416.
- Edytowalny `planetary-motion-source.blend`, siedem nazwanych akcji. Hash źródła w `planetary-motion-source.json` został sprawdzony po pobraniu.
- Wszystkie 416 pozycji przeszły geometryczną kontrolę stałego kadru (0 naruszeń marginesu), raport `motion-preflight.report`. Nie jest to odbiór jakości ani test w grze.
- Profil `grounded`: canvas 128 świata, origin `[0.5, 0.75]`, collider 12 bez zmian. Render RGBA 512, kamera ortho 7, elewacja 45°, 16 samples Cycles CUDA, denoise, bez Freestyle w klipach.
- Źródło CC0 MakeHuman z przypiętą rewizją i hashami w `rig-base-source.json`. Własny strój/rig/włosy. Nie używać ilustracji jako animacji.
- Modele ComfyUI: Animagine XL 3.1 (zaakceptowany wzorzec), DreamShaper XL Turbo 2.1 (otoczenie). Nie pobierać kolejnych dużych modeli przy wznowieniu.
- Włączony bezpieczny opt-in przyszłych paczek: `?ki-hero-art=1`. **Nowy bohater nie jest jeszcze zainstalowany ani opublikowany.** Domyślne zasoby i zapisy pozostają bez zmian.

## Wznowienie

1. Sprawdzić pod/montaż i pliki po ponownym uruchomieniu. Nie zakładać trwałości `/opt`.
2. Odtworzyć środowisko z `/workspace/ki-legends-gpu/bootstrap.sh`, z zachowaniem działającego PyTorch/CUDA i pozostałych projektów.
3. Odtworzyć bieżący checkpoint do `/opt/ki-legends-gpu/planetary-motion-v2`; potrzebny również `planetary-rig-v2/planetary-rig-down.blend` oraz skrypt `animate_planetary.py`.
4. Uruchomić `animate_planetary.py --render-validated`. Skrypt sprawdza istniejące sumy i pomija ukończone klatki. Wynik odmienny od oczekiwanego wymaga przerwania i analizy, bez nadpisywania źródeł.
5. Zabezpieczać kolejne partie poza GPU; nie trzymać wynajmu podczas testów CPU/CI.
6. Po komplecie: `prepare_planetary_delivery.py SOURCE OUTPUT`, następnie `npm run assets:pack -- OUTPUT DELIVERY --id=hero-planetary --world=verdant --presentation=grounded`, ustawić paczce `previewOnly: true`, walidować/importować przez istniejący importer.
7. Przetestować wizualnie wszystkie stany, kontakt stóp, osiem kierunków, touch/mobile, walkę i zapis. Dopiero potem przedstawić użytkownikowi. NPC i przeciwnicy nadal wymagają wykonania; innych ras nie rozpoczynać.

Walidacja kodu: TypeScript, lint (0 błędów/7 istniejących ostrzeżeń), build przeszły. Pełny E2E uruchomiono przed pauzą; wynik końcowy trzeba odczytać z zapisanych raportów, nie zakładać PASS. Nie wykonano testów nowego bohatera w grze, bo brak kompletnej paczki.

## Zamknięcie sesji i koszty

Checkpoint zapisano także na `/workspace/ki-legends-gpu/checkpoints/planetary-20261020/`: archiwum **28 096 269 bajtów**, manifest SHA-256, listy wersji bibliotek ComfyUI/Blendera. Archiwum odczytano ponownie z montowania i porównano hash. Dwa potrzebne checkpointy modeli pozostają w `/workspace/ki-legends-gpu/models/checkpoints/`; sprawdzono ich istnienie i rozmiary. `/workspace` jest zamontowane jako `fuse.geesefs`, ale środowisko nie ujawnia identyfikatora produktu RunPod Network Volume. API konta nie pozwoliło go zweryfikować. Nie utożsamiać tego ustalenia z potwierdzeniem konkretnego produktu Network Volume.

Na wyraźne zlecenie użytkownika usunięto wyłącznie `env-wan.tar`, `wan2.2_ti2v_5B_fp16.safetensors` i `wan2.2_vae.safetensors` oraz ich znaczniki gotowości. Zwolniono **16 079 472 608 bajtów**. Pozostawiono Qwen/Ollamę, współdzielone encodery, wyniki/workflow WAN i pozostałe projekty. Log operacji: `/workspace/ki-legends-gpu/wan-removal-20261020.json`.

Render zatrzymany. **Pod nie został zatrzymany przez API**: REST wcześniej 403, GraphQL z kluczem konta zwraca `Unauthorized`. Użytkownik musi nacisnąć **Stop** w panelu RunPod; nie Terminate. Zatrzymanie procesu renderowania i usunięcie modeli nie zatrzymują naliczania ceny GPU ani opłaty za przydzielony rozmiar storage.

Niezależnie pobrano z GitHub LFS i porównano SHA-256 **181 obiektów** punktu wznowienia (179 klatek, podgląd źródła i `.blend`). Wyniki nie istnieją wyłącznie na GPU. Kod: 98/98 testów jednostkowych PASS. Końcowe E2E przerwano na prośbę zakończenia sesji; szczegółowy wynik znajduje się w raporcie obok dokumentacji, bez deklaracji pełnego PASS. Nie opublikowano zmian ani nie scalono ich do main.

Końcowy wynik przerwanego E2E: **45 PASS, 0 FAIL, 1 przerwany, 1 niewykonany**. Przerwano PvE Androidów na polecenie końca sesji; PvE Legendów nie uruchomiono. To nie jest zaliczenie całego pakietu. Raporty: `qa/hero-planetary-v1/checkpoint/`. Draft PR: https://github.com/circus574-cpu/pixel-playground-launch/pull/4.
