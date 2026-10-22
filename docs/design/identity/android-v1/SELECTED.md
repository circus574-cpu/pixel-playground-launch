# Androidy — kandydat tożsamości v1 (ETAP 1)

**Data:** 2026-10-22. **Decyzja właściciela:** wybrał `android-s5741102-d62.png` (ziarno 5741102, siła 0.62) z contact sheetu 6 kandydatów, a następnie zlecił kolejną serię kandydatów.

**Status: KANDYDAT DO DALSZEJ PRACY. To nie jest końcowa akceptacja tożsamości; rig, 8 widoków i animacja nie rozpoczęte.**

## Dowody
| Plik | SHA-256 |
|---|---|
| `android-s5741102-d62.png` (wybrany) | `02a5fdc8cd3f465267c44a05cfb01b8f46ff24cd8cb98911c68047ff9b50ae67` |
| `contact-sheet.jpg` | `c096f97d0980ee28dc4f73ee7d32631e6ce19199d5288d84c862e00a2af60255` |
| `metadata.json` | `a5fa84adadb98fc0fc4b50a820680632eab450a2f61a831538cc3f9fa5f62677` |
| referencja `public/game/assets/origins-v1/android-full.webp` (PDF str. 6) | `04559d7507f7c3bfa92ebbbf4f1f2b43734546546fd262fa8bfeaaf1afa0eef0` |
| skrypt `scripts/gpu/identity_candidates.py` | `4f52c7019e1e61d3e268513b2858f529b25a306acba4424c4fc06efe05607397` |

Pozostałe pięć kandydatów: sumy w `metadata.json`.

## Pochodzenie
- Pod GPU 52s0jgxh6vxo0s, NVIDIA RTX A6000 48 GB; checkpoint `animagine-xl-3.1.safetensors`; SDXL img2img z referencji.
- Kopia skryptu na podzie miała jedną zmienioną linię: pobranie referencji pomijane, gdy plik istnieje (serwer `kilegends.pl` zwracał 403 dla klienta `urllib`). Referencję pobrano `curl`-em i zweryfikowano SHA-256.
- Na podzie: `/workspace/ki-legends-gpu/renders/android-identity-v1/` oraz `.../selected/`.
- Licencje modelu i prawa do obrazów: nierozstrzygnięte, patrz [ASSET-LICENSE-REGISTER.md](../../../ASSET-LICENSE-REGISTER.md).

## Znane odstępstwa od kanonu (ocena agenta, wymaga oceny właściciela)
- Szare tło zamiast czystego białego; pomarańczowe iskry w tle.
- Niebieskie obręcze energii wokół ciała (prompt negatywny zabraniał aury; referencja ma obręcze).
- Rdzenie na stawach i ornamenty płaszcza słabsze/uproszczone względem referencji.
