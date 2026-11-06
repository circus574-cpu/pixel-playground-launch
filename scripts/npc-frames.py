#!/usr/bin/env python3
"""Arkusz klatek NPC → drzewo plików gotowe dla `npm run assets:pack --profile=npc`.

Dlaczego osobne narzędzie, a nie ręczna robota: dostawa od właściciela to arkusz 8x8 z płaskim,
NIEPRZEZROCZYSTYM tłem i postacią dochodzącą na ~8 px do krawędzi komórki. Kontrakt pakowaczki
(`scripts/lib/pack-frames.ts`) wymaga natomiast:

  * ramki dokładnie `GPU_CONTRACT.rawFrame` (512x512), PNG 8-bit z kanałem alfa,
  * 2 px czystej przezroczystej krawędzi NA DOSTARCZANEJ klatce 128x128, czyli PO jej własnym
    downskalu lanczos3 — a ten filtr sięga ~12 px w głąb źródła.

Same te dwa warunki odrzuciły 9 z 64 klatek, więc są tu liczone, nie zakładane.

Użycie:
    python3 scripts/npc-frames.py <arkusz.png> <katalog_wyjsciowy> \
        [--dirs down,down-right,right,up-right,up,up-left,left,down-left] \
        [--walk-only] [--idle <arkusz.png>] [--check]

Uwaga o kolejności rzędów: arkusz właściciela idzie ZGODNIE z ruchem wskazówek zegara
(down → right → up → left), a `DIRECTIONS` w repo jest odwrotne. Przypinamy po NAZWIE,
więc źle podane `--dirs` daje NPC chodzących tyłem — to jedyna decyzja, której skrypt
nie jest w stanie podjąć sam.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RAW_SIDE = 512  # GPU_CONTRACT.rawFrame
DELIVERY_SIDE = 128  # GPU_CONTRACT.deliveryFrame
DOWNSCALE = RAW_SIDE // DELIVERY_SIDE  # 4
# Filtr lanczos3 o skali 4 sięga 3 pikseli wyjściowych = 12 px źródła; dodajemy 2 px przepisu.
BEZPIECZNY_MARGINES = 3 * DOWNSCALE + 2 * DOWNSCALE  # 20 px w źródle 512
ZAPAS = 4  # poduszka na drgania progów koloru
STANY = ("idle", "walk")


def ramki(komorka: np.ndarray, tolerancja: int) -> np.ndarray:
    """Maska tła: tylko piksele osiągalne od brzegu komórki.

    Globalne keyowanie po kolorze zjadłoby ciemny materiał płaszcza, bo jego odcień bywa bliski
    szarości tła. Wypełnianie od krawędzi zostawia zamknięte ciemne obszary wewnątrz postaci.
    """
    d = np.abs(komorka.astype(np.int16) - np.array([70, 70, 70], dtype=np.int16)).sum(axis=2)
    # Kolor tła bierzemy z rogów, jeśli nie jest to #464646 (np. ciemniejsze pole renderu).
    rog = np.median(np.stack([komorka[0, 0], komorka[0, -1], komorka[-1, 0], komorka[-1, -1]]), axis=0)
    if tuple(int(v) for v in rog) != (70, 70, 70):
        d = np.abs(komorka.astype(np.int16) - rog.astype(np.int16)).sum(axis=2)
    blisko = d < tolerancja
    maska = np.zeros_like(blisko, dtype=bool)
    maska[0, :] = blisko[0, :]
    maska[-1, :] = blisko[-1, :]
    maska[:, 0] = blisko[:, 0]
    maska[:, -1] = blisko[:, -1]
    while True:
        nowa = maska.copy()
        nowa[1:, :] |= maska[:-1, :] & blisko[1:, :]
        nowa[:-1, :] |= maska[1:, :] & blisko[:-1, :]
        nowa[:, 1:] |= maska[:, :-1] & blisko[:, 1:]
        nowa[:, :-1] |= maska[:, 1:] & blisko[:, :-1]
        if (nowa == maska).all():
            return nowa
        maska = nowa


def poklatka(arkusz: Image.Image, rzad: int, kol: int, komorka: int) -> Image.Image:
    """Wycina komórkę, keyuje tło i mieści postać w ramce 512 z wymaganym marginesem."""
    pole = np.asarray(arkusz.convert("RGB").crop((kol * komorka, rzad * komorka, (kol + 1) * komorka, (rzad + 1) * komorka)))
    tlo = ramki(pole, tolerancja=40)
    posta = ~tlo
    w, h = np.where(posta.any(axis=1))[0].min(), np.where(posta.any(axis=1))[0].max()
    x0, x1 = np.where(posta.any(axis=0))[0].min(), np.where(posta.any(axis=0))[0].max()

    # Skala: naturalna (512/rozmiar komórki), ale nigdy tak duża, by zabrakło marginesu.
    figur_w = h - w + 1
    figur_x = x1 - x0 + 1
    bazowa = RAW_SIDE / komorka
    potrzebna = (RAW_SIDE - 2 * (BEZPIECZNY_MARGINES + ZAPAS)) / max(figur_w, figur_x)
    skala = min(bazowa, potrzebna)

    figur = pole[w : h + 1, x0 : x1 + 1]
    alfa_fig = (posta[w : h + 1, x0 : x1 + 1] * 255).astype(np.uint8)
    # Miękkie krawędzie: piksel sąsiadujący z tłem dostaje niepełną alfę, bez schodków.
    sasiadzi = np.zeros_like(posta, dtype=np.int8)
    sasiadzi[1:, :] += tlo[:-1, :]
    sasiadzi[:-1, :] += tlo[1:, :]
    sasiadzi[:, 1:] += tlo[:, :-1]
    sasiadzi[:, :-1] += tlo[:, 1:]
    alfa_fig = np.where(posta[w : h + 1, x0 : x1 + 1] & (sasiadzi[w : h + 1, x0 : x1 + 1] > 0), 191, alfa_fig)

    rys = Image.fromarray(np.dstack([figur, alfa_fig]), "RGBA")
    nowy = (round(rys.width * skala), round(rys.height * skala))
    rys = rys.resize(nowy, Image.Resampling.LANCZOS)

    platno = Image.new("RGBA", (RAW_SIDE, RAW_SIDE), (0, 0, 0, 0))
    lewo = (RAW_SIDE - nowy[0]) // 2
    gora = BEZPIECZNY_MARGINES + ZAPAS
    platno.paste(rys, (lewo, gora), rys)
    return platno, gora + nowy[1] - 1  # ramka i dolna krawędź stopy


def sprawdz(pak: dict[str, Image.Image]) -> tuple[int, list[str]]:
    """Reguła pakowaczki na dostarczanej klatce 128: zero nieprzezroczystych pikseli przy brzegu."""
    bledne = []
    for sciezka, obraz in pak.items():
        mala = obraz.resize((DELIVERY_SIDE, DELIVERY_SIDE), Image.Resampling.LANCZOS).convert("RGBA")
        a = np.asarray(mala)[:, :, 3]
        if (a[:2, :] > 0).any() or (a[-2:, :] > 0).any() or (a[:, :2] > 0).any() or (a[:, -2:] > 0).any():
            bledne.append(sciezka)
    return len(bledne), bledne


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("arkusz", type=Path, help="arkusz chodu 8x8 (PNG) albo katalog z plikami rzędów")
    ap.add_argument("wyjscie", type=Path)
    ap.add_argument(
        "--dirs",
        default="down,down-right,right,up-right,up,up-left,left,down-left",
        help="kierunki poszczególnych rzędów, po przecinku, w kolejności od góry",
    )
    ap.add_argument("--idle", type=Path, help="arkusz idle w tym samym formacie (bez flagi: klatka kontaktowa chodu)")
    ap.add_argument("--walk-only", action="store_true", help="użyj tylko chodu; idle = klatka 00 powtórzona")
    ap.add_argument("--tolerancja", type=int, default=40, help="próg odległości koloru od tła")
    args = ap.parse_args()

    kierunki = [k.strip() for k in args.dirs.split(",")]
    if len(kierunki) != 8:
        print(f"--dirs musi podać 8 kierunków, dostałem {len(kierunki)}", file=sys.stderr)
        return 2

    ark = Image.open(args.arkusz)
    komorka = ark.width // 8
    if ark.width % 8 or ark.height != ark.width:
        print(f"oczekiwany kwadratowy arkusz 8x8, dostałem {ark.width}x{ark.height}", file=sys.stderr)
        return 2

    args.wyjscie.mkdir(parents=True, exist_ok=True)
    pak: dict[str, Image.Image] = {}
    stopy = []
    for r, kier in enumerate(kierunki):
        for k in range(8):
            obraz, stopa = poklatka(ark, r, k, komorka)
            sciezka = f"walk/{kier}/{k:02d}.png"
            pak[sciezka] = obraz
            stopy.append(stopa)
            (args.wyjscie / sciezka).parent.mkdir(parents=True, exist_ok=True)
            obraz.save(args.wyjscie / sciezka)

    if args.idle and not args.walk_only:
        idle_ark = Image.open(args.idle)
        for r, kier in enumerate(kierunki):
            for k in range(8):
                obraz, _ = poklatka(idle_ark, r, k, komorka)
                sciezka = f"idle/{kier}/{k:02d}.png"
                pak[sciezka] = obraz
                (args.wyjscie / sciezka).parent.mkdir(parents=True, exist_ok=True)
                obraz.save(args.wyjscie / sciezka)
    else:
        # Profil npc wymaga klipów idle i walk (src/game/assets/schema.ts:76), więc bez idle
        # pakiet nie przejdzie walidacji. Klatka kontaktowa powtórzona = postać stoi nieruchomo.
        for kier in kierunki:
            kontakt = pak[f"walk/{kier}/00.png"]
            for k in range(8):
                sciezka = f"idle/{kier}/{k:02d}.png"
                pak[sciezka] = kontakt
                (args.wyjscie / sciezka).parent.mkdir(parents=True, exist_ok=True)
                kontakt.save(args.wyjscie / sciezka)
        print("IDLE: podstawione z klatki kontaktowej chodu — postać stoi bez ruchu.")

    bledne, lista = sprawdz(pak)
    alfa = float((np.asarray(pak["walk/down/00.png"])[:, :, 3] == 0).mean() * 100)
    print(f"plików: {len(pak)} (oczekiwane 128) | komorka źródłowa {komorka} px")
    print(f"kierunki rzędów: {', '.join(kierunki)}")
    print(f"walk/down/00: {alfa:.0f}% pikseli przezroczystych")
    print(f"stopy w {len(stopy)} klatkach chodu: min {min(stopy)} max {max(stopy)} (ramka 512, konwencja bohatera 485)")
    print(f"reguła 2 px po downskalu do {DELIVERY_SIDE}: {'OK' if bledne == 0 else f'{bledne} klatek łamie'}")
    if bledne:
        for s in lista[:8]:
            print("   -", s)
        return 1
    print(f"dalej: npm run assets:pack -- {args.wyjscie} <out> --id=<id> --world=<świat> --profile=npc")
    return 0


if __name__ == "__main__":
    sys.exit(main())
