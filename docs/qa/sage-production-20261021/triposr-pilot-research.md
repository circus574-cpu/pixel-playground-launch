# Local image-to-textured-3D pilot, 2026-10-21

Selected for an actual isolated test: TripoSR. This is a static geometry/texture candidate, not an animation deliverable or accepted character.

- Code https://github.com/VAST-AI-Research/TripoSR at `107cefdc244c39106fa830359024f6a2f1c78871`, MIT.
- Model https://huggingface.co/stabilityai/TripoSR at `5b521936b01fbe1890f6f9baed0254ab6351c04a`, MIT; checkpoint 1,677,246,742 bytes, SHA256 `429e2c6b22a0923967459de24d67f05962b235f79cde6b032aa7ed2ffcd970ee`.
- DINO image tokenizer uses config only from `facebook/dino-vitb16`, revision `f205d5d8e640a89a2b8ef0369670dfc37cc07fc2`, Apache-2.0; weights already contained in TripoSR checkpoint.
- torchmcubes https://github.com/tatsy/torchmcubes at `a9ac95aa329957ba646e7bb057f825f5dfa77f38`, **MPL-2.0**, not BSD; commercial use permitted, preserve notices/source obligations if redistributing covered software.
- xatlas 0.0.9 MIT; moderngl 5.10.0 MIT; torch 2.4.1 BSD-style; transformers 4.35.0 Apache-2.0. License inventory is a direct-dependency review, not legal clearance for all transitive dependencies or source illustration.
- No background-removal inference or extra segmentation weights. Input alpha is composited onto neutral gray as deterministic inference preprocessing.

Official default VRAM approximately 6GB. A6000 48GB is ample for default configuration; 384-grid extraction and 2048 texture baking are unmeasured here. Official <0.5s A100 claim covers model inference, not download/install/mesh extraction/texture baking or A6000 runtime.

Headless texture bake requires EGL; code changes moderngl context to backend='egl'. CUDA toolkit nvcc required to compile torchmcubes; CPU marching-cubes fallback exists but still requires successful module build. Existing ComfyUI and Blender environments remain unchanged. Full copy of Comfy venv permits torch/CUDA reuse; all pip commands use copied environment Python module invocation because copied shell entrypoint shebangs can point at the original environment.

Output geometry has no skeleton and may fuse cloth, hair, arms or staff. Nearest-anatomy weight transfer requires explicit alignment, separate staff/cloth treatment and visual review of deformation. Single-view reconstruction cannot guarantee exact identity, ornament or unseen back surfaces. Review the static result before spending time on rigging or 416 frames.

Rejected as immediate clean production choices:

- Microsoft TRELLIS v1 MIT model/code but default GLB appearance renderer mip-splatting/diff-gaussian-rasterization is research/noncommercial. Alternative diffoctreerast likewise.
- TRELLIS.2 MIT core/weights, 24GB minimum, but default DINOv3 manually gated, RMBG2 noncommercial and nvdiffrast/nvdiffrec noncommercial. Repo `75fbf0183001ed9876c8dbb35de6b68552ee08bd`; model `af44b45f2e35a493886929c6d786e563ec68364d`; model repository checkpoints total 16,237,469,957 bytes plus auxiliary models.
- TencentARC InstantMesh code/weights Apache-2.0, but official code requires nvdiffrast for both mesh rendering and texture export. nvdiffrast v0.4.0 license section 3.3 explicitly restricts use to research/evaluation/noncommercial, notwithstanding '1-Way Commercial' heading. Repo `08822c52fdc399b93ea00e4fa9e596344ed52ccc`; model `b785b4ecfb6636ef34a08c748f96f6a5686244d0`. Zero123++ alone does not solve this dependency.

No GPU operations, installation or pod lifecycle changes were performed by the research task.
