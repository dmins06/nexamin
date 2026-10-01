import type { CodeExecutionProvider, ExecutionResult } from '../codeTypes'
import { executionLimits, isExecutionResult, validateExecution } from './limits'
import { loadRuntimeAssets } from './runtimeAssets'
import { javaGuest } from './javaGuest'
export const javaSandboxPolicy =
  "default-src 'none'; script-src 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
export const javaRunner: CodeExecutionProvider = {
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
      loadAbort = new AbortController(),
      abort = () => loadAbort.abort()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    const loading = setTimeout(() => loadAbort.abort(), executionLimits.loadMs)
    try {
      onPhase?.('Đang tải Java cho lần chạy đầu (khoảng 40 MB)…')
      const assets = await loadRuntimeAssets('java', loadAbort.signal)
      if (signal.aborted) throw Error('STOPPED')
      const decoder = new TextDecoder(),
        script =
          'self.window=self;\n' +
          ['fflate.js', 'browserfs.js', 'doppio.js']
            .map((name) => decoder.decode(assets[name]))
            .join('\n') +
          '\n' +
          javaGuest
      return await new Promise<ExecutionResult>((resolve) => {
        const iframe = document.createElement('iframe'),
          channel = crypto.randomUUID(),
          nonce = crypto.randomUUID().replaceAll('-', '')
        iframe.hidden = true
        iframe.setAttribute('sandbox', 'allow-scripts')
        iframe.setAttribute('aria-hidden', 'true')
        iframe.setAttribute('title', 'Môi trường Java cách ly')
        let timer: ReturnType<typeof setTimeout>,
          finished = false
        const finish = (result: ExecutionResult) => {
          if (finished) return
          finished = true
          clearTimeout(timer)
          signal.removeEventListener('abort', stop)
          window.removeEventListener('message', message)
          iframe.remove()
          resolve(result)
        }
        const stop = () =>
          finish({
            status: 'stopped',
            stdout: '',
            stderr: 'Đã dừng Java.',
            exitCode: null,
            executionTime: performance.now() - started,
          })
        const message = (event: MessageEvent<unknown>) => {
          if (event.source !== iframe.contentWindow || event.origin !== 'null')
            return
          const data = event.data
          if (
            !data ||
            typeof data !== 'object' ||
            !('channel' in data) ||
            data.channel !== channel
          )
            return
          if ('ready' in data && data.ready === true) {
            onPhase?.('Đang khởi tạo Java…')
            clearTimeout(timer)
            timer = setTimeout(
              () =>
                finish({
                  status: 'timeout',
                  stdout: '',
                  stderr:
                    'Java vượt 30 giây biên dịch và chạy. Kiểm tra vòng lặp hoặc thử dữ liệu nhỏ hơn.',
                  exitCode: null,
                  executionTime: performance.now() - started,
                }),
              executionLimits.javaMs,
            )
            iframe.contentWindow?.postMessage(
              {
                channel,
                script,
                archive: assets['java_home.tar.gz'],
                jar: assets['doppio.jar'],
                request,
              },
              '*',
            )
          } else if ('result' in data && isExecutionResult(data.result))
            finish(data.result)
          else if ('phase' in data && typeof data.phase === 'string')
            onPhase?.(data.phase.slice(0, 100))
        }
        const policy = javaSandboxPolicy.replace(
          "script-src 'unsafe-eval' blob:",
          `script-src 'nonce-${nonce}' 'unsafe-eval' blob:`,
        )
        // The iframe only bootstraps/relays its own Worker. No student source in HTML.
        iframe.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}"><script nonce="${nonce}">const channel=${JSON.stringify(channel)};let started=false;parent.postMessage({channel,ready:true},'*');addEventListener('message',e=>{if(e.source!==parent||e.data.channel!==channel||started)return;started=true;const worker=new Worker(URL.createObjectURL(new Blob([e.data.script],{type:'text/javascript'})));worker.onmessage=m=>parent.postMessage(m.data.phase?{channel,phase:m.data.phase}:{channel,result:m.data},'*');worker.onerror=()=>parent.postMessage({channel,result:{status:'runtime-error',stdout:'',stderr:'Java không chạy được. Hãy thử lại.',exitCode:null,executionTime:0}},'*');worker.postMessage({archive:e.data.archive,jar:e.data.jar,request:e.data.request});});</script>`
        window.addEventListener('message', message)
        signal.addEventListener('abort', stop, { once: true })
        timer = setTimeout(
          () =>
            finish({
              status: 'unavailable',
              stdout: '',
              stderr: 'Trình duyệt không khởi tạo được sandbox Java.',
              exitCode: null,
              executionTime: 0,
            }),
          5000,
        )
        document.body.append(iframe)
      })
    } catch {
      return {
        status: signal.aborted ? 'stopped' : 'unavailable',
        stdout: '',
        stderr: signal.aborted
          ? 'Đã dừng Java.'
          : 'Không tải được Java. Kiểm tra kết nối rồi thử lại.',
        exitCode: null,
        executionTime: performance.now() - started,
      }
    } finally {
      clearTimeout(loading)
      signal.removeEventListener('abort', abort)
    }
  },
}
