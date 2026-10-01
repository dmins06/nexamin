# Anatomy models shipped with Nexamin

`manifest.json` lists nine self-contained BodyParts3D-derived GLBs. Do not replace these files with unlicensed scans or remove their attribution. The full source, license history, conversion method, size report and validation commands are in [`docs/anatomy-assets.md`](../../../docs/anatomy-assets.md). Source OBJ archives remain outside the published site and repository in ignored `.cache/anatomy-source/`.

Meshes are named with stable Nexamin IDs and retain source FMA/FJ lineage in GLB extras. They share the same Y-up coordinate system and are loaded per visible system. The geometric demo is only an emergency/development fallback when a deliberately empty manifest is supplied; the production manifest uses actual anatomy meshes.
