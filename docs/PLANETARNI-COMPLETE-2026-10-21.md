# Planetarni motion-v2 — komplet techniczny i podgląd, 2026-10-21

Aktualizacja operacyjna: [runtime przywrócony na nowym podzie](GPU-RUNTIME-RESTORE-2026-10-21.md).
Wyłącznie właściciel wykonuje Start/Stop/Restart/Terminate podów; historyczne
zalecenie automatycznego wyłączania GPU zostało odwołane.

**416/416 klatek; kandydat do odbioru wizualnego, nie zatwierdzenie produkcyjne.**
Właściciel włączył GPU i zlecił kontynuację według dokumentacji. Wykonano brakujące
237 klatek, zabezpieczono źródła i przygotowano opt-in w osobnej gałęzi.
Nie scalano PR ani nie publikowano gry. NPC, przeciwnicy i pozostałe rasy nie były
rozpoczynane. Zatwierdzenie dawnego wzorca wyglądu nadal nie oznacza akceptacji riga.

## Wersje i zakres

- Aktualny punkt wyjścia: `main` **70e6e49683241236ccd7ce9da90059e3144f82b3**,
  zawierający nowszą mapę `/mapa`. Nie przenoszono wyników z `86a1e41` na ten kod.
- Historyczny PR #4: **7c50e8d5a93a3cf98c094f1ee341829fd6b0354c**.
  Przeniesiono jego obsługę `grounded`/`previewOnly`, testy, źródła Planetarnego
  oraz pochodzenie/licencje. Nie włączano eksperymentów city/rollout.
- Wiedza: PR #6 `6ffb6b3…`, PR #8 `779ad95…` i niezależne uzgodnienie Audytora.
  Te gałęzie i dokumenty pozostawiono bez zmian.
- Oryginalny checkout `/workspace/pixel-playground-launch` pozostał na czystym
  `work/ad4a1f9…`. Praca znajduje się w osobnym checkoutcie i gałęzi
  `work/planetary-resume-20261021`.

Reguły PvE, collider 12, zapisy/migracja, mapy, kamera gry i `/test` zachowane.
Main nadal ma domyślnego człowieka 96 / origin .95. Kandydat ma jawny profil
`grounded`: canvas 128 / origin .75, z renderami ortho 45°. Profil nie zmienia
fizyki, balansu ani kamery Phaser. Niedokończony aktor nie był importowany.

## GPU i rzeczywisty cold restore

Pracował nowy pod **52s0jgxh6vxo0s**, `big_apricot_guanaco`, 1× RTX A6000,
sterownik 595.91.07. Poprzedni `uywsfhvthv4n4k` pozostał `EXITED`.
API pokazało wspólne montowanie `/workspace`, `volumeId=cmvd4vaaz000007jjb1901zsp`.
`findmnt` wskazał `fuse.geesefs`, source `6cc4602b-bc02-4fc6-9ab3-6e8feea1c90e`.
Nie utożsamiać tych identyfikatorów z niezależnie potwierdzonym produktem Network Volume.

Po uruchomieniu `/opt/ki-legends-gpu` nie istniał. Sprawdzono SHA archiwum runtime
1 169 795 882 B oraz oryginalnego checkpointu 28 096 269 B, następnie odtworzono je
na POSIX `/opt`, zachowując archiwalne kopie. Ponownie odczytano i zhashowano oba
modele na woluminie:

| Model | Bajty | SHA-256 |
| --- | ---: | --- |
| Animagine XL 3.1 | 6 938 325 776 | `e3c47aedb06418c6c331443cd89f2b3b3b34b7ed2102a3d4c4408a8d35aad6b0` |
| DreamShaper XL Turbo 2.1 | 6 939 220 250 | `4496b36d48bfd7cfe4e5dbce3485db567bcefa2bef7238d290dbd45612125083` |

**Pełny automatyczny bootstrap nie przeszedł.** Nowy obraz ma Python 3.12;
archiwalne venv wskazywały nieistniejące `/usr/bin/python` i globalne biblioteki
Python 3.11 z dawnego obrazu. Pierwszy bootstrap zakończył się kodem 127.
Naprawiono wyłącznie prywatne dowiązania interpreterów do istniejącego
`/usr/bin/python3.11` (3.11.13). Uzupełniono brakujące biblioteki systemowe według
bootstrapu i Pillow 12.3.0 w `blender-venv`. Nie zmieniano sterownika NVIDIA.

