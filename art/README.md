# Pixel Playground — art production

## Concept pack v0.2 (2026-10-19)

Four themed regions: **forest**, **volcano**, **ice**, **desert**. The locally generated package `game_art_pack_v02.zip` contains 25 cropped PNG references: six sheets for each region (location, tileset, race, enemies, buildings, props) and one UI sheet.

**Production status:** concept references only. They are not engine-ready sprites, transparent assets, seamless tilemaps or animation sheets. The visual angle is partially isometric; the approved target is strict top-down 2D. Production work must correct this.

## Planned directory structure

- `art/concepts/` — overall style boards
- `art/worlds/{forest,volcano,ice,desert}/` — locations and terrain
- `art/races/` — playable races and units
- `art/enemies/` — enemy characters and bosses
- `art/buildings/` — building assets
- `art/props/` — environmental objects
- `art/ui/` — game HUD and interface
- `art/exports/` — engine-ready output (future)

## Next production criteria

1. Lock strict top-down camera and consistent pixel scale.
2. Create clean, isolated sprite assets on transparent backgrounds.
3. Verify seamless terrain tile edges and matching light direction.
4. Create unit directions, poses and animation frames.
5. Test visual consistency at actual gameplay zoom before implementing an engine.

**Binary assets have not been uploaded to GitHub yet.** This commit records the asset catalog and constraints only.
