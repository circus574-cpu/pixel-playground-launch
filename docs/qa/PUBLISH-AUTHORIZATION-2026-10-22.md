# KI Legends — zgoda właściciela na scalenie i publikację; stan audytowy 2026-10-22

**Źródło decyzji:** bezpośrednie polecenie właściciela z 2026-10-22 w rozmowie projektowej: „Ok. Zapisz w raporcie że udzielam zgody na publikację i scalają do main I publikuj grę. Trzeba sprawdzić na androidzie ją”.

## Decyzja właściciela
Właściciel **UDZIELA ZGODY** na scalenie przygotowanych zmian do gałęzi `main` i na publikację gry Ki Legends; jednocześnie wymaga sprawdzenia działania gry na Androidzie. Niniejszy dokument jest rejestrem zgody, **nie jest dowodem wykonanego scalenia, wdrożenia, testów ani zatwierdzeniem poprawności licencji**. Zgoda na publikację nie zastępuje technicznych warunków bezpieczeństwa i dowodów, których wymaga proces audytu.

## Zakres kontroli przed publikacją
- PR #15: `d9599277924e6c3f1ce99b43e2a1b20654b42c22` — 2 przebiegi GitHub Actions zakończone `success`: `39675441735` i `39675441724`, obejmujące testy regresji.
- PR #16: `fe7a9bdd8c2bb431c4ea04a534a8ededf92f0cad` — dokumentacja kanoniczna; brak przypisanych przebiegów CI na dokładnym SHA.
- Gałąź `docs/asset-license-register-20261022`: `5f0bb9dd0a5665147c116cebf40ee90ce7ac962a` — 729 pozycji zasobów; 731 zależności; 40 nierozstrzygniętych tekstów/zakresów licencji; brak CI na dokładnym SHA.
- **Prawa do pierwotnych ilustracji ras pozostają NIEZWERYFIKOWANE**: brak sprawdzonego łańcucha uprawnień do 10 unikalnych ilustracji PDF i ich pochodnych.
- Odbiór wizualny i test rzeczywistego urządzenia Android/sprzętowego WebGL wymagają odrębnych dowodów. Emulacja przeglądarki mobilnej nie stanowi testu na fizycznym Androidzie.

## Status działań
Zgoda właściciela: **OTRZYMANA I ZAPISANA**.
Scalenie do `main`: **DO POTWIERDZENIA W HISTORII GIT**.
Publikacja nowego commita: **DO POTWIERDZENIA W SYSTEMIE WDROŻEŃ**.
Test na fizycznym Androidzie: **NIEZWERYFIKOWANE**.
Decyzja audytowa: **nie wydawać opinii TECHNICZNIE GOTOWE bez dowodów wymaganych kontroli**.

Nie stwierdzono w tym dokumencie wykonania żadnej operacji, której nie potwierdza zewnętrzne źródło.
