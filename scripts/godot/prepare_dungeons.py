#!/usr/bin/env python3
"""Cave entrances of the Superior v2 world and the dungeon-kit art -> ports/godot-pyra/data/dungeons.json, assets/dungeon/.

The browser world reserves 22 entrances (4 per continent, 1 per island) with the status "entrance reserved; interior
integration pending" and ships the `dungeon-kit` art pack (12 props). The interiors do not exist there, so the Godot port builds
them (labyrinth, key, gate, chests, guards) from this data at run time with `scripts/dungeon.gd`.
"""
import json
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "ports" / "godot-pyra"
WORLDS = REPO / "public" / "game" / "worlds" / "superior-v2"
LANDS = ["pyra", "verdant", "aether", "nexus"] + [f"island-{i}" for i in range(1, 7)]

# Names and short stories of the 22 entrances (authored for the port, in the tone of docs/FABULA-I-EKWIPUNEK.md: the Silence is the bill
# for the previous rescue). Transit tunnels connect two continents; "chambers" are caves of two floors; the labyrinth is the great maze.
NAMES = {
    "v2-transit-3-pyra": {"name": "Tunel Zgaszonego Żaru", "blurb": "Pradawny przekop pod wulkanicznym szlakiem. Kowale mówią, że prowadzi na drugą stronę świata, do metropolii maszyn."},
    "v2-transit-3-nexus": {"name": "Przekop Pierwszego Ognia", "blurb": "Serwisowy tunel pod Magistralą Meridian. Czujniki zapisały w nim ślad ognia, którego nie rozpalił nikt z mieszkańców."},
    "v2-transit-4-pyra": {"name": "Zachodnia Grań Ciszy", "blurb": "Szlak ratowników wykuty w skale. Na drugim końcu czekają zielone doliny Verdantii."},
    "v2-transit-4-verdant": {"name": "Korzenna Droga do Popiołu", "blurb": "Korzenie wrosły w stary tunel. Mówi się, że same wybrały, dokąd go poprowadzić."},
    "v2-transit-1-verdant": {"name": "Zielony Przesmyk Pamięci", "blurb": "Tunel, którym podobno przeprowadzono pierwsze archiwa z Aetherii do puszczy."},
    "v2-transit-1-aether": {"name": "Przejście Odwróconego Tonu", "blurb": "Pieczęcie na wejściu brzmią fałszywie. Za nimi leży droga pod lasami Verdantii."},
    "v2-transit-2-aether": {"name": "Spirala Świetlistych Źródeł", "blurb": "Woda ze źródeł Aetherii spływa tu aż do kanałów Nexusa."},
    "v2-transit-2-nexus": {"name": "Kanał Nieautoryzowanych", "blurb": "Przejście jednostek, które procedura ratunkowa uznała za zbędne. Prowadzi do ogrodów Aetherii."},
    "v2-pyra-chambers-pyra": {"name": "Komory Rozbitych Kowadeł", "blurb": "Opuszczona kuźnia klanu, który przegrał wojnę o arenę. Ściany pamiętają każdy cios."},
    "v2-verdant-chambers-verdant": {"name": "Komory Ukrytej Powodzi", "blurb": "Doliny, które zalano po cichu. W komorach wciąż stoją stoły nakryte do kolacji."},
    "v2-aether-chambers-aether": {"name": "Komory Zatartych Imion", "blurb": "Archiwum, z którego Rada usunęła nazwiska ofiar. Puste ramki wiszą w rzędach."},
    "v2-nexus-chambers-nexus": {"name": "Komory Zbędnych Jednostek", "blurb": "Magazyn urządzeń wyłączonych podczas ewakuacji. Niektóre jeszcze nasłuchują."},
    "v2-pyra-labyrinth-pyra": {"name": "Wielki Labirynt Popiołu", "blurb": "Trzy piętra korytarzy, które rosną, gdy nikt nie patrzy. Na dnie podobno strzeże ich ten, kto nie dotrzymał rozkazu."},
    "v2-verdant-labyrinth-verdant": {"name": "Wielki Labirynt Korzeni", "blurb": "Żywy splot tuneli pod puszczą. Wchodzący słyszą własny oddech z opóźnieniem siedmiu uderzeń serca."},
    "v2-aether-labyrinth-aether": {"name": "Wielki Labirynt Odbić", "blurb": "Lustra w korytarzach pokazują imiona, których nie ma w kronikach. Na dnie czeka strażnik pamięci."},
    "v2-nexus-labyrinth-nexus": {"name": "Wielki Labirynt Procedur", "blurb": "Sieć tuneli zbudowana przez system, który nie przewidział błędu. Każdy zakręt to kolejna reguła."},
    "v2-island-1-chambers-island-1": {"name": "Jaskinia Pierwszego Echa", "blurb": "Wyspa Pierwszego Echa: spotkanie czterech kultur zaczęło się właśnie tu, w ciemności, od jednego dźwięku."},
    "v2-island-2-chambers-island-2": {"name": "Komora Złamanej Pieczęci", "blurb": "Dwie wersje tej samej historii. Jedna jest wykuta w ścianie, druga w kronice."},
    "v2-island-3-chambers-island-3": {"name": "Loch Odwróconej Latarki", "blurb": "Tu Veyr testował posłuszeństwo. Światło w lochu pada od dołu."},
    "v2-island-4-chambers-island-4": {"name": "Grota Czterech Cum", "blurb": "Neutralny port i jego sekret: magazyn, z którego ewakuowano wszystkich, którzy zdążyli."},
    "v2-island-5-chambers-island-5": {"name": "Pieczara Milczącego Nieba", "blurb": "Uszkodzone przekaźniki wyją tu bezgłośnie. Zapasowa trasa wiedzie przez ich cień."},
    "v2-island-6-chambers-island-6": {"name": "Czeluść Ostatniego Tonu", "blurb": "Wejście do Jądra Chóru. Nikt nie wrócił, żeby powiedzieć, co usłyszał jako ostatnie."},
}


