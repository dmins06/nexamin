import type { DataPoint, MLExperiment } from './aiTypes'
import { integer } from '../shared/input'
export interface MLFrame {
  iteration: number
  loss: number
  predictions: number[]
  parameters: number[]
  centroids: { x: number; y: number }[]
  operation: string
  tree: string[]
  neighbors: number[]
  query: number | null
}
export function parsePoints(text: string): DataPoint[] {
  const lines = text.trim().split('\n')
  if (!text.trim() || lines.length < 2 || lines.length > 30)
    throw Error('Nhập 2–30 điểm: x y nhãn(0/1).')
  return lines.map((line, i) => {
    const p = line.trim().split(/\s+/)
    if (p.length !== 3) throw Error(`Dòng ${i + 1}: cần x y nhãn.`)
    const x = Number(p[0]),
      y = Number(p[1])
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > 10 ||
      Math.abs(y) > 10
    )
      throw Error('Tọa độ trong [-10,10].')
    return { x, y, label: integer(p[2] ?? '', 'Nhãn', 0, 1) }
  })
}
export interface MLConfig {
  model: MLExperiment
  points: DataPoint[]
  iterations: number
  learningRate: number
  k: number
  queryX: number
  queryY: number
  layers: number
  neurons: number
  activation: 'sigmoid' | 'tanh' | 'relu'
}
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2
const sigmoid = (x: number) =>
  1 / (1 + Math.exp(-Math.max(-40, Math.min(40, x))))
const mean = (values: number[]) =>
  values.reduce((s, v) => s + v, 0) / Math.max(1, values.length)
