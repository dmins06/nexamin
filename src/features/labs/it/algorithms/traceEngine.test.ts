import { describe, it, expect } from 'vitest'
import { createTrace, parseEdges, parseValues } from './traceEngine'
import type { AlgorithmId, AlgorithmInput } from './algorithmTypes'
import { algorithms } from './algorithmRegistry'
const input: AlgorithmInput = {
  values: [5, 2, 8, 1, 4],
  target: 4,
  nodeCount: 5,
  start: 0,
  directed: false,
  edges: [
    { from: 0, to: 1, weight: 4 },
    { from: 0, to: 2, weight: 1 },
    { from: 2, to: 1, weight: 2 },
    { from: 1, to: 3, weight: 1 },
  ],
}
describe('real algorithm traces', () => {
  for (const id of [
    'bubble',
    'selection',
    'insertion',
    'merge',
    'quick',
  ] satisfies AlgorithmId[])
    it(`${id} sorts and snapshots all frames`, () => {
      for (const values of [
        [5, 2, 8, 1, 4],
        [1],
        [-4, 3, -4, 0],
        [1, 2, 3],
        [3, 2, 1],
        [2, 2, 2],
      ]) {
        const frames = createTrace(id, { ...input, values })
        expect(frames.at(-1)?.values).toEqual([...values].sort((a, b) => a - b))
        expect(values).toEqual(frames[0]?.values)
        expect(
          frames.every(
            (f) =>
              f.codeLine >= 0 &&
              f.codeLine <
                (algorithms.find((a) => a.id === id)?.code.length ?? 0),
          ),
        ).toBe(true)
      }
    })
  it('search returns matching index or absence, binary index refers to sorted array', () => {
    expect(createTrace('linear', input).at(-1)?.found).toBe(4)
    const binary = createTrace('binary', input).at(-1)
    expect(binary?.values).toEqual([1, 2, 4, 5, 8])
    expect(binary?.found).toBe(2)
    for (const id of ['binary', 'linear'] satisfies AlgorithmId[])
      expect(createTrace(id, { ...input, target: 99 }).at(-1)?.found).toBeNull()
  })
  it('BFS/DFS never visit disconnected or duplicate nodes', () => {
    for (const id of ['bfs', 'dfs'] satisfies AlgorithmId[]) {
      const frames = createTrace(id, input),
        visited = frames.at(-1)?.visited ?? []
      expect([...visited].sort()).toEqual([0, 1, 2, 3])
      expect(new Set(visited).size).toBe(visited.length)
    }
  })
  it('Dijkstra uses weights, preserves unreachable infinity and follows direction', () => {
    expect(createTrace('dijkstra', input).at(-1)?.distances).toEqual([
      0,
      3,
      1,
      4,
      null,
    ])
    expect(
      createTrace('dijkstra', { ...input, directed: true, start: 3 }).at(-1)
        ?.distances,
    ).toEqual([null, null, null, 0, null])
    expect(
      createTrace('dijkstra', {
        ...input,
        edges: [{ from: 0, to: 1, weight: 0 }],
      }).at(-1)?.distances,
    ).toEqual([0, 0, null, null, null])
  })
  it('rejects malformed inputs, negative weights, duplicates and oversize data', () => {
    expect(parseValues('1, -3 2')).toEqual([1, -3, 2])
    for (const s of ['', 'NaN', '1.5', '1000', Array(21).fill(1).join(',')])
      expect(() => parseValues(s)).toThrow()
    for (const s of ['0 1 -1', '0 0 1', '0 9', '0 1\n1 0', '0 1\n0 1'])
      expect(() => parseEdges(s, 5, false)).toThrow()
    expect(parseEdges('0 1\n1 0', 5, true)).toHaveLength(2)
    expect(() =>
      createTrace('dijkstra', {
        ...input,
        edges: [{ from: 0, to: 1, weight: -1 }],
      }),
    ).toThrow()
  })
})
