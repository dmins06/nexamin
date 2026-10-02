# CNTT Lab

Primary target: src/features/labs/it/ITLabHub.tsx
Mode: Operate. Ordinary extension; preserve Orbit to Surface, Anatomy and the existing app shell.

THESIS: A student opens a local programming workspace or changes a bounded teaching model, then inspects the calculation and why its state changed, without configuring a server.
OWN-WORLD: Existing semantic tokens, glass surfaces, Manrope/Space Grotesk and Lucide. Monospace only for actual code/data.
STORY: Phòng Lab → CNTT → workspace → edit/run/test or configure/step/explain. All eight workspaces are launchable educational betas, with limitations stated in each lab.
FIRST VIEWPORT: Hub with registry catalogue; Code Lab with task/editor/output; Algorithm Lab with input, a prominent state diagram and synchronized pseudocode; six system/model labs with concise limitations, editable fixtures and inspectable state/results.
FORM: Desktop multi-panel, mobile stacked editor-first with collapsible exercise details. Honest local public tests, explicit predefined traces, bounded execution and meaningful recovery.

## Shipped routes and scope

`/labs/it` renders eight registry cards, all labelled “Bản thử nghiệm” with “Mở lab” actions. Code Lab at `/labs/it/code`, Algorithm Lab at `/labs/it/algorithms`, Computer Architecture at `/labs/it/computer`, Network at `/labs/it/network`, Operating System at `/labs/it/os`, Database at `/labs/it/database`, AI / Machine Learning at `/labs/it/ai` and Security at `/labs/it/security` lazy-load independent working workspaces. The six system/model routes no longer render roadmap pages.

Code Lab uses CodeMirror for Python, C, C++, Java and JavaScript, with language-specific templates, exercise selection, stdin, run/stop, separate stdout/stderr and public test results. Code runs through browser workers and local runtime assets; the UI exposes loading/error states and execution limits. Test results are self-study feedback, not official grades or hidden-test judging. Exercise links open the corresponding predefined algorithm, explicitly not a visualization of the student's source. `nexamin.it.code.v1` stores the selected language/exercise, per-exercise/language drafts and stdin through the versioned adapter.

Algorithm Lab implements Bubble, Selection, Insertion, Merge and Quick Sort; Linear and Binary Search; BFS, DFS and Dijkstra. Configurable inputs produce predefined traces with array or graph state, synchronized pseudocode, operation text, metrics, step/play/reset and speed controls. Validation stays next to the input flow. `nexamin.it.algorithms.v1` stores algorithm, inputs and speed; play state and the current step are transient. The explanations disclose implementation-specific complexity and the distinction between swaps and writes.

Phases 2/3 add a sequential teaching CPU with registers/RAM/cache; CPU scheduling, dynamic RAM allocation and single-instance deadlock; actual browser SQLite CRUD/JOIN/query plans/schema; editable simulated topology and packet traces; five small locally calculated ML models; and Web Crypto/demo policy/secure-coding lessons. Their controls, states and local visual measurements are recorded in `.impeccable/surfaces/it-simulations.md`. These are educational betas; advanced hardware, paging, interactive ERD/B-tree, multi-router routing, ML hold-out evaluation and richer models remain future work as specified in `docs/it-lab-phase2-3.md` and `docs/it-lab.md`.

Versioned device preferences store the new labs' selected lessons and editable fixtures; shared playback stores speed, while frames/index/play state stay transient. SQL additionally stores the main practice DB in `nexamin.it.database.snapshot.v1` (version 1, base64 SQLite, up to 512 KiB), as requested by the user. Successful batches save a disposable execution copy; error/Stop/timeout preserve the previous snapshot. Confirmed “Khôi phục dữ liệu mẫu” clears only that practice DB. Storage quota/private mode has a visible SQL notice and a current-tab fallback. Security saves its lesson selection only, never demo input, hash/salt, key or ciphertext.

The existing Emin AI route receives a student-triggered explanation prompt. The lab does not manufacture an AI response; Security deliberately omits this sharing action. Nested routes retain Phòng Lab as the active shell destination and expose Phòng Lab → CNTT Lab → workspace breadcrumbs; child modules load on entry with status and recovery affordances.

## TYPE / MATERIAL / GROUND as built

- TYPE: headings resolve `--font-display` (Space Grotesk, Manrope fallback), with a 24–32px hub/workspace title, 19px card titles and 18px panel titles. Body and controls inherit `--font-body` (Manrope); input labels/buttons are 13px and helper/topic/status text is 12px. Monospace is used for the editor, program output, pseudocode and numeric array data. No new font assets or typography system are introduced.
- MATERIAL: cards/panels use `--glass` with `--surface` fallback, a semantic 1px border, 16px corners and 14px backdrop blur. Padding is 20px desktop and 16px mobile. Fields and diagram nodes use raised/soft semantic surfaces; active, settled and error states use accent, success and danger tokens. Buttons/fields have 44px minimum height and controls have a visible 2px accent focus outline. These are local surface measurements, not amendments to global tokens.
- GROUND: the existing orbit/sky/terrain background, 236px desktop sidebar, theme switch and mobile navigation remain supplied by the app shell. The lab adds no imagery and makes no global background change.

## Responsive expression

The catalogue has two columns, becoming one at 760px. Code Lab has exercise/editor/output columns above 1200px; at 1200px the exercise spans the row and editor/output share two columns. At 760px the order becomes editor, output, then collapsible exercise details. Algorithm state/pseudocode share two columns on desktop and stack on mobile. Controls wrap, array cells wrap, code/output stay inside bounded scrolling regions, and graph diagrams scale within the panel. This preserves the task order at the checked 360px width.

The six new workspaces use a two-panel input/result grid (1:1.2 ratio, 18px gap), stacking at 760px. Simulation panels use the existing stronger glass token. Their mobile playback separates restart, previous/play/next and speed; focusable table containers keep wide data scrolling within panels. See the simulation surface record for observed scope and explicit limits.

## Finish evidence

Phase 1 finish disposition: **ship**, accepted against twelve hub/Code/Algorithm captures with the declared mobile adaptations. Its evidence is `.impeccable/review/it-{hub,code,algorithms}-{desktop,mobile}-{dark,light}.png`, generated by `scripts/qa-it.cjs`. `.impeccable/review/it-documentation.md` is that earlier pass's historical record; its two-active/six-roadmap statement is superseded by the current registry and this document.

Phase 2/3 finish disposition: **ship**, with no material UI fixes, in `.impeccable/review/it23-finish-review.md`. The fresh reviewer accepted all 24 valid default-view captures: `.impeccable/review/it23-{computer,os,database,network,ai,security}-{desktop,mobile}-{dark,light}.png`, generated by `scripts/qa-it-phases.cjs`. Non-default lessons/models have reported functional verification, not a visual verdict. These are browser captures of fixture-backed teaching UI, not generated artwork or live account evidence. See `.impeccable/review/it23-documentation.md` for this source check and preserved drift.

`DESIGN.md` and `.impeccable/design.json` remain unchanged because this is an ordinary extension. The final system check records inherited discrepancies without repairing or promoting them into new design rules.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
