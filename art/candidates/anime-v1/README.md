# Anime v1 — awaiting style approval

These are separate art candidates, not an integrated or published game update.

- `scene-reference.webp`: visual direction reference only; do not use as a flattened game map. Its oblique scenic composition must not dictate the production map camera.
- `grass-seamless-128.png`, `grass-seamless-256.png`: genuine material samples. Opposite pixel edges are identical; repetition is still visible, so variants and calmer patches are required before a full terrain layer is accepted.
- `grass-repeat-qa.webp`: 3×3 repeat inspection.
- `oak-topdown.webp`: selected overhead correction. The earlier frontal tree was rejected for gameplay perspective.
- `cottage.webp`: independent illustrated building with a transparent background and down-facing entrance. Scale against the doorway, not just the roof.
- `hero-design.webp`: original human design, one pose only. Not a spritesheet or an animation. Fine clothing detail needs simplification for small sprites; directional poses must be verified later.
- `scale-qa.webp`: actual candidate sprites composed for proportion/size inspection, including hero sizes at .48 and .62 zoom. Not a Phaser screenshot.
- `prompts.json`, `tree-correction-prompt.txt`: exact generation prompts. Built-in OpenAI imagegen; model identifier not exposed. No paid API call.
- `manifest.json`: exported dimensions, alpha ranges, file sizes and SHA-256 checksums.

## QA and processing

All sources were generated separately. Scene exported to WebP quality 90. Object sources retained RGBA and were resized proportionally to a maximum 1024px dimension, exported lossless WebP. Grass was downsampled to 256px with Lanczos, then periodic-plus-smooth Fourier boundary correction, followed by averaging opposing edge pixels. A separate 128px sample was resized and had its edge equality restored. No object was cut from the reference scene. True alpha (0–255) was verified on tree, house and character exports. Scale QA uses the substantive alpha bounding box, not the transparent canvas dimensions.

Visual result: coherent teal/cream/coral palette and painted anime shading; selected tree has a stronger overhead view. Terrain repetition remains a known issue, not a passed production quality gate. Character remains a design, with no claims about eight-direction animation, anatomy consistency between frames, or gameplay integration. Edge cleanup/anchors/footprints and engine-scale camera consistency need a subsequent production pass after approval.

Repository checks: 7 test files / 22 tests passed; full `tsc --noEmit` passed on 2026-10-19. No runtime code changed in this candidate commit. Physical Android/iPhone performance and native fullscreen remain unverified. No Lovable publication requested for this candidate set.
