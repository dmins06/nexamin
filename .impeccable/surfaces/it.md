# CNTT Lab

Primary target: src/features/labs/it/ITLabHub.tsx
Mode: Operate. Ordinary extension; preserve Orbit to Surface, Anatomy and the existing app shell.

THESIS: A student opens a real programming workspace or follows an algorithm one operation at a time, without configuring a server.
OWN-WORLD: Existing semantic tokens, glass surfaces, Manrope/Space Grotesk and Lucide. Monospace only for actual code/data.
STORY: Phòng Lab → CNTT → exercise → edit/run/test or configure/step/explain. Six future labs remain explicitly unreleased.
FIRST VIEWPORT: Hub with registry catalogue; Code Lab with task/editor/output; Algorithm Lab with input, a prominent state diagram and synchronized pseudocode.
FORM: Desktop multi-panel, mobile stacked editor-first with collapsible exercise details. Honest local public tests, explicit predefined traces, bounded execution and meaningful recovery.

## Shipped routes and scope

`/labs/it` renders eight registry cards. Code Lab at `/labs/it/code` and Algorithm Lab at `/labs/it/algorithms` are labelled “Bản thử nghiệm” and have “Mở lab” actions. Computer Architecture, Network, Operating System, Database, AI / Machine Learning and Security have “Chưa phát hành” status and “Xem lộ trình” actions. Their direct routes render scope/roadmap text, not functioning simulations.

Code Lab uses CodeMirror for Python, C, C++, Java and JavaScript, with language-specific templates, exercise selection, stdin, run/stop, separate stdout/stderr and public test results. Code runs through browser workers and local runtime assets; the UI exposes loading/error states and execution limits. Test results are self-study feedback, not official grades or hidden-test judging. Exercise links open the corresponding predefined algorithm, explicitly not a visualization of the student's source. `nexamin.it.code.v1` stores the selected language/exercise, per-exercise/language drafts and stdin through the versioned adapter.

Algorithm Lab implements Bubble, Selection, Insertion, Merge and Quick Sort; Linear and Binary Search; BFS, DFS and Dijkstra. Configurable inputs produce predefined traces with array or graph state, synchronized pseudocode, operation text, metrics, step/play/reset and speed controls. Validation stays next to the input flow. `nexamin.it.algorithms.v1` stores algorithm, inputs and speed; play state and the current step are transient. The explanations disclose implementation-specific complexity and the distinction between swaps and writes.

The existing Emin AI route receives a student-triggered explanation prompt. The lab does not manufacture an AI response. Nested routes retain Phòng Lab as the active shell destination and expose Phòng Lab → CNTT Lab → workspace breadcrumbs; child modules load on entry with status and recovery affordances.

## TYPE / MATERIAL / GROUND as built

- TYPE: headings resolve `--font-display` (Space Grotesk, Manrope fallback), with a 24–32px hub/workspace title, 19px card titles and 18px panel titles. Body and controls inherit `--font-body` (Manrope); input labels/buttons are 13px and helper/topic/status text is 12px. Monospace is used for the editor, program output, pseudocode and numeric array data. No new font assets or typography system are introduced.
- MATERIAL: cards/panels use `--glass` with `--surface` fallback, a semantic 1px border, 16px corners and 14px backdrop blur. Padding is 20px desktop and 16px mobile. Fields and diagram nodes use raised/soft semantic surfaces; active, settled and error states use accent, success and danger tokens. Buttons/fields have 44px minimum height and controls have a visible 2px accent focus outline. These are local surface measurements, not amendments to global tokens.
- GROUND: the existing orbit/sky/terrain background, 236px desktop sidebar, theme switch and mobile navigation remain supplied by the app shell. The lab adds no imagery and makes no global background change.

## Responsive expression

The catalogue has two columns, becoming one at 760px. Code Lab has exercise/editor/output columns above 1200px; at 1200px the exercise spans the row and editor/output share two columns. At 760px the order becomes editor, output, then collapsible exercise details. Algorithm state/pseudocode share two columns on desktop and stack on mobile. Controls wrap, array cells wrap, code/output stay inside bounded scrolling regions, and graph diagrams scale within the panel. This preserves the task order at the checked 360px width.

## Finish evidence

Finish reviewer disposition: **ship**. The fresh reviewer accepted all twelve current source-matched captures, including the declared mobile stacking/order adaptations, with no material UI fixes required. Evidence is `.impeccable/review/it-{hub,code,algorithms}-{desktop,mobile}-{dark,light}.png`; `scripts/qa-it.cjs` records their local QA capture provenance. They are browser captures of the shipped UI, not generated artwork. See `.impeccable/review/it-documentation.md` for checked source and preserved system drift.

`DESIGN.md` and `.impeccable/design.json` remain unchanged because this is an ordinary extension. The final system check records inherited discrepancies without repairing or promoting them into new design rules.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
