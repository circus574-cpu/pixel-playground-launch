"""Enemy designs for the 40 bestiary monsters: our own concept per creature (the icons in the owner's bestiary are schematic only).
  python3 enemy_roster.py   -> writes art/production/enemies/roster.json (bestiary stats + design + animation archetype + size)
archetype: blob | quad | crawl | slither | plant | turret | fly | hover | stomp      size: S 0.62 | M 0.8 | L 0.98 (share of the 84x84 actor canvas)
"""
import json, re, sys, unicodedata
from pathlib import Path

PAL = {"verdant": "lush forest greens, warm amber and brown, natural", "aether": "cream white, emerald green and gold, serene magical",
       "nexus": "silver, graphite and electric blue light, high tech", "pyra": "black basalt, crimson red and glowing orange ember, volcanic"}
D = {  # name -> (archetype, size, design)
 "Mchowy Szlamak": ("blob", "S", "a round moss covered slime with translucent green jelly body, tufts of moss and tiny mushrooms on top, two big glossy dull eyes"),
 "Cierniowy Wilk": ("quad", "M", "a lean dark green wolf with long sharp thorns along its spine and tail, vines wrapped around its legs, glowing amber eyes, snarling"),
 "Liściak Skrytobójca": ("crawl", "M", "a mantis like leaf assassin insect with two leaf shaped blade arms, leaf shaped wings, camouflage green body, sharp glowing eyes"),
 "Korzeniowy Pełzacz": ("slither", "L", "a long writhing serpent made of twisted brown tree roots, a bulb shaped head with small yellow flowers and a lamprey mouth"),
 "Grzybowy Zarodnik": ("plant", "M", "a giant red capped mushroom creature with white spots, a small angry face on its stalk, clouds of spores puffing from the cap, short root legs"),
 "Bursztynowa Osa": ("fly", "M", "a big amber colored wasp with translucent veined wings and a glowing amber stinger, black and gold stripes, flying"),
 "Skalny Jeleń": ("quad", "L", "a powerful stag with stone plated hide, grey rock antlers, moss on its back and glowing green eyes"),
 "Leśny Pająk": ("crawl", "M", "a forest spider with dark green carapace marked with leaf patterns, long spindly legs and silk strands"),
 "Puchacz Pyłowy": ("fly", "M", "a large horned owl with dusty grey brown feathers, glowing yellow eyes, wings spread and trailing a cloud of dust"),
 "Strażnik Ruin": ("stomp", "L", "an ancient overgrown stone golem with moss and vines on its shoulders, glowing green runes and a heavy stone hammer fist"),
 "Świetlik Pieczęci": ("hover", "S", "a floating glowing orb spirit of gold and emerald light with a small ring of runes orbiting it"),
 "Pergaminowy Strażnik": ("stomp", "M", "a tall robed guardian made of folded parchment scrolls with glowing gold runes written on it and a blank mask for a face"),
 "Kryształowy Motyl": ("fly", "M", "a large butterfly with prism crystal wings that refract emerald and pale gold light, delicate crystal antennae"),
 "Szmaragdowy Wąż": ("slither", "M", "an emerald green serpent with gold markings, a jewel on its forehead and a raised hooded neck"),
 "Duch Bibliotekarza": ("hover", "M", "a translucent ghost of an old librarian with round spectacles, a floating robe trailing into wisps, pale blue white glow, holding a book"),
 "Złoty Skarabeusz": ("crawl", "S", "a golden scarab beetle with an ornate engraved shell set with emerald gems and strong front legs"),
 "Lew Świątyni": ("quad", "L", "a living cream marble temple lion statue with gold ornament, emerald eyes and a carved mane"),
 "Oko Wiedzy": ("hover", "M", "a floating giant eye in an ornate golden frame with a ring of glowing runes and an emerald iris"),
 "Marionetka Rytuału": ("stomp", "M", "a ritual puppet with wooden jointed limbs held by glowing strings, a white mask with gold lines and an ornate ceremonial robe"),
 "Mgielny Żuraw": ("fly", "L", "a tall crane made of mist and pale feathers with a long beak and long legs, fog trailing from its wings"),
 "Dron Zwiadowca": ("hover", "S", "a small scout drone with a silver body, a single blue glowing lens and two spinning rotors"),
 "Pełzacz Serwisowy": ("crawl", "S", "a six legged maintenance crawler robot with small repair arms, a welding tool and orange service lights on a silver body"),
 "Skaner Gąsienicowy": ("stomp", "L", "a slow tracked scanner robot with a big lens turret on caterpillar treads and a sensor dish"),
 "Pająk Spawalniczy": ("crawl", "M", "a robotic welding spider with a plasma torch on its abdomen, sparks, and graphite legs with blue joints"),
 "Wieżyczka Autonomiczna": ("turret", "M", "a stationary autonomous turret on a wide base with twin rotating gun barrels and a blue targeting light"),
 "Rój Nanitów": ("blob", "M", "a shifting blob of liquid silver nanites with glowing blue particles swirling inside it"),
 "Pies Łowca": ("quad", "M", "a sleek robotic hunting hound with silver armor plates, a blue visor for eyes and hydraulic legs"),
 "Strażnik Rdzenia": ("stomp", "L", "a heavy armored android guard with a glowing energy core on its chest and a plasma shield on its arm"),
 "Latarnia Plazmowa": ("hover", "M", "a floating lantern drone with a glowing plasma core inside a cage of rings and crackling sparks"),
 "Kruk Danych": ("fly", "M", "a robotic raven with wing feathers made of glowing blue data lines and a silver beak"),
 "Węgielek": ("blob", "S", "a small rolling lump of glowing coal with ember cracks, sparks and a cute angry face"),
 "Ognista Salamandra": ("slither", "M", "a fire salamander with red orange skin, flames licking along its back and a long tail"),
 "Popielny Wilk": ("quad", "M", "a grey ash wolf with cinder like fur crumbling into ash and glowing ember eyes"),
 "Skalny Berserker": ("stomp", "L", "a hulking rock berserker with basalt armor plates, crimson war paint and huge stone fists"),
 "Magmowy Krab": ("crawl", "M", "a giant lava crab with an obsidian shell split by glowing magma cracks and two huge claws"),
 "Żarowy Nietoperz": ("fly", "M", "a fiery bat with ember glowing wing membranes, orange veins and sharp fangs"),
 "Golem Ruin": ("stomp", "L", "an obsidian rubble golem with glowing lava seams, jagged shoulders and a stone head"),
 "Płomień-Duch": ("hover", "M", "a floating flame spirit with a skull like face, swirling fire and two burning eyes"),
 "Byk Areny": ("quad", "L", "an arena bull with armored horns, a black and crimson plate harness, steam from its nostrils"),
 "Skorpion Obsydianowy": ("crawl", "M", "an obsidian scorpion with glass black shell, big pincers and a glowing red stinger on a curled tail"),
}
SIZE = {"S": 0.62, "M": 0.8, "L": 0.98}
def slug(s): return re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", s.replace("ł", "l").replace("Ł", "L")).encode("ascii", "ignore").decode().lower()).strip("-")
if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]; src = json.loads((root / "art/production/enemies/bestiary-owner.json").read_text())["entries"]
    out = []
    for e in src:
        if e["kind"] != "mob": continue
        arch, size, design = D[e["name"]]
        out.append({"id": "%s-%s" % (e["world"], slug(e["name"])), "world": e["world"], "name": e["name"], "level": e["level"], "stats": e["stats"], "speed": e["speed"], "range": e["range"], "agro": e["agro"],
                    "behavior": e["behavior"], "skills": e["skills"], "weakness": e["weakness"], "loot": e["loot"], "archetype": arch, "size": size, "scale": SIZE[size], "design": design, "palette": PAL[e["world"]]})
    assert len(out) == 40 and len({o["id"] for o in out}) == 40
    (root / "art/production/enemies/roster.json").write_text(json.dumps({"note": "40 bestiary monsters with our own designs; bosses are not part of this batch", "monsters": out}, indent=1, ensure_ascii=False) + "\n"); print(len(out), "potworów:", sorted({o["archetype"] for o in out}))
