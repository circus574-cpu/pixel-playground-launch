# KI Legends — Świat Izometryczny 2D (`ports/godot-isometric-world`)

Pełny wieloregionowy świat izometryczny 2D w **Godot 4.6.3 + GDScript** łączący:
- **4 wielopoziomowe stolice kontynentów** (**Pyra — Twierdza Popiołu**, **Verdantia — Zielona Przystań**, **Aetheria — Sanktuarium Tysiąca Źródeł**, **Nexus-9 — Węzeł Świadomości**)
- **Izometryczny Atlas Planety Superior** (4 kontynenty o zatwierdzonych wymiarach, 6 wysp questowych `island-1..6`, 8 archipelagów oceanicznych)
- **Współdzielone dane wysokości i materiałów z Terrain3D** (`height.r32`, `control.r32`, `walkable.u8`, `weights.png`, `surface.png`, `mat_0..3.webp`, `water.png`)
- **Modele 3D i sprite'y izometryczne z Blendera 4.0 + OpenCV/Pillow** (`yaw 45°, elevation 30°`, filtr malarski, obrys konturowy, cień kontaktowy)
- **Obrotową mapę 3D regionu (`[M]`)** oraz **interaktywny Atlas Planety (`[G]`)**

## Sterowanie

- `WASD` / strzałki / lewy kciuk (ekran dotykowy) / kliknięcie LPM: ruch postaci z uwzględnieniem wysokości terenu (`iso(x, z, h)`), schodów, mostów i ramp
- `[1]` Pyra | `[2]` Verdantia | `[3]` Aetheria | `[4]` Nexus-9: przełączanie aktywnej stolicy
- `[G]`: pełnoekranowy Atlas Planety Superior (kliknięcie kontynentu przenosi do jego stolicy)
- `[M]` lub kliknięcie minimapy: obrotowa mapa 3D aktualnego regionu
- Kółko myszy / `+` `-` / gest pinch prawym kciukiem: przybliżenie kamery

## Testy automatyczne QA

```bash
ISO_QA_DIR=/ścieżka/do/qa godot --path ports/godot-isometric-world --rendering-driver vulkan --audio-driver Dummy -- --qa
```
