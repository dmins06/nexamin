import type {
  AlgorithmId,
  AlgorithmInput,
  GraphEdge,
  TraceFrame,
} from './algorithmTypes'
export function parseValues(text: string): number[] {
  const tokens = text.trim().split(/[\s,]+/)
  if (
    tokens.length < 1 ||
    tokens.length > 20 ||
    tokens.some((t) => !/^-?\d+$/.test(t))
  )
    throw Error(
      'Nhập từ 1 đến 20 số nguyên, cách nhau bằng dấu phẩy hoặc khoảng trắng.',
    )
  const values = tokens.map(Number)
  if (values.some((v) => Math.abs(v) > 999))
    throw Error('Mỗi số cần nằm trong khoảng −999 đến 999.')
  return values
}
export function parseEdges(
  text: string,
  nodeCount: number,
  directed: boolean,
): GraphEdge[] {
  if (!Number.isInteger(nodeCount) || nodeCount < 2 || nodeCount > 10)
    throw Error('Đồ thị cần từ 2 đến 10 đỉnh.')
  if (text.length > 2000) throw Error('Danh sách cạnh quá dài.')
  const lines = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    seen = new Set<string>()
  if (lines.length > 30) throw Error('Tối đa 30 cạnh.')
  return lines.map((line) => {
    const parts = line.split(/[\s,]+/)
    if (
      parts.length < 2 ||
      parts.length > 3 ||
      parts.some((p) => !/^\d+$/.test(p))
    )
      throw Error(
        'Mỗi dòng: đỉnh đầu, đỉnh cuối, trọng số không âm (mặc định 1).',
      )
    const from = Number(parts[0]),
      to = Number(parts[1]),
      weight = Number(parts[2] ?? 1)
    if (from >= nodeCount || to >= nodeCount || from === to || weight > 999)
      throw Error(
        `Đỉnh từ 0 đến ${nodeCount - 1}, không cạnh tự nối; trọng số 0–999.`,
      )
    const key = directed
      ? `${from}:${to}`
      : `${Math.min(from, to)}:${Math.max(from, to)}`
    if (seen.has(key))
      throw Error('Cạnh bị trùng. Mỗi cặp đỉnh chỉ nhập một cạnh.')
    seen.add(key)
    return { from, to, weight }
  })
}
export function createTrace(
  id: AlgorithmId,
  input: AlgorithmInput,
): TraceFrame[] {
  const values = [...input.values],
    frames: TraceFrame[] = [],
    state: TraceFrame = {
      values,
      active: [],
      settled: [],
      frontier: [],
      distances: [],
      found: null,
      codeLine: 0,
      operation: 'Sẵn sàng',
      comparisons: 0,
      swaps: 0,
      visited: [],
      edge: null,
    }
  const at = (i: number) => values[i] ?? 0
  const emit = (
    line: number,
    operation: string,
    active: number[] = [],
    edge: [number, number] | null = null,
  ) => {
    if (frames.length >= 4000)
      throw Error('Dữ liệu tạo quá nhiều bước. Giảm kích thước và thử lại.')
    frames.push({
      ...state,
      values: [...values],
      active: [...active],
      settled: [...state.settled],
      frontier: [...state.frontier],
      distances: [...state.distances],
      visited: [...state.visited],
      codeLine: line,
      operation,
      edge,
    })
  }
  const swap = (i: number, j: number) => {
    if (i !== j) {
      const v = at(i)
      values[i] = at(j)
      values[j] = v
      state.swaps++
    }
  }
  if (['bfs', 'dfs', 'dijkstra'].includes(id)) {
    if (
      !Number.isInteger(input.start) ||
      input.start < 0 ||
      input.start >= input.nodeCount
    )
      throw Error('Đỉnh bắt đầu không hợp lệ.')
    const adj = Array.from(
      { length: input.nodeCount },
      () => [] as { node: number; weight: number }[],
    )
    for (const e of input.edges) {
      if (e.weight < 0 || e.from >= input.nodeCount || e.to >= input.nodeCount)
        throw Error('Cạnh không hợp lệ.')
      adj[e.from]?.push({ node: e.to, weight: e.weight })
      if (!input.directed) adj[e.to]?.push({ node: e.from, weight: e.weight })
    }
    adj.forEach((list) => list.sort((a, b) => a.node - b.node))
    if (id === 'dijkstra') {
      const distances = Array.from({ length: input.nodeCount }, () => Infinity),
        visited = new Set<number>()
      distances[input.start] = 0
      state.distances = distances.map((d) => (Number.isFinite(d) ? d : null))
      emit(0, 'Khởi tạo khoảng cách')
      while (visited.size < input.nodeCount) {
        let u = -1
        for (let i = 0; i < input.nodeCount; i++)
          if (
            !visited.has(i) &&
            Number.isFinite(distances[i]) &&
            (u < 0 || (distances[i] ?? Infinity) < (distances[u] ?? Infinity))
          )
            u = i
        if (u < 0) break
        emit(2, `Chọn đỉnh ${u} có khoảng cách nhỏ nhất`, [u])
        visited.add(u)
        state.visited = [...visited]
        emit(3, `Chốt khoảng cách đỉnh ${u}`, [u])
        for (const { node: v, weight } of adj[u] ?? []) {
          if (visited.has(v)) continue
          state.comparisons++
          emit(5, `Xét cạnh ${u} → ${v}, trọng số ${weight}`, [u, v], [u, v])
          const candidate = (distances[u] ?? Infinity) + weight
          if (candidate < (distances[v] ?? Infinity)) {
            distances[v] = candidate
            state.distances = distances.map((d) =>
              Number.isFinite(d) ? d : null,
            )
            emit(6, `Cập nhật khoảng cách đến ${v} = ${candidate}`, [v], [u, v])
          }
        }
      }
      emit(1, 'Hoàn tất. Đỉnh không đến được giữ khoảng cách ∞.')
      return frames
    }
    const discovered = new Set([input.start]),
      pending = [input.start]
    state.frontier = [...pending]
    emit(
      0,
      `Khởi tạo ${id === 'bfs' ? 'hàng đợi' : 'stack'} với đỉnh ${input.start}`,
    )
    while (pending.length) {
      const u = id === 'bfs' ? pending.shift() : pending.pop()
      if (u === undefined) break
      state.visited.push(u)
      state.frontier = [...pending]
      emit(2, `Thăm đỉnh ${u}`, [u])
      const neighbors =
        id === 'bfs' ? (adj[u] ?? []) : [...(adj[u] ?? [])].reverse()
      for (const { node: v } of neighbors) {
        state.comparisons++
        emit(4, `Kiểm tra đỉnh ${v}`, [u, v], [u, v])
        if (!discovered.has(v)) {
          discovered.add(v)
          pending.push(v)
          state.frontier = [...pending]
          emit(
            5,
            `Thêm ${v} vào ${id === 'bfs' ? 'hàng đợi' : 'stack'}`,
            [v],
            [u, v],
          )
        }
      }
    }
    emit(1, 'Hoàn tất thành phần đến được từ đỉnh đầu.')
    return frames
  }
  if (
    values.length < 1 ||
    values.length > 20 ||
    values.some((v) => !Number.isInteger(v) || Math.abs(v) > 999)
  )
    throw Error('Dãy không hợp lệ.')
  if (id === 'binary') values.sort((a, b) => a - b)
  emit(
    0,
    id === 'binary'
      ? 'Dãy được sắp xếp trước khi tìm'
      : 'Bắt đầu với dãy đã nhập',
  )
  if (id === 'bubble')
    for (let end = values.length - 1; end > 0; end--) {
      let changed = false
      emit(1, 'Bắt đầu một lượt')
      for (let j = 0; j < end; j++) {
        state.comparisons++
        emit(3, `So sánh ${at(j)} và ${at(j + 1)}`, [j, j + 1])
        if (at(j) > at(j + 1)) {
          swap(j, j + 1)
          changed = true
          emit(4, 'Hoán đổi hai phần tử', [j, j + 1])
        }
      }
      state.settled.push(end)
      if (!changed) {
        emit(5, 'Không còn hoán đổi, dừng sớm')
        break
      }
    }
  if (id === 'selection')
    for (let i = 0; i < values.length - 1; i++) {
      let min = i
      emit(1, `Tìm nhỏ nhất từ vị trí ${i}`, [i])
      for (let j = i + 1; j < values.length; j++) {
        state.comparisons++
        emit(3, `So sánh ${at(j)} với nhỏ nhất ${at(min)}`, [j, min])
        if (at(j) < at(min)) {
          min = j
          emit(3, `Nhỏ nhất mới tại ${min}`, [min])
        }
      }
      swap(i, min)
      state.settled.push(i)
      emit(4, `Đặt nhỏ nhất vào vị trí ${i}`, [i, min])
    }
  if (id === 'insertion')
    for (let i = 1; i < values.length; i++) {
      const key = at(i)
      let j = i - 1
      emit(1, `Giữ giá trị ${key}`, [i])
      while (j >= 0) {
        state.comparisons++
        emit(2, `So sánh ${at(j)} với ${key}`, [j])
        if (at(j) <= key) break
        values[j + 1] = at(j)
        emit(3, 'Dịch phần tử sang phải', [j, j + 1])
        j--
      }
      values[j + 1] = key
      emit(4, `Chèn ${key} vào vị trí ${j + 1}`, [j + 1])
    }
  if (id === 'merge') {
    const sort = (left: number, right: number) => {
      emit(0, `Xét đoạn ${left}…${right}`)
      if (left >= right) {
        emit(1, 'Đoạn một phần tử')
        return
      }
      const mid = Math.floor((left + right) / 2)
      emit(2, `Chia tại ${mid}`)
      sort(left, mid)
      sort(mid + 1, right)
      const temp: number[] = []
      let i = left,
        j = mid + 1
      while (i <= mid && j <= right) {
        state.comparisons++
        emit(4, `So sánh ${at(i)} và ${at(j)}`, [i, j])
        temp.push(at(i) <= at(j) ? at(i++) : at(j++))
        emit(5, `Ghi ${temp[temp.length - 1]} vào vùng tạm`)
      }
      while (i <= mid) temp.push(at(i++))
      while (j <= right) temp.push(at(j++))
      temp.forEach((v, k) => {
        values[left + k] = v
        emit(6, `Ghi ${v} về vị trí ${left + k}`, [left + k])
      })
    }
    sort(0, values.length - 1)
  }
  if (id === 'quick') {
    const sort = (left: number, right: number) => {
      emit(0, `Xét đoạn ${left}…${right}`)
      if (left >= right) {
        emit(1, 'Đoạn đã có thứ tự')
        return
      }
      const pivot = at(right)
      let i = left
      emit(2, `Pivot = ${pivot}`, [right])
      for (let j = left; j < right; j++) {
        state.comparisons++
        emit(4, `So sánh ${at(j)} với pivot ${pivot}`, [j, right])
        if (at(j) <= pivot) {
          swap(i, j)
          emit(5, 'Chuyển vào nhóm nhỏ hơn hoặc bằng pivot', [i, j])
          i++
        }
      }
      swap(i, right)
      state.settled.push(i)
      emit(6, `Đặt pivot tại vị trí ${i}`, [i])
      emit(7, 'Tiếp tục hai đoạn hai bên')
      sort(left, i - 1)
      sort(i + 1, right)
    }
    sort(0, values.length - 1)
  }
  if (id === 'linear') {
    for (let i = 0; i < values.length; i++) {
      state.comparisons++
      emit(1, `So sánh ${at(i)} với ${input.target}`, [i])
      if (at(i) === input.target) {
        state.found = i
        emit(1, `Tìm thấy tại chỉ số ${i}`, [i])
        return frames
      }
    }
    emit(2, 'Không tìm thấy')
    return frames
  }
  if (id === 'binary') {
    let left = 0,
      right = values.length - 1
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      emit(2, `Đoạn ${left}…${right}, giữa ${mid}`, [mid])
      state.comparisons++
      emit(3, `So sánh ${at(mid)} với ${input.target}`, [mid])
      if (at(mid) === input.target) {
        state.found = mid
        emit(4, `Tìm thấy tại chỉ số ${mid} trong dãy đã sắp xếp`, [mid])
        return frames
      }
      if (at(mid) < input.target) {
        left = mid + 1
        emit(5, 'Thu hẹp sang nửa phải')
      } else {
        right = mid - 1
        emit(6, 'Thu hẹp sang nửa trái')
      }
    }
    emit(7, 'Không tìm thấy')
    return frames
  }
  state.settled = values.map((_, i) => i)
  emit(0, 'Hoàn tất: dãy tăng dần')
  return frames
}
