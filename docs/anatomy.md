# Giải phẫu 3D — frontend module

## Delivered scope

The module lives at `/labs/anatomy`: Phòng Lab → Y – Sinh → Giải phẫu người 3D. Phòng Lab immediately follows Luyện đề in the sidebar and is available in the existing mobile-more menu; bottom navigation remains five items. The nested route renders LabHubView, whose lazy module registry opens the unchanged AnatomyView. Breadcrumb and Back navigate to `/labs`; direct links, refresh and browser history work through the shared router. No API, account, database or backend configuration changes are required. See `docs/labs.md` and `docs/routing.md`.

The current release uses **84 separately selectable structures from BodyParts3D 4.0 across all eleven system groups**. The expansion catalog adds 48 named entries and redistributes the old residual bone entry into specific selectable structures, retaining all 898 original unique source-part IDs. Muscle coverage increases from 4 to 27 groups. It supports camera rotation/zoom/pan, picking/highlight, layers, vessel filters, isolate/hide/reveal, bilingual information, labels, three clipping planes, previous/next learning and a small multiple-choice quiz. Explicit system selection reveals its required layers/vessel filters, preserving unrelated preferences; it clears search, selection, hidden/isolation state and clipping, then resets the camera. The endocrine, reproductive, urinary and lymphatic systems automatically frame their loaded bounds; selecting a small gland can zoom closer and accounts for mobile aspect ratio. The information panel omits the related-structure heading when the selected entry has no relations. Model source, license history and measured byte reductions are documented in `docs/anatomy-assets.md`. This adult-male reference atlas does not include female anatomy, the thyroid gland or every anatomical structure, and is not a substitute for a medically reviewed course atlas. No diagnosis/treatment guidance is provided. OpenStax chapter links accompany concise metadata.

## Boundaries

- `AnatomyView`: lightweight entry and lazy workspace boundary.
- `AnatomyWorkspace`: synchronized selection, versioned local preferences, manifest loading, drawer, information sheet, fullscreen and learning state.
- `AnatomyViewer`: lazy R3F Canvas, cached GLB loading, cloned owned materials, demand rendering, capped DPR, context-loss handling.
- `AnatomySidebar`, `AnatomyToolbar`, `AnatomyInfoPanel`: accessible DOM controls and educational content independent of GPU.
- `anatomyData`, `anatomyTypes`, `anatomyState`, `anatomyQuiz`: explicit reusable entity metadata, filters, persistence and quiz prompts without coupling to rendering.
- `anatomyModels`, `anatomyScene`, `AnatomyLabels`: manifest validation, dictionary object mapping, clipping and collision-spaced projected labels. Up to 6 labels normally, 12 near the model; selected entity receives priority.

Preferences are stored at `nexamin.anatomy.v1`. Corrupt/old state safely defaults. Selection, hidden-entity IDs and clipping positions are transient. No secrets or health records are stored.

## Controls and responsive behavior

Desktop: 240px navigation, flexible viewer, 244px information. Below 1280px filters move to a native modal drawer. Below 760px the viewer sits above an expandable information sheet. Shared dark/light glass tokens and all global navigation/background effects remain unchanged.

Mouse drag / one-finger drag rotates; wheel / pinch zooms; right drag / two-finger drag pans. Keyboard focus on the viewer: arrow keys rotate, Shift+arrows pan, +/− zoom, Home reset. Visible toolbar and entity list provide alternatives to canvas interaction. Orbit controls have no automatic rotation or damping; selection/system framing eases to its destination, or moves immediately with `prefers-reduced-motion`. Fullscreen uses native API where supported and an expanded fallback otherwise.

`public/models/anatomy/manifest.json` lists the shipped real GLBs. An empty development manifest uses the explicitly marked geometric demo; an invalid/missing manifest or failed GLB shows “Không thể tải mô hình giải phẫu.” and retry. A single model failure does not suppress other groups. The rest of Nexamin stays usable.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
# In another terminal: npm run dev:frontend -- --host 127.0.0.1
node scripts/qa-anatomy.cjs
node scripts/qa-anatomy-models.cjs
node --test scripts/check-anatomy-glb-codec.mjs
node scripts/inspect-anatomy-assets.mjs
node scripts/qa-anatomy-expanded.cjs
```

Unit tests mock the viewer (no GPU needed). Browser QA uses Chromium software WebGL at desktop dark/light, tablet and 360px mobile widths. It verifies lazy entry, actual model render, selection/info, labels, clipping, camera keyboard shortcuts, unchanged bottom nav, no horizontal overflow and context-loss retry. The GLB inspector checks named meshes, lineage, index ranges and self-containment; expert anatomical review is still outside this implementation.

The second browser script creates a tiny synthetic GLB in memory to verify real loading, object-name mapping, canvas picking, isolation and mesh-bound label placement, then smoke-checks existing navigation with mocked APIs. The fixture is never served as production content. Expanded-model QA uses the real shipped compressed GLBs and bundled decoder; auth/API remain fixtures, not real login verification. Comprehensive dark-theme checks at 1440px and 360px cover all eleven systems, new selections and layer recovery. Default-state checks additionally cover 1440px/360px light, 900px dark and 1600px light, including skeleton-only initial loading. The twelve final screenshots and resource/error records are listed in `.impeccable/review/anatomy-expanded-qa.json`; the independent finish review in `.impeccable/review/anatomy-expanded-finish.md` records `ship` for this local build. These software-WebGL results do not claim low-end-device frame rate, medical expert approval or production deployment. The existing Vitest 2 development toolchain has known audit advisories and should not be exposed as a public server; upgrading that toolchain is a separate compatibility task.
