# Ki Legends — audyt czytelności gry i regresja, 2026-10-20

> **Raport historyczny (stan sprzed 22.10.2026).** Liczby HP/KI, nazwy umiejętności i zachowanie dzika z tego raportu opisują grę przed wdrożeniem ras i drzewek. Obowiązujący opis: [GAMEPLAY-RACES-AND-MONSTERS.md](GAMEPLAY-RACES-AND-MONSTERS.md).

Zgłoszenie: podpowiedzi zasłaniają grę, część nie znika. Audyt wykonany na rzeczywistym `main` `dc56ddf`, na osobnej gałęzi `fix/gameplay-overlay-audit`. Zakres: komunikaty, etykiety świata, dialogi, okna, czat, ustawienia, sterowanie, śmierć, zapis i pełna istniejąca ścieżka PvE. Identyfikator nowego kodu: `stage3.2-clear-gameplay-r1`.

## Potwierdzone problemy i poprawki

| Problem odtworzony w przeglądarce / kodzie                                                      | Przyczyna                                                                                            | Poprawka                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Komunikat nadal widoczny po 6,5 s, również po wyłączeniu podpowiedzi; nachodzi na rozmowę       | `state.notice` bez terminu wygaśnięcia; checkbox sterował niewidocznym `.ki-help`                    | Nowe zdarzenia `noticeId`, 5 s czasu rzeczywistego, przycisk ×, działający przełącznik „Komunikaty w grze”. Powtarzany snapshot i ten sam komunikat nie przedłużają aktywnego terminu.                                          |
| Komunikat potrafił zostać nad dialogiem lub przenieść się z niego na mapę                       | Globalny, absolutnie pozycjonowany element niezależny od aktualnego okna                             | Komunikaty rozmowy/handlu/ekwipunku w treści odpowiedniego okna. Zmiana kontekstu usuwa poprzedni komunikat. Zegar działa również podczas pauzy dialogu; powrót do karty usuwa komunikat, którego termin już minął.             |
| Zbyt dużo tekstów nad postaciami i lokacjami, zwłaszcza w Pyrze                                 | Jednoczesne nazwy i role wszystkich NPC, własny podpis, podpisy łupów i powielone opisy punktów mapy | Maksymalnie nazwa najbliższego NPC lub aktywnego przeciwnika; test prostokąta chroni sylwetkę gracza. Nazwy wyłączalne. Role w dialogach, nazwy lokacji na minimapie/mapie, łupy nadal widoczne i zbieralne.                    |
| Mobilny komunikat nachodził na sterowanie kamerą lub panel celu                                 | Brak rezerwacji miejsca na wąskim ekranie; panel celu ma faktycznie 78 px wysokości                  | Węższy pasek przy lewym HUD; odstęp pod panelem przeciwnika. Testy mierzą rzeczywiste prostokąty elementów. Tekst powiadomienia przepuszcza dotyk do gry; tylko × przechwytuje kliknięcie.                                      |
| „Duża minimapa” nie zmieniała rozmiaru                                                          | Nadpisane reguły motywu CSS                                                                          | Rzeczywiste 180 px / 130 px na telefonie i odsunięcie sąsiednich elementów; ustawienie zapamiętywane.                                                                                                                           |
| Przycisk celu zadania przechwytywał dotyk zakładki czatu na telefonie, Escape nie zamykał czatu | Niewłaściwa kolejność warstw i brak obsługi stanu czatu                                              | Warstwy okien/czatu nad HUD; akcje kontekstowe ukryte podczas czatu; Escape zamyka czat i oddaje klawiaturę grze.                                                                                                               |
| Stare instancje sesji zachowywały listenery po zmianie postaci                                  | Sprzątanie wyłącznie na `SHUTDOWN`, a `Phaser.Game.destroy` emituje `DESTROY`                        | Idempotentne sprzątanie synchroniczne przy odmontowaniu oraz oba zdarzenia sceny; usuwane listenery komend, zoomu, etykiet, zapisu i blur. Test CDP mierzy powrót liczby `window.pagehide` do wartości sprzed uruchomienia gry. |
| Błąd pełnego ekranu pozostawał na środku; ostrzeżenie zapisu stale zasłaniało mapę              | Osobne trwałe nakładki                                                                               | Błąd pełnego ekranu korzysta ze wspólnego zamykanego komunikatu. Ostrzeżenie zapisu można zwinąć do wskaźnika „!” na ustawieniach; pełny tekst zawsze dostępny w ustawieniach, także przy wyłączonych komunikatach.             |

## Zachowanie i dane

