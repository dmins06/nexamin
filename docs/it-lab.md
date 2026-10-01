# CNTT Lab — Phase 1

## Completed / prepared

- IT Hub: registry-driven eight modules, independent URL routes and lazy imports.
- Code Lab: Python/C/C++/Java/JavaScript, CodeMirror 6, per-exercise/language drafts, stdin/stdout/stderr, elapsed compile/run time, Stop, reset confirmation, public tests and optional question draft for Emin AI.
- Six starter exercises: Hello World, sum, prime, Fibonacci, Binary Search, Bubble Sort. Hello/sum include working examples; the other four intentionally have TODO templates for the student. Tests are educational, public and local, not tamper-proof grading.
- Algorithm Lab: Bubble/Selection/Insertion/Merge/Quick Sort, Linear/Binary Search, BFS/DFS/Dijkstra; data editing, trace snapshots, play/pause, previous/next/restart, three speeds, synchronized pseudocode, comparisons/swaps/visited nodes and explained complexity.
- Six remaining labs have independent domain contracts and truthful roadmap routes. CPU, network, OS, SQL, ML and security demonstrations are **not implemented**. Array is visualized in sort/search, queue in BFS and stack in DFS; linked lists/BST/heaps/hash tables are future work.
- No Anatomy implementation, authentication, production database or Gemini configuration was changed.

## Routes

`/labs/it` → `code`, `algorithms`, `computer`, `network`, `os`, `database`, `ai`, `security`.

`/labs/it/algorithms?algorithm=binary` can open a predefined trace from a matching Code Lab exercise. It does **not** inspect, execute or visualize arbitrary submitted source. Browser history/deep refresh use the existing router and Vercel rewrite.

## Module layout

`src/features/labs/it/` contains typed registry/card/hub/layout, six future domain folders, and independent `code/` / `algorithms/` implementations. Shared controls and AI handoff are in `shared/`. The layout contains per-route error recovery; root authentication still protects these routes.

Hub metadata imports neither CodeMirror, runners, Three.js nor algorithm engines. `CodeLab` is about 248 KB gzip including the editor and language support; that chunk only loads on its own route. Runtime assets load only after Run/Test. Algorithm Lab is about 8 KB gzip. These sizes are build observations, not budgets guaranteed for later changes.

## Running / deployment

```
npm ci
npm run prepare:code
npm run dev:frontend
```

`npm run build` verifies/downloads runtime assets, typechecks and builds Vite into `dist`. Requires Node supporting the project toolchain, `curl`, network access to pinned download sources, and roughly 400 MB spare space for assets/build/cache. No new backend service, API key, paid infrastructure, database migration, Docker privilege or cross-origin-isolation headers are required. `npm run dev` retains the current full-stack workflow.

Vercel uses the existing `npm run build` command. All generated binaries are ignored by Git and fetched/verified during the build; a checksum mismatch deliberately fails deployment. Original `.gz` downloads also get `.gz.bin` serving copies to prevent Vite's transparent Content-Encoding handling from altering runtime bytes. Preserve the accompanying licenses/source notices. This release adds no credential to frontend code.

## Execution API / extending languages

The interface `CodeExecutionProvider.execute(request, signal, onPhase)` returns `{status, stdout, stderr, exitCode, executionTime}`. `executionTime` is milliseconds, excludes asset downloads, includes preparation/compilation/run. UI depends on the provider contract, not a vendor. `providers.ts` selects WASI versus isolated Java. There is **no** `/api/code/execute` endpoint in this release: execution remains entirely client-side. A future remote provider must satisfy [the security model](code-execution-security.md), not call subprocess from FastAPI.

To add a language: extend the explicit `CodeLanguage` union, metadata/editor grammar, every starter template, a compatible provider/runtime recipe and its pinned asset/license manifest. Add source/stdin/output/error/timeout/Stop tests. Do not fall through to an incompatible existing runtime. Java is Java 8, JavaScript is QuickJS rather than Node, and Python supports the packaged standard library rather than pip.

## Extending labs / algorithms

To release a lab: implement its independent component, add a lazy route, update its typed registry status only after functionality/security/tests exist. A domain interface or roadmap alone does not justify `available`.

To add an algorithm: extend `AlgorithmId`, definition/pseudocode/complexity and the pure trace generator; produce immutable frames with valid `codeLine`, actual operation metrics and state. Test correctness/edge cases before rendering. Input caps bound trace generation; Dijkstra uses a linear scan, hence O(V² + E), not heap complexity. Binary Search shows an explicitly sorted array; indices refer to that displayed array. Stack/queue semantics are visible in graph traversal frontiers.

## Persistence / AI / limits

Drafts use `nexamin.it.code.v1`, simulation choices `nexamin.it.algorithms.v1`; malformed/unknown versions recover safely. Stored source is plaintext on this device: do not place API keys or passwords in exercise code. Runtime files and program filesystem state are not saved between executions. Test results are invalidated on exercise/language change and each new run.

Hỏi Emin AI places a bounded question into the existing `studyhub.ai.draft.v1` session adapter and navigates to `/assistant`. The existing tutor still needs an authenticated account, selected course, configured Gemini backend and its normal quota. The lab works without AI; asking is optional, and the draft may include source/input/output the student deliberately shares.

Java's interpreter/JIT/class-library implementation is old, slower and heavier than native Java, especially on low-memory phones. Limits protect server resources by avoiding server execution; browser overhead/Java object heap are **not** a hard OS RAM quota. A hostile memory-heavy program may still crash its local tab. No hidden tests, package managers, multiple-file projects, network programs, full IDE debugging or arbitrary-code tracing are claimed.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- `node scripts/qa-it.cjs`: real runtime execution for all five languages, public test cases, compile/runtime errors, Stop/infinite-loop timeout/output limit, Java bridge denial/batch EOF, local Python socket denial, algorithm controls and desktop/mobile dark/light captures. Auth/profile APIs are mocked for a synthetic QA user; actual compilers/interpreters are not mocked.
- Isolation probes are enforced localhost-only. For a deployed smoke test use `QA_BASE_URL=https://nexamin.id.vn QA_SMOKE_ONLY=1 QA_FUNCTIONAL_ONLY=1 node scripts/qa-it.cjs`; this skips isolation probes while running real languages/public tests and navigation/algorithm checks. `QA_CAPTURE_ONLY=1` captures the twelve desktop/mobile dark/light views separately.
- `node scripts/qa-routing.cjs`: existing routes, refresh, browser history, mobile navigation, protected guest deep links and Anatomy regression.
- `npm audit --omit=dev`: production npm packages. Vendored JVM/class library require a separate isolation review; npm audit is not a certification of their safety.

Next: Phase 2 CPU instruction-cycle model, OS scheduling with calculation tests, and SQLite-WASM in a separate browser worker. Keep SQL away from the Nexamin API/database. Then add Phase 3 isolated network/ML/security teaching models.
