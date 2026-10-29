# KI Legends — druga dostawa VFX, selekcja grafik (29.10.2026)

**Status:** audyt koncepcyjny i kwalifikacja do obróbki; **NIEZAIMPORTOWANE do runtime**. Poprzednia selekcja: [GEMINI-VFX-SELEKCJA.md](GEMINI-VFX-SELEKCJA.md).

## Źródło i stan faktyczny

Właściciel przesłał sześć obrazów JPG jako plansze wygenerowane w Gemini: `11442.jpg` (Planetarni), `11443.jpg` (Mędrcy), `11444.jpg` i `11445.jpg` (Androidzi), `11446.jpg` i `11439.jpg` (Legendy, ta ostatnia plansza była też pokazywana wcześniej). Każdy ma **1536 × 1030 pikseli, RGB/JPG, bez alpha**. Pięć plansz: siatka **3 kolumny × 2 wiersze**; `11439.jpg`: **2 kolumny × 3 wiersze**. W każdym 6 pól, łącznie 36.

Zgodność z nazwami i mechaniką porównana z `src/game/kit/nodes.generated.ts` i kodem `src/game/kit/{planetary,sage,android,legend}.ts`.

**Wynik:** **25 KANDYDAT**, **9 REZERWA**, **2 POPRAWKA**. Decyzje dotyczą **pól graficznych**, nie liczby umiejętności ani wdrożonych animacji.

W zestawieniu z wcześniejszą dostawą Gemini pokryto koncepcyjnie **44/44 zdolności bazowych, aktywnych, ultimate i form KI (11 na rasę)**. Nie znaczy to, że jest 44 kompletów produkcyjnych: brakuje animacji/faz, certyfikowanego wycięcia i walidacji na urządzeniach. Nie uwzględnia dodatkowych pasywów jako samodzielnych VFX ani ataków potworów.

## Pełna ocena 36 pól

| Źródło | Rasa | Faktyczny skill | Element | Decyzja | Uwaga |
|---|---|---|---|---|---|
| P07/P01 | planetary | `A9` Burza Wędrowca | 5 smug cięć | **KANDYDAT** | Należy zachować pięć trafień |
| P07/P02 | planetary | `A9` Burza Wędrowca | finał serii | **KANDYDAT** | Końcowy efekt uderzenia |
| P07/P03 | planetary | `B4` Kruszący Stąp | pionowy impakt | **REZERWA** | Prawie ucięta górna krawędź |
| P07/P04 | planetary | `B4` Kruszący Stąp | uderzenie w ziemię | **KANDYDAT** | Uderzenie i ogłuszenie |
| P07/P05 | planetary | `T` Forma Rezonansu Świata | zapłon transformacji | **KANDYDAT** | Ruch cząsteczek ku górze |
| P07/P06 | planetary | `T` Forma Rezonansu Świata | aura stała | **KANDYDAT** | Pusty środek dla sprite postaci |
| S08/P01 | sage | `B4` Krąg Spowolnienia | pole spowolnienia | **KANDYDAT** | Płaski krąg kontroli |
| S08/P02 | sage | `B9` Świątynia Światła | sanktuarium | **KANDYDAT** | Strefa defensywna, nie atak |
| S08/P03 | sage | `C1` Skupienie KI | napływ energii | **KANDYDAT** | Regeneracja KI |
| S08/P04 | sage | `C9` Pełnia Skupienia | rozbłysk buffa | **KANDYDAT** | Wzmocnienie zdolności |
| S08/P05 | sage | `T` Forma Oświecenia | zapłon lotosu | **REZERWA** | Oczyścić sylwetkę ze środka |
| S08/P06 | sage | `T` Forma Oświecenia | aura stała | **REZERWA** | Oczyścić sylwetkę ze środka |
| A09/P01 | android | `R` Strzał Impulsowy | pocisk | **KANDYDAT** | Podstawowy strzał |
| A09/P02 | android | `A1` Namierzanie | celownik | **KANDYDAT** | Celownik nad celem |
| A09/P03 | android | `A4` Salwa Precyzyjna | potrójny strzał | **KANDYDAT** | Trzy strzały |
| A09/P04 | android | `A9` Protokół Egzekucji | superstrzał | **REZERWA** | Ucięty lewy koniec |
| A09/P05 | android | `B1` Tarcza Plazmowa | osłona | **KANDYDAT** | Do QA maski półprzezroczystości |
| A09/P06 | android | `B4` Impuls Odpychający | fala | **KANDYDAT** | Efekt odrzucenia |
| A10/P01 | android | `B9` Fortyfikacja | pancerz | **KANDYDAT** | Pancerz bez postaci |
| A10/P02 | android | `C1` Wyładowanie Rdzenia | wiązka | **REZERWA** | Ucięta na prawej krawędzi |
| A10/P03 | android | `C4` Rozładowanie Awaryjne | chłodzenie | **KANDYDAT** | Bez eksplozji |
| A10/P04 | android | `C9` Przeciążenie Systemu | przeciążenie | **POPRAWKA** | Nieczytelne sztuczne napisy |
| A10/P05 | android | `C9` Przeciążenie Systemu | wygaszenie | **REZERWA** | Słaba widoczność w skali gry |
| A10/P06 | android | `T` Forma Pełnego Rdzenia | aura | **POPRAWKA** | Sylwetka i fałszywe napisy UI |
| L11/P01 | legend | `R` Uderzenie Żaru | cios | **KANDYDAT** | Używać jako cios wręcz |
| L11/P02 | legend | `B4` Płomienny Szał | aura bojowa | **KANDYDAT** | Ciemne tło w środku do usunięcia |
| L11/P03 | legend | `B9` Ostatni Płomień | symbol serca | **REZERWA** | Pasuje bardziej na ikonę niż VFX |
| L11/P04 | legend | `B9` Ostatni Płomień | ratunek | **KANDYDAT** | Jednorazowy efekt ratunku |
| L11/P05 | legend | `C4` Eksplozja Żaru | wybuch | **KANDYDAT** | Rzeczywista umiejętność AoE |
| L11/P06 | legend | `T` Forma Płomiennego Legendy | aura | **REZERWA** | Ciemna sylwetka do usunięcia |
| L12/P01 | legend | `A1` Ogniste Cięcie | potrójne cięcie | **KANDYDAT** | Do animacji serii |
| L12/P02 | legend | `A4` Szarża Płomienia | smuga | **REZERWA** | Przypomina pocisk zamiast doskoku |
| L12/P03 | legend | `A9` Tysiąc Cięć | sieć cięć | **KANDYDAT** | Seria ośmiu ciosów |
| L12/P04 | legend | `B1` Przełamanie | rozbicie tarczy | **KANDYDAT** | Efekt trafienia |
| L12/P05 | legend | `C1` Wybuch Ki | fala AoE | **KANDYDAT** | Szeroki impuls wokół postaci |
| L12/P06 | legend | `C9` Ognisty Kataklizm | pionowy pożar | **KANDYDAT** | Obszarowy ogień i podpalenie |

