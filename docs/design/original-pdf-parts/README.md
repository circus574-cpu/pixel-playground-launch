# Ki Legends — oryginalny PDF właściciela, ARCHIWUM BINARNE

Oryginalny dokument: `Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf` (12 stron, 20.10.2026, **5 343 097 bajtów**).

**SHA-256 oryginału: `be58d9df4fb49d19b11a66d47a1a3fc3fbbf5acc9c11ddc5cf76213f6be15734`**.

Plik został podzielony BEZSTRATNIE na 12 binarnych części `part-01.bin` ... `part-12.bin` z powodu ograniczenia wielkości jednego transferu. Są to bajty **oryginalnego PDF**, a nie rekonstrukcja graficzna, streszczenie ani osobne wydruki stron. Nie usuwać, nie formatować i nie konwertować fragmentów.

Odtworzenie w katalogu repo:

```sh
python3 docs/design/original-pdf-parts/restore.py
```

Skrypt łączy części we właściwej kolejności, oblicza SHA-256 i zgłasza błąd przy rozbieżności; nie nadpisuje niezgodnego istniejącego PDF. Wynik: `docs/design/Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf` (plik generowany lokalnie, nie należy odrębnie commitować bez potrzeby).

## Kanon ilustracji
- **Strona 4:** Planetarni, dwie referencje sylwetka/perspektywa.
- **Strona 5:** Mędrcy.
- **Strona 6:** Androidy.
- **Strona 7:** Legendy.
- **Strona 8:** dodatkowe referencje skali i świata.

To autorytatywne obrazy referencyjne; przypadkowe grafiki z internetu nie są zamiennikiem. Historia użycia musi respektować prawa do obrazów, niezależnie od tego archiwum.

## Weryfikacja przesyłu
Fragmenty utworzono bez zmiany bajtów, ich Git blob SHA-1 obliczono lokalnie i zestawiono z SHA zwróconymi przez API GitHub. Cały łańcuch należy dodatkowo zweryfikować po pobraniu repo przez uruchomienie skryptu powyżej.
