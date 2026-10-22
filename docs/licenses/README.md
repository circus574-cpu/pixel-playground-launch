# Dowody audytu licencji — 22.10.2026

Punkty wejścia: [grafiki i modele](../ASSET-LICENSE-REGISTER.md),
[zależności i notices](../DEPENDENCY-LICENSE-REGISTER.md).
Baza zakresu: `d9599277924e6c3f1ce99b43e2a1b20654b42c22`, nie automatycznie `main`.

## Pliki

- `asset-inventory.json` / `.csv`: pełne rekordy 729 zasobów, 704 śledzone pliki;
  przy każdym jawny rodzaj identyfikacji (bieżące bajty / LFS / deklaracja / historyczny raport).
- `audit-summary.json`: liczniki i hash lockfile.
- `evidence/pdf-images.json`: hash oryginalnego PDF, 11 wystąpień / 10 unikalnych JPEG,
  strony, obiekty i zgodność z czterema referencjami w repo.
- `evidence/pdf-fonts.json`: dane copyright/licencji odczytane z osadzonych fontów;
  `PDF-FONT-NOTICES.txt`: odczytane warunki do zachowania przy odpowiedniej redystrybucji.
- `evidence/source-receipts.json`: źródłowe publiczne URL, wyniki HTTP, hashe i rozmiary;
  7/7 plików/licencji MakeHuman zweryfikowano względem przypiętego manifestu.
- `evidence/terms-*`: pełne snapshoty aktualnych warunków OpenAI/Lovable i oficjalne
  teksty GNU. Nie stanowią dowodu zawarcia historycznej umowy ani zgody na cudze inputy.
- `dependencies/register.json`: każda ścieżka lockfile, SRI, hash archiwum,
  odczytane metadane, legal files i README/versions wybranych natywnych paczek.
- `dependencies/supplemental.json`: uzupełniające immutable źródła lub jawny brak;
  licencja skryptów budujących libvips nie jest licencją jego natywnego payloadu.
- `dependencies/texts/*.txt`: dokładne bajty zebranych legal files / dowodów,
  deduplikowane po SHA-256. Rozszerzenie `.txt` nie zmienia oryginalnych bajtów.
- `THIRD-PARTY-NOTICES.txt`: konserwatywna kompilacja zebranych legal texts;
  nie jest certyfikatem zakończenia obowiązków licencyjnych ani opublikowaną częścią gry.

## Odtwarzanie

Uruchamiać z katalogu repo na wskazanej bazie; przy nowszej bazie trzeba ponownie
ustalić zakres i datę audytu, zamiast przypisywać mu stare wyniki. Skrypty nie
instalują paczek, nie wykonują ich kodu, nie używają GPU i nie wdrażają aplikacji.
Wymagania: Python 3, Poppler `pdfimages`, PyMuPDF i fontTools (analiza fontów).
Narzędzia analizy są poza lockfile runtime gry i nie zostały do niego dodane.

```sh
python scripts/licenses/collect_dependencies.py
python scripts/licenses/collect_supplemental.py
python scripts/licenses/collect_source_evidence.py
python scripts/licenses/collect_assets.py
python scripts/licenses/render_registers.py
python scripts/licenses/verify_registers.py
```

Pierwszy krok używa cache archiwów `/tmp/ki-license-tarballs` (można wskazać
`KI_LICENSE_ARCHIVE_CACHE`) lub cache npm, zawsze porównując SRI; w przeciwnym razie
pobiera dokładny `resolved`. Nie zachowujemy tarballi/programów w Git, tylko hashe,
metadane i materiały licencyjne. Brak publicznego legal text pozostaje widoczną luką.
Skrypt uzupełnienia odnotowuje błąd sieci; można ponowić zebranie, lecz nie wolno
zastępować brakującej wersji dowolną licencją `master`.

Walidacja wykonana: pełna zgodność 729 rekordów zasobów i 731 ścieżek lockfile,
hashe materiałów dowodowych, mapowanie PDF, kompletność tabel/CSV i brak zmian
aplikacji, zasobów, lockfile oraz konfiguracji produkcyjnej. Pełny TypeScript
aplikacji/e2e/tools przeszedł. Nie uruchamiano testów przeglądarkowych, ponieważ
zmiany obejmują wyłącznie audyt/dokumentację i jego narzędzia.
