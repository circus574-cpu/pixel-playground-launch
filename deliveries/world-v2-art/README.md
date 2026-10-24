# Grafika świata v2 — dostawa GPU 24.10.2026 (niezainstalowana)

Źródła i surowe wyniki do świata v2 (geometria `f9e765d`). Nie są podłączone do gry.

- `textures/` — 84 tekstury podłoża bez szwów: 4 kontynenty × 7 rodzajów (grass, forest, mountain, wetland, shore, road, sea) × 3 warianty, 1024².
- `objects/` — obiekty do rozsiania (drzewa, krzewy, skały, trzciny, kłody, pnie, grzyby, paprocie) dla 4 kontynentów, wycięte z tłem przezroczystym.
- `cities/` — 4 stolice i 12 miast (3072 × 2048 / 2560).
- `famous-raw/` — 16 sławnych lokacji z questów (po 3 warianty); Verdantia ponownie w `verdant-v2/`.
- `monsters-raw/` — wzorce 40 potworów bestiariusza (po 3 warianty, szare tło, do wycięcia).
- `maps/` — mapa 2D każdego lądu i tekstura globusa (equirectangular 4096 × 2048).
- `scripts/` — generator krajobrazu (`landscape.py`), renderer terenu (`world_render.py`), globus, wycinanie obiektów i skrypty GPU.

Modele: DreamShaper XL Turbo (tekstury, obiekty, potwory), Animagine XL + IP-Adapter (miasta, lokacje), RealESRGAN x4 anime (powiększanie).
