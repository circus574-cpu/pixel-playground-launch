# Ki Legends — cztery rasy i etapy (tekstowy indeks dokumentu właściciela)

**Źródło:** „KI LEGENDS — Anime fantasy MMORPG 2D | Wizja gry, cztery rasy i plan produkcji”, dokument koncepcyjny v1.0 z 20.10.2026, 12 stron. Ten indeks jest pomocą dla agentów; **nie zastępuje oryginalnego PDF ani zawartych w nim ilustracji**. Oryginalny PDF wraz z ilustracjami jest bezstratnie zapisany w [12 częściach binarnych](../design/original-pdf-parts/README.md) na gałęzi PR #16; skrypt odtwarza `docs/design/Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf`. Wymaga scalenia do `main`.

## Rasy i referencje (strony 3–7)
- **Planetarni** — odkrywcy i wojownicy związani z żywą energią świata; zieleń, ochra, bursztyn, skóra, tkaniny, mobilność. Docelowo dynamika ruchu i walka wręcz. Krajobraz: żyzne doliny, skalne ścieżki, lasy i osady.
- **Mędrcy** — strażnicy dawnej wiedzy, dyscyplina i kontrola KI; biel, szmaragd, złoto, długie szaty, rytualna biżuteria, zdobione kostury i świetliste kręgi. Docelowo dystans, bariery i wsparcie. Krajobraz: świątynie, tarasowe ogrody, biblioteki i sanktuaria.
- **Androidy** — technologia i syntetyczna energia; srebro, czerń/grafit, intensywny elektryczny błękit, pancerze, rdzenie, cyfrowe aureole. Docelowo precyzyjne uderzenia, osłony i impulsy. Krajobraz: metaliczne fortece, laboratoria i technologiczne miasta.
- **Legendy** — wojownicy niezwykłej siły; czerń, karmazyn, stal, ogień, szarfy i płomienna aura. Docelowo ofensywna walka wręcz. Krajobraz: ruiny, areny i skaliste wyżyny.

**Uwaga:** przykładowe umiejętności, fabuła ras i krainy są w dokumencie *propozycjami kreatywnymi do zatwierdzenia*, nie dowodem zaimplementowanych mechanik (str. 12). Nazw krain „Verdantia”, „Aetheria”, „Nexus-9”, „Pyra” nie potwierdza ten PDF; nie traktuj ich jako potwierdzonej treści tego źródła.

## Reguły wizualne (strony 3, 8, 11–12)
- Wspólna perspektywa, proporcje, skala i czytelność na telefonie; ciało i aura/efekty KI rozdzielone.
- Jeden kanoniczny wariant sylwetki, twarzy i stroju na rasę; pozostałe referencje pomocnicze.
- Spójny model i rig; ruch w ośmiu kierunkach, idle, bieg, atak, trafienie, śmierć; przezroczyste klatki pakowane do atlasów.
- Sprawdź płynność, brak migotania stroju, kolizje/hitboxy i wydajność mobilną.
- W dokumencie rekomendowano jako pierwszy model referencyjny **Legendę** (str. 11); faktyczny późniejszy stan produkcji Planetarnych należy weryfikować z GitHub, nie nadpisywać historycznej rekomendacji.

## Etapy (strony 9–10)
1. Fundament techniczny i prototyp.
2. Grywalna pętla PvE.
2.1. Stabilizacja.
3. Wzorcowa postać animowana.
4. Cztery kompletne rasy.
5. Cztery krainy startowe.
6. Kontynenty i eksploracja.
7. Prawdziwe MMORPG (wymaga osobnej architektury sieciowej).
8. Beta i rozwój.

Dokument jest koncepcyjny, z datą 20.10.2026; jego historyczne statusy etapów nie są aktualnym raportem wdrożenia. Faktyczny stan sprawdzaj w commitach, PR-ach, testach i grze.

## Zasada zarządzania GPU — późniejsza decyzja właściciela (21.10.2026)
Właściciel wyłącznie decyduje o uruchomieniu, wyłączeniu, restarcie, usunięciu i konfiguracji instancji GPU. Codex nie podejmuje tych działań samodzielnie. Ta decyzja jest późniejsza niż oryginalny PDF; **nie zmienia treści historycznego oryginału**.

## Aneksy właściciela z 22.10.2026 — rozwój i przeciwnicy

Uzupełniają oryginalny kanon graficzny i fabularny dwie nowe koncepcje:
- [Statystyki i drzewka wszystkich czterech ras, poziomy 1–20](CHARACTER-PROGRESSION-LEVELS-1-20.md) — 11 stron, 116 węzłów, wartości i wymagania.
- [Bestiariusz poziomy 1–20](BESTIARY-LEVELS-1-20.md) — 2 strony, 20 przeciwników i reguły propozycji balansu.

Pełne oryginalne PDF-y: [manifest SHA-256](source-annexes/MANIFEST.json). Nowe aneksy **nie zastępują kanonicznych ilustracji**, nie stanowią dowodu, że mechaniki są obecnie zaimplementowane i nie upoważniają do przemianowania dotychczasowych krain Verdantia/Aetheria/Nexus-9/Pyra.
