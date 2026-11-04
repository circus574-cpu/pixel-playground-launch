# KI Legends — zasady projektu

**Aktualizacja 04.11.2026.** [Indeks](INDEX.md), [plan](PLAN-I-ZADANIA.md), [architektura](ARCHITEKTURA-I-TESTY.md). Zasady supersedują wcześniejsze checkpointy z 23–29.10 tam, gdzie opisują stary hosting, konta, lokalne PvE albo migrację.

## Tożsamość i kanon

Anime/manga fantasy action RPG 2D w przeglądarce i na telefonie. Cztery rasy: Planetarni/Verdantia, Mędrcy/Aetheria, Androidzi/Nexus-9, Legendy/Pyra. Wykluczone starsze Human/Orc/Dwarf/Elf i średniowieczna/pikselowa stylistyka. Nie kopiować cudzych postaci, map ani zasobów. Jedyny docelowy świat: Superior v2.

## VPS, baza i źródło rozgrywki

Hosting **VPS Aruba / Coolify jest już w użyciu**. Prywatny PostgreSQL na VPS przechowuje konta, role, sesje, postacie, checkpointy i rewizje świata. Usługa Node.js/GameServer obsługuje WebSocket; online PvE jest wykonywane na serwerze, klient wysyła komendy i renderuje odpowiedzi, a brak sesji blokuje dalszą grę. Dane kont i postaci online **nie są utrzymywane jako podstawowe źródło prawdy w starym Supabase**. Pozostają historyczne integracje, kod migracji i prywatne zasoby /test.

To **nie jest deklaracja kompletnego MMO**: obecność innych postaci i AOI nie potwierdza współdzielonych potworów, PvP, party, ekonomii MMO ani pełnych serwerowych instancji. Każde z tych zadań wymaga odrębnego testu i akceptacji. Nie migrować projektów ponownie i nie podnosić starego relay bez audytu.

## Konta, postacie, backup i bezpieczeństwo

Autoryzacja na VPS (`src/server/accounts/`), tokeny, aktywacja e-mail, role administratora/GM i logowanie wymagają działającego prywatnego PostgreSQL. Resend to zewnętrzna bramka e-mail; nie deklarować aktywnego SMTP bez sprawdzenia `/ws/auth/status`, a sekretów nigdy nie publikować. Postacie są przypisane do kont, sesje są wyłączne (lease), zapis rewizjonowany, komendy idempotentne. Po PR #85 checkpointy ticków co około 2 s, a komendy i zamknięcie zapisują od razu; `seq` odróżnia kolejne ramki o tej samej rewizji. Ryzyko niezapisanego stanu przy awarii dokumentować jawnie. Nie usuwać kont, postaci ani kopii bez zgody; backup i restore testować przed migracjami.

Prywatne `/test`: hasło i szyfrowana sesja na serwerze, prywatny bucket, krótkie uprawnienia upload/download, wspólne limity i poprawna walidacja MIME/treści. Teksty renderuj jako tekst, pliki podglądaj lokalnie. Nie wysyłaj prywatnych danych do zewnętrznych usług.

## Zgody, produkcja i autorstwo

Właściciel zatwierdza mechanikę, grafikę, koszty i publikację. Nie scalaj PR, nie zmieniaj infrastruktury, nie uruchamiaj deploymentu ani nie restartuj produkcji bez osobnej zgody. Chronić historię Git (bez force push, przepisywania historii lub nieuzgodnionego usuwania). Wszystkie zmiany i wyniki QA dokumentuj z numerem PR i SHA w [dzienniku zmian](INDEX.md#historia--jeden-dziennik-na-dzień); stan „otwarty PR” nie oznacza wdrożonego runtime.

## GPU — wyłączne prawo właściciela

Tylko właściciel uruchamia, zatrzymuje, restartuje, kasuje, skaluje GPU i zarządza jego rozliczeniami. Agent może pracować na już uruchomionym GPU za zgodą; nie usuwać archiwów, assetów ani modeli. Płatnych modeli AI nie używać bez zgody.

## Mechanika, grafika i postęp

Statystyki ras, grafika, rozwój i bestiariusz mają źródła w materiałach właściciela. Nie edytować ręcznie generowanych `nodes.generated.ts` i `base.generated.ts`; modyfikować źródło oraz generator. Limit poziomu 20 nie obowiązuje; walidacja numeryczna `LEVEL_MAX` nie jest capem gameplay. PR #90 pozostaje pracą niescaloną. Anime-pakiety, fizyka kolizji i gameplay muszą być od siebie oddzielone; 35/40 potworów anime scalone, pozostałe do uzupełnienia.

Odbiór: `npm run typecheck`, `npm run test`, `npm run lint`, `npm run assets:check`, `python3 scripts/docs/check_documentation.py`, `npm run build`; dla gry także Canvas/WebGL, kontrola zasobów, urządzenie fizyczne i — przy zmianach serwera — izolowany PostgreSQL / WebSocket. Zielony test na starym SHA nie zastępuje bieżącej weryfikacji.
