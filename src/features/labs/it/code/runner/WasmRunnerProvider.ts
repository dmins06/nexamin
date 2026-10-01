import type { CodeExecutionProvider, ExecutionResult } from '../codeTypes'
import { executionLimits, isExecutionResult, validateExecution } from './limits'
import { loadRuntimeAssets } from './runtimeAssets'
export const wasmRunner: CodeExecutionProvider = {
  async execute(request, signal, onPhase) {
    const invalid = validateExecution(request)
    if (invalid)
      return {
        status: 'limit',
        stdout: '',
        stderr: invalid,
        exitCode: null,
        executionTime: 0,
      }
    const started = performance.now(),
      assetAbort = new AbortController(),
      abort = () => assetAbort.abort()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    const loading = setTimeout(() => assetAbort.abort(), executionLimits.loadMs)
    try {
      onPhase?.('Đang tải runtime cho lần chạy đầu…')
      const assets = await loadRuntimeAssets(
        request.language,
        assetAbort.signal,
      )
      if (signal.aborted) throw Error('STOPPED')
      return await new Promise<ExecutionResult>((resolve) => {
        const worker = new Worker(
          new URL('./wasi.worker.ts', import.meta.url),
          { type: 'module' },
        )
        let timer: ReturnType<typeof setTimeout>,
          finished = false
        const finish = (result: ExecutionResult) => {
          if (finished) return
          finished = true
          clearTimeout(timer)
          signal.removeEventListener('abort', stop)
          worker.terminate()
          resolve(result)
        }
        const stop = () =>
          finish({
            status: 'stopped',
            stdout: '',
            stderr: 'Đã dừng chương trình.',
            exitCode: null,
            executionTime: performance.now() - started,
          })
        const timeout = (ms: number) => {
          clearTimeout(timer)
          timer = setTimeout(
            () =>
              finish({
                status: 'timeout',
                stdout: '',
                stderr:
                  'Chương trình vượt thời gian cho phép. Hãy kiểm tra vòng lặp hoặc giảm dữ liệu.',
                exitCode: null,
                executionTime: performance.now() - started,
              }),
            ms,
          )
        }
        signal.addEventListener('abort', stop, { once: true })
        timeout(executionLimits.compileMs)
        worker.onmessage = ({ data }: MessageEvent<unknown>) => {
          if (isExecutionResult(data)) finish(data)
          else if (
            data &&
            typeof data === 'object' &&
            'phase' in data &&
            typeof data.phase === 'string'
          ) {
            onPhase?.(data.phase)
            if ('timeout' in data && typeof data.timeout === 'number')
              timeout(Math.min(executionLimits.compileMs, data.timeout))
          }
        }
        worker.onerror = () =>
          finish({
            status: 'unavailable',
            stdout: '',
            stderr:
              'Trình chạy bị lỗi. Thử lại hoặc dùng trình duyệt hỗ trợ WebAssembly.',
            exitCode: null,
            executionTime: 0,
          })
        worker.postMessage({ request, assets })
      })
    } catch {
      return {
        status: signal.aborted ? 'stopped' : 'unavailable',
        stdout: '',
        stderr: signal.aborted
          ? 'Đã dừng chương trình.'
          : 'Không tải được trình chạy. Kiểm tra kết nối rồi thử lại.',
        exitCode: null,
        executionTime: performance.now() - started,
      }
    } finally {
      clearTimeout(loading)
      signal.removeEventListener('abort', abort)
    }
  },
}