[Wersja CSV do przetwarzania automatycznego](qa/gemini-vfx-dostawa-2.csv).

## Problemy do poprawienia

1. `A09/P04` — superstrzał Androida (`A9`) wchodzi w lewą krawędź: zachować cały pocisk lub przygotować jego bezszwowy odcinek zamiast przypadkowego ucięcia.
2. `A10/P02` — wyładowanie rdzenia (`C1`) dociera do krawędzi prawej; dla wiązki dopuszczalne tylko świadomie zdefiniowane łączenie/animowanie.
3. `A10/P04` i `A10/P06` — generator wprowadził fałszywe drobne napisy/UI, niedopuszczalne do wdrożenia na mapie.
4. `S08/P05`, `S08/P06`, `L11/P06` — siluetki w środkach aur: zachować pusty, przezroczysty obszar pod animowaną postać. `L11/P02` wymaga kontroli pustego środka.
5. `L11/P03` — płonące serce wizualnie działa jako ikona ratunku, nie jako światowy VFX; nie renderować automatycznie na mapie.
6. `L12/P02` — smuga Szarży Płomienia zbyt podobna do pocisku; powiązać ze śladem ruchu postaci lub poprawić.

## Wymagania techniczne

- **Dostawa surowa:** zawsze zachować oryginalny JPG i hash SHA-256; źródła nie są bezpośrednio pobrane z publicznej strony Gemini.
- **Obróbka:** wycinać kafle zgodnie z faktycznym podziałem 3×2 lub 2×3; rozmiar komórki to około 512×515 lub 768×343, a nie deklarowane dokładnie 512×512, bo plansze mają 1030 px wysokości.
- **Alpha:** wejściowe JPEG nie mają przezroczystości. Konwersja z szarego tła to estymacja, konieczne QA krawędzi, miękkich poświat, ciemnych konturów, częściowo przezroczystych tarcz i pozostałości tła. Nie traktować szachownicy nadrukowanej w JPG jako kanału alpha.
- **Animacje:** obecne obrazy są fazami/ilustracjami, nie sekwencjami 8 klatek. Dla pocisków wymagany kierunek i hit VFX, dla doskoków pozycja/ruch postaci, dla aura T osobna warstwa z odpowiednimi czasami działania. Liczba klatek i FPS musi zostać zweryfikowana według rzeczywistego kontraktu importera i rendererów.
- **Integracja:** mapować `race + skill_id + event/phase`, nie tworzyć nowych zdolności, nie zmieniać balansowania, hitboxów, cooldownów ani wartości.
- **Licencje:** rejestr `docs/LICENCJE.md`; potwierdzić oryginalne pliki, konto i warunki użycia Gemini, możliwość komercyjnej dystrybucji oraz licencje referencji wejściowych.
- **QA:** testy na mapie w prawdziwym Phaser WebGL (Android/mobile + desktop), oględziny skali, FPS, poprawności i culling/zasobów. Do tego momentu wszystkie mają status NIEZATWIERDZONE dla produkcji.

## Dostępność plików

**Na GitHubie znajdują się ten raport i rejestr CSV — nie sześć surowych obrazów ani 25 wyciętych testowych PNG.** Paczkę QA przygotowano w roboczym środowisku z przesłanych przez użytkownika plików (`ki-legends-vfx-dostawa-2-qa.zip`), zawiera niezmienione oryginały, 25 eksperymentalnych PNG z kanałem alpha oraz manifest. Nie wskazywać tego ZIP jako wdrożonego asset packu ani jako pliku dostępnego w GitHubie.

Wszystkie elementy na tym etapie są tylko do art review. Produkcja, hosting i mechanika pozostają bez zmian.
