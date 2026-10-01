import { WASI, type WASIFS } from '@runno/wasi'
import type { ExecutionRequest, ExecutionResult } from '../codeTypes'
import { boundExecutionOutput, executionLimits } from './limits'
import { unpackRuntime } from './archive'
import { boundWasmMemory } from './wasmMemory'
interface WorkerRequest {
  request: ExecutionRequest
  assets: Record<string, Uint8Array>
}
// Only WASI imports are available to guest code. No JS eval or network bridge.
self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  const started = performance.now()
  let stdout = '',
    stderr = '',
    totalOutput = 0,
    written = 0,
    compiled = false
  const { request, assets } = data,
    encoder = new TextEncoder()
  const out = (text: string, error: boolean) => {
    totalOutput += encoder.encode(text).length
    if (totalOutput > executionLimits.outputBytes) throw Error('OUTPUT_LIMIT')
    if (error) stderr += text
    else stdout += text
  }
  const file = (path: string, content: Uint8Array) => ({
    path,
    content,
    mode: 'binary' as const,
    timestamps: {
      access: new Date(),
      modification: new Date(),
      change: new Date(),
    },
  })
  const archiveName =
    request.language === 'python' ? 'python-3.11.3.tar.gz' : 'clang-fs.tar.gz'
  let fs: WASIFS = {}
  try {
    if (request.language !== 'javascript') {
      const archive = assets[archiveName]
      if (!archive) throw Error('Runtime chưa sẵn sàng.')
      fs = Object.fromEntries(
        Object.entries(unpackRuntime(archive)).map(([path, content]) => [
          path,
          file(path, content),
        ]),
      )
    }
    const jsPrelude = `const readAll = () => ${JSON.stringify(request.stdin)}; const readline = (() => {const lines = readAll().split(/\\r?\\n/); let i=0; return () => lines[i++] ?? "";})();\n`
    fs['/program'] = file(
      '/program',
      encoder.encode(
        (request.language === 'javascript' ? jsPrelude : '') +
          request.sourceCode,
      ),
    )
    async function run(
      binary: Uint8Array,
      args: string[],
      env: Record<string, string>,
      compile: boolean,
    ) {
      self.postMessage({
        phase: compile ? 'Đang biên dịch…' : 'Đang chạy…',
        timeout: compile ? executionLimits.compileMs : executionLimits.runMs,
      })
      let input = request.stdin
      const wasi = new WASI({
        args,
        env,
        fs,
        isTTY: false,
        stdin: (max) => {
          if (!input) return null
          let chunk = '',
            len = 0
          for (const c of input) {
            const n = encoder.encode(c).length
            if (len + n > max) break
            chunk += c
            len += n
          }
          input = input.slice(chunk.length)
          return chunk || null
        },
        stdout: (text) => out(text, false),
        stderr: (text) => out(text, true),
      })
      // One ephemeral filesystem; bound guest writes before WASI allocates buffers.
      const write = wasi.fd_write.bind(wasi)
      wasi.fd_write = (fd, ptr, count, result) => {
        if (fd > 2) {
          const view = new DataView(wasi.memory.buffer)
          for (let i = 0; i < count; i++)
            written += view.getUint32(ptr + i * 8 + 4, true)
          if (written > executionLimits.fileWriteBytes)
            throw Error('FILE_LIMIT')
        }
        return write(fd, ptr, count, result)
      }
      const resize = wasi.fd_filestat_set_size.bind(wasi),
        allocate = wasi.fd_allocate.bind(wasi),
        open = wasi.path_open.bind(wasi)
      let opens = 0
      wasi.fd_filestat_set_size = (fd, size) => {
        if (size > BigInt(executionLimits.fileWriteBytes))
          throw Error('FILE_LIMIT')
        return resize(fd, size)
      }
      wasi.fd_allocate = (fd, offset, length) => {
        if (offset + length > BigInt(executionLimits.fileWriteBytes))
          throw Error('FILE_LIMIT')
        return allocate(fd, offset, length)
      }
      wasi.path_open = (...parameters) => {
        opens++
        if (opens > (compile ? 4096 : 256)) throw Error('FILE_LIMIT')
        return open(...parameters)
      }
      const imports = wasi.getImportObject()
      const memoryBound = boundWasmMemory(
        binary,
        compile ? 8192 : executionLimits.memoryPages,
      )
      const instance = await WebAssembly.instantiate(memoryBound, imports)
      const result = wasi.start(instance)
      fs = result.fs
      return result.exitCode
    }
    let exitCode = 0
    if (request.language === 'c' || request.language === 'cpp') {
      const clang = assets['clang.wasm'],
        linker = assets['wasm-ld.wasm']
      if (!clang || !linker) throw Error('Runtime chưa sẵn sàng.')
      const args =
        request.language === 'cpp'
          ? [
              'clang',
              '-cc1',
              '-Werror',
              '-emit-obj',
              '-disable-free',
              '-isysroot',
              '/sys',
              '-internal-isystem',
              '/sys/include/c++/v1',
              '-internal-isystem',
              '/sys/include',
              '-internal-isystem',
              '/sys/lib/clang/8.0.1/include',
              '-ferror-limit',
              '4',
              '-O1',
              '-o',
              '/program.o',
              '-x',
              'c++',
              '/program',
            ]
          : [
              'clang',
              '-cc1',
              '-Werror',
              '-triple',
              'wasm32-unkown-wasi',
              '-isysroot',
              '/sys',
              '-internal-isystem',
              '/sys/include',
              '-internal-isystem',
              '/sys/lib/clang/8.0.1/include',
              '-ferror-limit',
              '4',
              '-O1',
              '-emit-obj',
              '-o',
              '/program.o',
              '/program',
            ]
      exitCode = await run(clang, args, {}, true)
      if (exitCode === 0)
        exitCode = await run(
          linker,
          [
            'wasm-ld',
            '--no-threads',
            '--export-dynamic',
            '-z',
            'stack-size=1048576',
            '-L/sys/lib/wasm32-wasi',
            '/sys/lib/wasm32-wasi/crt1.o',
            '/program.o',
            '-lc',
            ...(request.language === 'cpp' ? ['-lc++', '-lc++abi'] : []),
            '-o',
            '/program.wasm',
          ],
          {},
          true,
        )
      if (exitCode !== 0) {
        self.postMessage({
          status: 'compile-error',
          stdout,
          stderr,
          exitCode,
          executionTime: performance.now() - started,
        } satisfies ExecutionResult)
        return
      }
      compiled = true
      const program = fs['/program.wasm']
      if (!program || program.mode !== 'binary')
        throw Error('Không tìm thấy chương trình đã biên dịch.')
      fs = { '/program.wasm': program }
      exitCode = await run(program.content, ['program'], {}, false)
    } else {
      compiled = true
      const binary =
        assets[
          request.language === 'python'
            ? 'python-3.11.3.wasm'
            : 'wasmedge_quickjs.wasm'
        ]
      if (!binary) throw Error('Runtime chưa sẵn sàng.')
      exitCode = await run(
        binary,
        [request.language === 'python' ? 'python' : 'quickjs', '/program'],
        {},
        false,
      )
    }
    self.postMessage({
      status: exitCode === 0 ? 'success' : 'runtime-error',
      stdout,
      stderr,
      exitCode,
      executionTime: performance.now() - started,
    } satisfies ExecutionResult)
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Không thể chạy chương trình.'
    self.postMessage({
      status: reason.endsWith('_LIMIT')
        ? 'limit'
        : compiled
          ? 'runtime-error'
          : 'unavailable',
      ...boundExecutionOutput(
        stdout,
        reason.endsWith('_LIMIT')
          ? 'Chương trình vượt giới hạn output hoặc tệp tạm.'
          : `${stderr}\n${reason}`,
      ),
      exitCode: null,
      executionTime: performance.now() - started,
    } satisfies ExecutionResult)
  }
}
