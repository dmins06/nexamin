import type { ExecutionRequest, ExecutionResult } from '../codeTypes'
export const executionLimits = {
  sourceBytes: 32768,
  stdinBytes: 16384,
  outputBytes: 65536,
  runMs: 10000,
  compileMs: 25000,
  javaMs: 30000,
  loadMs: 90000,
  memoryPages: 4096,
  fileWriteBytes: 8388608,
} as const
export function validateExecution(request: ExecutionRequest): string | null {
  const encoder = new TextEncoder()
  if (encoder.encode(request.sourceCode).length > executionLimits.sourceBytes)
    return 'Code vượt giới hạn 32 KiB.'
  if (encoder.encode(request.stdin).length > executionLimits.stdinBytes)
    return 'Stdin vượt giới hạn 16 KiB.'
  if (!request.sourceCode.trim()) return 'Hãy nhập code trước khi chạy.'
  return null
}
export function isExecutionResult(value: unknown): value is ExecutionResult {
  return (
    !!value &&
    typeof value === 'object' &&
    'status' in value &&
    [
      'success',
      'compile-error',
      'runtime-error',
      'timeout',
      'stopped',
      'unavailable',
      'limit',
    ].includes(String(value.status)) &&
    'stdout' in value &&
    typeof value.stdout === 'string' &&
    value.stdout.length <= 65536 &&
    'stderr' in value &&
    typeof value.stderr === 'string' &&
    value.stderr.length <= 65536 &&
    new TextEncoder().encode(value.stdout + value.stderr).length <=
      executionLimits.outputBytes &&
    'exitCode' in value &&
    (value.exitCode === null || Number.isInteger(value.exitCode)) &&
    'executionTime' in value &&
    typeof value.executionTime === 'number' &&
    Number.isFinite(value.executionTime) &&
    value.executionTime >= 0
  )
}
export function boundExecutionOutput(stdout: string, stderr: string) {
  const encoder = new TextEncoder(),
    decoder = new TextDecoder()
  const errorBytes = encoder
    .encode(stderr)
    .subarray(0, executionLimits.outputBytes)
  const outputBytes = encoder
    .encode(stdout)
    .subarray(0, executionLimits.outputBytes - errorBytes.length)
  // Streaming decoding drops an incomplete final UTF-8 sequence.
  return {
    stdout: decoder.decode(outputBytes, { stream: true }),
    stderr: new TextDecoder().decode(errorBytes, { stream: true }),
  }
}
