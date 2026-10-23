# Pochodzenie 40 potworów (22.10.2026)

**Status:** wygenerowane na GPU właściciela, zapisane w repo jako paczki dostawy (`deliveries/enemy-<id>-1.0.0/`), **niezainstalowane w grze**, **prawa do materiałów referencyjnych i pochodnych obrazów nierozstrzygnięte** (zob. `docs/ASSET-LICENSE-REGISTER.md`) — nie publikować przed decyzją właściciela.

## Źródła wymagań
- Bestiariusz właściciela: `docs/design/BESTIARY-OWNER-2026-10-22.html` (obrazy w nim tylko poglądowe; projekty wizualne własne).
- Wybór projektów: `selection-v1.json` (ziarno kandydata na potwora), `roster.json` (archetyp, klasa rozmiaru, opis).

## Potok (skrypty w `scripts/gpu/`)
1. `enemy_roster.py` – 40 projektów (archetyp: blob/quad/crawl/slither/plant/turret/fly/hover/stomp; rozmiar S/M/L → skala 0,62/0,80/0,98).
2. `gen_enemy_candidates.py` – kandydaci, Animagine XL 3.1 (28 kroków, CFG 6, 1024², 3 ziarna).
3. `gen_enemy_views.py` – 5 widoków (dół, dół-prawo, prawo, góra-prawo, góra) przez IP-Adapter SDXL (h94), wybór ziarna podobieństwem CLIP; kierunki lewe to lustra.
4. `matte_creatures.py` – wycięcie rembg `isnet-anime`, punkt stóp (256; 409,6), latające +36 px.
5. `animate_creature.py` – procedularna deformacja siatki wg archetypu: 7 stanów × 8 kierunków = 416 klatek 512×512, margines bezpieczny 22 px, kontrola przekroczeń (`report.json`: 0 przekroczeń we wszystkich 40).
6. `pack_enemies.py` – `assets:pack` (profil `enemy`, 128 px, 2 strony atlasu) + klucze `<świat>.enemy.<slug>` w `actorBindings`.

## Dowody
- Sumy SHA-256 manifestów: `deliveries/ENEMIES-SHA256.txt`; mapa kluczy: `bindings.json`.
- Walidacja: `npm run assets:import -- <manifest>` bez instalacji (`installed:false`).
- Klatki 512 px, widoki i mastery są na network volume pod `/workspace/ki-legends-gpu/` (zob. `environment-20261022/RESTORE.md`).

## Znane wady
- Widoki malowane niezależnie → różnice proporcji między kierunkami; kierunki lewe są lustrami prawych.
- Animacja to deformacja pojedynczego obrazu (bez ruchu kończyn); wilk i krab pilota zmniejszone do 72% i 78% dla zmieszczenia ruchu, najmniejsze zmniejszenie w partii: 61%.
