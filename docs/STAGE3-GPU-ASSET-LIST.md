# Kolejka produkcji grafiki — Ki Legends

> Aktualny kontrakt produkcyjny: [GPU_ASSET_PIPELINE.md](GPU_ASSET_PIPELINE.md), `art/pipeline/gpu-production-targets.json` i `gpu-pack.schema.json`. Poniższa historyczna kolejka etapu 3 określa kierunek artystyczny. Parametry 288 klatek, przyszła skala i planowany adapter nie są już specyfikacją dostawy: wdrożony pipeline wymaga **416 klatek 128²**, zachowuje skalę 96 jednostek i ma działający adapter animacji.

Status: lista i kontrakt, bez uruchamiania GPU, modeli AI ani płatnych usług.
Maszynowa specyfikacja: `art/pipeline/stage3-render-contract.json`.
Wzorce artystyczne: PDF koncepcyjny z 20.10.2026, wszystkie ilustracje obejrzane.
Cztery oryginalne ilustracje JPEG wyeksportowano z PDF bez cięcia na animacje;
są użyte wyłącznie w kartach pochodzenia. Nie są teksturami postaci ani terenu.

## P0 — pierwszy kanoniczny bohater

1. Wybrać jeden kanon twarzy, stroju i sylwetki (referencje tego samego pochodzenia różnią się detalami).
2. Model + UV + materiały + rig; źródło `.blend`, pliki tekstur i licencje na trwałym dysku.
3. Jedna kamera ortograficzna, docelowo elewacja 60°, skierowana na południową fasadę;
   dopasować próbką do istniejącej wioski, potem zablokować kamerę i światło dla wszystkich paczek.
4. Idle 8, walk 8, attack 8, hit 4, death 8 klatek × 8 kierunków = 288 klatek na bohatera.
5. Próbka 512×512 RGBA, stopy `(0.5,0.95)`, brak aury/cienia kontaktowego w klatce ciała.
6. Sprawdzić 96 obecnych jednostek oraz przyszłe 128/144/160 na rzeczywistym ekranie 360×800.
   Nie zmieniać hitboxu dla dopasowania wielkości obrazu.
7. Atlas 2048² maksymalnie na stronę, PNG lub bezstratny WebP + Phaser JSON hash.
   Nazwy `hero/walk/down-right/03`; zachować metadane sourceSize / spriteSourceSize przy trimowaniu.
8. Dopiero po akceptacji wzorca wykonać Planetarnych, Mędrców, Androidy i Legendy.
   Aura, błysk trafienia i efekty KI to osobne paczki. Brak obecnie unikalnego balansu ras.

Adapter już obsługuje wybór 4/8 kierunków i arkusz/atlas dla chodzenia (`characterVisual.ts`).
Docelowe klipy idle/attack/hit/death wymagają później podpięcia do zdarzeń prezentacji;
obecnie idle to pojedyncza klatka, walka i śmierć mają dotychczasowe efekty proceduralne.
Nie przedstawiać tego jako gotowych ośmiokierunkowych animacji wszystkich stanów.

## P1 — świat, wymiana istniejących identyfikatorów

| Paczka    | Obiekty / identyfikatory                                                                | Materiały                                                                                             |
| --------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Aetheria  | `sanctum`, `archive`, `ki-tree`, `ki-source`, `cloud-peak`, `garden`                    | `aether-ground`, `aether-path`, `aether-plaza`; kamień tarasów, mgła, woda źródeł, świetliste rośliny |
| Nexus-9   | `lab`, `reactor`, `terminal`, `crystal`, `pylon`, `tech-garden`                         | `nexus-ground`, `nexus-path`, `nexus-plaza`; płyty metalu, kanały energii, kryształ i szkło           |
| Pyra      | `fortress`, `war-shrine`, `statue`, `basalt`, `volcano`, `clan-banner`                  | `pyra-ground`, `pyra-path`, `pyra-plaza`; bazalt, czerwony piaskowiec, lawa, popiół                   |
| Verdantia | Zachować zaakceptowaną paczkę `anime-forest-v1`; warianty dopiero po zgodnym porównaniu | Istniejący atlas terenu i obiektów pozostaje obowiązujący                                             |

18 nowych obiektów, po 2–3 warianty niezmieniające kamery; 9 bazowych kafli + przejścia i krawędzie.
Źródłowe obiekty do 1024² RGBA; rozmiar świata i footprint zgodnie z region JSON.
Podłoże 256² → 64 jednostki, seamless, padding 4 px, extrude 2 px. Wszystkie przeszkody
muszą zachować zgodność widocznego kształtu z obszarem kolizji i testami przejść.
Paczki atlasowe zamiast pełnych obrazów mapy. Nie scalać osady w jedną płaską ilustrację.

## P2 — mieszkańcy, fauna i interfejs

- 16 lokalnych NPC: Aira/Ren/Mio/Taro, Sora/Ishin/Mei/Enso, LYRA-7/AXON/MIRA-2/HEF-4,
  Kaena/Rokan/Yumi/Goro. Osobne stroje i portrety; obecnie wspólny ludzki sprite z tintem.
- Dziki: leśny, z mglistych ogrodów, perymetru, popielnych kanionów — model bazowy + warianty,
  8 kierunków, idle/walk/attack/hit/death. Obecnie wszystkie wykorzystują dotychczasową grafikę dzika.
- Ikony punktów zainteresowania, wejść, energii, klanów i lokalnego handlu.
- Efekty oddzielnie: skupienie KI, obwody rdzenia, żar, żywa energia; nałożone na istniejące reguły.

## Przekazanie z Blendera

Najpierw scena wzorcowa i render kontrolny, potem wielokierunkowy turntable/akcje tego samego rigu.
Nie generować oddzielnych, niespójnych ilustracji jako kolejnych klatek. Eksportować pliki na trwały dysk,
spakować atlas, podpiąć centralny manifest `src/game/world/assets.ts` i uruchomić regresję.
W nowych regionach zamienić klucze SVG na atlasowe obrazy w adapterze zasobów/renderowania;
nie przepisywać `GameSession`, zadań, zapisu, kolizji ani układów map.
Do testów: `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e`.
