# TripoSR high-resolution front projection onto existing UV mesh

Verified code at TripoSR commit `107cefdc244c39106fa830359024f6a2f1c78871`:

- `tsr/system.py:TSR.render` defaults: elevation 0°, distance 1.9, vertical FOV 40°.
- `tsr/utils.py:get_spherical_cameras` first azimuth 0°: camera `(1.9,0,0)` looking toward origin; screen-right `+Y`, screen-up `+Z`; mesh is Z-up.
- These are the library visualization defaults. Exact conditioning camera is not explicitly encoded in the single-image model config. Silhouette and face landmark registration must be checked before treating these parameters as fitted.
- To bring this view to the game camera at negative Y, use source-to-game Z rotation **-90°**, provisional until visually confirmed. A +90° source rotation shows the opposite side.

For source mesh point `(x,y,z)`, camera distance `d=1.9`, half-angle `h=20°`, square input:

```
q = d - x
u = 0.5 + y / (2 * q * tan(h))
v_top = 0.5 - z / (2 * q * tan(h))
v_uv = 1 - v_top
```

Use the exact padded square input supplied to inference (including its foreground occupancy), at its original high resolution; do not project an unpadded/cropped master with the same parameters. The source in this task reportedly occupies ~90% of a 1707² square. TripoSR official preprocessing defaults to 85%, so the particular pilot's actual input must win over library defaults.

If the high-resolution master has a different crop or padding, apply the known crop/padding affine transform to `(u,v_top)` before sampling; do not guess per-frame registration. A manually fitted single affine offset/scale can be fixed once for the static model and saved in metadata.

To enhance texture without a billboard:

1. Keep the existing baked texture as fallback for all unseen surfaces.
2. Add a second per-corner UV layer by projecting every original 3D vertex with the equation above. Keep the model's original UV unwrap as the destination layer.
3. Reject points with `q<=0`, UV outside [0,1], or source reference alpha near zero.
4. Use a front-facing normal weight, e.g. smoothstep(0.25,0.75,dot(normal,normalize(camera-point))).
5. Raycast from the source camera through each face center into the source mesh BVH; apply projected color only if this face is the nearest visible surface within a scale-aware tolerance. This prevents painting face details on the back, robe colors onto hidden arms and costume detail onto the staff behind it.
6. Mix reference color with the original baked texture using reference alpha × normal weight × visibility. Feather the boundary across normals/visibility to avoid seams. Do not synthesize transparency holes in existing geometry from the image background.
7. Bake the mixed emission color into a NEW 2048/4096 atlas on the original UV map. Preserve original atlas and save the new texture, projection settings and blend source independently.
8. Review front, quarter and back renders; inspect face/ornament placement and seams. Animation uses the UV texture attached to the deforming mesh, without camera-facing planes or per-frame redraw.

Avoid projecting blindly: single-image geometry may not reproduce the reference pose or facial landmarks. A sharper wrongly registered face is worse than the original baked texture. Unseen back/side fidelity and topology/rigging remain unresolved. This enhancement creates neither a skeleton nor acceptance of the character.
