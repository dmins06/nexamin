import type {
  LabProcess,
  SchedulingPolicy,
  ScheduleSlice,
  ProcessMetrics,
  MemoryBlock,
} from './osTypes'
import { integer, numbers } from '../shared/input'
export function parseProcesses(text: string): LabProcess[] {
  const lines = text.trim().split('\n')
  if (!text.trim() || lines.length > 12)
    throw Error('Nhập 1–12 tiến trình: ID arrival burst priority.')
  const ids = new Set<string>()
  return lines.map((line, i) => {
    const p = line.trim().split(/\s+/),
      id = p[0] ?? ''
    if (p.length !== 4 || !/^[A-Za-z][A-Za-z0-9]{0,7}$/.test(id) || ids.has(id))
      throw Error(`Dòng ${i + 1}: ID duy nhất và 3 số nguyên.`)
    ids.add(id)
    return {
      id,
      arrival: integer(p[1] ?? '', 'Arrival', 0, 100),
      burst: integer(p[2] ?? '', 'Burst', 1, 50),
      priority: integer(p[3] ?? '', 'Priority', 0, 99),
    }
  })
}
export function schedule(
  processes: readonly LabProcess[],
  policy: SchedulingPolicy,
  quantum = 2,
): { slices: ScheduleSlice[]; metrics: ProcessMetrics[] } {
  if (!processes.length || processes.length > 12)
    throw Error('Cần 1–12 tiến trình.')
  const ids = new Set<string>()
  for (const p of processes) {
    if (ids.has(p.id)) throw Error('ID bị trùng.')
    ids.add(p.id)
    integer(p.arrival, 'Arrival', 0, 100)
    integer(p.burst, 'Burst', 1, 50)
    integer(p.priority, 'Priority', 0, 99)
  }
  integer(quantum, 'Quantum', 1, 20)
  const remaining = processes.map((p) => p.burst),
    first = processes.map(() => -1),
    completed = processes.map(() => -1),
    slices: ScheduleSlice[] = [],
    queue: number[] = [],
    seen = new Set<number>()
  let time = 0,
    finished = 0
  const arrivals = () =>
    processes
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => p.arrival <= time && !seen.has(i))
      .sort((a, b) => a.p.arrival - b.p.arrival || a.i - b.i)
      .forEach(({ i }) => {
        queue.push(i)
        seen.add(i)
      })
  const tick = (i: number | null) => {
    const last = slices.at(-1),
      id = i === null ? null : (processes[i]?.id ?? null)
    if (last?.processId === id && last.end === time) last.end++
    else slices.push({ processId: id, start: time, end: time + 1 })
    time++
    if (i !== null) {
      if (first[i] === -1) first[i] = time - 1
      remaining[i] = (remaining[i] ?? 0) - 1
      if (remaining[i] === 0) {
        completed[i] = time
        finished++
      }
    }
  }
  while (finished < processes.length && time < 800) {
    arrivals()
    if (policy === 'round-robin') {
      const i = queue.shift()
      if (i === undefined) {
        tick(null)
        continue
      }
      const duration = Math.min(quantum, remaining[i] ?? 0)
      for (let j = 0; j < duration; j++) {
        tick(i)
        arrivals()
      }
      if ((remaining[i] ?? 0) > 0) queue.push(i)
    } else {
      const ready = processes
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => p.arrival <= time && (remaining[i] ?? 0) > 0)
      ready.sort(
        (a, b) =>
          (policy === 'sjf'
            ? a.p.burst - b.p.burst
            : policy === 'srtf'
              ? (remaining[a.i] ?? 0) - (remaining[b.i] ?? 0)
              : policy === 'priority'
                ? a.p.priority - b.p.priority
                : 0) ||
          a.p.arrival - b.p.arrival ||
          a.i - b.i,
      )
      const i = ready[0]?.i
      if (i === undefined) {
        tick(null)
        continue
      }
      const duration = policy === 'srtf' ? 1 : (remaining[i] ?? 0)
      for (let j = 0; j < duration; j++) tick(i)
    }
  }
  if (finished !== processes.length) throw Error('Timeline vượt giới hạn.')
  return {
    slices,
    metrics: processes.map((p, i) => ({
      processId: p.id,
      turnaround: (completed[i] ?? 0) - p.arrival,
      waiting: (completed[i] ?? 0) - p.arrival - p.burst,
      response: (first[i] ?? 0) - p.arrival,
    })),
  }
}
export type MemoryPolicy = 'first' | 'best' | 'worst'
export function allocateMemory(
  holes: string,
  requests: string,
  policy: MemoryPolicy,
) {
  let start = 0
  const blocks: MemoryBlock[] = numbers(holes, 'Khối RAM', 1, 1024, 12).map(
      (size) => {
        const block = { start, size, processId: null }
        start += size
        return block
      },
    ),
    decisions: string[] = []
  const sizes = numbers(requests, 'Yêu cầu', 1, 1024, 12)
  for (const [i, size] of sizes.entries()) {
    const free = blocks
      .map((b, index) => ({ b, index }))
      .filter(({ b }) => b.processId === null && b.size >= size)
    if (policy === 'best') free.sort((a, b) => a.b.size - b.b.size)
    if (policy === 'worst') free.sort((a, b) => b.b.size - a.b.size)
    const chosen = free[0]
    if (!chosen) {
      decisions.push(`P${i + 1}: ${size} KB không vừa khối trống nào.`)
      continue
    }
    const b = chosen.b,
      parts: MemoryBlock[] = [{ start: b.start, size, processId: `P${i + 1}` }]
    if (b.size > size)
      parts.push({
        start: b.start + size,
        size: b.size - size,
        processId: null,
      })
    blocks.splice(chosen.index, 1, ...parts)
    decisions.push(`P${i + 1}: ${size} KB tại ${b.start}.`)
  }
  return { blocks, decisions, total: start }
}
export function deadlockCycle(text: string): string[] {
  const lines = text.trim().split('\n')
  if (!text.trim() || lines.length > 32)
    throw Error('Nhập 1–32 cạnh P1 -> R1 hoặc R1 -> P2.')
  const adjacency = new Map<string, string[]>(),
    owners = new Set<string>(),
    edges = new Set<string>()
  for (const line of lines) {
    const m = /^\s*([PR][1-9]\d?)\s*->\s*([PR][1-9]\d?)\s*$/.exec(line),
      a = m?.[1],
      b = m?.[2]
    if (!a || !b || a[0] === b[0] || edges.has(`${a}:${b}`))
      throw Error('Cạnh duy nhất nối tiến trình với tài nguyên.')
    if (a.startsWith('R')) {
      if (owners.has(a))
        throw Error('Mô hình chỉ cho mỗi tài nguyên một chủ sở hữu.')
      owners.add(a)
    }
    edges.add(`${a}:${b}`)
    adjacency.set(a, [...(adjacency.get(a) ?? []), b])
  }
  const done = new Set<string>(),
    path: string[] = []
  const visit = (node: string): string[] => {
    const at = path.indexOf(node)
    if (at >= 0) return [...path.slice(at), node]
    if (done.has(node)) return []
    path.push(node)
    for (const next of adjacency.get(node) ?? []) {
      const cycle = visit(next)
      if (cycle.length) return cycle
    }
    path.pop()
    done.add(node)
    return []
  }
  for (const node of adjacency.keys()) {
    const cycle = visit(node)
    if (cycle.length) return cycle
  }
  return []
}
