import { describe, it, expect } from 'vitest'
import { cpuTrace, parseProgram } from './computer/cpuEngine'
import {
  schedule,
  parseProcesses,
  allocateMemory,
  deadlockCycle,
} from './os/osEngine'
describe('CPU educational execution', () => {
  it('loads, adds, stores and halts with immutable frames', () => {
    const f = cpuTrace(
      'LOAD R0 0\nLOAD R1 1\nADD R2 R0 R1\nSTORE R2 2\nHALT',
      '5,7',
    )
    expect(f.at(-1)?.ram[2]).toBe(12)
    expect(f[0]?.ram[2]).toBe(0)
    expect(f.at(-1)?.phase).toBe('halted')
    expect(f.map((s) => s.phase)).toContain('decode')
  })
  it('counts direct-mapped hits and rejects invalid instructions', () => {
    expect(cpuTrace('LOAD R0 0\nLOAD R1 0\nHALT', '4').at(-1)?.hits).toBe(1)
    expect(() => parseProgram('LOAD R9 16')).toThrow()
    expect(() => parseProgram('eval(1)')).toThrow()
  })
})
describe('OS exact calculations', () => {
  const processes = parseProcesses('P1 0 5 2\nP2 1 2 1\nP3 2 1 3')
  it('FCFS, SJF and non-preemptive priority compute response/waiting', () => {
    expect(schedule(processes, 'fcfs').metrics[1]).toEqual({
      processId: 'P2',
      waiting: 4,
      turnaround: 6,
      response: 4,
    })
    expect(schedule(processes, 'sjf').slices.map((s) => s.processId)).toEqual([
      'P1',
      'P3',
      'P2',
    ])
    expect(schedule(processes, 'priority').slices[1]?.processId).toBe('P2')
  })
  it('SRTF preempts and RR queues arrivals before requeuing', () => {
    expect(schedule(processes, 'srtf').slices[1]?.processId).toBe('P2')
    expect(
      schedule(processes, 'round-robin', 2).slices.map((s) => s.processId),
    ).toEqual(['P1', 'P2', 'P3', 'P1'])
    for (const policy of [
      'fcfs',
      'sjf',
      'srtf',
      'round-robin',
      'priority',
    ] as const) {
      for (const m of schedule(processes, policy).metrics) {
        expect(m.waiting).toBeGreaterThanOrEqual(0)
        expect(m.response).toBeLessThanOrEqual(m.waiting)
      }
    }
  })
  it('handles idle time and refuses zero quantum/duplicates', () => {
    expect(
      schedule(parseProcesses('P1 3 1 0'), 'fcfs').slices[0]?.processId,
    ).toBeNull()
    expect(() => schedule(processes, 'round-robin', 0)).toThrow()
    expect(() => parseProcesses('P1 0 1 1\nP1 1 2 1')).toThrow()
  })
  it('splits holes according to each allocation policy', () => {
    expect(
      allocateMemory('64,128,256', '70', 'first').blocks.find(
        (b) => b.processId,
      )?.start,
    ).toBe(64)
    expect(
      allocateMemory('64,128,256', '70', 'worst').blocks.find(
        (b) => b.processId,
      )?.start,
    ).toBe(192)
    expect(allocateMemory('64', '70', 'best').decisions[0]).toContain(
      'không vừa',
    )
  })
  it('finds a single-instance resource cycle and distinguishes acyclic requests', () => {
    expect(deadlockCycle('P1 -> R1\nR1 -> P2\nP2 -> R2\nR2 -> P1')).toEqual([
      'P1',
      'R1',
      'P2',
      'R2',
      'P1',
    ])
    expect(deadlockCycle('P1 -> R1\nR1 -> P2')).toEqual([])
    expect(() => deadlockCycle('R1 -> P1\nR1 -> P2')).toThrow()
  })
})
