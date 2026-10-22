# Legendy — kandydat tożsamości v1 (ETAP 2)

**Data:** 2026-10-22. **Decyzja właściciela:** wybrał `legend-s5741102-d62.png` (ziarno 5741102, siła 0.62) z contact sheetu 6 kandydatów.

**Status: ZAAKCEPTOWANY przez właściciela jako kandydat tożsamości Legend (wybór w czacie sesji). Rig, 8 widoków i animacja nie rozpoczęte.** Kolejność z [GPU-PRODUCTION-SEQUENCE.md](../../../GPU-PRODUCTION-SEQUENCE.md): produkcja Legend po ukończeniu i odbiorze Androidów.

## Dowody
| Plik | SHA-256 |
|---|---|
| `legend-s5741102-d62.png` (wybrany) | `35421413ffe928e53aa50916fa2028cdb3d89cf5c0db3d0982c6db32d29d121b` |
| `contact-sheet.jpg` | `16fb2d73bf77dd7176e574f0b3f020781719650c6427237d3bae94384993ee5d` |
| `metadata.json` | `78c2d6745b415773539c2fe72054e31bcf72cf2e2a8795c116a5a916eb69fbf9` |
| referencja `public/game/assets/origins-v1/legend-full.webp` (PDF str. 7) | `ba7c4d962595ae469adeaa00939549af2f77597caf175f29fff2122e75a87e80` |
| skrypt `scripts/gpu/identity_candidates.py` | `4f52c7019e1e61d3e268513b2858f529b25a306acba4424c4fc06efe05607397` |

Pozostałe pięć kandydatów: sumy w `metadata.json`.

## Pochodzenie
- Pod GPU 52s0jgxh6vxo0s, NVIDIA RTX A6000 48 GB; checkpoint `animagine-xl-3.1.safetensors`; SDXL img2img z referencji.
- Kopia skryptu na podzie: pobranie referencji pomijane, gdy plik istnieje (`kilegends.pl` zwracał 403 dla `urllib`); referencję pobrano `curl`-em i zweryfikowano SHA-256.
- Na podzie: `/workspace/ki-legends-gpu/renders/legend-identity-v1/` oraz `.../selected/`.
- Licencje modelu i prawa do obrazów: nierozstrzygnięte, patrz [ASSET-LICENSE-REGISTER.md](../../../ASSET-LICENSE-REGISTER.md).

## Znane odstępstwa od kanonu (ocena agenta, wymaga oceny właściciela)
- Szare tło zamiast czystego białego; iskry w tle.
- Ogień/aura wokół ciała mimo zakazu w prompcie negatywnym (kanon dopuszcza płomienną energię).
- Blokada kolejnych kroków: brak runtime Blendera na podzie (patrz android-v1/SELECTED.md).