**Blender 4.5.3 LTS/bpy został rzeczywiście odtworzony i wyrenderował 237 klatek
przez Cycles CUDA. ComfyUI nie uruchomiono:** stare dowiązania torch 2.4.1+cu124
prowadzą do nieobecnych globalnych paczek dawnego obrazu. Nie instalowano nowych
wag ani alternatywnego PyTorch; inference AI nie był potrzebny do kontynuacji riga.
Pełny cold restore całego stosu pozostaje otwartym zadaniem. Modele są teraz
sprawdzone na woluminie, lecz ich kopii poza nim nadal nie potwierdzono.

Nie czyszczono WAN, Qwen/Ollama ani innych projektów. Nie tworzono podów,
nie zmieniano konfiguracji zasobów ani montowań. Po zabezpieczeniu kompletnego
checkpointu i pobraniu go poza GPU wykonano `pod-action: stop` wyłącznie na
pracującym podzie. API zwróciło **EXITED**, bez Terminate. Storage może nadal
podlegać opłatom.

## Render i integralność

Oryginalny `animate_planetary.py` ma SHA
`b704b9ca1b4f8fe3254f7a9f257430503060a8e1f8f04f37d3a927a6edb522e9`.
Skrypt z checkpointu porównano z PR #4. W kopii roboczej zmieniono tylko `ROOT`
na `/workspace/ki-legends-gpu/resumes/planetary-20261021`, aby nowe archiwa
kierunków nie nadpisywały historycznych. Kamera, rig, pozy i parametry renderu
nie zostały zmienione.

Przed renderem wykonano świeży `--validate-only`: **416 póz, 0 naruszeń marginesu,
maksymalna różnica granic względem historycznego preflightu 0,0**.
Następnie `--render-validated` sprawdził i pominął zachowane klatki.

| Klip | Klatki | FPS | Pętla |
| --- | ---: | ---: | --- |
| idle | 64 | 6 | tak |
| walk | 64 | 16 | tak |
| attack | 64 | 16 | nie |
| skill | 64 | 12 | nie |
| hit | 32 | 16 | nie |
| death | 64 | 10 | nie |
| respawn | 64 | 12 | nie |

Wszystkie 416 plików: RGBA 512×512, zgodne SHA z metadanymi, niepusta alfa,
minimalny rzeczywisty margines **23 px** (wymagane ≥8), stały canvas/origin;
każdy klip/kierunek ma różniące się klatki. Pierwotne **179 PNG są bajtowo
niezmienione**. Zapisano edytowalne `.blend` i wejściowy rig, skrypty oraz siedem
zweryfikowanych plików bazy MakeHuman. `pause.manifest` celowo zachowuje historyczne
179; aktualny `motion.manifest` zawiera 416. Dodatkowy source-preview PNG nie jest
klatką animacji.

Nowy checkpoint:

- `/workspace/ki-legends-gpu/checkpoints/planetary-20261021-complete/planetary-motion-v2-complete-20261021.tar.gz`
- **60 077 990 B**, SHA **e326caa9739b96f6911716ff5c5313721842ee90ca840a4cc6fa8f3f664171cd**.
- Odczyt z docelowego woluminu i ponowny download do środowiska Cloud: zgodne SHA.
- Historyczny checkpoint również pobrany i sprawdzony poza podem.
- Szczegóły odtwarzania i pełne logi pozostają w
  `/workspace/ki-legends-gpu/resumes/planetary-20261021/session-evidence/`.

Źródła zabezpieczono również w GitHub LFS na osobnej gałęzi, commit
`07f6a147e7bcfb62544ab3a24050a13a84d51d49`. Następnie pobrano je ponownie do
oddzielnego, pustego cache: **426 ścieżek / 425 unikalnych obiektów,
72 210 441 B unikalnych danych**. Każdy SHA-256 i rozmiar jest zgodny:
[pełny readback LFS](qa/planetary-resume-20261021/lfs-readback.json).
Różnica liczby plików/obiektów wynika z identycznego podglądu źródła i jednej
klatki, nie z brakującego pliku. Potwierdzenie obejmuje źródła tej dostawy,
nie modele AI ani kompletny runtime.

## Pakowanie i opt-in

