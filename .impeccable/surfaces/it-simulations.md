# IT Lab — Phase 2/3

Mode: Operate. Ordinary extension of existing CNTT workspaces; no new visual world or comp round.

## Direction contract

THESIS: Change a bounded teaching model, run a real calculation, and inspect why its state changed.
OWN-WORLD: Incumbent Nexamin typography, glass panels, semantic dark/light tokens, Lucide controls and native data geometry. No raster/3D assets or global redesign.
STORY: Enter a lab → configure a small fixture → step/run → compare states/results → explanation/exercise → optional Emin AI draft.
FIRST VIEWPORT: Existing breadcrumb/title, concise model limitations, input controls and the first real state/result. CPU shows registers/RAM and phase; OS shows schedule; SQL shows editor/result; Network shows topology; ML shows data/model; Security shows a local lesson.
FORM: Precisely requested teaching-workspace extension, code-led, no concept seed. Two panels on desktop, input then simulation then explanation on mobile; native diagram geometry and accessible data alternatives. Versioned device preferences; no production data connection or external attack targets.

## Shipped routes and teaching scope

All six routes now lazy-load independent working educational betas: `/labs/it/computer`, `/labs/it/os`, `/labs/it/database`, `/labs/it/network`, `/labs/it/ai` and `/labs/it/security`. Together with Code and Algorithms, `itLabRegistry.ts` exposes eight “Bản thử nghiệm” cards with “Mở lab” actions. The six routes no longer render roadmap pages. `ITLabLayout` supplies the existing breadcrumb, loading status and per-route error recovery; the catalogue imports metadata rather than simulation engines or SQLite WASM.

| Workspace | Observed controls and output | Explicit boundary |
| --- | --- | --- |
| Computer Architecture | Editable LOAD/ADD/STORE/HALT program and initial RAM; sample reset; synchronized instruction, Fetch/Decode/Execute phase, PC, four registers, 16 RAM cells, four cache lines and hit/miss counts; snapshot playback. | Sequential 32-bit teaching CPU with separated instruction/data memory, not physical 3D hardware, GPU or pipeline. |
| Operating System | Pressed-state lesson buttons for scheduling, memory and deadlock; FCFS/SJF/SRTF/RR/Priority, conditional quantum, editable processes, Gantt and waiting/turnaround/response table; First/Best/Worst Fit blocks and single-instance wait-cycle results. | Inputs recalculate immediately; one CPU without context-switch cost. Paging/replacement, compaction and Banker remain future work. |
| Database | SQL Playground, JOIN Visualizer and ERD & Index lesson buttons; SQL templates/editor, Run, Stop and confirmed restore; actual SQLite result tables, elapsed time, row changes and schema DDL; INNER/LEFT/RIGHT/FULL matching table. | Local SQLite practice DB, separate from Nexamin. ERD is readable DDL/relationship text; query plans are real SQLite output. Drag/drop ERD, interactive B-tree and animated JOIN pairing are not shipped. |
| Network | Editable device/link tables, one-subnet and two-subnet examples, source/destination selects; responsive SVG topology, current packet node, layer, route, IP text and failure explanation; snapshot playback. | Simulated HTTP/TCP/IPv4/Ethernet, one router and at most two directly connected networks; no real packets, full ARP/TCP handshake, multi-router routing tables or IPv6. |
| AI / Machine Learning | Five model choices, editable points and model-specific parameters; query coordinates; sample reset; SVG points/regression line/centroids/query marker, iteration, training loss, prediction and an expandable data table; snapshot playback. | Small deterministic regression, KNN, KMeans, CART and dense MLP calculations. Training loss does not prove generalization; no automatic hold-out split, CNN/Transformer/RAG or GPU framework. |
| Security | Hash & Salt, AES-GCM, Authentication / Authorization and Secure Coding lessons; bounded demo text and async crypto actions; read-only hash/cipher output, tamper rejection, demo role/ownership/action result and safe-code examples. | Web Crypto and local policy/text demonstrations. No target URL, exploit, real permission change or authentication flow; no AI-sharing control. |

The detailed educational-beta and advanced-future limits are recorded in `docs/it-lab-phase2-3.md` and `docs/it-lab.md`. Real calculation here means local engine/WASM/Web Crypto output from labeled teaching fixtures; it does not imply production hardware, network traffic or live account data.

