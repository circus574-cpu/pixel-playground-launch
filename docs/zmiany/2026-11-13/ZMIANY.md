# Zmiany 2026-11-13

### 1. Wdrożenie: test przeglądu świata admina przekraczał limit czasu w CI

- Wdrożenie PR #159 (animacje Trybu KI 5B/5C, NPC Myśliwy i Alchemik) zatrzymał na `main` test
  `admin-world-overview` „maps combat objectives…”: przelicza wszystkie cele zadań wszystkich lądów, sam trwa ok. 3,5 s,
  a przy pełnym równoległym zestawie w CI przekroczył domyślne 5 s (ten sam kod przeszedł chwilę wcześniej w PR).
  Ryzyko było zapisane w dzienniku 12.11.2026.
- Poprawka: jawny limit 30 s dla tego jednego testu; jego sprawdzenia bez zmian.
