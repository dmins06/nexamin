import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { cpuTrace } from './cpuEngine'
import { attempt } from '../shared/input'
import { useLabSettings } from '../shared/useLabSettings'
import { usePlayback } from '../shared/usePlayback'
import { SimulationControls } from '../shared/SimulationControls'
import { LabIntro } from '../shared/LabIntro'
import { LabExplain } from '../shared/LabExplain'
const defaults = {
  program: 'LOAD R0 0\nLOAD R1 1\nADD R2 R0 R1\nSTORE R2 2\nHALT',
  ram: '5, 7, 0, 0',
}
const empty: ReturnType<typeof cpuTrace> = []
export function ComputerLab() {
  const { settings, change } = useLabSettings('cpu', defaults),
    program = settings.program ?? '',
    ram = settings.ram ?? ''
  const result = useMemo(
      () => attempt(() => cpuTrace(program, ram)),
      [program, ram],
    ),
    playback = usePlayback(result.value ?? empty),
    f = playback.frame
  return (
    <>
      <LabIntro
        title="Computer Architecture"
        description="Theo dõi một lệnh đi qua Fetch, Decode và Execute; quan sát thanh ghi, ALU, cache và RAM."
        notice="Mô hình giáo dục tuần tự, 4 thanh ghi 32-bit, RAM 16 ô và cache direct-mapped 4 dòng. Bộ nhớ lệnh tách dữ liệu; không mô phỏng GPU/pipeline hay máy tính 3D thật."
      />
      <div className="it-sim-grid">
        <section className="it-panel">
          <h2>Chương trình mẫu có thể chỉnh sửa</h2>
          <label>
            Lệnh CPU
            <textarea
              rows={7}
              value={program}
              onChange={(e) => change('program', e.target.value)}
              maxLength={2000}
            />
          </label>
          <p className="it-small">
            ADD: đích, nguồn trái, nguồn phải. LOAD/STORE: thanh ghi, địa chỉ
            0–15.
          </p>
          <label>
            RAM ban đầu
            <input
              value={ram}
              onChange={(e) => change('ram', e.target.value)}
            />
          </label>
          <button
            className="it-button"
            onClick={() => {
              change('program', defaults.program)
              change('ram', defaults.ram)
            }}
          >
            Dữ liệu mẫu
          </button>
          {result.error && (
            <p role="alert" className="it-error">
              {result.error}
            </p>
          )}
          <h3>Lệnh đang xét</h3>
          <ol className="it-pseudocode">
            {program.split('\n').map((line, i) => (
              <li
                key={i}
                className={f?.activeLine === i ? 'active' : ''}
                aria-current={f?.activeLine === i ? 'step' : undefined}
              >
                <code>{line}</code>
              </li>
            ))}
          </ol>
        </section>
        <section className="it-panel">
          <h2>Trạng thái CPU</h2>
          <div className="it-flow">
            {['fetch', 'decode', 'execute'].map((phase, i) => (
              <div
                key={phase}
                className={
                  f?.phase === phase ? 'it-flow-node active' : 'it-flow-node'
                }
              >
                {phase.toUpperCase()}
                {i < 2 && <ArrowRight size={16} aria-hidden="true" />}
              </div>
            ))}
          </div>
          <p className="it-operation" role="status">
            {f?.operation ?? 'Sửa dữ liệu để tiếp tục.'}
          </p>
          <p>
            PC: {f?.pc ?? '—'} · Bước {playback.count ? playback.index + 1 : 0}/
            {playback.count}
          </p>
          <SimulationControls {...playback} />
          <div className="it-memory-grid">
            {f?.registers.map((value, i) => (
              <div key={i}>
                <span>R{i}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <h3>RAM (ô dữ liệu, không phải byte)</h3>
          <div className="it-memory-grid">
            {f?.ram.map((value, i) => (
              <div key={i} className={f.address === i ? 'active' : ''}>
                <span>[{i}]</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <h3>Cache</h3>
          <p>
            Hit: {f?.hits ?? 0} · Miss: {f?.misses ?? 0}
          </p>
          <ul>
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                Dòng {i}:{' '}
                {f?.cache[i]
                  ? `địa chỉ ${f.cache[i]?.address}, giá trị ${f.cache[i]?.value}`
                  : 'trống'}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="it-panel">
        <h2>Vì sao kết quả thay đổi?</h2>
        <p>
          LOAD tìm đúng địa chỉ trong dòng address mod 4; miss nạp từ RAM. STORE
          ghi xuyên xuống RAM. ALU cộng hai thanh ghi, kết quả tràn được cuộn
          theo số nguyên 32-bit. CPU/GPU xử lý, RAM giữ dữ liệu đang dùng; SSD
          lưu bền, motherboard kết nối, PSU cấp điện và cooling tản nhiệt—không
          phải bộ phận nào cũng tham gia mọi lệnh.
        </p>
        <p>
          Thử thêm LOAD R3 0 trước HALT để thấy cache hit; đổi địa chỉ thành 4
          để tạo xung đột dòng cache. Bước tiếp thay đổi trạng thái thật, Bước
          trước đọc snapshot trước đó.
        </p>
        <LabExplain
          title="CPU Fetch–Decode–Execute"
          context={f?.operation ?? 'Mô hình CPU đơn giản'}
        />
      </section>
    </>
  )
}
