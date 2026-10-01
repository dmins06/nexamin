import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Play, Square, RotateCcw, Check, X } from 'lucide-react'
import { CodeEditor } from './CodeEditor'
import { OutputPanel } from './OutputPanel'
import { exercises, isCodeLanguage, languages } from './codeRegistry'
import { loadCodePreferences, saveCodePreferences } from './codeStorage'
import { codeRunner } from './runner/providers'
import { passesTest } from './testCases'
import type { ExecutionResult } from './codeTypes'
import { LabExplain } from '../shared/LabExplain'
interface CaseResult {
  passed: boolean
  result: ExecutionResult
}
export function CodeLab() {
  const [preferences, setPreferences] = useState(loadCodePreferences),
    [result, setResult] = useState<ExecutionResult | null>(null),
    [tests, setTests] = useState<CaseResult[]>([]),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState(''),
    controller = useRef<AbortController | null>(null),
    mounted = useRef(true)
  const exercise =
      exercises.find((e) => e.id === preferences.exerciseId) ?? exercises[0],
    language = languages.find((l) => l.id === preferences.language)
  const key = `${preferences.exerciseId}:${preferences.language}`,
    source =
      preferences.drafts[key] ??
      exercise?.languageTemplates[preferences.language] ??
      ''
  useEffect(() => saveCodePreferences(preferences), [preferences])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
    }
  }, [])
  function clear() {
    setResult(null)
    setTests([])
  }
  async function execute(testing: boolean) {
    if (controller.current || !exercise) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    clear()
    try {
      const cases = testing
          ? exercise.testCases
          : [{ input: preferences.stdin, expectedOutput: '', hidden: false }],
        outcomes: CaseResult[] = []
      for (const test of cases) {
        if (abort.signal.aborted) break
        const next = await codeRunner.execute(
          {
            language: preferences.language,
            sourceCode: source,
            stdin: test.input,
          },
          abort.signal,
          (text) => {
            if (mounted.current)
              setPhase(
                testing
                  ? `Test ${outcomes.length + 1}/${cases.length}: ${text}`
                  : text,
              )
          },
        )
        if (!mounted.current) return
        setResult(next)
        if (testing) {
          outcomes.push({
            passed: passesTest(next, test.expectedOutput),
            result: next,
          })
          setTests([...outcomes])
        }
        if (
          [
            'stopped',
            'unavailable',
            'limit',
            'timeout',
            'compile-error',
          ].includes(next.status)
        )
          break
      }
    } catch {
      if (mounted.current)
        setResult({
          status: 'unavailable',
          stdout: '',
          stderr: 'Không chạy được chương trình. Kiểm tra kết nối và thử lại.',
          exitCode: null,
          executionTime: 0,
        })
    } finally {
      if (controller.current === abort) controller.current = null
      if (mounted.current) {
        setBusy(false)
        setPhase('')
      }
    }
  }
  if (!exercise) return null
  return (
    <section aria-labelledby="code-title">
      <header className="it-heading">
        <h1 id="code-title">Code Lab</h1>
        <p>
          Viết code, thử stdin và kiểm tra lời giải. Chương trình chỉ chạy trong
          môi trường tạm trên thiết bị của bạn.
        </p>
      </header>
      <div className="it-code-toolbar">
        <label>
          Ngôn ngữ
          <select
            disabled={busy}
            value={preferences.language}
            onChange={(e) => {
              if (isCodeLanguage(e.target.value)) {
                const language = e.target.value
                setPreferences((p) => ({ ...p, language }))
                clear()
              }
            }}
          >
            {languages.map((l) => (
              <option value={l.id} key={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
        <label className="it-grow">
          Bài tập
          <select
            disabled={busy}
            value={preferences.exerciseId}
            onChange={(e) => {
              const selected = exercises.find((x) => x.id === e.target.value)
              if (selected) {
                setPreferences((p) => ({
                  ...p,
                  exerciseId: selected.id,
                  stdin: selected.testCases[0]?.input ?? '',
                }))
                clear()
              }
            }}
          >
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <button
          className="it-button primary"
          disabled={busy}
          onClick={() => void execute(false)}
        >
          <Play size={17} aria-hidden="true" />
          Chạy
        </button>
        <button
          className="it-button"
          disabled={!busy}
          onClick={() => controller.current?.abort()}
        >
          <Square size={15} aria-hidden="true" />
          Dừng
        </button>
      </div>
      <div className="it-code-workspace">
        <details className="it-panel it-exercise" open>
          <summary>
            {exercise.title} · {exercise.difficulty}
          </summary>
          <p>{exercise.description}</p>
          <h3>Ví dụ</h3>
          <p className="it-small">Input</p>
          <pre>{exercise.testCases[0]?.input || '(không cần stdin)'}</pre>
          <p className="it-small">Output mong đợi</p>
          <pre>{exercise.testCases[0]?.expectedOutput}</pre>
          {exercise.algorithm && (
            <>
              <Link
                className="it-button"
                to={`/labs/it/algorithms?algorithm=${exercise.algorithm}`}
              >
                Xem thuật toán mẫu
              </Link>
              <p className="it-small">
                Mở mô phỏng định sẵn, không trực quan hóa code của bạn.
              </p>
            </>
          )}
        </details>
        <section className="it-panel it-code-editor">
          <div className="it-panel-heading">
            <h2>{language?.file}</h2>
            <button
              className="it-button"
              disabled={busy}
              onClick={() => {
                if (
                  source !== exercise.languageTemplates[preferences.language] &&
                  !window.confirm(
                    'Khôi phục code mẫu và xóa bản nháp hiện tại của bài/ngôn ngữ này?',
                  )
                )
                  return
                setPreferences((p) => ({
                  ...p,
                  drafts: {
                    ...p.drafts,
                    [key]: exercise.languageTemplates[p.language],
                  },
                }))
                clear()
              }}
            >
              <RotateCcw size={15} aria-hidden="true" />
              Code mẫu
            </button>
          </div>
          <p className="it-small">{language?.note}</p>
          <CodeEditor
            value={source}
            language={preferences.language}
            disabled={busy}
            onChange={(code) =>
              setPreferences((p) => ({
                ...p,
                drafts: { ...p.drafts, [key]: code },
              }))
            }
          />
          <label>
            stdin
            <textarea
              rows={4}
              disabled={busy}
              value={preferences.stdin}
              maxLength={16384}
              placeholder="Nhập dữ liệu chương trình cần đọc…"
              onChange={(e) => {
                const stdin = e.target.value
                setPreferences((p) => ({ ...p, stdin }))
              }}
            />
          </label>
          <p className="it-small">
            Giới hạn: code 32 KiB, stdin 16 KiB, output 64 KiB, chạy 10 giây.
            Java tối đa 30 giây gồm biên dịch. Không có network.
          </p>
        </section>
        <OutputPanel
          result={result}
          busy={busy}
          phase={phase}
          onClear={() => setResult(null)}
        />
      </div>
      <section className="it-panel it-test-cases">
        <div className="it-panel-heading">
          <h2>Test cases</h2>
          <button
            className="it-button primary"
            disabled={busy}
            onClick={() => void execute(true)}
          >
            Kiểm tra bài
          </button>
        </div>
        <p className="it-small">
          Tất cả test đều công khai, chấm tại thiết bị. Đây là công cụ tự học,
          không xác nhận điểm hay chống gian lận.
        </p>
        <p role="status">
          {tests.length
            ? `${tests.filter((t) => t.passed).length} / ${exercise.testCases.length} đạt · đã chạy ${tests.length} test`
            : 'Chưa kiểm tra'}
        </p>
        <ol>
          {exercise.testCases.map((test, i) => (
            <li key={i}>
              <details>
                <summary>
                  {tests[i] ? (
                    tests[i]?.passed ? (
                      <Check size={17} aria-hidden="true" />
                    ) : (
                      <X size={17} aria-hidden="true" />
                    )
                  ) : null}
                  Test {i + 1} —{' '}
                  {tests[i]
                    ? tests[i]?.passed
                      ? 'Đạt'
                      : 'Chưa đạt'
                    : 'Chưa chạy'}
                </summary>
                <p>Input</p>
                <pre>{test.input || '(trống)'}</pre>
                <p>Mong đợi</p>
                <pre>{test.expectedOutput}</pre>
                {tests[i] && (
                  <>
                    <p>Thực tế</p>
                    <pre>{tests[i]?.result.stdout || '(trống)'}</pre>
                    <p>{tests[i]?.result.stderr}</p>
                  </>
                )}
              </details>
            </li>
          ))}
        </ol>
        <LabExplain
          context={`Code Lab — ${language?.title} — ${exercise.title}\nCode:\n${source}\nStdin: ${preferences.stdin}\nstdout: ${result?.stdout ?? ''}\nstderr: ${result?.stderr ?? ''}`}
        />
      </section>
    </section>
  )
}
