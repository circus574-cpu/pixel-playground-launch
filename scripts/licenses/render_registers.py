#!/usr/bin/env python3
"""Render documentation from audit receipts. Offline; no asset or lockfile mutations."""
import collections, hashlib, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
D=ROOT/'docs'; L=D/'licenses'
def cell(s):return str(s if s is not None else 'nieustalone').replace('|','\\|').replace('\n',' ')
def load(p):return json.loads(p.read_text())
ASSET_INTRO='''# KI Legends — rejestr licencji grafik i modeli

Stan audytu: **22.10.2026**, baza `d9599277924e6c3f1ce99b43e2a1b20654b42c22`
(gałąź integracyjna PR #15, nie deklaracja stanu `main`). Osobna gałąź audytu:
`docs/asset-license-register-20261022`. Nie usunięto ani nie zastąpiono zasobów,
nie zmieniono aplikacji, produkcji, kont, bucketów ani konfiguracji GPU.

## Wniosek i znaczenie dowodów

**Brak podstaw do uznania całej biblioteki grafik za oczyszczoną licencyjnie.**
Najważniejsze nierozstrzygnięcia: oryginalne ilustracje PDF i ich pochodne,
pełne prawa do wyglądu Mędrców/Planetarnych, historia atlasu i grafik Lovable,
oryginały `cover.png`/`test-background.png`, dokładna licencja checkpointu DreamShaper.
Nie jest to twierdzenie o naruszeniu praw; jest to wskazanie brakujących dowodów.

Rozróżniamy: **tożsamość bajtów**, **pochodzenie techniczne**, **tekst licencji**,
**uprawnienie konkretnego podmiotu do konkretnego wykorzystania**. Commit, prompt,
manifest, aprobata wyglądu, upload właściciela, licencja programu oraz etykieta SPDX
nie są zamienne z dowodem praw do obrazu. Nie przypisano automatycznie MIT ani CC0
całemu projektowi. Sam root `package.json` nie ustanawia licencji biblioteki grafik.

Dowód od zewnętrznego wydawcy przypisany do dokładnego pliku/wersji ma większą wagę
niż opis w repo. Zarchiwizowane warunki usług z dnia audytu nie dowodzą, że właśnie
te warunki i to konto obejmowały historyczną generację. Hashe w LFS oznaczają
oczekiwany obiekt: plików binarnych wskazywanych przez pointery nie pobierano w tym
audytowaniu. Nie powtórzono historycznych pomiarów na GPU. Tabela i JSON mówią,
które hashe odczytano teraz, a które są tylko pointerem/raportem/deklaracją.

## 1. PDF i oryginalne referencje

Oryginał `docs/design/Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf`
**jest w tej gałęzi** (5 343 097 B, 12 stron). Starsze zdania w INDEX/AGENTS
„PDF oczekuje na dodanie” nie opisują faktycznej obecności tego pliku.
`pdfimages -j` pozwolił odczytać 11 wystąpień obrazów, **10 unikalnych JPEG**.
Obraz Legendy jest powtórzony na okładce i stronie 7. Wszystkie wystąpienia,
numery stron/obiektów, hashe i powiązania są w
[pdf-images.json](licenses/evidence/pdf-images.json).

Potwierdzono SHA-256 identycznych strumieni JPEG:

| Rasa | Strona PDF | Oryginał w repo | SHA-256 |
| --- | --- | --- | --- |
| Planetarni | 4 | `public/game/assets/stage3/references/planetary.jpg` | `c9153912519f69f16431e1be21e0a955c5a27889f4c90673a5b1a2b7342ce1a4` |
| Mędrcy | 5 | `public/game/assets/stage3/references/sage.jpg` | `a0f3faab56a789e45661e076af18a2b73ed96856090626da33be05151d8de9b4` |
| Androidy | 6 | `public/game/assets/stage3/references/android.jpg` | `86bbfebf312938388aa1d7623d279fab293da2d819422981790e122bc88b766a` |
| Legendy | 7 i okładka 1 | `public/game/assets/stage3/references/legend.jpg` | `e1c9c27298b82250731b8a38eb78024834597b71b8312f52e5e00127797a77ba` |

`origins-v1/*-{480,960,full}.webp` to kadry/resize tych ilustracji (kod:
`scripts/prepare_stage31_art.py`), **nie nowe niezależne generacje**.
Pozostałe sześć oryginalnych ilustracji też pozostaje bez ustalonego autora/licencji.
Zdanie w PDF „dziesięć ilustracji przekazanych przez autora” nie identyfikuje
uprawnionego autora ani nie udziela licencji na komercję/adaptacje.

Potrzebne dla każdego pierwowzoru: nazwisko/pseudonim i kontakt uprawnionego,
oryginał lub stabilny URL z datą, umowa albo tekst licencji przypisany do obrazu,
zakres komercyjnej dystrybucji i opracowań, sublicencji dla gry, obowiązki atrybucji,
ewentualne ograniczenia terytorium/czasu oraz prawa do postaci/znaków osób trzecich.
Jeśli to generacja: zapis sesji, konto/uprawniony użytkownik, warunki z tej daty,
wejściowe referencje i prawa do nich. Nie wystarcza nowe oświadczenie bez dokumentów
źródłowych; powinno wskazywać sprawdzalny łańcuch praw.

PDF zawiera dwa osadzone podzbiory DejaVuSans/DejaVuSans-Bold. Z ich faktycznej
tabeli `name` odczytano pełne warunki Bitstream Vera/Arev i copyrighty;
DejaVu changes są opisane jako public domain. To odrębny, pozytywny dowód licencji
fontów, **nie ilustracji**. Zachować [PDF-FONT-NOTICES.txt](licenses/evidence/PDF-FONT-NOTICES.txt)
przy dystrybucji fontów/PDF; uwzględnić ograniczenia nazw, sprzedaży samych fontów
i reklamowego użycia nazw autorów. Helvetica jest nieosadzona (brak kopii fontu
w pliku); nie wyciągamy z samej nazwy prawa do dystrybucji jej binariów.

## 2. Mędrcy

`painted-design-provenance.json` deklaruje `image_gen`, malowane widoki
referencyjne i deformację siatki w Blender/CUDA. Ten dokument sam nie dowodzi
praw do ilustracji Mędrca. `owner_approved_eight_base_views=true` dotyczy odbioru
wyglądu, a nie udzielenia licencji. Pochodne nie usuwają praw pierwowzoru.

Dwa atlasy runtime są obecne w `public/game/assets/gpu/hero-sage/…`.
Osiem ścieżek `masters-grounded/*.png` z hashami wskazanymi w provenance **nie
istnieje w tej gałęzi**: wpisano je indywidualnie jako `DECLARED_ABSENT`.
Historyczne 416 klatek i sceny z PR #11 nie zostały przeniesione na tę gałąź
w ramach tego audytu; nie deklarujemy inspekcji ich bajtów ani kompletności
zewnętrznego archiwum. Należy zabezpieczyć źródła i przypisać licencje do nich.
MakeHuman i TripoSR są wymienione jako odrzucone piloty; licencja pilota nie jest
licencją finalnej malowanej postaci. Zgoda na rozpoczęcie animacji nie zastępuje
zgody autora pierwowzoru na opracowanie i wykorzystanie komercyjne.

## 3. Planetarni i modele GPU

`planetary-master.json` wskazuje img2img z `origins-v1/planetary-full.webp`,
seed 5741001, workflow ComfyUI i dokładny checkpoint Animagine. Techniczny
łańcuch jest opisany, lecz referencja prowadzi do nadal niewyjaśnionego JPEG z PDF.
Cytat „Jest dobrze startuj…” jest decyzją produkcyjną, nie umową licencyjną.
416 klatek, źródło mastera i `.blend` są identyfikowane pointerami LFS; odróżniono
ich OID od hashy aktualnie odczytanych bajtów. Atlasy runtime są plikami lokalnymi.

**MakeHuman:** odczytano z publicznego upstream dokładny commit
`a8bc2d54ff0ac92e78ff71431b1023eda42bf482` i porównano SHA-256 sześciu plików
bazy oraz `LICENSE.ASSETS.md`: **7/7 zgodne** z manifestem. Licencja CC0-1.0
dotyczy tych danych siatki/rigów/targetów. Nie przenosi się na strój, włosy,
ilustrację wejściową, master, wszystkie outputy ani aplikację MakeHuman.
Dowody: [source-receipts.json](licenses/evidence/source-receipts.json).

**Animagine XL 3.1:** przypięta karta
`cagliostrolab/animagine-xl-3.1@483f0c322568ed13697ed01dd0be07204746d12b`
wskazuje CreativeML Open RAIL++-M i odsyła do licencji bazowego SDXL.
Odczytano kartę oraz pełny tekst wskazanej licencji. Lokalny `MODEL_LICENSE.txt`
różni się od pobranego tekstu białymi znakami; nie deklarujemy identycznego SHA.
Dokument rozróżnia zgodę na używanie modelu, ograniczenia użycia oraz output.
Licencjodawca nie deklaruje praw do wygenerowanego outputu; użytkownik odpowiada
za jego wykorzystanie. To nie jest gwarancja nienaruszania praw osób trzecich.
Przy przekazywaniu wag/derywatów modelu obowiązują m.in. kopia licencji,
zachowanie notices, oznaczenie zmian i przekazanie ograniczeń użycia.
Nie należy automatycznie traktować samego WebP jako redystrybucji wag.
Nie pobierano wielogigabajtowego checkpointu: jego SHA w rejestrze pochodzi
z historycznego raportu, nie bieżącego readbacku.

**DreamShaper XL Turbo 2.1:** raport identyfikuje nazwę, rozmiar i SHA checkpointu,
ale nie ustala przypiętego źródła i licencji tego dokładnego pliku. Status:
`BRAK_LICENCJI_DOKLADNEGO_CHECKPOINTU`. Nie przypisano mu licencji Animagine
ani zgadywanej wersji repo Lykon. Wymagane źródło/wersja i warunki pobrania/wykorzystania.
Brak dowodu, że ten checkpoint wygenerował którąkolwiek konkretną grafikę tutaj.

## 4. Atlas i globus Lovable

Osiem plików `src/assets/planet-map/` rozpatrzono oddzielnie.
`atlas-1920.webp` i `atlas-3840.webp` nie mają załączonego źródłowego dowodu
autorstwa/licencji. `globe-color-*`, `globe-surface-*`, `globe-lights-*` to
pochodne atlasu z `scripts/build_globe_textures.py` i dziedziczą jego status.
`globe-clouds-2048.webp` i `space.jpg` są **opisane w dokumentacji** jako wygenerowane
narzędziem obrazów Lovable; brak logu konkretnej generacji, wejść, modelu i konta.
Autor commita Lovable/bot jest dowodem dodania pliku do Git, nie autorstwa obrazu.

Zachowano publiczne warunki Lovable z dnia audytu. Mówią o własności Customer Data
i AI Output „as between us”, z zastrzeżeniem praw osób trzecich; nie gwarantują
unikalności ani braku cudzych praw. Nie dowodzi to warunków konkretnej historycznej
sesji ani tego, czy plik został wygenerowany, wgrany lub pochodził od osoby trzeciej.
Potrzebne: eksport historii generacji/uploadu, źródła, daty, konto i właściwa
umowa/warunki. Shadery i biblioteka three.js mają osobny status kodu; ich licencja
MIT nie obejmuje automatycznie tekstur planety.

## 5. cover.png i test-background.png

W repo są **tylko deskryptory**, nie binaria tych dwóch obrazów:

| Obraz | Deskryptor | Asset ID | Deklarowany rozmiar | Data metadanych |
| --- | --- | --- | --- | --- |
| `cover.png` | `src/assets/cover.png.asset.json` | `025eb219-7762-413d-996d-135177dfb346` | 2 507 283 B | 2026-10-19T14:50:25Z |
| `test-background.png` | `src/assets/test-background.png.asset.json` | `f594fa76-0e3c-43c4-8313-b7b7ccf85a4c` | 2 425 567 B | 2026-10-19T15:07:35Z |

`r2_key`, URL `/__l5e/assets-v1/…`, nazwa i data określają obiekt magazynu,
nie autora/generator ani licencję. Nie odczytywano prywatnego Storage, nie obchodzono
sesji `/test`, nie wysyłano obrazów do zewnętrznych viewerów. Nie podano zmyślonych
hashy oryginałów. Wymagane: oryginalne pliki, ich SHA-256, źródło/generacja,
umowa lub licencja, prawa do wejściowych referencji oraz dopuszczalne użycie
jako okładki/tła i w marketingu. Oba statusy: `BRAK_DOWODU_PRAW`.

## 6. Inne zasoby i zakres

Włączono archiwalne forest-v3/v1/v2, kandydatów anime, proceduralne SVG,
rig techniczny, favicon oraz zrzuty QA. Pliki archiwalne/preview też mogą być
redystrybuowane przez Git/hosting — brak użycia w aktualnej scenie nie usuwa
obowiązków. Zrzuty QA i kompozycje dziedziczą prawa widocznych grafik.
Prompty i manifesty OpenAI są dowodem opisanego procesu, nie odrębną licencją.
Proceduralne SVG mają odtwarzalny kod; prawo do wkładów/umów autora jest odrębne.
Favicon i dawne koncepcyjne SVG nie mają ustalonego źródła/licencji.

Pełny zakres to pliki śledzone w bazie i jawnie wskazane źródła zewnętrzne.
Nie twierdzimy, że obejmuje niewidoczne pliki prywatnego bucketu, wszystkie
historyczne gałęzie, kompletny dysk GPU ani całą bibliotekę plików właściciela.
Zależności npm, ich vendored notices i natywne biblioteki opisuje
[DEPENDENCY-LICENSE-REGISTER.md](DEPENDENCY-LICENSE-REGISTER.md).

## 7. Dalsze dokumenty wymagane do rozstrzygnięcia

1. Właściciel: zebrać pierwotne źródła i sprawdzalne dokumenty praw dla dziesięciu
   ilustracji PDF oraz dwóch obrazów z deskryptorów; wskazać licencjodawcę i zakres.
2. Osoba prowadząca grafikę: powiązać master/reference/output i sesje generacji
   dla obu bohaterów oraz atlasu/chmur/kosmosu z prawami do wejść i warunkami usługi.
3. Opiekun archiwum GPU: dostarczyć źródła Mędrca i przypiętą licencję dokładnego
   DreamShaper; nie jest to zlecenie uruchomienia/zmiany stanu GPU.
4. Opiekun wydania: zamknąć luki notices zależności, źródeł LGPL/MPL i biblioteki
   natywne; ustalić rzeczywisty skład dystrybuowanych artefaktów. Gotowe teksty
   pomocnicze w docs nie oznaczają ich opublikowania w aplikacji.
5. Dopiero po weryfikacji dowodów zmienić status konkretnego zasobu; nie zamieniać
   wszystkich wierszy na „OK” na podstawie jednego oświadczenia lub licencji narzędzia.

## 8. Pełny rejestr indywidualny

Każdy wiersz zawiera ścieżkę, autora/generator, źródło, licencję, podstawę
komercji, dowody i status. Pełne SHA-256/rozmiary i rodzaj identyfikacji są w
[JSON](licenses/asset-inventory.json) oraz [CSV](licenses/asset-inventory.csv).
Fragmenty `#page=…` i `#embedded-font-xref=…` oznaczają element wewnątrz PDF,
a nie osobny plik w repo. Ścieżki `/workspace/ki-legends-gpu/…` to lokalizacje
historycznie raportowane na GPU, nie w tym środowisku audytu.

<!-- GENERATED-ASSET-TABLE -->
'''
DEP_INTRO='''# KI Legends — rejestr licencji zależności i wymagane notices

Audyt 22.10.2026 na bazie `d9599277924e6c3f1ce99b43e2a1b20654b42c22`.
Źródło zakresu: dokładny `package-lock.json` (lockfileVersion 3), wszystkie
zależności pośrednie, dev, opcjonalne i warianty platform; bez instalowania
ani uruchamiania pobranych paczek. **To rejestr lockfile, nie potwierdzony SBOM
końcowego bundle klienta/serwera/kontenera.** Etykieta `dev` nie dowodzi sama,
że kod nie trafił do dystrybuowanego narzędzia lub obrazu.

## Jak sprawdzono dowody

Każdą archiwalną paczkę pobrano z `resolved` albo odczytano z cache i sprawdzono
jej bajty względem SRI z lockfile. Zgodność metadanych nazwy/wersji sprawdzono
z uwzględnieniem aliasu `h3-v2` → `h3`; nie pomylono go z innym wydaniem.
Zachowano pełne legal files i hashe, nie sam tag `license`. Pole autora w
package.json pozostaje deklaracją wydawcy, nie niezależnym audytem autorstwa.

`SRI_AND_LEGAL_TEXT` oznacza znaleziony tekst w dokładnej paczce,
**nie automatyczne uznanie wszystkich praw za wyjaśnione**. Wewnętrzne notices
mogą nakładać więcej obowiązków niż pojedyncze SPDX w lockfile (np. Lucide/Feather,
Phaser/Matter.js, victory-vendor/D3). `SRI_NO_LEGAL_TEXT` pozostaje widoczne,
nawet gdy zebrano dokument pomocniczy upstream.

Dla braków odczytano metadane konkretnego wydania npm, sprawdzono zgodność
`dist.integrity` i użyto przypiętego `gitHead` z deklarowanego repozytorium.
Dowody uzupełniające mają osobny plik/status. Nie zastąpiono brakującego wydania
licencją z przypadkowego `main/master`, nie logowano się do prywatnych repozytoriów.
Brak publicznego tekstu nie oznacza automatycznie zakazu ani zgody — pozostaje luką.

## Wymagane notices i działania

| Licencja / przypadek | Wymaganie przy odpowiedniej dystrybucji |
| --- | --- |
| MIT, ISC, BSD-2-Clause | Zachować pełny copyright, permission/license i disclaimer; BSD także dla binariów w dokumentacji/innych materiałach. Nie wystarcza napis „MIT”. |
| BSD-3-Clause | Jak BSD-2 oraz nie sugerować poparcia autorów/organizacji. |
| Apache-2.0 | Kopia licencji, zachowanie notices/atrybucji, przekazanie istniejącego NOTICE tam, gdzie dotyczy, oznaczenie zmienionych plików; warunki patentowe. Nie wymyślać NOTICE, którego wydawca nie dostarczył. |
| MPL-2.0 (np. lightningcss i warianty) | Notices i dostępność Source Code Form pokrytych plików przy dystrybucji Executable Form; informacja jak uzyskać źródła. Copyleft dotyczy pokrytych plików, nie automatycznie całego projektu. Ustalić zmiany i faktyczny artefakt. |
| LGPL-3.0-or-later oraz złożone AND w sharp | Teksty GPL/LGPL, copyright i notices, odpowiedni dostęp do Corresponding Source, warunki modyfikacji/relinkowania lub wymiany biblioteki i dozwolonego reverse engineering do debugowania zmian. Sposób spełnienia zależy od dystrybucji/łączenia; sama lista licencji nie wystarcza. |
| Natywne payloady libvips | Własne notices komponentów: m.in. Cairo MPL-1.1, AOM BSD + patent license, FreeType FTL, fontconfig, libpng, libtiff, mozjpeg IJG/zlib/BSD, LGPL biblioteki. To dodatkowy zakres poza SPDX pakietu npm; patrz README/versions z archiwów. |
| CC-BY-4.0 (`caniuse-lite`) | Przy udostępnianiu materiału zachować wskazanego autora/źródło, link/licencję, istniejące notices i oznaczenie zmian. Sam tekst CC bez informacji o materiale/atrybucji nie zamyka obowiązku. Ustalić czy dystrybuowane dane trafiają do artefaktu. |
| Python-2.0 (`argparse`) | Zachować pełne notices i kolejne licencje historyczne dostarczone w paczce; przy pochodnych spełnić wymóg krótkiego opisu zmian, jeżeli ma zastosowanie. |
| BlueOak-1.0.0 | Zachować copyright i tekst licencji albo wskazany w niej dopuszczalny link przy przekazaniu kopii. |
| MIT AND ISC (`victory-vendor`) | Spełnić oba zestawy i zachować notices vendored D3. AND nie oznacza wyboru jednej licencji. |
| `lucide-react` (lock: ISC) | Pełna paczka zawiera też MIT dla części Feather, Cole Bemis; zachować oba teksty i odpowiednie copyrighty. |
| 0BSD, Unlicense | Brak ogólnego wymogu atrybucji jak w MIT; zachować teksty w konserwatywnym pakiecie i sprawdzić pozostałe komponenty. |

Wersje GNU LGPL/GPL oraz notices **konkretnych bundled bibliotek** trzeba powiązać
z dystrybuowanym binarium, nie tylko skopiować ogólną licencję GNU. Dane `versions.json`
są dowodem wersji wymienionych w paczce, nie kompletnym źródłem ani gotowym source offer.
Nie uznano skryptów Apache repo `sharp-libvips` za licencję LGPL jego binariów.

[THIRD-PARTY-NOTICES.txt](licenses/THIRD-PARTY-NOTICES.txt) zawiera konserwatywny
zestaw wszystkich rzeczywiście zebranych tekstów z przypisaniem paczek/źródeł
(zakres szerszy niż klient WWW). To materiał do dołączenia do odpowiedniej dystrybucji,
**nie deklaracja zakończenia compliance**. Nie dodano odnośnika w UI ani niczego
nie opublikowano. Nie rozstrzygnięto ostatecznego SBOM/deployu, pełnego source offer
LGPL/MPL ani niezebranych notices komponentów natywnych. Do uzupełnienia także
upstreamy bez legal text i prawa aplikacji/grafik z osobnego rejestru.

## Dowody i odtwarzanie

- [register.json](licenses/dependencies/register.json): 1 rekord na ścieżkę lockfile,
  adres archiwum, SRI, SHA-256 archiwum, metadane i pliki prawne z hashami.
- [supplemental.json](licenses/dependencies/supplemental.json): źródła uzupełniające,
  immutable gitHead i jawne błędy/braki; zachowano również ostrzeżenie o zakresie libvips.
- `scripts/licenses/collect_dependencies.py`: zebranie paczek bez uruchamiania ich kodu.
- `scripts/licenses/collect_supplemental.py`: uzupełnienie legal text z powiązanego upstream.
- `scripts/licenses/collect_source_evidence.py`, `collect_assets.py`: dowody zasobów.
- `scripts/licenses/render_registers.py`: offline render obu rejestrów i notices.
- Wymagania narzędzi audytu: Python 3, Poppler (`pdfimages`), PyMuPDF i fontTools
  do analizy fontów PDF; nie są nowymi zależnościami runtime gry.

<!-- GENERATED-DEPENDENCY-TABLE -->
'''

