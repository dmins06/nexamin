import type { ExecutionResult } from './codeTypes'
const statusText: Record<ExecutionResult['status'], string> = {
  success: 'Chạy thành công',
  'compile-error': 'Lỗi biên dịch',
  'runtime-error': 'Lỗi khi chạy',
  timeout: 'Quá thời gian',
  stopped: 'Đã dừng',
  unavailable: 'Trình chạy chưa sẵn sàng',
  limit: 'Vượt giới hạn',
}
export function OutputPanel({
  result,
  busy,
  phase,
  onClear,
}: {
  result: ExecutionResult | null
  busy: boolean
  phase: string
  onClear: () => void
}) {
  return (
    <section className="it-panel it-output" aria-label="Kết quả chạy">
      <div className="it-panel-heading">
        <h2>Output</h2>
        <button
          className="it-button"
          disabled={busy || !result}
          onClick={onClear}
        >
          Xóa output
        </button>
      </div>
      <p role="status">
        {busy
          ? phase
          : result
            ? statusText[result.status]
            : 'Chạy chương trình để xem kết quả.'}
      </p>
      {result && (
        <p className="it-small">
          Thời gian biên dịch và chạy:{' '}
          {(result.executionTime / 1000).toFixed(3)} s · Exit code:{' '}
          {result.exitCode ?? '—'}
        </p>
      )}
      <h3>stdout</h3>
      <pre tabIndex={0} aria-label="stdout">
        {result?.stdout || '(trống)'}
      </pre>
      <h3>stderr</h3>
      <pre
        className={result?.stderr ? 'it-error' : ''}
        tabIndex={0}
        aria-label="stderr"
      >
        {result?.stderr || '(trống)'}
      </pre>
    </section>
  )
}