Istniejący `prepare_planetary_delivery.py` zaliczył 416/416; następnie wykonano
packer z `--presentation=grounded`, ustawiono `previewOnly:true`, przejrzano dry-run
i wykonano importer w osobnym checkoutcie. Nie edytowano rejestru w celu ominięcia
walidacji. Dwa atlasy 2048×2048 i 2048×1280, klatki klienta 128×128:
**2 129 296 B** WebP, digest paczki
`1868eaa1c9f85e8f3803de4a01e92007de16ec5e0a8c8f0d59a4ce4f5060ba46`.

`assets:check` sprawdził osobno produkcję i preview. Domyślny katalog pozostaje
bez nowego aktora. Verdantia preview z cache: **94 452 000 B**, poniżej 128 MiB;
pozostałe światy zachowują dotychczasowe zasoby.

Lokalny podgląd gry: `npm run playtest`, następnie
`/scripts/playtest.html?ki-hero-art=1`. Bez parametru pozostaje człowiek.
Samodzielny przegląd klipów można wygenerować przez:

```sh
python scripts/gpu/create_planetary_review.py DELIVERY/manifest.json REVIEW.html
```

## Testy i dowody

Dowody: [katalog QA](qa/planetary-resume-20261021/), szczególnie
[integralność](qa/planetary-resume-20261021/frame-verification.json),
[piksele](qa/planetary-resume-20261021/pixel-verification.json),
[przebieg renderu](qa/planetary-resume-20261021/render-summary.txt),
[desktop](qa/planetary-resume-20261021/planetary-idle-1280.png) i
[390 px](qa/planetary-resume-20261021/planetary-idle-390.png).

Wykonano czyste `npm ci`, pełny TypeScript aplikacji/e2e/tools, **110/110 Vitest**,
assets:check i build. Pełne E2E bazowego playtestu z obsługą profilu, przed instalacją
paczki: **54/54** w 15,9 min. Po instalacji: **4/4** dedykowane scenariusze preview,
**1/1** prawdziwy dotyk CDP/joystick ośmiu kierunków i tap umiejętności oraz
**2/2** rzeczywiste PvE/śmierć/respawn z opt-in. To oddzielne przebiegi, nie jedna
deklaracja pełnej suity na produkcji. Domyślny wygląd, brak atlasów Planetarnego
w innych światach, zachowanie tej samej postaci/zadania po przełączaniu flagi,
uszkodzony atlas/retry i klatki ruchu/skill sprawdzono w przeglądarce.

Pełny lint nowego main początkowo miał **136 błędów / 7 ostrzeżeń** w zastanych,
niezmienionych plikach. Osobny commit porządkuje tylko dwa wygenerowane pliki
Supabase oraz deklarację nieprzypisywanego ponownie timera. Porównanie AST
(z jawnym uwzględnieniem tej deklaracji) nie wykazało innych zmian kodu/typów.
**14/14** testów szkicownika/routingu po tej korekcie PASS. Końcowy lint:
**0 błędów / 7 zastanych ostrzeżeń**. Nie wykonywano operacji na Supabase ani
zmian polityk, bucketu czy sesji szkicownika. Historyczne zrzuty QA przywrócono;
nowe dowody zapisano oddzielnie.
Tekstowe kopie logów mają usunięte końcowe białe znaki; pełny log renderu
zachowano bez zmian w `render.log.gz`.

## Odbiór i dalsze bramki

Przejrzano klatki/filmstripy oraz faktyczną grę desktop/mobile viewport.
Pełna liczba klatek, hash, geometria i testy nie zastępują akceptacji artystycznej.
Do oceny właściciela pozostają m.in. sylwetka i czytelność w skali gry, płynność
walk/attack/skill, kontakt stóp oraz stylizowane złożenie ciała w death/respawn.
Nie deklarujemy naturalnego filmowego upadku ani końcowego zatwierdzenia riga.

Fizyczny Android, sprzętowy WebGL, termika/długa sesja i komercyjna ocena licencji
pozostają niezweryfikowane. Obecna domena i deploy nie były zmieniane ani badane.
Nie włączać aktora domyślnie ani nie rozpoczynać masowej produkcji innych ras
przed odbiorem. Kolejny etap według dokumentacji: akceptacja Planetarnego,
następnie NPC/przeciwnicy i otoczenie dopasowane do skali.