- Dodatkowa pomoc jest w **Ustawienia → Sterowanie i pomoc**, otwierana przez gracza. Ostatnie zdarzenia pozostają w zakładce czatu **System**.
- Osobne ustawienia urządzenia: `ki-legends:ui-preferences:v1` (`messages`, `worldLabels`, `largeMinimap`), zachowane po odświeżeniu i zmianie rasy. Błąd zapisu preferencji nie blokuje gry.
- Schemat i klucze postaci niezmienione. `noticeId` jest tylko stanem prezentacji sesji, nie zapisem postaci. Nie kasowano ani nie migrowano ponownie zapisów graczy.
- Zachowano cztery kontynenty, tymczasowy ludzki sprite, walkę, zadania, łupy, handel, kowala, ekwipunek, minimapę i wybór postaci. Testowy przycisk **Zmiana rasy** nadal działa; flaga `TEST_RACE_SWITCH_ENABLED` w `src/game/features.ts` nadal pozwala go wyłączyć.
- Zasoby i grafiki bez zmian, bez nowych usług i bez generowania GPU. Gra nadal jest lokalnym fundamentem PvE.

## Wykonane sprawdzenia

| Sprawdzenie                                    | Rzeczywisty wynik                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest, całość                                 | **80/80 PASS**, 13 plików, w tym czas życia, zamykanie, pauza, wznowienie karty, powtarzane zdarzenia i błędy storage                                                                             |
| Pełny zestaw Playwright po poprawkach bazowych | **25/25 PASS**, 7 min 35 s, bez pominiętych testów i bez ponowień; [wyniki JSON](qa/overlay-audit/full-suite-results.json)                                                                        |
| Regresja PvE w rzeczywistej przeglądarce       | Aira → rynek → powrót/nagroda; Ren → trzy dziki; umiejętności zużywające KI, XP, łupy, ekwipunek, kupiec, kowal, odświeżenie zapisu                                                               |
| Cztery światy                                  | Start każdej rasy, lokalni NPC/cele, oddzielne zapisy, ruch, kolizje, kamera, minimapa, przełączanie i zgodność starego v1                                                                        |
| Mobile i HUD                                   | 360×800, 390×844, 414×896, 852×393, 640×480; rzeczywiste zdarzenia dotykowe joysticka, dialogi i układ. Dodatkowo desktop 1280×900 i PvE 1920×1080.                                               |
| Cykl komunikatów                               | Brak trwałego banera na starcie; rzeczywiste wygaśnięcie po 5 s; ręczne zamknięcie; brak powrotu w kolejnych snapshotach i po dialogu; wyłączenie i zachowanie preferencji po reload/zmianie rasy |
| Awaria zapisu                                  | Izolowany kontekst symuluje `QuotaExceededError`; ostrzeżenie działa mimo wyłączonych komunikatów, można je zwinąć, wskaźnik i pełny opis pozostają                                               |
| Śmierć/odrodzenie                              | Izolowany poprawny zapis 1 HP, rzeczywista walka powoduje śmierć; brak podwójnego banera; faktyczne odrodzenie, 120 HP i działający ruch                                                          |
| Loader i grafiki ras                           | Oryginalne ilustracje, szczegóły, rzeczywisty wstrzymany request zasobu i błąd zasobu → retry; brak regresji                                                                                      |
| HP/KI                                          | Osobne pola przy niskich, średnich i maksymalnych wartościach oraz różnych skalach UI                                                                                                             |
| TypeScript                                     | Pełny `npx tsc --noEmit` aplikacji oraz konfiguracja e2e: PASS                                                                                                                                    |
| Produkcyjny build                              | `npm run build`: PASS; istniejące ostrzeżenia dużego chunku Phaser / narzędzi budowania                                                                                                           |
| ESLint                                         | 0 błędów; 7 istniejących ostrzeżeń komponentów shadcn o Fast Refresh                                                                                                                              |

Po pełnych 25 testach dodatkowy pomiar rzeczywistego panelu przeciwnika potwierdził nakładanie 13 px na wąskich ekranach. Odstęp zwiększono i dodano osobny test regresyjny sześciu rozdzielczości. Końcowa weryfikacja na zbudowanym kodzie: **8/8 PASS**, 2 min 30 s, bez ponowień i pominięć — pięć układów, awaria zapisu, odrodzenie oraz dodatkowy test sześciu breakpointów podczas namierzania rzeczywistego przeciwnika. [Wyniki JSON](qa/overlay-audit/final-overlay-results.json), [telefon z panelem celu i komunikatem](qa/overlay-audit/combat-390.png). TypeScript aplikacji/e2e, 80 testów jednostkowych, ESLint i produkcyjny build wykonane ponownie: PASS (te same 7 istniejących ostrzeżeń ESLint).

