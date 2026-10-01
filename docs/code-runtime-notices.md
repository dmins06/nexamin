# Code Lab runtime provenance and licenses

Runtime binaries are fetched at build time by `scripts/prepare-code-runtimes.mjs`, verified against `scripts/code-runtime-lock.json`, and served with the following notices at `/runtimes/code/`. No downloaded binary is committed into Nexamin source control. Archives are kept unchanged; the runner only inserts a WebAssembly memory maximum in memory, per execution.

| Component | Version / upstream | License / accompanying notice |
| --- | --- | --- |
| Runno WASI host | @runno/wasi 0.10.0 | MIT, RUNNO-LICENSE |
| CPython WASI runtime | Python 3.11.3 via VMware / Runno | PSF and bundled notices, PYTHON-LICENSE.txt; VMware build tools Apache-2.0 |
| Clang / LLD | wasm-clang, LLVM 8.0.1 | LLVM/NCSA and third-party licenses, LLVM-LICENSE.txt |
| libc++ / libc++abi | bundled WASI sysroot | LLVM/NCSA/MIT, LIBCXX-LICENSE.txt |
| WasmEdge QuickJS | Runno's wasmedge_quickjs.wasm | Apache-2.0 wrapper and MIT QuickJS, WASMEDGE-QUICKJS-LICENSE.txt / QUICKJS-LICENSE.txt |
| DoppioJVM | 0.5.0, bundled doppio.jar | MIT, DOPPIO-LICENSE |
| BrowserFS | 1.4.3 (only inside Java sandbox) | MIT, BROWSERFS-LICENSE |
| Java class library | Doppio JCL v3.2, OpenJDK 8 | GPL-2.0 with Classpath exception, OPENJDK-LICENSE.txt, ASSEMBLY_EXCEPTION, THIRD_PARTY_README |
| fflate | 0.8.3 | MIT, FFLATE-LICENSE |
| CodeMirror / Lezer | npm lockfile versions | MIT, upstream package notices |

Copyright holders and full terms are in the accompanying license texts, not superseded by this summary. The MIT license of Doppio's scripts does not relicense OpenJDK. Nexamin does not claim authorship of these runtimes.

## Corresponding upstream sources / build instructions

- [Runno source, runtime recipes and language assets](https://github.com/taybenlor/runno), host revision `f19db53b7bd4ec92fcb0f8b3059bc87aeaf998e2`.
- [Python v3.11.3 source](https://github.com/python/cpython/tree/v3.11.3), [VMware WebAssembly language runtime build recipes](https://github.com/vmware-labs/webassembly-language-runtimes).
- [LLVM 8.0.1 source](https://github.com/llvm/llvm-project/tree/llvmorg-8.0.1), [wasm-clang build recipes](https://github.com/binji/wasm-clang); bundled libc++/libc++abi are from the LLVM source tree. [WASI libc](https://github.com/WebAssembly/wasi-libc).
- [WasmEdge QuickJS source](https://github.com/second-state/wasmedge-quickjs), [QuickJS source](https://github.com/bellard/quickjs).
- [DoppioJVM source](https://github.com/plasma-umass/doppio), [BrowserFS source](https://github.com/jvilk/BrowserFS/tree/v1.4.3), [Doppio JCL build scripts and modifications](https://github.com/plasma-umass/doppio_jcl). JCL's `Grunttasks.ts` identifies the OpenJDK package inputs, including `openjdk-8_*_8u72-b05-1ubuntu1_i386.deb` and timezone data; this is an old educational runtime, not a current Java security runtime.
- [OpenJDK 8 upstream source](https://github.com/openjdk/jdk8u) and [Ubuntu OpenJDK 8 source packages](https://launchpad.net/ubuntu/+source/openjdk-8/8u72-b05-1ubuntu1). Preserve the upstream source/build links and GPL/ClassPath notices if redistributing this component; a modified distributor must fulfill its corresponding-source obligations for its exact build.
- [fflate source](https://github.com/101arrowz/fflate), [CodeMirror](https://github.com/codemirror), [Lezer](https://github.com/lezer-parser).

Downloaded source/license URLs and SHA-256 checksums are pinned in the lock manifest. `--record-lock` is a maintainer-only update command, never used in production builds. Do not change a checksum just to bypass a failed integrity check.
