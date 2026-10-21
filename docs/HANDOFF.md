# KI Legends — przekazanie do Codex Cloud

Stan audytu: **2026-10-21 UTC**. Dokument powstał na osobnej gałęzi `docs/codex-cloud-handoff-20261021` z `main` **`86a1e411339bc41fb218d4633ed2a7bd81e1f167`**. Bieżące polecenie właściciela: **wyłącznie zabezpieczenie i przekazanie; bez merge do main, bez publikacji, bez uruchamiania GPU, bez zmian danych na GPU**. Właściciel potwierdził w tej fazie, że GPU jest wyłączone. Wcześniejsze zgody na publikowanie nie upoważniają do publikacji tego przekazania.

## Jak czytać dowody

- **Kod / plik odczytany teraz**: konkretna ścieżka i commit; nie przypisujemy sobie cudzych zmian.
- **Test wykonany**: komenda, SHA i wynik w [raporcie końcowym](handoff/FINAL_TESTS.md). Starsze wyniki są osobno, nie zastępują ponownego testu.
- **Historyczny raport GPU**: dowód tego, co sprawdzono 2026-10-20, nie inwentaryzacja wyłączonego poda dzisiaj.
- **Instrukcja / plan**: nie oznacza wdrożenia ani zaakceptowania grafiki.
- **Niezweryfikowane**: brak dostępu albo brak zachowanego dowodu; nie zamieniać na PASS.

Repo: https://github.com/circus574-cpu/pixel-playground-launch . Produkcja: https://kilegends.pl/ . Dokumenty szczegółowe: [TECHNICAL_STATE](TECHNICAL_STATE.md), [GPU_PRODUCTION](GPU_PRODUCTION.md). Pliki tej gałęzi należy odczytać z PR przekazania, dopóki właściciel nie zatwierdzi scalenia.

## Ostatni stan i zachowanie gry

To lokalne PvE, nie działający serwer MMORPG. Cztery pochodzenia / osobne regiony startowe:

| Rasa / ID | Kontynent / ID | Region | Przewodnik / lokalny cel eksploracji |
| --- | --- | --- | --- |
| Planetarni / planetary | Verdantia / verdant | Wioska Początkowa | Aira / Rynek |
| Mędrcy / sage | Aetheria / aether | Sanktuarium Tysiąca Źródeł | Sora / Źródło Pamięci |
| Androidy / android | Nexus-9 / nexus | Węzeł Świadomości | LYRA-7 / Rdzeń Świadomości |
| Legendy / legend | Pyra / pyra | Twierdza Popiołu | Kaena / Arena Dziedzictwa |

Ruch z A*, kolizje, kamera/zoom, minimapa, rozmowy, questy, polowanie na trzy dziki, umiejętności/HP/KI/XP, łupy, broń i pancerz, kupiec, kowal, śmierć/odrodzenie, lokalne sloty i niedestrukcyjna migracja zapisów są w kodzie. Cztery starty nie oznaczają czterech gotowych artystycznie pełnych kontynentów. W runtime pozostaje wspólny człowiek. `src/game/features.ts` ma `TEST_RACE_SWITCH_ENABLED=true`: testowa „Zmiana rasy” w ustawieniach zachowuje postacie. Wyłączenie później wymaga osobnej małej zmiany, nie usunięcia zapisów.

## Co zlecono i co rzeczywiście zrobiono

Historia dostępnych poleceń obejmuje etap 2.1 (Aira/ruch do rynku/PvE), cztery światy i sloty, oryginalne ilustracje selektora i rzeczywisty loader, znikające podpowiedzi, stabilizację przed GPU, pipeline, naprawę RunPod, eksperymenty otoczenia, osobną akceptację bohaterów, przerwaną produkcję Planetarnych oraz końcowe porządkowanie HUD. Wdrożenia wcześniejszych etapów weryfikujemy przez istniejące raporty i historię; nie przedstawiamy ich jako nowych prac tego audytu.

