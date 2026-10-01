import type { CodeExecutionProvider } from '../codeTypes'
import { wasmRunner } from './WasmRunnerProvider'
import { javaRunner } from './JavaRunnerProvider'
export const codeRunner: CodeExecutionProvider = {
  execute(request, signal, onPhase) {
    return (request.language === 'java' ? javaRunner : wasmRunner).execute(
      request,
      signal,
      onPhase,
    )
  },
}
