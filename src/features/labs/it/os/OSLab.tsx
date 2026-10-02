import { useMemo } from 'react'
import {
  schedule,
  parseProcesses,
  allocateMemory,
  deadlockCycle,
} from './osEngine'
import type { SchedulingPolicy } from './osTypes'
import { attempt, integer } from '../shared/input'
import { useLabSettings } from '../shared/useLabSettings'
import { LabIntro } from '../shared/LabIntro'
import { LabExplain } from '../shared/LabExplain'
const policies: readonly { id: SchedulingPolicy; title: string }[] = [
  { id: 'fcfs', title: 'FCFS' },
  { id: 'sjf', title: 'SJF' },
  { id: 'srtf', title: 'SRTF' },
  { id: 'round-robin', title: 'Round Robin' },
  { id: 'priority', title: 'Priority' },
]
const defaults = {
  lesson: 'schedule',
  processes: 'P1 0 5 2\nP2 1 2 1\nP3 2 1 3',
  policy: 'round-robin',
  quantum: '2',
  holes: '64, 128, 256',
  requests: '70, 50, 120',
  memoryPolicy: 'first',
  edges: 'P1 -> R1\nR1 -> P2\nP2 -> R2\nR2 -> P1',
}
export function OSLab() {
  const { settings: s, change } = useLabSettings('os', defaults),
    policy = policies.find((p) => p.id === s.policy)?.id ?? 'fcfs'
  const scheduling = useMemo(
    () =>
      attempt(() =>
        schedule(
          parseProcesses(s.processes ?? ''),
          policy,
          policy === 'round-robin'
            ? integer(s.quantum ?? '', 'Quantum', 1, 20)
            : 2,
        ),
      ),
    [s.processes, s.quantum, policy],
  )
  const memory = useMemo(
      () =>
        attempt(() =>
          allocateMemory(
            s.holes ?? '',
            s.requests ?? '',
            s.memoryPolicy === 'best'
              ? 'best'
              : s.memoryPolicy === 'worst'
                ? 'worst'
                : 'first',
          ),
        ),
      [s.holes, s.requests, s.memoryPolicy],
    ),
    deadlock = useMemo(
      () => attempt(() => deadlockCycle(s.edges ?? '')),
      [s.edges],
    )
  const lesson =
    ['schedule', 'memory', 'deadlock'].find((v) => v === s.lesson) ?? 'schedule'
  return (
    <>
      <LabIntro
        title="Operating System"
        description="Thay đổi workload, so sánh lịch CPU; thực nghiệm cấp phát RAM và vòng chờ tài nguyên."
        notice="Một CPU, không tính chi phí context switch. Priority/SJF không ngắt; SRTF ngắt; số priority nhỏ ưu tiên cao. Dữ liệu mẫu là tiến trình giả lập."
      />
      <div className="it-controls" aria-label="Bài học OS">
        {[
          ['schedule', 'Lập lịch CPU'],
          ['memory', 'Cấp phát RAM'],
          ['deadlock', 'Deadlock'],
        ].map(([id, title]) => (
          <button
            key={id}
            className="it-button"
            aria-pressed={lesson === id}
            onClick={() => change('lesson', id ?? 'schedule')}
          >
            {title}
          </button>
        ))}
      </div>
      {lesson === 'schedule' && (
        <div className="it-sim-grid">
          <section className="it-panel">
            <h2>Tiến trình</h2>
            <label>
              ID · Arrival · Burst · Priority
              <textarea
                rows={6}
                value={s.processes}
                onChange={(e) => change('processes', e.target.value)}
                maxLength={1000}
              />
            </label>
            <div className="it-algorithm-input">
              <label>
                Chính sách
                <select
                  value={policy}
                  onChange={(e) => change('policy', e.target.value)}
                >
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              {policy === 'round-robin' && (
                <label>
                  Quantum
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={s.quantum}
                    onChange={(e) => change('quantum', e.target.value)}
                  />
                </label>
              )}
            </div>
            <button
              className="it-button"
              onClick={() => change('processes', defaults.processes)}
            >
              Dữ liệu mẫu
            </button>
            <p>
              Thử tăng Burst P1 rồi so sánh FCFS với SRTF. Waiting = Turnaround
              − Burst; Response = thời điểm chạy đầu − Arrival.
            </p>
            {scheduling.error && (
              <p role="alert" className="it-error">
                {scheduling.error}
              </p>
            )}
          </section>
          <section className="it-panel">
            <h2>Gantt chart</h2>
            <div className="it-gantt" aria-label="Lịch CPU">
              {scheduling.value?.slices.map((slice, i) => (
                <div key={i} style={{ flexGrow: slice.end - slice.start }}>
                  <strong>{slice.processId ?? 'Idle'}</strong>
                  <span>
                    {slice.start}–{slice.end}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="it-table-scroll"
              tabIndex={0}
              aria-label="Chỉ số tiến trình"
            >
              <table className="it-data-table">
                <thead>
                  <tr>
                    <th>Process</th>
                    <th>Waiting</th>
                    <th>Turnaround</th>
                    <th>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduling.value?.metrics.map((m) => (
                    <tr key={m.processId}>
                      <th>{m.processId}</th>
                      <td>{m.waiting}</td>
                      <td>{m.turnaround}</td>
                      <td>{m.response}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Waiting trung bình:{' '}
              {scheduling.value
                ? (
                    scheduling.value.metrics.reduce(
                      (n, m) => n + m.waiting,
                      0,
                    ) / scheduling.value.metrics.length
                  ).toFixed(2)
                : '—'}
            </p>
            <p>
              Timeline dùng đơn vị thời gian giả lập. RR đưa tiến trình đến
              trong quantum vào hàng đợi trước khi đưa tiến trình đang chạy về
              cuối.
            </p>
          </section>
        </div>
      )}
      {lesson === 'memory' && (
        <div className="it-sim-grid">
          <section className="it-panel">
            <h2>Các khối trống</h2>
            <label>
              Kích thước khối (KB)
              <input
                value={s.holes}
                onChange={(e) => change('holes', e.target.value)}
              />
            </label>
            <label>
              Yêu cầu P1, P2… (KB)
              <input
                value={s.requests}
                onChange={(e) => change('requests', e.target.value)}
              />
            </label>
            <label>
              Chọn khối
              <select
                value={s.memoryPolicy}
                onChange={(e) => change('memoryPolicy', e.target.value)}
              >
                <option value="first">First Fit</option>
                <option value="best">Best Fit</option>
                <option value="worst">Worst Fit</option>
              </select>
            </label>
            <p>
              Cấp phát động, tách phần dư; không gom khối/compaction. Paging và
              page replacement chưa có trong bản này.
            </p>
            {memory.error && (
              <p role="alert" className="it-error">
                {memory.error}
              </p>
            )}
          </section>
          <section className="it-panel">
            <h2>RAM sau cấp phát</h2>
            <div className="it-memory-blocks">
              {memory.value?.blocks.map((b) => (
                <div
                  key={b.start}
                  className={b.processId ? 'active' : ''}
                  style={{ flexGrow: b.size }}
                >
                  <strong>{b.processId ?? 'Trống'}</strong>
                  <span>
                    {b.start} · {b.size} KB
                  </span>
                </div>
              ))}
            </div>
            <ol>
              {memory.value?.decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ol>
            <p>
              Không vừa một khối không có nghĩa tổng RAM trống bằng 0: đây là
              phân mảnh ngoài.
            </p>
          </section>
        </div>
      )}
      {lesson === 'deadlock' && (
        <div className="it-sim-grid">
          <section className="it-panel">
            <h2>Đồ thị cấp phát tài nguyên</h2>
            <label>
              Cạnh yêu cầu hoặc cấp phát
              <textarea
                rows={7}
                value={s.edges}
                onChange={(e) => change('edges', e.target.value)}
                maxLength={1000}
              />
            </label>
            <p>
              P → R: yêu cầu; R → P: tài nguyên đang thuộc tiến trình. Mỗi R có
              đúng một instance; mô hình không dùng cho tài nguyên nhiều
              instance.
            </p>
            {deadlock.error && (
              <p role="alert" className="it-error">
                {deadlock.error}
              </p>
            )}
          </section>
          <section className="it-panel">
            <h2>Kết quả kiểm tra vòng chờ</h2>
            <p role="status">
              {deadlock.value
                ? deadlock.value.length
                  ? 'Có deadlock trong mô hình single-instance.'
                  : 'Không có chu trình chờ trong đồ thị đã nhập.'
                : 'Sửa dữ liệu để kiểm tra.'}
            </p>
            <div className="it-flow">
              {deadlock.value?.map((node, i) => (
                <div className="it-flow-node active" key={i}>
                  {node}
                </div>
              ))}
            </div>
            <p>
              Thử bỏ cạnh P2 → R2 để phá vòng chờ. Không có chu trình ở đây
              không chứng minh một hệ điều hành thật không thể deadlock.
              Banker's Algorithm chưa triển khai.
            </p>
          </section>
        </div>
      )}
      <LabExplain
        title="Operating System"
        context={
          lesson === 'schedule'
            ? `${policy}: ${JSON.stringify(scheduling.value?.metrics)}`
            : lesson === 'memory'
              ? (memory.value?.decisions.join('\n') ?? 'Cấp phát RAM')
              : (deadlock.value?.join(' → ') ?? 'Vòng chờ tài nguyên')
        }
      />
    </>
  )
}