Najświeższa zakończona partia to **HUD telefonu i komputera**, PR [#5](https://github.com/circus574-cpu/pixel-playground-launch/pull/5), dowody [#7](https://github.com/circus574-cpu/pixel-playground-launch/pull/7). Szczegóły i obrazy: [MOBILE-HUD-LAYOUT-2026-10-20](MOBILE-HUD-LAYOUT-2026-10-20.md).

Potwierdzone przyczyny i rozwiązania:

1. Cztery stare arkusze CSS niezależnie nadpisywały geometrię. Narzędzia, kamera, czat i umiejętności zajmowały osobne rzędy. Dodano końcową warstwę `hud-layout.css`, zamiast przepisywać skórkę/całą aplikację. Pięć skilli ma minimum 44×44, menu 48×52, wspólny dolny rząd. HP/KI 176×56 i minimapa 88 px w układzie kompaktowym; pełne nazwy pozostają dostępne na mapie/opisie. Pomiar przy 390×640: stałe ramki 19,69% → 12,87% viewportu, 34,7% mniejsza suma powierzchni, nie deklaracja wzrostu FPS.
2. Globalnie najbliższy NPC dawał przycisk rozmowy nawet daleko i przy przeciwniku. Pokazujemy go do 180 jednostek, poza walką i otwartymi oknami. Dziennik/mapa nadal prowadzą do odległych NPC i lokalnych celów.
3. Menu telefonu chowa się po wyborze narzędzia, rozpoczęciu rozmowy, Escape i dotknięciu świata. Ostatni gest trafia też do świata. Blur przycisków po zamknięciu zapobiega przechwytywaniu klawiatury ruchu. Listener zewnętrznego dotknięcia ma cleanup.
4. Długie nazwy przeciwników zwiększały wysokość celu i nachodziły na komunikat o stałym Y. `ki-status-stack` układa cel i komunikat w przepływie grid. Kamera desktopowa przeniesiona nad dolne menu, poza panel zadania. Ostrzeżenie zapisu działa niezależnie od zwiniętych narzędzi i zwykłych podpowiedzi.
5. Jawne `aria-label` czatu usuwa niejednoznaczną nazwę dostępną z pseudo-elementu. Zwykłe podpowiedzi są czasowe/zamykalne; ostrzeżenia krytyczne nie zostały ukryte dla „czystego” obrazu.
6. Starsze testy `.tap()` próbowały naciskać schowany ekwipunek/kamerę. Wspólny `openHudTool` używa prawdziwego otwarcia menu i dotyku. Test ruchomych dzików klika aktualną pozycję, z odczytem `data-enemies`, `data-camera-x/y`, zoom i korektą środka kamery Phaser. Nie wstrzykuje zabójstw ani łupów. `mountGame.ts` dostał wyłącznie odczytową telemetrię kamery.
7. Zastane pliki generowane Supabase blokowały lint. Osobny commit formatuje typy i poprawia deklarację timera; żadnych zmian DB, auth, polityk czy storage.

Pełny wykaz ostatniej partii: [hud-changed-files.json](handoff/hud-changed-files.json): **21 dodanych, 15 zmodyfikowanych, 0 usuniętych** względem `8045a0b..86a1e41`. Po poprzedniej pracy oba własne worktree były czyste. Stare screenshoty generowane ponownie podczas QA zachowano lokalnie i przywrócono historyczne wersje; nie dopisano ich jako rzekomo nowych dowodów. Ta partia przekazania dodaje wyłącznie dokumentację i dowody, nie zmienia silnika.

## Kotwice Git i PR

| PR / gałąź | Stan przy audycie | SHA / znaczenie |
| --- | --- | --- |
| #1 qa/playwright-github-actions-20261020 | merged | e8edb7a…; historyczne CI/PvE, nie nowa praca tego przekazania |
| #2 feat/pre-gpu-stabilization-20261020 | merged | b51fc19…; merge d0a2ba6…; pipeline, cache, stabilizacja |
| #3 docs/runpod-gpu-setup-20261020 | OPEN | bbe248576c4e43098034aad84c667109912e62a2; historyczna naprawa runtime, nie scalać automatycznie |
| #4 feat/gpu-hero-approval-20261020 | DRAFT OPEN | 7c50e8d5a93a3cf98c094f1ee341829fd6b0354c; niepełne animacje, LFS, nowy opt-in/profil, nie main |
| #5 fix/mobile-hud-layout-20261020 | merged | 7a52aaeb0412b671e6d9e0bf0825980b7bc131e9; merge **5e72796a5ee450736429cb4101a0bbfd81bf55c6** |
| #6 docs/ki-legends-knowledge-reconstruction-20261021 | DRAFT OPEN, Architekt | **d020074dc70761632436e167d3e26d13e8beaf03**, tylko odczyt |
| #7 docs/mobile-hud-verification-20261021 | merged | ea8648968acad9899e918ef706009f7022547b5e; merge **86a1e411339bc41fb218d4633ed2a7bd81e1f167** |

Commity HUD: `47fd3ac` lint, `7add71e` układ/testy, `5685c2e` stos komunikatów, `05f91f1` desktop/dotyk, `8e5909f` widoczność kamery w teście, `7a52aae` środek zoomu. Dokładne opisy w raporcie HUD. Dodatkowe gałęzie: `feat/gpu-city-assets-20261020` na `6551522`, `wip/city-preview-rollout-20261020` na `d20167e` oraz `feat/ki-agent-system-20261021` widoczna na `8045a0b`; zachować, nie przejmować bez diffu. Ruchome referencje trzeba odświeżyć przy nowym starcie.

Wcześniejsza publikacja HUD została **wykonana przed poleceniem przekazania**, przez Lovable po synchronizacji `5e72796`, deployment `ba5606b9-a3d2-40e1-a6ee-8514cdf0c02d`. Następnie 7/7 testów na `https://kilegends.pl/` (34,1 s), dowody w repo. To nie deklaracja, że dowolny przyszły main jest wdrożony. Merge #7 zawiera tylko dokumentację. Podczas obecnego przekazania nie publikowano i nie scalano żadnego PR.

## Próby nieudane i pułapki wznowienia

- Pierwszy pełny CI HUD [39486734284](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39486734284): 48 PASS / 6 FAIL. Pięć błędów testu schowanych narzędzi i jeden statycznego celowania. Kolejny lokalny przebieg potwierdził brak korekty środka zoomu. Poprawiono automat i powtórzono; nie maskowano problemów skip/wyższym timeoutem ani zmianą zasad walki.
- Końcowy CI [39540694141](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39540694141): 97/97 unit, 54/54 E2E (17,3 min), pełny TypeScript/assets/lint/build PASS. Lokalne 54/54 (14,4 min). Wyniki nie obejmują nowego, nieukończonego bohatera z #4.
- Przy `KI_QA_BASE_URL` podać także `KI_QA_PATH=/scripts/playtest.html` dla izolowanego playtestu; `/` jest poprawne na produkcji, nie dla statycznego playtest builda.
- Nie uruchamiać równoległych Playwrightów zapisujących do tego samego `test-results`: występowało ENOENT przy zamykaniu trace. Osobne `--output` i brak równoległego przebudowywania serwowanych assetów.
- `gh` w tym środowisku ma starsze opcje: `gh pr checks --json` nie działa; edycja PR może wpadać w stary Projects GraphQL. Używać REST z plikiem JSON. Długie `gh run watch` raz zakończyło się 401 poświadczeń; świeży krótki odczyt API działał. Nie logować tokenów ani rozpoczynać interaktywnego loginu w ciemno.
- Pobieranie archiwum Actions przez gh zwróciło Forbidden na przekierowaniu; odczyt logów przez connector GitHub działał po zakończeniu joba. Logi są w `structuredContent.content`, nie w tekstowym „Action completed”. Nie publikować podpisanych URL artefaktów. Wybrane trwałe dowody pozostają w repo; czasowe artefakty CI mogą wygasnąć.
- RunPod: błędne argv kontenera, brak POSIX na FUSE, konflikt wersji ComfyUI/PyTorch, brak bibliotek Blendera — szczegóły [GPU_PRODUCTION](GPU_PRODUCTION.md). Nie naprawiać przez ponowną instalację CUDA ani przypadkowe aktualizacje.
- Pierwsza próba 64 klatek Planetarnych obcinała włosy; odrzucona do instalacji. Profil `grounded` i kamera 45° istnieją tylko na #4. Nie kopiować renderów do main z obecnym legacy kontraktem 60° / stopami 0.95.

## Nierozwiązane zadania i zależności

1. **GPU / Planetarni:** dokończyć 237 klatek (attack 13, skill 64, hit 32, death 64, respawn 64), obejrzeć wszystkie klipy, spakować/importować wyłącznie jako opt-in, sprawdzić w grze. 179/416 nie jest ukończeniem rasy. Idle/walk po 64 gotowe plikowo; nie oznacza akceptacji jakości riga w runtime.
2. **Integracja #4:** przed merge uzgodnić z obecnym main profil `grounded`, schemat/importer/packer i opt-in. Wspólny lint commit istnieje w main jako cherry-pick pod innym SHA; porównać treść, nie przenosić ponownie bez analizy. #4 miał 98 unit i niepełny E2E, nie dzisiejsze 97/54.
3. **GPU storage:** zachować ten sam wolumin; potwierdzić identyfikator Network Volume, zawartość kopii runtime/modeli po uruchomieniu autoryzowanym przez właściciela. Nie gwarantujemy produktu Network Volume na podstawie `fuse.geesefs`. Szczegółowa macierz ryzyka i kopii w GPU_PRODUCTION.
4. **Pozostałe rasy:** nie rozpoczynać bez osobnej akceptacji. Najpierw kompletny Planetarny; potem NPC/przeciwnicy i otoczenie w tej samej skali. Nowe plansze użytkownika służą jako referencja miast, nie postaci ani nowych nazw ras.
5. **Wydajność:** fizyczny Android, sprzętowy WebGL, termika, sieć mobilna i długa sesja nadal niezweryfikowane. Wyniki syntetyczne i software SwiftShader nie są pomiarem 60 FPS na telefonie. Historyczne pomiary: PRE_GPU_STABILIZATION i jego JSON.
6. **Zakres przyszły:** brak multiplayera, kont, PvP, sieciowej ekonomii, rozbudowanej fabuły/klas/bonusów rasowych. Nie implementować ich w ramach wznowienia grafiki.
7. **Archiwum kontekstu:** oryginalnego PDF i załączników zdjęciowych nie odnaleziono w bieżącym filesystemie. Nazwa PDF: `Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf`. Oryginalne wyodrębnione ilustracje ras i ich hashe są w `public/game/assets/origins-v1/` i `world/origin-art.json`. Pełnej wcześniejszej rozmowy nie można odtworzyć z Git; wszystkie dostępne istotne ustalenia i granice zapisano tutaj/GPU_PRODUCTION. Nie twierdzimy, że nieudokumentowane pliki na serwerze zostały skopiowane.

## Dla Architekta — PR #6, bez ingerencji

Przeczytano wszystkie dziewięć zmienionych plików #6: AGENTS oraz ARCHITECTURE, ROADMAP, DECISIONS, STATUS, TASKS, CHANGELOG, GAME_DESIGN, WORLD_LORE. Niczego tam nie zmieniano ani nie scalano. Powinien uwzględnić:

- Zastąpić przejściową bazę `8045a0b` finalnymi dowodami HUD #5/#7 i nowym raportem testów; nie zmieniać historycznych dat na „dzisiaj”. `git cat-file -t 8045a0b` potwierdza commit, nie sam identyfikator drzewa. STATUS sam zawiera późniejsze sprostowanie tej niejednoznaczności.
- Rozróżnić zaakceptowany **wzorzec** Planetarnego od niezaakceptowanych, niepełnych animacji i braku integracji w grze. Liczba klatek to stan plików, nie odbiór artystyczny.
- Bazowy kontrakt main: 96 / 0.95 / 60°; propozycja #4: `grounded` 128 / 0.75 / 45°. Nie łączyć tych standardów w jeden rzekomo wdrożony format.
- Nie przenosić 98 unit z #4 na main (97), ani 45 PASS + przerwany test na pełne PASS. Oddzielić 54 E2E obecnego main od testów nowej grafiki, które są NIEWYKONANE.
- 89 PNG w gałęzi miast zawiera odrzucone eksperymenty i 32 klatki efektów, nie 89 zatwierdzonych obiektów. `selection.json` jest wyborem technicznym, nie zgodą właściciela.
- Doczepić aktualne potwierdzenie LFS: 181 obiektów świeżo pobranych i zhashowanych. Nie rozszerzać go na modele znajdujące się tylko na woluminie ani wszystkie assety innych gałęzi.
- Publikacja HUD była osobnym, wcześniejszym działaniem z udokumentowaną weryfikacją. Obecne przekazanie i PR #6 nie są zgodą na nowe wdrożenie.

## INSTRUKCJA STARTOWA DLA NOWEJ SESJI CODEX CLOUD

1. `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git remote -v`; odświeżyć refs po sprawdzeniu dostępu. Nie nadpisywać zmian ani przejmować innego worktree.
2. Przeczytać **AGENTS.md z faktycznej gałęzi** i `docs/PRODUCTION.md`; sprzeczne historyczne sekcje rozstrzyga najnowsze polecenie właściciela. Nie publikować/scalać na podstawie tej instrukcji.
3. Odczytać PR #6 / przypięte `d020074dc70761632436e167d3e26d13e8beaf03` bez checkoutu/edycji gałęzi Architekta. Przykład po fetch: `git show d020074dc70761632436e167d3e26d13e8beaf03:docs/STATUS.md`; analogicznie pozostałe dokumenty.
4. Przeczytać HANDOFF.md z PR przekazania, nie zakładać jego obecności na main.
5. Przeczytać GPU_PRODUCTION.md oraz przypięte materiały #3/#4 i wzorzec źródeł LFS.
6. Przeczytać TECHNICAL_STATE.md, GPU_ASSET_PIPELINE.md, raport HUD i FINAL_TESTS.md.
7. Sprawdzić aktualne commity/otwarte PR, zwłaszcza #3, #4, #6 i PR przekazania. Zachować gałęzie city/rollout i inne prace.
8. Sprawdzić środowisko, proxy i autoryzacje bez wypisywania sekretów; `npm ci`, dostępność Chromium/Git LFS; wykonać testy zgodnie z FINAL_TESTS. Nie instalować GPU/modeli w ciemno.
9. Odtworzyć listę zadań wyżej i macierz kopii GPU. Jeśli celem jest GPU, uzyskać nowe polecenie właściciela uruchomienia/kosztów oraz dostęp do zachowanego woluminu; sam historyczny adres nie jest autoryzacją ani sekretem dostępowym.
10. Przygotować raport gotowości: aktualny SHA, testy, LFS, stan woluminu/modeli, lista braków i pierwszy bezpieczny krok. Dopiero potem wykonywać nowe polecenia. Nie odtwarzać setupu przez kopiowanie starego PID lub capability URL z logów.

**Przekazanie wiedzy nie wymaga obecnej rozmowy.** Praca kodowa może wystartować z zapisanych dokumentów i refs. Wznowienie renderowania jest warunkowe: dostępny i opłacony przez właściciela pod, właściwy wolumin, sprawdzony runtime i komplet źródeł; nie obiecujemy gotowej rasy ani czasu uruchomienia bez tej kontroli.
