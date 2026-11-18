# KI Legends — dokumentacja projektu

**17.11 — serwerowa aktualizacja prototypu Pyry:** nowe budynki i 14 materiałów
podłączone do Godota oraz obu map. Paczka `core-c101` dla istniejącej aplikacji
1.14, bez nowego APK. Kandydat wydania treści **1.14.1**;
[test oryginalnego klienta i publikacja](zmiany/2026-11-17/ZMIANY.md#5-podłączenie-materiałów-do-prototypu-i-aktualizacja-przez-serwer).

**17.11 — produkcja tekstur Pyry na GPU:** 72 warianty materiałów, 12 masek
przejść, źródła 1024 px i wersje 512 px. Osobna gałąź zasobów, bez zmiany świata
i APK. [Zakres, wyniki i kopia źródeł](zmiany/2026-11-17/ZMIANY.md#4-tekstury-pyry--produkcja-na-a40).

**17.11 — nowe budynki próby izometrycznej Pyry:** sześć malowanych sprite'ów,
kotwice, kontaktowe cienie i synchronizacja map. Zintegrowane w próbie Godota,
bez nowego APK i publikacji. [Wyniki i zrzuty](zmiany/2026-11-17/ZMIANY.md#3-budynki-i-styl-izometrycznej-pyry).
**18.11 — Świat Izometryczny 2D (Faza A + C): 4 Pełne Kontynenty `1024×1024 m`, 24 Expowiska, Żywa Woda/Lawa, 99 Bytów i Globus 3D (`ports/godot-isometric-world`):**
wieloregionowy świat izometryczny 2D w Godot 4.6.3 obejmujący 4 pełne kontynenty `1024×1024 m`
(Pyra, Verdantia, Aetheria, Nexus-9 — ufortyfikowana bezpieczna stolica `r = 180 m` + dziki kontynent),
generator dróg `Catmull-Rom Spline`, **24 polany bojowe (`Expowiska Lv. 1–18`)**, animowane rzeki,
jeziora, zatoki oceaniczne, wodospady i płynną lawę, **338 ręcznie malowanych obiektów `.webp` +
12 murów/baszt/bram z Blender Cycles GPU / Geometry Nodes**, **99 animowanych bytów** (4 bohaterów,
40 NPC, 41 gatunków potworów, 10 gatunków fauny) z efektami `PyraAmbient`, rzeczywisty **Globus 3D
Planety Superior (`[G]`)**, malowany **Atlas 2D (`[Tab]`)** oraz obrotową **Mapę 3D Kontynentu (`[M]`)**.
[Raport i dowody QA](zmiany/2026-11-18/ZMIANY.md), [dokumentacja projektu](../ports/godot-isometric-world/README.md).