def main():
    assets=load(L/'asset-inventory.json');deps=load(L/'dependencies/register.json');supp=load(L/'dependencies/supplemental.json');by={r['path']:r for r in supp}
    rows=assets['assets'];summary=f"\nLiczba wpisów: **{len(rows)}**: {assets['trackedFileCount']} śledzone pliki + 2 deskryptory zewnętrzne + 11 wystąpień ilustracji PDF + 8 zadeklarowanych, nieobecnych masterów Mędrca + 2 checkpointy GPU + 2 fonty PDF.\n\n"
    columns=['path','authorOrGenerator','source','license','commercialBasis','evidence','status']
    table='| Ścieżka | Autor/generator (ustalenie lub deklaracja) | Źródło | Licencja | Podstawa komercyjna | Dowody do sprawdzenia | Status |\n| --- | --- | --- | --- | --- | --- | --- |\n'
    for r in rows:table+='| '+' | '.join(cell(r.get(k)) for k in columns)+' |\n'
    (D/'ASSET-LICENSE-REGISTER.md').write_text(ASSET_INTRO+summary+table+'\nRejestr generowany z `docs/licenses/asset-inventory.json`; statusy nie są zatwierdzeniem publikacji.\n')
    records=deps['records'];counts=collections.Counter(r['lockLicense'] for r in records)
    combined={};gaps=[]
    for r in records:
        evidence=list(r['legalFiles']);s=by.get(r['path'])
        if s and s.get('file'):evidence.append(s)
        for e in evidence:
            key=e['sha256'];combined.setdefault(key,{'file':e['file'],'packages':set(),'sources':set()});combined[key]['packages'].add(r['name']+'@'+r['version']);combined[key]['sources'].add(e.get('archivePath',e.get('sourceUrl','')))
        if not r['legalFiles'] and (not s or s.get('status')!='UPSTREAM_TEXT_AT_REGISTRY_GITHEAD'):gaps.append(r)
    # LGPLv3 incorporates GPLv3: include official full reference texts, while
    # keeping payload copyright/source/relinking gaps explicitly outstanding.
    for receipt in load(L/'evidence/source-receipts.json'):
        if receipt['id'] in ('terms-gnu-lgpl3','terms-gnu-gpl3') and receipt.get('file'):
            combined[receipt['sha256']]={'file':receipt['file'],'packages':{'REFERENCE LICENSE TEXT for LGPL components; source/compliance obligations remain open'},'sources':{receipt['url']}}
    text='KI LEGENDS — THIRD-PARTY NOTICES (AUDIT SUPPLEMENT; NOT A COMPLETE RELEASE COMPLIANCE CERTIFICATE)\n'
    text+='Lockfile SHA-256: '+deps['lockfileSha256']+'\nAudited base: '+assets['auditedBase']+'\n'
    text+='Includes development/optional platforms as a conservative superset. Missing or insufficient legal texts remain for '+str(len(gaps))+' lockfile paths; see DEPENDENCY-LICENSE-REGISTER.md.\n'
    text+='LGPL/MPL source and relinking obligations, native bundled-component notices, and artwork clearances are separate outstanding requirements.\n'
    for key,e in sorted(combined.items()):
        text+='\n'+'='*78+'\nPackages: '+', '.join(sorted(e['packages']))+'\nEvidence: '+'; '.join(sorted(e['sources']))+'\nSHA-256: '+key+'\n'+'='*78+'\n'
        text+=(ROOT/e['file']).read_bytes().decode('utf-8',errors='replace')+'\n'
    (L/'THIRD-PARTY-NOTICES.txt').write_text(text)
    summary=f"\nLockfile SHA-256: `{deps['lockfileSha256']}`. **{len(records)} ścieżek, {len(set((r['name'],r['version']) for r in records))} par nazwa/wersja; wszystkie archiwa zgodne z SRI.**\n\n"
    summary+=f"**{sum(bool(r['legalFiles']) for r in records)}** paczek zawiera wyodrębniony legal text; **{sum(not bool(r['legalFiles']) for r in records)}** nie zawiera samodzielnego pliku prawnego. Uzupełnienie: **{sum(s['status']=='UPSTREAM_TEXT_AT_REGISTRY_GITHEAD' for s in supp)}** powiązanych upstreamów; **{len(gaps)}** ścieżek nadal bez wystarczającego tekstu/zakresu (w tym 10 payloadów libvips).\n\n"
    summary+='| Deklaracja SPDX lockfile | Liczba ścieżek |\n| --- | --- |\n'+''.join(f'| {cell(k)} | {v} |\n' for k,v in sorted(counts.items()))
    summary+='\n## Nierozstrzygnięte legal text / zakres\n\nNie uzupełniono tych pozycji domniemaną zgodą. Warianty platform nie muszą trafiać do każdej dystrybucji; ustalić faktyczny artefakt.\n\n| Ścieżka | Wersja | Licencja deklarowana | Powód |\n| --- | --- | --- | --- |\n'
    for r in gaps:
        s=by.get(r['path'],{});summary+='| '+' | '.join(map(cell,[r['path'],r['version'],r['lockLicense'],s.get('scopeWarning',s.get('error',s.get('status','brak tekstu')))]))+' |\n'
    summary+='\n## Pełny rejestr ścieżek lockfile\n\n| Ścieżka | Wydanie | Licencja deklarowana | Zakres lockfile | Dowód | Uzupełnienie/status |\n| --- | --- | --- | --- | --- | --- |\n'
    for r in records:
        scope=('dev' if r['dev'] else 'runtime według lock')+('; optional' if r['optional'] else '')
        files=r['legalFiles'];evidence=r['status']+(' · [tekst](licenses/dependencies/texts/'+files[0]['sha256']+'.txt)' if files else '')
        s=by.get(r['path'],{});extra=s.get('status','legal files z paczki; sprawdzić zakres')
        if s.get('file'):extra+=' · [tekst]('+s['file'].removeprefix('docs/')+')'
        summary+='| '+' | '.join(map(cell,[r['path'],r['name']+'@'+r['version'],r['lockLicense'],scope,evidence,extra]))+' |\n'
    (D/'DEPENDENCY-LICENSE-REGISTER.md').write_text(DEP_INTRO+summary)
    (L/'audit-summary.json').write_text(json.dumps({'base':assets['auditedBase'],'date':assets['date'],'lockfileSha256':deps['lockfileSha256'],'assetEntries':len(rows),'trackedAssetFiles':assets['trackedFileCount'],'lockPaths':len(records),'allArchivesSriVerified':all(r.get('archiveVerified') for r in records),'archivesWithLegalText':sum(bool(r['legalFiles']) for r in records),'supplementedSourceTexts':sum(s['status']=='UPSTREAM_TEXT_AT_REGISTRY_GITHEAD' for s in supp),'unresolvedLegalTextOrScope':len(gaps),'individualAssetStatuses':dict(collections.Counter(r['status'] for r in rows))},ensure_ascii=False,indent=2)+'\n')
    print((L/'audit-summary.json').read_text())
if __name__=='__main__':main()
