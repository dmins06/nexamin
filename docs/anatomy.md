# Giải phẫu 3D — frontend module

## Delivered scope

`ViewId = anatomy`; desktop item immediately follows Luyện đề. Mobile access uses the existing more menu; bottom navigation remains five items. App only imports/renders `AnatomyView`. No API, account, database or backend configuration changes are required.

The first release is a **clearly labeled geometric WebGL demo**, not an anatomical atlas. It has 28 educational entities across 11 systems and demonstrates camera rotation/zoom/pan, picking/highlight, layers, vessel filters, isolate/hide/reveal, bilingual information, label leader lines, three clipping planes and optional previous/next learning. The primitives' shapes, sizes and placement are not medically accurate. There is no diagnosis/treatment guidance. OpenStax Anatomy & Physiology 2e chapter links accompany concise metadata; this is not a substitute for a reviewed course atlas.

## Boundaries

- `AnatomyView`: lightweight entry and lazy workspace boundary.
- `AnatomyWorkspace`: synchronized selection, versioned local preferences, manifest loading, drawer, information sheet, fullscreen and learning state.
- `AnatomyViewer`: lazy R3F Canvas, cached GLB loading, cloned owned materials, demand rendering, capped DPR, context-loss handling.
- `AnatomySidebar`, `AnatomyToolbar`, `AnatomyInfoPanel`: accessible DOM controls and educational content independent of GPU.
- `anatomyData`, `anatomyTypes`, `anatomyState`: explicit reusable entity metadata, filters, persistence; future quiz can consume `AnatomyLearningPrompt` without coupling to rendering.
- `anatomyModels`, `anatomyScene`, `AnatomyLabels`: manifest validation, dictionary object mapping, clipping and collision-spaced projected labels. Up to 6 labels normally, 12 near the model; selected entity receives priority.

Preferences are stored at `nexamin.anatomy.v1`. Corrupt/old state safely defaults. Selection, hidden-entity IDs and clipping positions are transient. No secrets or health records are stored.

## Controls and responsive behavior

Desktop: 240px navigation, flexible viewer, 244px information. Below 1280px filters move to a native modal drawer. Below 760px the viewer sits above an expandable information sheet. Shared dark/light glass tokens and all global navigation/background effects remain unchanged.

Mouse drag / one-finger drag rotates; wheel / pinch zooms; right drag / two-finger drag pans. Keyboard focus on the viewer: arrow keys rotate, Shift+arrows pan, +/− zoom, Home reset. Visible toolbar and entity list provide alternatives to canvas interaction. No automatic rotation or damping animations. Fullscreen uses native API where supported and an expanded fallback otherwise.

`public/models/anatomy/README.md` documents exact GLB placement, mapping, coordinates and license requirements. An empty manifest uses the demo; an invalid/missing manifest or failed GLB shows “Không thể tải mô hình giải phẫu.” and retry. The rest of Nexamin stays usable.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
# In another terminal: npm run dev:frontend -- --host 127.0.0.1
node scripts/qa-anatomy.cjs
node scripts/qa-anatomy-models.cjs
```

Unit tests mock the viewer (no GPU needed). Browser QA uses Chromium software WebGL at desktop dark/light, tablet and 360px mobile widths. It verifies lazy entry, WebGL canvas, selection/info, labels, clipping, camera keyboard shortcuts, unchanged bottom nav, no horizontal overflow and context-loss retry. Production model accuracy/licensing cannot be verified until real assets are supplied.

The second browser script creates a tiny synthetic GLB in memory to verify real loading, object-name mapping, canvas picking, isolation and mesh-bound label placement, then smoke-checks existing navigation with mocked APIs. The fixture is never served as production content. `npm audit --omit=dev` reports no runtime vulnerabilities; the existing Vitest 2 development toolchain has 5 audit advisories and should not be exposed as a public server. Upgrading that toolchain is a separate compatibility task.
