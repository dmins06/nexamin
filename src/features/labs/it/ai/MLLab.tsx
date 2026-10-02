import { useMemo, useId } from 'react'
import type { MLExperiment } from './aiTypes'
import { mlTrace, parsePoints, type MLFrame } from './mlEngine'
import { attempt, integer, decimal } from '../shared/input'
import { useLabSettings } from '../shared/useLabSettings'
import { usePlayback } from '../shared/usePlayback'
import { SimulationControls } from '../shared/SimulationControls'
import { LabIntro } from '../shared/LabIntro'
import { LabExplain } from '../shared/LabExplain'
const models: readonly { id: MLExperiment; name: string }[] = [
  { id: 'linear-regression', name: 'Linear Regression' },
  { id: 'knn', name: 'KNN' },
  { id: 'kmeans', name: 'KMeans' },
  { id: 'decision-tree', name: 'Decision Tree' },
  { id: 'neural-network', name: 'Neural Network' },
]
const defaults = {
  model: 'linear-regression',
  points: '-4 -3 0\n-3 -2 0\n-2 -1 0\n2 3 1\n3 4 1\n4 5 1',
  iterations: '60',
  rate: '0.2',
  k: '2',
  queryX: '3',
  queryY: '4',
  layers: '1',
  neurons: '4',
  activation: 'tanh',
}
const empty: MLFrame[] = []
export function MLLab() {
  const { settings: s, change } = useLabSettings('ml', defaults),
    model = models.find((m) => m.id === s.model)?.id ?? 'linear-regression',
    points = useMemo(
      () => attempt(() => parsePoints(s.points ?? '')),
      [s.points],
    )
  const trace = useMemo(
      () =>
        attempt(() => {
          if (!points.value) return empty
          return mlTrace({
            model,
            points: points.value,
            iterations:
              model === 'knn' || model === 'decision-tree'
                ? 1
                : integer(s.iterations ?? '', 'Vòng lặp', 1, 100),
            learningRate:
              model === 'linear-regression' || model === 'neural-network'
                ? decimal(s.rate ?? '', 'Learning rate', 0.001, 1)
                : 0.2,
            k:
              model === 'knn' || model === 'kmeans'
                ? integer(s.k ?? '', 'K', 1, 10)
                : 1,
            queryX: decimal(s.queryX ?? '', 'Query x', -10, 10),
            queryY:
              model === 'linear-regression'
                ? 0
                : decimal(s.queryY ?? '', 'Query y', -10, 10),
            layers:
              model === 'neural-network'
                ? integer(s.layers ?? '', 'Hidden layers', 1, 3)
                : 1,
            neurons:
              model === 'neural-network'
                ? integer(s.neurons ?? '', 'Neurons', 2, 8)
                : 4,
            activation:
              s.activation === 'sigmoid'
                ? 'sigmoid'
                : s.activation === 'relu'
                  ? 'relu'
                  : 'tanh',
          })
        }),
      [
        model,
        points.value,
        s.iterations,
        s.rate,
        s.k,
        s.queryX,
        s.queryY,
        s.layers,
        s.neurons,
        s.activation,
      ],
    ),
    playback = usePlayback(trace.value ?? empty),
    f = playback.frame
  const coord = (v: number) => 20 + (v + 10) * 14,
    plotId = useId()
  return (
    <>
      <LabIntro
        title="AI / Machine Learning"
        description="Đổi dữ liệu, bước qua quá trình học và kiểm tra loss/prediction được tính thật trên thiết bị."
        notice="Mô hình nhỏ, deterministic; không gọi Gemini để giả lập kết quả. Loss trên dữ liệu huấn luyện không chứng minh khả năng tổng quát hóa. Đây không phải framework deep learning/GPU."
      />
      <div className="it-sim-grid">
        <section className="it-panel">
          <h2>Thí nghiệm</h2>
          <label>
            Mô hình
            <select
              value={model}
              onChange={(e) => change('model', e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dữ liệu: x y nhãn (0/1)
            <textarea
              value={s.points}
              rows={7}
              maxLength={2000}
              onChange={(e) => change('points', e.target.value)}
            />
          </label>
          <p className="it-small">
            2–30 điểm, tọa độ [-10,10]. Regression học y từ x và bỏ qua nhãn;
            KNN/tree/MLP phân loại theo hai tọa độ và nhãn.
          </p>
          <div className="it-algorithm-input">
            {model !== 'knn' && model !== 'decision-tree' && (
              <label>
                Số vòng
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={s.iterations}
                  onChange={(e) => change('iterations', e.target.value)}
                />
              </label>
            )}
            {(model === 'linear-regression' || model === 'neural-network') && (
              <label>
                Learning rate
                <input
                  type="number"
                  step={0.05}
                  min={0.001}
                  max={1}
                  value={s.rate}
                  onChange={(e) => change('rate', e.target.value)}
                />
              </label>
            )}
            {(model === 'knn' || model === 'kmeans') && (
              <label>
                K
                <input
                  type="number"
                  min={1}
                  max={model === 'kmeans' ? 4 : 10}
                  value={s.k}
                  onChange={(e) => change('k', e.target.value)}
                />
              </label>
            )}
            <label>
              Query x
              <input
                type="number"
                min={-10}
                max={10}
                value={s.queryX}
                onChange={(e) => change('queryX', e.target.value)}
              />
            </label>
            {model !== 'linear-regression' && (
              <label>
                Query y
                <input
                  type="number"
                  min={-10}
                  max={10}
                  value={s.queryY}
                  onChange={(e) => change('queryY', e.target.value)}
                />
              </label>
            )}
          </div>
          {model === 'neural-network' && (
            <div className="it-algorithm-input">
              <label>
                Hidden layers
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={s.layers}
                  onChange={(e) => change('layers', e.target.value)}
                />
              </label>
              <label>
                Neurons / layer
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={s.neurons}
                  onChange={(e) => change('neurons', e.target.value)}
                />
              </label>
              <label>
                Activation
                <select
                  value={s.activation}
                  onChange={(e) => change('activation', e.target.value)}
                >
                  <option value="tanh">tanh</option>
                  <option value="sigmoid">sigmoid</option>
                  <option value="relu">ReLU</option>
                </select>
              </label>
            </div>
          )}
          <button
            className="it-button"
            onClick={() => change('points', defaults.points)}
          >
            Dữ liệu mẫu
          </button>
          {(points.error || trace.error) && (
            <p role="alert" className="it-error">
              {points.error ?? trace.error}
            </p>
          )}
        </section>
        <section className="it-panel">
          <h2>Dữ liệu & mô hình</h2>
          <svg
            className="it-ml-plot"
            viewBox="0 0 320 320"
            role="img"
            aria-label="Điểm dữ liệu, tâm cụm hoặc đường hồi quy"
          >
            <line x1={20} y1={160} x2={300} y2={160} />
            <line x1={160} y1={20} x2={160} y2={300} />
            <text x={290} y={153}>
              x
            </text>
            <text x={168} y={25}>
              y
            </text>
            <defs>
              <clipPath id={plotId}>
                <rect x={20} y={20} width={280} height={280} />
              </clipPath>
            </defs>
            {model === 'linear-regression' && f && (
              <line
                clipPath={`url(#${plotId})`}
                className="it-regression-line"
                x1={coord(-10)}
                y1={
                  320 -
                  coord((f.parameters[0] ?? 0) * -10 + (f.parameters[1] ?? 0))
                }
                x2={coord(10)}
                y2={
                  320 -
                  coord((f.parameters[0] ?? 0) * 10 + (f.parameters[1] ?? 0))
                }
              />
            )}
            {points.value?.map((p, i) => (
              <g
                key={i}
                className={
                  model === 'kmeans'
                    ? `it-cluster-${Math.round(f?.predictions[i] ?? 0)}`
                    : model === 'linear-regression'
                      ? 'it-point'
                      : (f?.predictions[i] ?? p.label ?? 0) >=
                          (model === 'neural-network' ? 0.5 : 1)
                        ? 'it-point-alt'
                        : 'it-point'
                }
              >
                <circle
                  cx={coord(p.x)}
                  cy={320 - coord(p.y)}
                  r={f?.neighbors.includes(i) ? 8 : 5}
                />
                <title>
                  Điểm {i + 1}: ({p.x},{p.y}), nhãn {p.label}
                </title>
              </g>
            ))}
            {f?.centroids.map((c, i) => (
              <g key={i}>
                <rect
                  className="it-centroid"
                  x={coord(c.x) - 7}
                  y={320 - coord(c.y) - 7}
                  width={14}
                  height={14}
                />
                <text x={coord(c.x) + 10} y={320 - coord(c.y)}>
                  C{i}
                </text>
              </g>
            ))}
            {f && f.query !== null && (
              <g className="it-query-point" clipPath={`url(#${plotId})`}>
                <path
                  d={`M ${coord(Number(s.queryX)) - 7} ${320 - coord(model === 'linear-regression' ? f.query : Number(s.queryY))} h 14 M ${coord(Number(s.queryX))} ${320 - coord(model === 'linear-regression' ? f.query : Number(s.queryY)) - 7} v 14`}
                />
                <title>
                  Query: x={s.queryX},{' '}
                  {model === 'linear-regression'
                    ? `y dự đoán=${f.query.toFixed(4)}`
                    : `y=${s.queryY}`}
                </title>
              </g>
            )}
          </svg>
          <p className="it-small">
            Trục x/y: -10 đến 10; tròn là dữ liệu, vuông là tâm cụm, dấu cộng là
            query. Điểm lớn là láng giềng KNN. Danh sách bên dưới là bản dữ liệu
            đọc được.
          </p>
          {model !== 'linear-regression' && (
            <p className="it-small">
              {model === 'kmeans'
                ? 'Màu biểu thị cụm C0–C3; prediction bên dưới là số cụm.'
                : 'Hai màu biểu thị class 0/1 ở prediction; MLP dùng ngưỡng 0.5. Nhãn dữ liệu gốc và prediction được liệt kê bên dưới.'}
            </p>
          )}
          <p className="it-operation" role="status">
            {f?.operation ?? 'Sửa dữ liệu để tiếp tục.'}
          </p>
          <p>
            Vòng: {f?.iteration ?? '—'} ·{' '}
            {model === 'knn'
              ? 'Không huấn luyện'
              : `Loss: ${f?.loss.toFixed(5) ?? '—'}`}{' '}
            · Query:{' '}
            {f?.query === null || !f ? 'chưa dự đoán' : f.query.toFixed(4)}
          </p>
          <SimulationControls {...playback} />
          {model === 'linear-regression' && f && (
            <p>
              y = {(f.parameters[0] ?? 0).toFixed(4)}x +{' '}
              {(f.parameters[1] ?? 0).toFixed(4)} · loss = MSE.
            </p>
          )}
          {model === 'neural-network' && (
            <>
              <div className="it-flow">
                <div className="it-flow-node">2 inputs</div>
                <div className="it-flow-node">
                  {s.layers} × {s.neurons} hidden
                </div>
                <div className="it-flow-node">1 sigmoid</div>
              </div>
              <p>
                Full-batch backprop, output xác suất nhãn 1, loss binary
                cross-entropy. Tọa độ /10 để ổn định; khởi tạo trọng số xác
                định. Một bước là một epoch, không giả vờ hiển thị mọi phép
                nhân.
              </p>
              <pre>
                {f?.parameters
                  .slice(0, 8)
                  .map((w, i) => `w${i}: ${w.toFixed(4)}`)
                  .join('\n')}
              </pre>
            </>
          )}
          {f?.tree.length !== 0 && f?.tree && <pre>{f.tree.join('\n')}</pre>}
          <details>
            <summary>Dữ liệu / prediction tại bước này</summary>
            <div
              className="it-table-scroll"
              tabIndex={0}
              aria-label="Prediction"
            >
              <table className="it-data-table">
                <thead>
                  <tr>
                    <th>Điểm</th>
                    <th>x</th>
                    <th>y</th>
                    <th>Nhãn</th>
                    <th>Prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {points.value?.map((p, i) => (
                    <tr key={i}>
                      <th>{i + 1}</th>
                      <td>{p.x}</td>
                      <td>{p.y}</td>
                      <td>{p.label}</td>
                      <td>{f?.predictions[i]?.toFixed(4) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      </div>
      <p>
        Thử đổi learning rate, giảm dữ liệu hoặc đảo nhãn. KNN hòa chọn nhãn 0;
        CART dùng Gini/depth 3; KMeans tối đa 50 vòng, không dùng nhãn có sẵn.
        Chưa có CNN, Transformer hay train/test split tự động.
      </p>
      <LabExplain
        title={models.find((m) => m.id === model)?.name ?? 'ML'}
        context={
          f ? `${f.operation}, loss=${f.loss}, query=${f.query}` : 'ML Lab'
        }
      />
    </>
  )
}