## Controls, states and persistence as built

`LabIntro` presents one title, short Vietnamese description and explicit model notice. Errors use adjacent `role="alert"`; phase/operation, SQL progress and crypto output use status announcements. Lesson selectors are native buttons with `aria-pressed`, not an invented tab widget. Playback offers restart, previous, play/pause, next and 0.5×/1×/2×; unavailable actions are disabled at trace boundaries. Input changes reset the transient index and play state. OS has immediate recalculation rather than playback; SQL and crypto have busy/disabled states. SQL also distinguishes empty results, no returned table, truncated output, loading, running, failure, Stop and save/quota notices.

The version-1 device adapter stores string preferences under `nexamin.it.{cpu,os,sql-editor,network,ml,security-lesson,playback}.v1`; malformed or unknown versions recover to defaults. Shared playback remembers speed only. CPU/network/ML frames, current step and playing state are transient. Security remembers the selected lesson only: input, salt/hash, key, ciphertext and policy choices remain in memory.

SQL follows the user's device-persistence preference: `nexamin.it.database.snapshot.v1` stores a version-1, base64 SQLite snapshot capped at 512 KiB. Each run opens a disposable copy; only a fully successful batch replaces the saved main practice DB. Error, Stop and timeout preserve its previous snapshot. Quota/private-mode failure keeps the latest successful snapshot in the current tab and displays a notice. “Khôi phục dữ liệu mẫu” requires native confirmation, clears the practice snapshot and starts the sample DB on the next run; it does not reset editor preferences or Nexamin data. Browser storage is plaintext, device-local and clearable, without account sync.

`LabExplain` drafts a bounded student-requested question through the existing session adapter and navigates to Emin AI; it supplies no generated response. The core labs work without AI. Security omits this sharing action.

## Scoped visual and responsive expression

TYPE inherits Space Grotesk/Manrope through the active CSS cascade. Titles use `clamp(24px, 3vw, 32px)`, panel titles 18px, labels/buttons 13px and helper text 12px; prose has 1.65 line height. Monospace remains for concrete code/data. Tables and memory values use tabular numerals.

MATERIAL retains semantic `--glass-strong` with `--surface` fallback for simulation panels, a 1px `--border`, 16px corners, 14px backdrop blur and 20px padding (16px mobile). Inputs use raised surfaces; nodes/cells use soft surfaces; accent denotes the active phase/node, success/warning/danger encode existing data states. Intro/notice/breadcrumb text uses `--text` for legibility over the inherited environment. In light mode operation text also uses `--text`. These scoped measurements are observations, not new global tokens or rules.

GROUND is supplied by the unchanged Orbit to Surface shell, imagery and theme switch. No new raster, font, 3D asset or illustration was added. Literal cells, flow boxes, tables and SVG geometry carry the teaching data.

`.it-sim-grid` uses `minmax(0, 1fr) minmax(0, 1.2fr)` with an 18px gap, becoming one column at 760px. Mobile reads input, state/result, then explanation. Playback places restart on its own row, then previous/play/next, then speed; controls and schedule/memory blocks wrap. CPU memory remains a four-column grid. SVG plots/topology scale to their panel (maximum 460px); long tables scroll inside focusable labeled containers. Buttons/fields have 44px minimum height; native controls and scrollable tables expose 2px accent focus outlines. Caret and selection have scoped theme treatment.

## Accepted finish evidence

Fresh finish reviewer disposition: **ship**, with no material UI fixes. `.impeccable/review/it23-finish-review.md` accepted all 24 valid supplied captures: six default workspaces × desktop/mobile × dark/light. Evidence names are `.impeccable/review/it23-{computer,os,database,network,ai,security}-{desktop,mobile}-{dark,light}.png`; `scripts/qa-it-phases.cjs` records local browser-capture provenance. Captures depict rendered teaching outputs within fixture authentication/profile state, not live account data or generated artwork.

Only the six default views received this visual verdict. Other lessons/model selections have reported functional checks; they are not claimed as visually reviewed. This documenter performed source verification, not a new browser capture, QA execution or polish pass. `DESIGN.md` and `.impeccable/design.json` remain incumbent authority, unchanged for this ordinary extension. Evidence and inherited drift are recorded in `.impeccable/review/it23-documentation.md`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
