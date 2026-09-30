# Anatomy assets

The shipped `manifest.json` intentionally has an empty `models` array. This activates the clearly marked geometric interaction demo, NOT a medically accurate human model. No third-party model is bundled.

## Install licensed GLB models

1. Obtain lightweight GLB assets whose license permits public redistribution. Keep the license text, author, original download URL and any required attribution beside each asset. Anatomical accuracy needs review by a qualified educator before publication.
2. Place files here, e.g. `skeleton.glb`, `muscles.glb`, `organs.glb`, `vascular.glb`, `nervous.glb`. Do not commit large raw scans or unlicensed models.
3. All layers must share one coordinate frame: Y-up, centered near `[0, 0.1, 0]`, whole body approximately 4.5 units tall. Export with transforms applied. Use `scale` and `position` for a shared conversion, not independent per-organ normalization. Camera reset is `[0, 0.1, 7.5]`; clipping extents are X ±1.5, Y ±2.5, Z ±0.8.
4. Name objects with stable IDs or aliases in `src/features/anatomy/anatomyData.ts`. `Heart`, `heart` or GLTF extras `{ "anatomyId": "heart" }` map to the same entity. Named ancestors also map descendants. `Lung_L` and `Lung_R` map to `lungs`. Add metadata/aliases for new entities. Unmapped meshes are hidden; a model with no mapped meshes produces the retry fallback.
5. Replace `manifest.json` with entries such as:

```json
{
  "version": 1,
  "models": [
    {
      "id": "organs",
      "url": "/models/anatomy/organs.glb",
      "license": "REPLACE with verified redistribution license",
      "attribution": "REPLACE with author and original source URL",
      "scale": 1,
      "position": [0, 0, 0]
    }
  ]
}
```

Only same-origin `.glb` paths beneath `/models/anatomy/` are accepted. GLBs should be self-contained, with embedded textures. Material highlighting expects standard glTF PBR materials. Vessels use conventional arterial red and venous blue regardless of oxygenation (the pulmonary artery carries oxygen-poor blood; the pulmonary vein carries oxygen-rich blood).

## Performance and validation

Start with decimated meshes and small textures, aiming for a few MB total. Inspect on a low-end phone before publishing. GLTF results are cached across feature mounts, geometry/textures shared, scene/material clones owned per viewer. A retry clears the failed loader entry. Do not mutate cached scenes directly.

The baseline loader disables remote Draco decoder requests. Meshopt support is provided by drei. To adopt Draco or KTX2, explicitly self-host and configure matching decoders/transcoders, test browser support and CSP, and validate deployment before replacing assets. The current demo has no decoder/CDN dependency.

Test every model: select each entity, hide/show, isolate, labels, all three clipping axes, transparency, reload, missing GLB and WebGL loss. Labels use mapped mesh bounds, not demo coordinates. Clipping is a simple open plane (no filled medical section surfaces); this is not DICOM/CT/MRI rendering.
