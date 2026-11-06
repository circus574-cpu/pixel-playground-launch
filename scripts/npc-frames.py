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


def opraw(pole: np.ndarray, tolerancja: int, komorka: int) -> tuple[Image.Image, int]:
    """Keyuje tło i mieści postać w ramkę 512 z wymaganym marginesem.

    Działa tak samo na wyciętej komórce arkusza i na pojedynczym pliku z paczki klatek.
    """
    tlo = ramki(pole, tolerancja=tolerancja)
    posta = ~tlo
    if not posta.any():
        raise ValueError("cała ramka wyszła tłem — brak postaci")
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


def poklatka(arkusz: Image.Image, rzad: int, kol: int, komorka: int, tolerancja: int) -> tuple[Image.Image, int]:
    """Wycina komórkę arkusza 8x8 i oddaje ją do oprawienia."""
    pole = np.asarray(
        arkusz.convert("RGB").crop((kol * komorka, rzad * komorka, (kol + 1) * komorka, (rzad + 1) * komorka))
    )
    return opraw(pole, tolerancja, komorka)


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

    args.wyjscie.mkdir(parents=True, exist_ok=True)
    pak: dict[str, Image.Image] = {}
    stopy: list[int] = []

    def dopisz(sciezka: str, obraz: Image.Image, stopa: int) -> None:
        pak[sciezka] = obraz
        stopy.append(stopa)
        (args.wyjscie / sciezka).parent.mkdir(parents=True, exist_ok=True)
        obraz.save(args.wyjscie / sciezka)

    if args.arkusz.is_dir():
        # Paczka klatek: pliki PNG o nazwach zawierających kierunek i numer klatki,
        # np. `down/03.png`, `walk-down-right-05.png` albo `downright_5.png`. Stan bierzemy
        # z katalogu nadrzędnego (idle/ walk/), inaczej wszystko jest chodem.
        pliki = sorted(args.arkusz.rglob("*.png"))
        if not pliki:
            print(f"w katalogu {args.arkusz} nie ma plików PNG", file=sys.stderr)
            return 2
        rozpozna: dict[str, int] = {}
        # Najdłuższy pasujący kierunek: w norm `downleft03png` skrót `down` też pasuje,
        # a pierwsze trafienie przypisałoby klatkę złej rzędnej.
        po_dlugosci = sorted(kierunki, key=len, reverse=True)
        for plik in pliki:
            wzg = plik.relative_to(args.arkusz).as_posix()
            norm = wzg.lower().replace("_", "").replace("-", "").replace("/", "")
            kier = next((k for k in po_dlugosci if k.replace("-", "") in norm), None)
            if not kier:
                print(f"pominięto {wzg}: brak nazwy kierunku z --dirs", file=sys.stderr)
                continue
            reszta = norm.split(kier.replace("-", ""), 1)[-1]
            cyfry = "".join(c for c in reszta if c.isdigit())
            if not cyfry:
                print(f"pominięto {wzg}: brak numeru klatki w nazwie", file=sys.stderr)
                continue
            numer = int(cyfry)
            stan = "idle" if "idle" in wzg.lower() else "walk"
            pole = np.asarray(Image.open(plik).convert("RGB"))
            obraz, stopa = opraw(pole, args.tolerancja, max(pole.shape[:2]))
            dopisz(f"{stan}/{kier}/{numer:02d}.png", obraz, stopa)
            rozpozna[kier] = rozpozna.get(kier, 0) + 1
        brak = [k for k in kierunki if rozpozna.get(k, 0) != 8]
        print(f"paczka: {len(pak)} klatek | pełnych kierunków: {8 - len(brak)}/8")
        if brak:
            print(f"   braki (oczekiwane 8 klatek): {', '.join(f'{k}={rozpozna.get(k,0)}' for k in brak)}", file=sys.stderr)
            return 1
        ark = None
        komorka = 0
    else:
        ark = Image.open(args.arkusz)
        if ark.width % 8 or ark.height != ark.width:
            print(f"oczekiwany kwadratowy arkusz 8x8, dostałem {ark.width}x{ark.height}", file=sys.stderr)
            return 2
        komorka = ark.width // 8
        for r, kier in enumerate(kierunki):
            for k in range(8):
                obraz, stopa = poklatka(ark, r, k, komorka, args.tolerancja)
                dopisz(f"walk/{kier}/{k:02d}.png", obraz, stopa)

    ma_idle = any(s.startswith("idle/") for s in pak)
    if args.idle and not args.walk_only and not ma_idle:
        if ark is None:
            print("--idle ma sens tylko z arkuszem 8x8; w paczce klatek dodaj katalog idle/", file=sys.stderr)
            return 2
        idle_ark = Image.open(args.idle)
        for r, kier in enumerate(kierunki):
            for k in range(8):
                obraz, stopa = poklatka(idle_ark, r, k, komorka, args.tolerancja)
                dopisz(f"idle/{kier}/{k:02d}.png", obraz, stopa)
    elif not ma_idle:
        # Profil npc wymaga klipów idle i walk (src/game/assets/schema.ts:76), więc bez idle
        # pakiet nie przejdzie walidacji. Klatka kontaktowa powtórzona = postać stoi nieruchomo.
        for kier in kierunki:
            kontakt = pak[f"walk/{kier}/00.png"]
            for k in range(8):
                dopisz(f"idle/{kier}/{k:02d}.png", kontakt, 0)
        stopy = [s for s in stopy if s > 0]
        print("IDLE: podstawione z klatki kontaktowej chodu — postać stoi bez ruchu.")

    bledne, lista = sprawdz(pak)
    alfa = float((np.asarray(pak["walk/down/00.png"])[:, :, 3] == 0).mean() * 100)
    print(f"plików: {len(pak)} (oczekiwane 128) | źródło: {'paczka klatek' if ark is None else f'arkusz 8x8, komórka {komorka} px'}")
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
