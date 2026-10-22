# KI Legends — rejestr otwartych zadań i usterek

Aktualizacja: **2026-10-22**, punkt odniesienia `main` `66a615dec1d4259e1bf668956ec1cb09e9aa177e`. Żadnego zadania nie uznawać za wykonane na podstawie samej deklaracji PR.

| ID | Priorytet | Zadanie / dowód | Kryterium zamknięcia |
| --- | --- | --- | --- |
| P0-21-01 | WYSOKI | PR #21, `aether-art-preview.spec.ts:18`: test przeczy domyślnemu włączeniu grafiki Aetherii | Test zgodny z aktualnym manifestem i zachowujący kontrolę poprawnego renderu; nowe CI PASS |
| P0-21-02 | WYSOKI | PR #21, `planetary-preview.spec.ts:156`: dotyk daje 10,25 jednostki, próg >12 | Ustalić przyczynę z trace; potwierdzić 8 kierunków i płynny ruch, bez arbitralnego obniżania wymagań |
| P0-21-03 | WYSOKI | PR #21, 3× `region-start-art.spec.ts:10`: HTTP error przy `/` na porcie playtest | Poprawna trasa testowa oraz testy wszystkich trzech regionów, przełączania grafik i integralności zapisów PASS |
| P0-21-04 | ŚREDNI | PR #21, `stage3.spec.ts:92`: minimapa Aetherii 1200 px, test oczekuje 2400 px | Asercja zgodna z aktualnym plikiem obrazu/kontraktem (bez wymiany zasobu wyłącznie na potrzeby testu); PASS |
| P0-21-05 | WYSOKI | Pełny Browser QA PR #21 [39776233057](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39776233057) = 89 PASS, 6 FAIL | Nowy pełny Playwright PASS i Software WebGL PASS na identycznym finalnym SHA, ślady i screenshoty |
| P0-21-06 | WYSOKI | `main` wciąż uruchamia `human-v2` dla Planetarnych bez flagi URL | Właściwy `hero-planetary` bez flagi, brak regresji Mędrców, innych ras, zapisów i HUD; potwierdzony test |
| REL-01 | WYSOKI | Źródła i prawa do 10 pierwotnych ilustracji PDF i pochodnych; [rejestr](ASSET-LICENSE-REGISTER.md) | Udokumentowany łańcuch uprawnień do rzeczywiście używanych grafik i uzupełnione nierozstrzygnięcia |
| REL-02 | WYSOKI | Produkcja `kilegends.pl` vs zaakceptowany SHA | Udokumentowany build/deploy SHA i niezależny test publicznej gry |
| QA-MOBILE | WYSOKI | Fizyczny Android / sprzętowy WebGL / touch / zużycie pamięci / płynność 416-klatkowych bohaterów | Protokół urządzenia, wersji, scenariuszy, screeny, akceptacja właściciela |
| DOC-01 | ŚREDNI | Po scaleniach #15/#16/#17 historyczne statusy były nieaktualne | Spójne i scalone aktualizacje `STATUS`, `TASKS`, `ARCHITECTURE`, `ROADMAP`, `DECISIONS`, `CHANGELOG`, indeksu i instrukcji |
| DOC-02 | ŚREDNI | PR #20 — dodatkowe aneksy: statystyki, drzewka, bestiariusz; brak w `main` | Audyt źródeł i PR #20, decyzja właściciela, dopiero potem merge |
| PROC-01 | ŚREDNI | PR #11–#14 i #18–#19 częściowo dublują funkcje w `main` | Ocena różnic i udokumentowana decyzja o utrzymaniu/zamknięciu, bez automatycznego merge |
| GPU-01 | ŚREDNI | Androidy → Legendy → miasta czterech ras jako kolejne etapy produkcji | Niezależne assety, QA i zatwierdzenie zgodnie z [planem GPU](GPU-PRODUCTION-SEQUENCE.md) |

## Zakończone historycznie / zachowane dowody
- PR #9, #15, #16 i #17: **MERGED** według GitHub; nie są już otwartymi zadaniami scalenia.
- PR #15 `d959927...`: dwa workflow **SUCCESS** ([QA](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39675441735), [WebGL](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39675441724)). Nie przenosić tego PASS na późniejszy PR #21.
- Oryginalny PDF z 12 stronami: 12 binarnych części i skrypt `restore.py` są już w `main` dzięki PR #16. Pełne odtworzenie i hash po nowym klonowaniu pozostają zalecaną kontrolą.

**Reguła procesu:** nie wykonywać start/stop/restart/terminate GPU, automatycznego merge ani wdrożenia. Odrębna zgoda właściciela i weryfikacja bram jakości są wymagane.