def main() -> None:
    lands = {}
    for land in LANDS:
        world = json.loads((WORLDS / land / "world.json").read_text())
        lands[land] = [
            {
                "id": d["id"],
                "instanceId": d["instanceId"],
                "kind": d["kind"],
                "x": d["overworldEntrance"]["x"],
                "y": d["overworldEntrance"]["y"],
                **NAMES.get(d["id"], {"name": "Jaskinia", "blurb": ""}),
            }
            for d in world["dungeons"]
        ]
    # the same tunnel instance is entered from two lands: each entrance knows the other end
    by_instance: dict[str, list[tuple[str, dict]]] = {}
    for land, entries in lands.items():
        for entry in entries:
            by_instance.setdefault(entry["instanceId"], []).append((land, entry))
    for ends in by_instance.values():
        if len(ends) == 2 and ends[0][0] != ends[1][0]:
            (la, ea), (lb, eb) = sorted(ends, key=lambda e: e[0])
            ea["partnerLand"], ea["partnerId"], ea["side"] = lb, eb["id"], "a"
            eb["partnerLand"], eb["partnerId"], eb["side"] = la, ea["id"], "b"
    pack_dir = next((REPO / "public" / "game" / "assets" / "gpu" / "dungeon-kit").glob("*/pack.json")).parent
    out = ROOT / "assets" / "dungeon"
    out.mkdir(parents=True, exist_ok=True)
    art = []
    for f in sorted(pack_dir.glob("dungeon-kit-*.webp")):
        name = f.stem.removeprefix("dungeon-kit-")
        shutil.copyfile(f, out / f"{name}.webp")
        art.append(name)
    (ROOT / "data" / "dungeons.json").write_text(json.dumps({"lands": lands, "art": art}, ensure_ascii=False, indent=1))
    print(json.dumps({"entrances": sum(len(v) for v in lands.values()), "art": art}))


if __name__ == "__main__":
    main()
