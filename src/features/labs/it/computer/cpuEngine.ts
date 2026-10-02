import type { Instruction, CPUState } from './computerTypes'
import { integer, numbers } from '../shared/input'
export interface CPUFrame extends CPUState {
  operation: string
  cache: readonly { address: number; value: number }[]
  hits: number
  misses: number
  activeLine: number
  address: number | null
}
export function parseProgram(source: string): Instruction[] {
  const lines = source
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length || lines.length > 40)
    throw Error('Chương trình cần 1–40 lệnh.')
  return lines.map((line, i) => {
    const parts = line.toUpperCase().split(/[\s,]+/),
      [op, a, b, c] = parts
    const register = (s: string | undefined) => {
      if (!s || !/^R[0-3]$/.test(s))
        throw Error(`Dòng ${i + 1}: thanh ghi R0–R3.`)
      return Number(s.slice(1))
    }
    const address = (s: string | undefined) =>
      integer(s ?? '', `Dòng ${i + 1}: địa chỉ`, 0, 15)
    if (op === 'LOAD' && parts.length === 3)
      return { op, register: register(a), address: address(b) }
    if (op === 'STORE' && parts.length === 3)
      return { op, register: register(a), address: address(b) }
    if (op === 'ADD' && parts.length === 4)
      return {
        op,
        destination: register(a),
        left: register(b),
        right: register(c),
      }
    if (op === 'HALT' && parts.length === 1) return { op }
    throw Error(
      `Dòng ${i + 1}: dùng LOAD R0 0, ADD R2 R0 R1, STORE R2 2 hoặc HALT.`,
    )
  })
}
export function cpuTrace(source: string, initial: string): CPUFrame[] {
  const program = parseProgram(source),
    values = numbers(initial, 'RAM', -999, 999, 16),
    ram = Array.from({ length: 16 }, (_, i) => values[i] ?? 0),
    registers = [0, 0, 0, 0],
    cache: Array<{ address: number; value: number }> = [],
    frames: CPUFrame[] = []
  let hits = 0,
    misses = 0
  const emit = (
    pc: number,
    phase: CPUState['phase'],
    operation: string,
    instruction: Instruction | null,
    address: number | null = null,
  ) =>
    frames.push({
      pc,
      phase,
      operation,
      instruction,
      address,
      ram: [...ram],
      registers: [...registers],
      cache: cache.map((c) => ({ ...c })),
      hits,
      misses,
      activeLine: pc,
    })
  emit(0, 'fetch', 'Sẵn sàng: PC = 0, thanh ghi = 0.', null)
  for (const [pc, instruction] of program.entries()) {
    emit(
      pc,
      'fetch',
      `Fetch: đọc lệnh ${pc} từ bộ nhớ chương trình.`,
      instruction,
    )
    emit(
      pc,
      'decode',
      `Decode: giải mã ${instruction.op} và toán hạng.`,
      instruction,
    )
    let message = '',
      address: number | null = null
    if (instruction.op === 'LOAD') {
      address = instruction.address
      const slot = address % 4,
        entry = cache[slot],
        hit = entry?.address === address
      if (hit) hits++
      else misses++
      const value = ram[address] ?? 0
      cache[slot] = { address, value }
      registers[instruction.register] = value
      message = `${hit ? 'Cache hit' : 'Cache miss → đọc RAM'}: RAM[${address}] = ${value} → R${instruction.register}.`
    } else if (instruction.op === 'ADD') {
      const value =
        ((registers[instruction.left] ?? 0) +
          (registers[instruction.right] ?? 0)) |
        0
      registers[instruction.destination] = value
      message = `ALU: R${instruction.left} + R${instruction.right} → R${instruction.destination} = ${value} (32-bit).`
    } else if (instruction.op === 'STORE') {
      address = instruction.address
      ram[address] = registers[instruction.register] ?? 0
      cache[address % 4] = { address, value: ram[address] ?? 0 }
      message = `Write-through: R${instruction.register} → RAM[${address}] = ${ram[address]}.`
    } else {
      emit(pc, 'halted', 'HALT: chương trình dừng.', instruction)
      return frames
    }
    emit(pc, 'execute', message, instruction, address)
  }
  emit(program.length, 'halted', 'Đã hết lệnh; mô hình dừng.', null)
  return frames
}