export function mlTrace(config: MLConfig): MLFrame[] {
  const {
    model,
    points,
    learningRate: lr,
    iterations,
    k,
    queryX,
    queryY,
    layers,
    neurons,
    activation,
  } = config
  integer(iterations, 'Số vòng', 1, 100)
  integer(k, 'K', 1, Math.min(10, points.length))
  integer(layers, 'Hidden layers', 1, 3)
  integer(neurons, 'Neurons', 2, 8)
  if (
    points.length < 2 ||
    points.length > 30 ||
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.abs(p.x) > 10 ||
        Math.abs(p.y) > 10 ||
        (p.label !== 0 && p.label !== 1),
    ) ||
    !Number.isFinite(lr) ||
    lr < 0.001 ||
    lr > 1 ||
    !Number.isFinite(queryX) ||
    !Number.isFinite(queryY) ||
    Math.abs(queryX) > 10 ||
    Math.abs(queryY) > 10
  )
    throw Error(
      'Dữ liệu/learning rate không hợp lệ. LR cần 0.001–1; query trong [-10,10].',
    )
  const frames: MLFrame[] = [],
    query = { x: queryX, y: queryY }
  const emit = (
    iteration: number,
    loss: number,
    predictions: number[],
    parameters: number[],
    operation: string,
    extra: Partial<
      Pick<MLFrame, 'centroids' | 'tree' | 'neighbors' | 'query'>
    > = {},
  ) => {
    if (
      !Number.isFinite(loss) ||
      loss > 1e8 ||
      parameters.some((p) => !Number.isFinite(p))
    )
      throw Error('Mô hình phân kỳ. Giảm learning rate hoặc tọa độ.')
    frames.push({
      iteration,
      loss,
      predictions: [...predictions],
      parameters: [...parameters],
      operation,
      centroids: [],
      tree: [],
      neighbors: [],
      query: null,
      ...extra,
    })
  }
  if (model === 'linear-regression') {
    let w = 0,
      b = 0
    for (let i = 0; i <= iterations; i++) {
      const predictions = points.map((p) => w * p.x + b * 10),
        loss = mean(points.map((p, j) => ((predictions[j] ?? 0) - p.y) ** 2))
      emit(
        i,
        loss,
        predictions,
        [w, b * 10],
        i
          ? 'Gradient descent: cập nhật slope/intercept từ toàn bộ dữ liệu.'
          : 'Khởi tạo slope = 0, intercept = 0.',
        { query: w * queryX + b * 10 },
      )
      const dw = mean(
          points.map((p) => (2 * ((w * p.x) / 10 + b - p.y / 10) * p.x) / 10),
        ),
        db = mean(points.map((p) => 2 * ((w * p.x) / 10 + b - p.y / 10)))
      w -= lr * dw
      b -= lr * db
    }
    return frames
  }
  if (model === 'kmeans') {
    if (k > 4 || new Set(points.map((p) => `${p.x},${p.y}`)).size < k)
      throw Error('KMeans cần K ≤ 4 và ít nhất K tọa độ khác nhau.')
    let centers = [{ x: points[0]?.x ?? 0, y: points[0]?.y ?? 0 }]
    while (centers.length < k) {
      const farthest = [...points].sort(
        (a, b) =>
          Math.min(...centers.map((c) => distance(b, c))) -
          Math.min(...centers.map((c) => distance(a, c))),
      )[0]
      if (!farthest) break
      centers.push({ x: farthest.x, y: farthest.y })
    }
    for (let i = 0; i <= Math.min(iterations, 50); i++) {
      const labels = points.map((p) =>
        centers.reduce(
          (best, c, j) =>
            distance(p, c) < distance(p, centers[best] ?? c) ? j : best,
          0,
        ),
      )
      const loss = mean(
        points.map((p, j) => distance(p, centers[labels[j] ?? 0] ?? query)),
      )
      emit(
        i,
        loss,
        labels,
        [],
        i
          ? 'Gán cụm gần nhất sau cập nhật tâm; loss là mean squared distance.'
          : 'Chọn tâm đầu tiên, sau đó tâm xa nhất (deterministic).',
        {
          centroids: centers.map((c) => ({ ...c })),
          query: centers.reduce(
            (best, c, j) =>
              distance(query, c) < distance(query, centers[best] ?? c)
                ? j
                : best,
            0,
          ),
        },
      )
      const next = centers.map((c, j) => {
        const members = points.filter((_, n) => labels[n] === j)
        return members.length
          ? {
              x: mean(members.map((p) => p.x)),
              y: mean(members.map((p) => p.y)),
            }
          : c
      })
      if (next.every((c, j) => distance(c, centers[j] ?? c) < 1e-12)) break
      centers = next
    }
    return frames
  }
  if (model === 'knn') {
    const neighbors = points
        .map((p, i) => ({ i, d: distance(p, query) }))
        .sort((a, b) => a.d - b.d || a.i - b.i)
        .slice(0, k)
        .map((v) => v.i),
      ones = neighbors.filter((i) => points[i]?.label === 1).length,
      prediction = ones > neighbors.length / 2 ? 1 : 0
    emit(
      0,
      0,
      points.map((p) => p.label ?? 0),
      [],
      'Tính khoảng cách Euclidean; không có bước huấn luyện.',
      { query: null },
    )
    emit(
      1,
      0,
      points.map((p) => p.label ?? 0),
      [],
      `K=${k}: ${ones} phiếu nhãn 1, ${neighbors.length - ones} phiếu nhãn 0; hòa chọn 0.`,
      { neighbors, query: prediction },
    )
    return frames
  }
  if (model === 'decision-tree') {
    interface Node {
      feature: 'x' | 'y' | null
      threshold: number
      label: number
      left: Node | null
      right: Node | null
    }
    const lines: string[] = [],
      gini = (data: DataPoint[]) => {
        const p = data.filter((v) => v.label === 1).length / data.length
        return 2 * p * (1 - p)
      }
    const build = (data: DataPoint[], depth: number, prefix: string): Node => {
      const label =
          data.filter((p) => p.label === 1).length > data.length / 2 ? 1 : 0,
        node: Node = {
          feature: null,
          threshold: 0,
          label,
          left: null,
          right: null,
        }
      if (depth >= 3 || gini(data) === 0) {
        lines.push(`${prefix}Leaf: class ${label} (${data.length} điểm)`)
        return node
      }
      let best: {
        feature: 'x' | 'y'
        threshold: number
        left: DataPoint[]
        right: DataPoint[]
        score: number
      } | null = null
      for (const feature of ['x', 'y'] as const) {
        const values = [...new Set(data.map((p) => p[feature]))].sort(
          (a, b) => a - b,
        )
        for (let i = 0; i < values.length - 1; i++) {
          const threshold = ((values[i] ?? 0) + (values[i + 1] ?? 0)) / 2,
            left = data.filter((p) => p[feature] <= threshold),
            right = data.filter((p) => p[feature] > threshold),
            score =
              (left.length * gini(left) + right.length * gini(right)) /
              data.length
          if (!best || score < best.score)
            best = { feature, threshold, left, right, score }
        }
      }
      if (!best || best.score >= gini(data) - 1e-12) {
        lines.push(`${prefix}Leaf: class ${label} (${data.length} điểm)`)
        return node
      }
      node.feature = best.feature
      node.threshold = best.threshold
      lines.push(
        `${prefix}${best.feature} ≤ ${best.threshold.toFixed(2)} (${data.length} điểm)`,
      )
      node.left = build(best.left, depth + 1, prefix + '  [yes] ')
      node.right = build(best.right, depth + 1, prefix + '  [no] ')
      return node
    }
    const tree = build(points, 0, ''),
      predict = (p: { x: number; y: number }, node: Node): number =>
        node.feature
          ? predict(
              p,
              p[node.feature] <= node.threshold
                ? (node.left ?? { ...node, feature: null })
                : (node.right ?? { ...node, feature: null }),
            )
          : node.label
    emit(
      0,
      0,
      points.map((p) => p.label ?? 0),
      [],
      'CART: chọn ngưỡng giảm Gini, depth tối đa 3.',
    )
    const predictions = points.map((p) => predict(p, tree)),
      loss = mean(points.map((p, i) => (predictions[i] === p.label ? 0 : 1)))
    emit(
      1,
      loss,
      predictions,
      [],
      `Cây được fit trên dữ liệu nhập; loss là training error, không phải kiểm thử độc lập.`,
      { tree: lines, query: predict(query, tree) },
    )
    return frames
  }
  // Actual small dense MLP, full-batch backprop; deterministic initialization.
  const widths = [2, ...Array.from({ length: layers }, () => neurons), 1]
  const weights = widths
      .slice(1)
      .map((out, l) =>
        Array.from({ length: out }, (_, j) =>
          Array.from(
            { length: widths[l] ?? 0 },
            (_, i) =>
              Math.sin((l + 1) * 17 + (j + 1) * 11 + (i + 1) * 7) * 0.45,
          ),
        ),
      ),
    biases = widths.slice(1).map((out) => Array.from({ length: out }, () => 0))
  const activate = (x: number) =>
    activation === 'relu'
      ? Math.max(0, x)
      : activation === 'tanh'
        ? Math.tanh(x)
        : sigmoid(x)
  const derivative = (y: number) =>
    activation === 'relu'
      ? y > 0
        ? 1
        : 0
      : activation === 'tanh'
        ? 1 - y * y
        : y * (1 - y)
  const forward = (p: { x: number; y: number }) => {
    const values: number[][] = [[p.x / 10, p.y / 10]]
    for (const [l, layer] of weights.entries())
      values.push(
        layer.map((ws, j) => {
          const z = ws.reduce(
            (n, w, i) => n + w * (values[l]?.[i] ?? 0),
            biases[l]?.[j] ?? 0,
          )
          return l === weights.length - 1 ? sigmoid(z) : activate(z)
        }),
      )
    return values
  }
  for (let epoch = 0; epoch <= iterations; epoch++) {
    const predictions = points.map((p) => forward(p).at(-1)?.[0] ?? 0),
      loss = mean(
        points.map((p, i) => {
          const probability = Math.max(
            1e-9,
            Math.min(1 - 1e-9, predictions[i] ?? 0),
          )
          return (
            -(p.label ?? 0) * Math.log(probability) -
            (1 - (p.label ?? 0)) * Math.log(1 - probability)
          )
        }),
      )
    emit(
      epoch,
      loss,
      predictions,
      weights.flat(2),
      `Epoch ${epoch}: forward → binary cross-entropy → backprop → weight update.`,
      { query: forward(query).at(-1)?.[0] ?? 0 },
    )
    const gradients = weights.map((layer) =>
        layer.map((ws) => ws.map(() => 0)),
      ),
      biasGrad = biases.map((bs) => bs.map(() => 0))
    for (const p of points) {
      const values = forward(p),
        deltas: number[][] = Array.from({ length: weights.length }, () => [])
      deltas[weights.length - 1] = [(values.at(-1)?.[0] ?? 0) - (p.label ?? 0)]
      for (let l = weights.length - 2; l >= 0; l--)
        deltas[l] = (values[l + 1] ?? []).map(
          (v, j) =>
            (weights[l + 1] ?? []).reduce(
              (sum, ws, n) => sum + (ws[j] ?? 0) * (deltas[l + 1]?.[n] ?? 0),
              0,
            ) * derivative(v),
        )
      for (const [l, layer] of weights.entries())
        for (const [j, ws] of layer.entries()) {
          const delta = deltas[l]?.[j] ?? 0
          const bg = biasGrad[l]
          if (bg) bg[j] = (bg[j] ?? 0) + delta
          for (const [i] of ws.entries()) {
            const g = gradients[l]?.[j]
            if (g) g[i] = (g[i] ?? 0) + delta * (values[l]?.[i] ?? 0)
          }
        }
    }
    for (const [l, layer] of weights.entries())
      for (const [j, ws] of layer.entries()) {
        const bs = biases[l]
        if (bs)
          bs[j] = (bs[j] ?? 0) - (lr * (biasGrad[l]?.[j] ?? 0)) / points.length
        for (const [i, w] of ws.entries())
          ws[i] = w - (lr * (gradients[l]?.[j]?.[i] ?? 0)) / points.length
      }
  }
  return frames
}