Osobny rzeczywisty test **WebGL / SwiftShader** (640×480): uruchomienie, poprawna mapa/NPC, ilustracje i zapis po odświeżeniu na wszystkich czterech kontynentach; zadanie Kaeny od przyjęcia do 40 XP i odbioru nagrody. Weryfikacja nagłówków Phaser potwierdziła WebGL przy każdym uruchomieniu, bez błędów konsoli/zasobów. [Wyniki WebGL](qa/overlay-audit/webgl-results.json). Ostatnia korekta CSS odstępu panelu celu dodatkowo sprawdzona opisanym testem sześciu breakpointów w Canvas.

## Zrzuty

- Przed: [telefon — trwała podpowiedź](qa/overlay-audit/before-390.png), [ta sama podpowiedź nad dialogiem](qa/overlay-audit/before-dialogue-390.png), [desktop](qa/overlay-audit/before-1280.png).
- Po: [czysty telefon](qa/overlay-audit/clean-390.png), [czysty desktop](qa/overlay-audit/clean-1280.png), [komunikat przy HUD](qa/overlay-audit/message-390.png), [komunikat w dialogu](qa/overlay-audit/dialogue-390.png), [ustawienia](qa/overlay-audit/settings-390.png), [poziomo](qa/overlay-audit/clean-852.png).
- Stany awaryjne: [zapis — pełny komunikat w ustawieniach](qa/overlay-audit/save-warning.png), [odrodzenie](qa/overlay-audit/death.png).

## Powtórzenie kontroli lokalnej

```sh
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.e2e.json
npm run test
npm run lint
npm run build
npm run build:playtest
npm run test:e2e
```

Playwright używa rzeczywistego `Index` i adaptera Phaser w Chromium/Canvas. Osobny test WebGL powyżej ma własny, węższy zakres. Pełny zestaw zawiera obecnie 26 przypadków: wykonano pełne 25 przed ostatnią korektą odstępu CSS, następnie 8 obejmujących wszystkie zmienione przypadki i nową regresję panelu celu. Nie deklarujemy drugiego pełnego przebiegu 26/26.

## Ograniczenia

Testy mobile to emulacja dotyku i viewportów w Chromium, bez fizycznych telefonów, Safari/iOS i pomiarów FPS na docelowym sprzęcie. Testy powtarzalnej zmiany postaci mierzą usunięcie listenerów aplikacji; nie są pełnym profilem pamięci całego Phaser. Zależność Phaser posiada własny listener widoczności dokumentu; nie modyfikowano dostawcy. Symulacja braku miejsca i zapis 1 HP dotyczą wyłącznie izolowanych danych QA. Żaden istniejący zapis użytkownika nie był modyfikowany.

## Commity i publikacja

- Kod i testy: `1598e3e5ebb3d49fb87f57b98fca68ce13875afd` — `fix(game): expire guidance and keep gameplay overlays clear`.
- Raport i lokalne dowody QA: `f9298e9fa71d15e1eb2545e8bfab56d70440c54e`. Gałąź scalona fast-forward do `main`, bez przepisywania historii; Lovable potwierdził synchronizację tego SHA przed publikacją.
- **OPUBLIKOWANO i zweryfikowano** https://kilegends.pl/ oraz https://pixel-playground-launch.lovable.app/ — HTTP 200 i meta `ki-build=stage3.2-clear-gameplay-r1`, 2026-10-20 12:31:54 UTC. [Dowód wersji](qa/overlay-audit/published-build.json).
- Lovable deployment: `d41bdd00-438e-4d60-9693-1f5adfcea7c9`.
- **Rzeczywista kontrola produkcji w Chromium: PASS**. Cztery pełne ścieżki lokalnych zadań eksploracji (Kaena, Aira, Sora, LYRA-7), prawidłowe światy/nazwy, pełne oryginalne ilustracje, nawigacja do celu, powrót, nagroda 40 XP i zachowanie postępu po odświeżeniu osobnych zapisów. Na 390×844 dodatkowo: rzeczywiste zniknięcie komunikatu po 5 s, ręczne zamknięcie, wyłączenie komunikatów/etykiet, odświeżenie zachowujące ustawienia i testowy przycisk Zmiana rasy. Brak błędów konsoli, wyjątków i błędów zasobów. [Wyniki produkcji](qa/overlay-audit/production-results.json).
- Zrzuty produkcji: [telefon bez nakładek](qa/overlay-audit/production-clean-390.png), [krótki komunikat](qa/overlay-audit/production-message-390.png), [ustawienia](qa/overlay-audit/production-settings-390.png), [Verdantia](qa/overlay-audit/production-verdant.png), [Aetheria](qa/overlay-audit/production-aether.png), [Nexus-9](qa/overlay-audit/production-nexus.png), [Pyra](qa/overlay-audit/production-pyra.png).
- Końcowe uzupełnienie raportu i dowodów produkcji nie zmienia opublikowanego kodu gry.
