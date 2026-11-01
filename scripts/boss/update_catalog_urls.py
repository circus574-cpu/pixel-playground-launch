with open('src/game/bosses/catalog.ts', 'r', encoding='utf-8') as f:
    text = f.read()

boss_ids = ['ygdrasha', 'thorgar', 'arcykaplan-pustki', 'aurelith', 'arbiter-zero', 'hydra-rdzen', 'kharzul', 'pyrrhax']

for b_id in boss_ids:
    target = f'id: "{b_id}",'
    replacement = f'id: "{b_id}",\n    animWebpUrl: "/game/bosses/{b_id}_idle.webp",\n    animGifUrl: "/game/bosses/{b_id}_idle.gif",\n    spriteSheetUrl: "/game/bosses/{b_id}_spritesheet.png",'
    if target in text and f'animWebpUrl: "/game/bosses/{b_id}_idle.webp"' not in text:
        text = text.replace(target, replacement, 1)

with open('src/game/bosses/catalog.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated catalog.ts successfully with boss animation asset URLs!")
