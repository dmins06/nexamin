# Giải phẫu 3D

Primary target: src/features/anatomy/AnatomyView.tsx
Mode: Operate. Established Nexamin design; user-specified three-column desktop workspace and mobile viewer with sheets. Code-led implementation explicitly follows the detailed user brief; no new visual-world decision is required.

## Direction contract

THESIS: Select, reveal and inspect an anatomical entity in one connected learning workspace. The 3D scene owns the visual focus.

OWN-WORLD: Inherit Nexamin's navy/light atmospheric background, semantic glass surfaces, Manrope body and cyan focus accents. Arteries and veins use conventional red/blue, with named controls.

STORY: A student opens Phòng Lab → Y – Sinh → Giải phẫu người 3D, explores 84 real licensed BodyParts3D structures in eleven system groups, manipulates the scene and reads bilingual educational metadata. The expansion includes 27 muscle groups and retains all 898 original unique source-part IDs. This is a selected adult-male reference atlas, not complete female/male anatomy; missing thyroid/female anatomy is stated visibly. The geometric demo is only a development fallback and never fabricates newly catalogued structures.

FIRST VIEWPORT: Desktop has a 240px system navigator, flexible dominant viewer and compact information column. Viewer toolbar exposes reset, labels, transparency, clipping and fullscreen. Mobile shows the viewer first; filters use a drawer and information expands below it.

FORM: User-pinned three-column educational workspace; no seed or concept tournament. Signature interaction: selecting a named mesh synchronizes its highlight, camera focus, bilingual information and hide/isolate actions. Explicit system selection clears search and transient inspection state, reveals the relevant layers/vessel filters and resets the camera; localized systems then frame their loaded bounds. Reduced motion makes focus immediate. A small quiz builds on the same real structure IDs.

QUALITY BAR: Preserve the existing visual identity/tokens, navigation and controls. Real meshes for every expanded catalog ID; no decoder CDN. Explicitly selecting a system reveals its required layers. Default opens only the skeletal asset. Small glands can be inspected at a useful scale; 360–1600px, dark/light, keyboard controls, no horizontal overflow. Report transfer bytes separately from unmeasured low-end-device performance. Ordinary extension: no approved comp or replacement world.

FINISH: Recorded in `.impeccable/review/anatomy-expanded-finish.md` with disposition `ship`; twelve final captures are referenced in `.impeccable/review/anatomy-expanded-qa.json`. Anatomy documentation preserves the inherited DESIGN.md and sidecar. Local verification and fixture-based browser QA do not establish production deployment.
