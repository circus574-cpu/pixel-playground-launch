# KI Legends forest assets v1

Generated with the built-in OpenAI ImageGen tool on 2026-10-19. The tool does not expose a model selector or report an exact model version. No API key is shipped with the game. WebP copies preserve transparency and are used by the client.

- `world-v1.webp`: oak, medieval cottage, mossy boulder and wild boar, isolated in a 2×2 atlas. Frame bounds in `src/game/mountGame.ts` account for the actual output layout.
- `hero-walk-v1.webp`: 4×4 human adventurer walk sheet; rows down, left, right, up, four frames per direction.
- `terrain-v1.webp`: grass and dirt textures in left and right halves.

Prompt specifications: production game assets for a top-down fantasy 2D RPG, classic detailed 32-bit pixel art, natural forest palette, consistent overhead three-quarter view; transparent object and character sheets, opaque full-bleed terrain; no labels, text, borders, interface or concept-art layouts. Hero: brown hair, blue tunic, brown belt and boots; same character in all frames. World: lush oak, timber/stone cottage with russet roof, mossy grey rock, brown boar facing right. Terrain: grass left, compact dirt with fine gravel right.

This is a local gameplay prototype. It does not implement multiplayer authority or persistent player state. Click-to-move stops/slides at obstacles; it does not include pathfinding. Directional walking is animated; boars and world objects are static sprites.
