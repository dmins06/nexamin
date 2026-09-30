# Phòng Lab

The global `ViewId` is `lab`. Sidebar and mobile-more show **Phòng Lab** after Luyện đề; the mobile bottom bar remains five items. Anatomy stays intact in `src/features/anatomy/` and is launched from the Hub, not the global sidebar.

## Discovery and module boundaries

- `labRegistry.ts`: searchable metadata and eight discipline definitions. Only Giải phẫu người 3D is currently released. Other fields show an honest unreleased state, not fake simulations.
- `labModules.ts`: explicit loader registry. The Anatomy import is dynamic and invoked only after Khám phá. Neither Three.js nor anatomy assets are fetched merely by opening the Hub.
- `LabHubView`: discovery, filters, launch, breadcrumb/back and a module error boundary. No anatomy simulation logic.
- `LabCard` and `LabCategoryFilter`: reusable metadata-driven UI.
- `labStorage.ts`: versioned `nexamin.labs.v1` preferences for category and search. Fresh/default category is All. Invalid state resets safely. Active simulation is transient; returning preserves discovery context and restores heading focus.

To add a future lab, create its feature independently, add metadata to `labRegistry`, and register its lazy module in `labModules`. A metadata entry without a loader cannot launch. `coming-soon` entries remain disabled; `available` and `beta` require a matching loader. Do not eagerly import simulation packages into the Hub. No universal simulation framework or new router is introduced.

Anatomy retains its current educational geometric demo, interaction controls, GLB pipeline and disclaimer. Real licensed assets can be installed using `public/models/anatomy/README.md`.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. Hub tests mock the existing Anatomy view and preserve the existing non-GPU Anatomy tests. `node scripts/qa-labs.cjs` exercises desktop dark/light, tablet and 360px mobile, including no anatomy requests while browsing the Hub, filters, search, launch/back and overflow. Existing `qa-anatomy.cjs` and `qa-anatomy-models.cjs` now enter Anatomy through Phòng Lab, retaining their WebGL and GLB checks. Use `QA_BASE_URL` to point browser checks at a production preview.
