import type { AlgorithmInput, TraceFrame } from './algorithmTypes'
export function AlgorithmDiagram({
  frame,
  input,
  graph,
}: {
  frame: TraceFrame
  input: AlgorithmInput
  graph: boolean
}) {
  if (!graph)
    return (
      <div className="it-array" aria-label="Trạng thái dãy">
        {frame.values.map((v, i) => (
          <div
            key={i}
            className={`it-array-item ${frame.active.includes(i) ? 'active' : ''} ${frame.settled.includes(i) || frame.found === i ? 'settled' : ''}`}
          >
            <strong>{v}</strong>
            <span>[{i}]</span>
          </div>
        ))}
      </div>
    )
  const positions = Array.from({ length: input.nodeCount }, (_, i) => ({
    x: 180 + 125 * Math.cos((2 * Math.PI * i) / input.nodeCount - Math.PI / 2),
    y: 155 + 115 * Math.sin((2 * Math.PI * i) / input.nodeCount - Math.PI / 2),
  }))
  return (
    <>
      <svg
        className="it-graph"
        viewBox="0 0 360 310"
        role="img"
        aria-label={`Đồ thị ${input.nodeCount} đỉnh, ${input.directed ? 'có' : 'không'} hướng. Đã thăm: ${frame.visited.join(', ') || 'chưa có'}`}
      >
        <defs>
          <marker
            id="it-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {input.edges.map((e, i) => {
          const from = positions[e.from],
            to = positions[e.to]
          if (!from || !to) return null
          const dx = to.x - from.x,
            dy = to.y - from.y,
            len = Math.hypot(dx, dy),
            active =
              frame.edge &&
              ((frame.edge[0] === e.from && frame.edge[1] === e.to) ||
                (!input.directed &&
                  frame.edge[1] === e.from &&
                  frame.edge[0] === e.to))
          return (
            <g key={i} className={active ? 'active' : ''}>
              <line
                x1={from.x + (dx / len) * 22}
                y1={from.y + (dy / len) * 22}
                x2={to.x - (dx / len) * 24}
                y2={to.y - (dy / len) * 24}
                markerEnd={input.directed ? 'url(#it-arrow)' : undefined}
              />
              <text x={(from.x + to.x) / 2 + 4} y={(from.y + to.y) / 2 - 5}>
                {e.weight}
              </text>
            </g>
          )
        })}
        {positions.map((p, i) => (
          <g
            key={i}
            className={`it-node ${frame.visited.includes(i) ? 'settled' : ''} ${frame.active.includes(i) ? 'active' : ''}`}
          >
            <circle cx={p.x} cy={p.y} r="21" />
            <text x={p.x} y={p.y + 5} textAnchor="middle">
              {i}
            </text>
          </g>
        ))}
      </svg>
      <p className="it-small">
        Đã thăm: {frame.visited.join(' → ') || 'chưa có'} · Chờ:{' '}
        {frame.frontier.join(', ') || 'trống'}
      </p>
      {frame.distances.length > 0 && (
        <dl className="it-distances" aria-label="Khoảng cách từ đỉnh đầu">
          {frame.distances.map((d, i) => (
            <div key={i}>
              <dt>Đỉnh {i}</dt>
              <dd>{d ?? '∞'}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}
