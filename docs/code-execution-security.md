# Code execution security model

## Boundary / selection

Student programs are untrusted. No endpoint was added to FastAPI and no student source executes in the backend, a shell, Docker host or production database. The selected free approach is local WASI for Python/C/C++/QuickJS and an opaque-origin Java sandbox. It works with the existing static Vercel frontend and ordinary Render backend, without privileged containers or API secrets.

Piston's current public API requires discretionary authorization; self-hosting needs isolation infrastructure not available in an ordinary free Render service. Runno's high-level runtime lacks Java and normally uses SharedArrayBuffer for interactive stdin. This implementation uses its lower-level WASI host with batch stdin instead. Wandbox is not relied on because its public interface has no production SLA and the reviewed container invocation did not establish a default network-off guarantee. TeaVM playground's System.in implementation could not fulfill the requested Java stdin behavior. See [Piston](https://github.com/engineer-man/piston), [Runno](https://github.com/taybenlor/runno), [Wandbox](https://github.com/melpon/wandbox), [TeaVM](https://github.com/konsoletyper/teavm).

## WASI boundary

Each request creates a dedicated Worker. Only WASI imports are linked to guest modules; user JavaScript runs inside QuickJS WASM, never `eval` in the Nexamin origin. The host emulates a fresh in-memory filesystem, argv, empty environment and batch stdin. No DOM/storage/fetch/host filesystem/database/OS process capability is exported. Socket imports return unsupported errors in the WASI host. After C/C++ linking, the run filesystem is discarded except for the compiled program.

Before instantiation the memory section is rewritten to cap linear memory. Shared, multi-memory or incompatible layouts fail closed. Filesystem writes, allocation, truncation and open calls are bounded before invoking emulated syscalls. Stop/timeout terminate the Worker. No guest-supplied archives are extracted; only build-verified runtime archives are accepted.

## Java boundary

Java runs in a Worker created by a hidden iframe with `sandbox="allow-scripts"` and **without** `allow-same-origin`. Its origin is opaque, so it cannot read Nexamin cookies/localStorage/sessionStorage or DOM. The iframe has a strict CSP: default/connect/img/media/frame/object sources disabled, scripts limited to a per-run nonce/blob and generated-JS evaluation needed by the JVM. The Worker inherits the network-off CSP. Network/child-worker APIs are also made unavailable in the Worker. `doppio.JavaScript.eval` is explicitly replaced with a SecurityException before user Main runs.

Only trusted runtime bytes plus the user's bounded source/stdin are passed into that sandbox. BrowserFS is configured only as InMemory, never LocalStorage/IndexedDB/XMLHttpRequest filesystems. A fresh runtime and JVM are created for each request. Batch fd-0 adapters supply UTF-8 bytes and true EOF without an interactive prompt. Temporary writes/truncation/open operations are bounded. Runtime errors are rendered as text, not interpreted HTML.

A trusted Java entry point catches exceptions from `Main.main` and exits nonzero. Doppio otherwise reports zero for some uncaught exceptions; stderr alone is never interpreted as a failed run. This handles the single-main educational workflow, not reliable diagnosis of every user-created background thread. Combined stdout/stderr results are bounded and validated in UTF-8 bytes, including trusted error messages.

Parent messages are accepted only from the exact iframe window, opaque `null` origin and random per-run channel. Result shape/status/output lengths/time are validated; unexpected messages are ignored. Student text is never inserted into srcdoc or a script tag. Stop/timeout remove the iframe and its Worker realm; listeners/timers are cleaned up, including navigation/unmount.

## Enforced limits

| Resource | WASI / Java |
| --- | --- |
| Source / stdin | 32 KiB / 16 KiB UTF-8 |
| Combined stdout + stderr | 64 KiB |
| Runtime asset loading | 90 seconds, abortable |
| WASI guest running | 10 seconds per run |
| C/C++ compilation/link | 25 seconds per stage |
| Java initialize/compile/run | 30 seconds total |
| WASI linear memory | 256 MiB guest; 512 MiB trusted compiler |
| Temporary guest writes / file size | 8 MiB |
| Open calls | 256 WASI guest, 4096 trusted compiler; 512 Java |
| Network | No guest network |
| Host process creation | No host processes; no exposed spawning API |

