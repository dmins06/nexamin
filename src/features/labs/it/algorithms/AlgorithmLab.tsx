import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { algorithms } from './algorithmRegistry'
import { createTrace, parseEdges, parseValues } from './traceEngine'
import {
  defaultAlgorithmPreferences,
  loadAlgorithmPreferences,
  saveAlgorithmPreferences,
} from './algorithmStorage'
import { AlgorithmDiagram } from './AlgorithmDiagram'
import { SimulationControls } from '../shared/SimulationControls'
import { LabExplain } from '../shared/LabExplain'
export function AlgorithmLab() {
  const [search] = useSearchParams()
  const [preferences, setPreferences] = useState(() => {
      const p = loadAlgorithmPreferences(),
        fromCode = algorithms.find((a) => a.id === search.get('algorithm'))
      return fromCode ? { ...p, algorithm: fromCode.id } : p
    }),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false)
  const definition =
    algorithms.find((a) => a.id === preferences.algorithm) ?? algorithms[0]
  const trace = useMemo(() => {
    try {
      const input = {
        values:
          definition?.category === 'graph'
            ? []
            : parseValues(preferences.values),
        target: Number(preferences.target),
        nodeCount: preferences.nodeCount,
        edges:
          definition?.category === 'graph'
            ? parseEdges(
                preferences.edges,
                preferences.nodeCount,
                preferences.directed,
              )
            : [],
        start: preferences.start,
        directed: preferences.directed,
      }
      if (
        definition?.category === 'searching' &&
        (!Number.isInteger(input.target) || !preferences.target.trim())
      )
        throw Error('Giá trị tìm kiếm cần là số nguyên.')
      return {
        input,
        frames: createTrace(preferences.algorithm, input),
        error: '',
      }
    } catch (error) {
      return {
        input: null,
        frames: [],
        error: error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.',
      }
    }
  }, [
    preferences.algorithm,
    preferences.values,
    preferences.target,
    preferences.nodeCount,
    preferences.edges,
    preferences.start,
    preferences.directed,
    definition?.category,
  ])
  useEffect(() => saveAlgorithmPreferences(preferences), [preferences])
  useEffect(() => {
    if (!playing || index >= trace.frames.length - 1) return
    const timer = setTimeout(
      () => setIndex((i) => i + 1),
      800 / preferences.speed,
    )
    return () => clearTimeout(timer)
  }, [playing, index, trace.frames.length, preferences.speed])
  const running = playing && index < trace.frames.length - 1
  const frame = trace.frames[index]
  function change(next: Partial<typeof preferences>) {
    setPlaying(false)
    setIndex(0)
    setPreferences((p) => ({ ...p, ...next }))
  }
  if (!definition) return null
  return (
    <section aria-labelledby="algorithm-title">
      <header className="it-heading">
        <h1 id="algorithm-title">Algorithm Lab</h1>
        <p>Thay đổi dữ liệu, bước qua từng thao tác và đối chiếu với mã giả.</p>
      </header>
      <div className="it-algorithm-input it-panel">
        <label>
          Thuật toán
          <select
            value={preferences.algorithm}
            onChange={(e) => {
              const selected = algorithms.find((a) => a.id === e.target.value)
              if (selected) change({ algorithm: selected.id })
            }}
          >
            {['sorting', 'searching', 'graph'].map((category) => (
              <optgroup
                key={category}
                label={
                  category === 'sorting'
                    ? 'Sắp xếp'
                    : category === 'searching'
                      ? 'Tìm kiếm'
                      : 'Đồ thị'
                }
              >
                {algorithms
                  .filter((a) => a.category === category)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        {definition.category === 'graph' ? (
          <>
            <label>
              Số đỉnh
              <input
                type="number"
                min={2}
                max={10}
                value={preferences.nodeCount}
                onChange={(e) => change({ nodeCount: Number(e.target.value) })}
              />
            </label>
            <label>
              Đỉnh đầu
              <input
                type="number"
                min={0}
                max={preferences.nodeCount - 1}
                value={preferences.start}
                onChange={(e) => change({ start: Number(e.target.value) })}
              />
            </label>
            <label className="it-check">
              <input
                type="checkbox"
                checked={preferences.directed}
                onChange={(e) => change({ directed: e.target.checked })}
              />
              Có hướng
            </label>
            <label className="it-wide">
              Cạnh: đầu cuối trọng số
              <textarea
                rows={4}
                value={preferences.edges}
                maxLength={2000}
                onChange={(e) => change({ edges: e.target.value })}
              />
              <span className="it-small">
                Mỗi dòng một cạnh; không nhập cạnh ngược với đồ thị vô hướng.
              </span>
            </label>
          </>
        ) : (
          <>
            <label className="it-grow">
              Dãy số
              <input
                value={preferences.values}
                maxLength={300}
                onChange={(e) => change({ values: e.target.value })}
              />
            </label>
            {definition.category === 'searching' && (
              <label>
                Cần tìm
                <input
                  value={preferences.target}
                  maxLength={8}
                  onChange={(e) => change({ target: e.target.value })}
                />
              </label>
            )}
          </>
        )}
        <button
          className="it-button"
          onClick={() => {
            setPlaying(false)
            setIndex(0)
            setPreferences(defaultAlgorithmPreferences())
          }}
        >
          Dữ liệu mẫu
        </button>
      </div>
      {trace.error && (
        <p role="alert" className="it-error">
          {trace.error}
        </p>
      )}
      <div className="it-algorithm-workspace">
        <section className="it-panel">
          <div className="it-panel-heading">
            <h2>{definition.title}</h2>
            <span className="it-small">
              {trace.frames.length ? index + 1 : 0} / {trace.frames.length} bước
            </span>
          </div>
          <p className="it-operation" aria-live={running ? 'off' : 'polite'}>
            {frame?.operation ?? 'Sửa dữ liệu để bắt đầu.'}
          </p>
          {frame && trace.input && (
            <AlgorithmDiagram
              frame={frame}
              input={trace.input}
              graph={definition.category === 'graph'}
            />
          )}
          <SimulationControls
            index={index}
            count={trace.frames.length}
            playing={running}
            speed={preferences.speed}
            onIndex={(i) => {
              setPlaying(false)
              setIndex(i)
            }}
            onPlay={() => setPlaying((p) => !p)}
            onSpeed={(speed) => setPreferences((p) => ({ ...p, speed }))}
          />
          <dl className="it-metrics">
            <div>
              <dt>So sánh</dt>
              <dd>{frame?.comparisons ?? 0}</dd>
            </div>
            <div>
              <dt>Hoán đổi</dt>
              <dd>{frame?.swaps ?? 0}</dd>
            </div>
            <div>
              <dt>Đỉnh đã thăm</dt>
              <dd>{frame?.visited.length ?? 0}</dd>
            </div>
          </dl>
          <p className="it-small">
            Ô/đỉnh nổi bật: đang xét. Ô/đỉnh được chốt: đã hoàn tất. Chỉ số bắt
            đầu từ 0.
          </p>
        </section>
        <section className="it-panel">
          <h2>Mã giả đồng bộ</h2>
          <ol className="it-pseudocode">
            {definition.code.map((line, i) => (
              <li
                className={frame?.codeLine === i ? 'active' : ''}
                key={i}
                aria-current={frame?.codeLine === i ? 'step' : undefined}
              >
                <code>{line}</code>
              </li>
            ))}
          </ol>
          <h3>Vì sao thuật toán hoạt động?</h3>
          <p>{definition.explanation}</p>
          <p className="it-small">
            Thời gian tốt / trung bình / xấu: {definition.best} /{' '}
            {definition.average} / {definition.worst}. Bộ nhớ bổ sung:{' '}
            {definition.space}. Các giới hạn này không tính bộ nhớ lưu từng
            frame của giao diện.
          </p>
          <LabExplain
            context={`Algorithm Lab — ${definition.title}\n${frame?.operation ?? ''}\nDãy: ${frame?.values.join(', ')}\nĐã thăm: ${frame?.visited.join(', ')}\n${definition.explanation}`}
          />
          <Link className="it-button" to="/labs/it/code">
            Viết code
          </Link>
        </section>
      </div>
      <details className="it-panel">
        <summary>Cấu trúc dữ liệu và lộ trình</summary>
        <p>
          Hiện có dãy trong sắp xếp/tìm kiếm, hàng đợi trong BFS và stack trong
          DFS. Linked List, BST, Heap, Hash Table, A* và MST chưa có mô phỏng
          riêng.
        </p>
        <p>
          Đây là thuật toán định sẵn. Chuyển từ Code Lab không phân tích hay
          trực quan hóa code tùy ý.
        </p>
      </details>
    </section>
  )
}
