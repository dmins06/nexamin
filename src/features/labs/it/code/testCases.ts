import type { ExecutionResult } from './codeTypes'
export function normalizeOutput(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}
export function passesTest(result: ExecutionResult, expected: string) {
  return (
    result.status === 'success' &&
    result.exitCode === 0 &&
    normalizeOutput(result.stdout) === normalizeOutput(expected)
  )
}
