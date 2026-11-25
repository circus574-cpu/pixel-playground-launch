# GameMaster KI Legends

Model zbudowano z referencji przekazanej przez właściciela w rozmowie. Wersja w pozie A posłużyła do rigowania. Model ma 19 019 trójkątów, szkielet z 24 kośćmi i osadzoną teksturę 2K. Oddzielna mapa emisji wzmacnia błękit oczu. Wysokość 4,5 m wynika z mnożnika 2× względem źródłowego riga 2,25 m.

## Edycja i podgląd

- [GameMaster.blend](blender/GameMaster.blend) otwiera się w Blenderze 4.3.2. Tekstury są pakowane w pliku. Osiem akcji można wybierać w **Dope Sheet → Action Editor** na obiekcie **GameMaster Rig**.
- [Projekt Godot](godot/project.godot) otwiera się w Godocie 4.6.3. Uruchom F6 na scenie `showcase.tscn` albo F5 dla projektu. Panel pozwala wybierać wszystkie klipy oraz przełączać zbliżenie oczu.
- [GLB](godot/assets/KI-Legends-GameMaster.glb) zawiera model, rig, materiał emisji i wszystkie klipy. Plik [animacje.json](godot/assets/animacje.json) podaje czasy, skalę i właściwości pętli.
- [Nagranie](preview/gamemaster-animacje.mp4), [lewitacja](preview/lewitacja.png) i [zbliżenie oczu](preview/oczy.png) pochodzą z uruchomionego Godota. [Pomiary wysokości w klipach](preview/kontrola-ruchu.json) zapisują czas oraz najniższy i najwyższy punkt siatki po deformacji szkieletem.
- [Źródła](sources) zawierają referencję w pozie A, siatkę, rig, chód, ataki i lot po retargetowaniu oraz pierwotny ruch lotu w FBX. Mapa emisji jest też dostępna jako oddzielny PNG.

| Klip | Czas | Ruch |
| --- | ---: | --- |
| `walk` | 1,21 s | Pętla wolniejszego chodu z wyrównanym kontaktem stóp |
| `heavy_strike` | 3,47 s | Ciężkie uderzenie obiema pięściami |
| `ki_blast` | 2,67 s | Zebranie energii i wypuszczenie KI gestem |
| `flight` | 6,97 s | Płynne wznoszenie, wyprostowane szybowanie i lądowanie |
| `takeoff` | 2,63 s | Wznoszenie z podłoża |
| `hover` | 3,20 s | Pętla lewitacji z uniesioną głową, otwartymi dłońmi i stopami ok. 2,1 m nad podłożem |
| `glide` | 2,35 s | Pętla spokojnego szybowania na stałej wysokości |
| `land` | 1,95 s | Zejście do poziomu gruntu |

## Odtworzenie plików

Uruchom `python3 -m pip install -r tools/requirements.txt`, a potem `bash tools/build.sh` w katalogu dostawy. Skrypty korzystają z zapisanych plików źródłowych. Wynik pojawia się w `build/`. Polecenie `blender --background --python tools/build_blender.py -- build/KI-Legends-GameMaster.glb build/GameMaster.blend` odtwarza edytowalny plik Blendera.

## Dalsza integracja

Dostawa zawiera niezależny projekt Godot i animacje postaci. W grze trzeba podłączyć stan lotu do sterowania i kolizji, związać momenty trafień z klipami, dodać efekty KI oraz sprawdzić skalę względem postaci w rzeczywistej kamerze Androida. Rig jest szkieletem ciała. Osobne kości włosów i materiału byłyby potrzebne do niezależnej animacji tych elementów. Prawa do komercyjnego użycia obrazu referencyjnego wymagają weryfikacji przed publikacją.

## Pochodzenie i koszt Meshy

| Etap | Identyfikator zadania | Zużycie |
| --- | --- | ---: |
| Image to 3D, Meshy T2.5 i N1 | `01a2140c-6b94-739e-8340-0d25aaff6efd` | 15 |
| Rig | `01a2140e-71ab-709e-921c-69bf3722af75` | 5 |
| Text to Motion, lot | `01a2140d-850d-7020-b976-cb7d61d135c9` | 10 |
| Lot przeniesiony na rig postaci | `01a21410-1613-73ee-85a8-6461816590aa` | 3 |
| Dwa ataki z katalogu, 214 i 125 | `01a21410-1396-74bf-89b5-71d002b33448` | 6 |

Razem 39 z limitu 200 kredytów. Chód pochodzi z paczki riga. Wyprostowanie tułowia w locie, korekty podłoża, pętle i emisję oczu wykonano lokalnie.