These are **browser** controls, not server-side CPU/RAM quotas. Browser memory includes runtime assets, host JS objects, compilation overhead and trace/UI state outside linear WASM memory. Java object allocations and simulated threads do not have a reliable hard total RAM/thread quota. Deliberate resource exhaustion can affect the user's own tab; a browser sandbox is not a guarantee against browser/JVM vulnerabilities. Java 8/Doppio/BrowserFS are old educational components, not suitable for executing hostile code in a shared server process. This limitation must remain visible/documented, not described as complete OS isolation.

## API abuse / secrets / tests

There is no execution API to abuse or charge a shared compute quota. UI permits one run/batch at a time and aborts on navigation. A user modifying client code may bypass their own device limits, not backend isolation. Static download bandwidth is still subject to the hosting plan. AI requests retain existing authenticated backend quotas; no new Gemini key is needed or shipped.

Tests are deliberately all public/local. A client cannot protect hidden expected outputs or provide trusted grading; future server grading needs a separate isolated executor, authenticated quotas, strict CPU/wall/RAM/process/output/FS limits, network disabled and robust teardown. Never substitute `subprocess.run` inside FastAPI or unrestricted JS eval because a remote runner is unavailable.

## Local SQL and security teaching boundaries

SQLite runs only in a dedicated browser Worker, initialized from the trusted pinned sql.js WASM. Student queries are SQL data, never JavaScript, and no SQL-to-JS functions or production connection are exposed. Worker has no DOM/localStorage; it receives only SQL and the bounded local practice snapshot. Its trusted initialization fetches the static WASM, not arbitrary query-controlled URLs. Each run owns a disposable DB copy: success exports the main practice DB, failure/Stop/timeout discards the worker and keeps the previous snapshot. There is no SQL execution endpoint or backend credential. Manual transactions are rejected; the run lifecycle owns persistence. Extra attached SQLite files are ephemeral, not host files.

Limits: SQL 32 KiB; 20 statements; 32 columns; 200 displayed rows/result; combined row output 64 KiB; snapshot 512 KiB; load 20 seconds then computation 3 seconds. Trusted initialization sets SQLite hard heap 64 MiB and max-page-count 128; WASM linear memory is rewritten to a 256 MiB maximum. Student PRAGMA may alter SQLite limits, so the outer Worker timeout/WASM/output/snapshot bounds remain authoritative. Host browser/JS overhead is not covered by that linear-memory cap; this is not a hard OS memory quota or proof against browser/WASM implementation vulnerabilities.

Security lessons run only bounded trusted routines on ephemeral demo strings: Web Crypto SHA-256, PBKDF2-SHA256 with fresh salt, non-exportable AES-GCM key/fresh IV and actual authenticated decryption failure. The UI takes no target URLs, executes no injection payload, calls no auth-management API and persists no crypto inputs/results/key. Role/ownership dropdowns only exercise a pure mock policy, never actual privileges. No student JavaScript is evaluated; SQL/HTML examples render as React text. There is intentionally no AI-share button in this lab.

## Validation scope / residual findings

Unit/component tests cover request/result contracts, byte caps, memory rewriting, drafts, cases/cancellation, algorithm correctness and invalid inputs. Real-browser QA exercises compilers/interpreters, errors, infinite-loop Stop/timeout, oversized output, Java bridge denial/EOF and a local-only socket attempt. These are regression checks, not a browser exploit penetration test. npm production audit is supplemented by manual vendored-Java isolation review; five pre-existing dev-tool advisories (Vitest/Vite/esbuild chain) remain outside this feature, with development listeners bound to localhost. No claim is made that npm audit covers vendored JDK code or all vulnerabilities.

Keep [runtime source/license notices](code-runtime-notices.md), hashes and sandbox tests with any upgrade. Bandit/Semgrep/Gitleaks/pip-audit were unavailable in this environment; unavailable scanners are not reported as passing.
