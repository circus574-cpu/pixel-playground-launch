# Malowane widoki + deformacja siatki — pipeline bohaterów (2026-10-22)

**Decyzja właściciela (2026-10-22):** modele 3D budowane z prymitywów w Blenderze („tragiczne”) zostają porzucone. Bohaterowie powstają z **ośmiu malowanych widoków** zaakceptowanego kandydata tożsamości, animowanych deformacją siatki 2D (bez przerysowywania pojedynczych klatek). Jakość pochodzi z ilustracji.

## Kroki i skrypty (`scripts/gpu/`)
1. `android_pose_keypoints.py` / `planetary_pose_keypoints.py` — punkty szkieletu (OpenPose) z rigu, osiem kierunków (wspólny szkielet dla wszystkich ras).
2. `painted_views.py <race> <tag> <seeds> <ip-scale>` — ControlNet OpenPose (xinsir, Apache-2.0) + IP-Adapter SDXL (h94, Apache-2.0) + Animagine XL 3.1; wejście: zaakceptowany kandydat; wyjście: 8 widoków × ziarna.
3. `matte_masters.py` — wycięcie tła (rembg `isnet-anime`), jedna skala dla ośmiu widoków, kotwica stóp (256, 486.4), mastery 512×512 RGBA.
4. `animate_painted.py` — szkielet 2D (łańcuchy ciało / ręce / nogi), liniowe skinowanie siatki, klipy proceduralne (idle, walk, attack, skill, hit, death, respawn), przyciągnięcie do linii ziemi, wspólny współczynnik skali dla marginesu (`KI_SAFE`, domyślnie 14 px; użyto 22).
5. `assets:pack` → `assets:import` (walidacja) — paczka 416 klatek, 2 strony atlasu 128 px.

## Wybrane warianty (właściciel delegował wybór agentowi)
| Rasa | Kandydat tożsamości | Widoki | Ziarno widoków |
|---|---|---|---|
| Android | `android-s5741102-d62.png` | `android-painted-v3` | 5741102 |
| Planetarni | `planetary-s5741102-d62.png` | `planetary-painted-v1` | 5741103 (wiersz 2 wybrany przez właściciela) |
| Legendy | `legend-s5741102-d62.png` | `legend-painted-v1` | 5741102 (wybór agenta, wiersz 1) |
| Mędrcy (męska) | `sage-s5741102-d55.png` | `sage-painted-v1` | 5741102 (wybór agenta, wiersz 1) |

## Znane wady (NIEZWERYFIKOWANE przez właściciela jako akceptacja końcowa)
- Widoki jednej rasy nie są w pełni spójne (proporcje, detale między kierunkami).
- Deformacja rwie teksturę na styku nóg/płaszcza i w tunice Planetarnych (atak z przodu).
- Chód z przodu ma niewielki ruch; skala postaci zmniejszona o 7–29% (wg rasy), żeby upadek mieścił się w kadrze.
- Kostur Mędrców nie jest narysowany (szkielet ma ręce opuszczone); Legendy mają czerwone smugi energii w tle widoków, które wycięcie tła w części usuwa.
- Prawa do obrazów i modeli: nierozstrzygnięte (patrz `ASSET-LICENSE-REGISTER.md`). Zainstalowane modele: ControlNet OpenPose SDXL i IP-Adapter SDXL, sumy w `models/controlnet-ipadapter-hashes.json` na volume.

## Porządek na volume (decyzja właściciela)
Usunięto 30 GB: `comfy-stack-20261018/models/checkpoints/flux1-schnell-fp8.safetensors` (17 GB), `.../text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors` (6,7 GB), `.../archives/` (8,3 GB). Volume: 93 GB → 63 GB. Pozostałe kandydaci do usunięcia (poziom 1–2 oraz DreamShaperXL, TripoSR, `resumes/shutdown-20261021`) czekają na odrębną decyzję.
