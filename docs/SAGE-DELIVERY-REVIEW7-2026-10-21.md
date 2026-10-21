# Mędrcy — opt-in delivery review7

416 real frames were validated and packed into two lossless WebP atlases (2048×2048 and 2048×1280), 2,484,058 image bytes. The renderer source and original 512×512 PNG files remain unchanged. Raw bundle SHA256: `f1611e6c2770c9b8228d5462e3d3622517ec2d272918e3f5445001e57faadf49`.

The immutable package is `public/game/assets/gpu/hero-sage/1.0.0-bafe591d3ac3`, with `previewOnly: true`, bound only to `aether.hero`. Enable it with `?ki-sage-art=1`. Default visuals and all three other races remain unchanged. Seven states, eight directions, 416 atlas references, no missing frames; delivered size128×128, origin(0.5,0.75).

## Resampling correction

Default Lanczos3 produced two boundary pixels with alpha1/255 on death/down/05 from ringing during downsampling. The optional `--resize-kernel=lanczos2` setting removed this resampling tail and all416 frames passed the strict2px delivery border. This changes the interpolation kernel consistently across the Sage package, with no cropping, padding, per-frame resizing or edits to source pixels. The default pipeline remains Lanczos3.

## Checks

Full TypeScript PASS; GPU pipeline12/12 tests PASS; playtest build PASS. Five Playwright tests PASS in50.9s: same character and durable progress across opt-in reloads, default appearance and all other races, eight directions and skill at1280px and390px, corrupt-atlas retry preserving the slot, and actual CDP touch joystick/tapped skill. These tests are Canvas headless Chromium, including emulated phone dimensions; they are not physical Android certification.

The self-contained interactive preview is `/workspace/artifacts/ki-sage-20261021/animation-review.html`; adjacent `animation-review.png` shows all56 clips. Chromium checked seven states, pause, state/tempo/background controls and zero page errors using the embedded HTML. Navigation to a local `file://` URL is blocked by this managed browser policy; embedding the same self-contained document worked. This is a local review artifact, not publication.

A separate Chromium run with the SwiftShader/WebGL launch configuration passed the save/default-race test (1/1,34.0s). This checks the same integration in a software rendering configuration and is not a hardware performance result. Default assets check PASS; including previews yields Aetheria43,824,416 decoded bytes (14textures), within the128MiB contract; all other worlds retain their default totals.

## Remaining acceptance and limits

Owner accepted the eight painted directional masters and authorized animation production. Final motion/gameplay visual acceptance remains open. The final technique is a painted2D deforming puppet rendered in Blender/CUDA, not a successful3D reconstruction. Physical Android, hardware WebGL, driver GPU memory, thermal behavior and long-session performance remain unverified. SwiftShader tests cannot establish hardware frame rates.

The canonical illustration's original rights/provenance remain an open project issue; generated painted masters do not clear reference rights. MakeHumanCC0 and TripoSRMIT/torchmcubesMPL2 describe retained rejected pilots, not the final painted rig dependency. Installed Animagine/DreamShaper models are not dependencies of these final sprites. See the v3 production provenance for actual source lineage. No merge or game publication was performed.

Evidence: [validation.json](qa/sage-delivery-review7/validation.json), [Playwright](qa/sage-delivery-review7/playwright-canvas.log), [interactive review checks](qa/sage-delivery-review7/offline-review.json).
