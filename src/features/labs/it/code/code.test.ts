import { beforeEach, describe, it, expect } from 'vitest'
import {
  defaultCodePreferences,
  loadCodePreferences,
  saveCodePreferences,
  codeKey,
} from './codeStorage'
import { normalizeOutput, passesTest } from './testCases'
import {
  boundExecutionOutput,
  isExecutionResult,
  validateExecution,
} from './runner/limits'
import { boundWasmMemory } from './runner/wasmMemory'
import { javaSandboxPolicy } from './runner/JavaRunnerProvider'
import { runtimeNames } from './runner/runtimeAssets'
import {
  loadAlgorithmPreferences,
  algorithmKey,
} from '../algorithms/algorithmStorage'
beforeEach(() => localStorage.clear())
describe('code contracts and isolation', () => {
  it('persists versioned drafts per exercise/language and rejects corrupt data', () => {
    const state = {
      ...defaultCodePreferences(),
      drafts: { 'hello:python': 'print(1)', 'sum:c': 'int main(void){}' },
    }
    saveCodePreferences(state)
    expect(loadCodePreferences()).toEqual(state)
    localStorage.setItem(codeKey, '{"version":9}')
    expect(loadCodePreferences()).toEqual(defaultCodePreferences())
    localStorage.setItem(
      codeKey,
      JSON.stringify({ ...state, language: 'unknown' }),
    )
    expect(loadCodePreferences()).toEqual(defaultCodePreferences())
    localStorage.setItem(algorithmKey, '{"version":9,"algorithm":"dijkstra"}')
    expect(loadAlgorithmPreferences().version).toBe(1)
  })
  it('limits UTF-8 request bytes and validates untrusted result shape', () => {
    expect(
      validateExecution({
        language: 'python',
        sourceCode: 'é'.repeat(17000),
        stdin: '',
      }),
    ).toContain('32 KiB')
    expect(
      validateExecution({
        language: 'c',
        sourceCode: 'int main(){}',
        stdin: 'x'.repeat(17000),
      }),
    ).toContain('16 KiB')
    expect(
      isExecutionResult({
        status: 'success',
        stdout: '',
        stderr: '',
        exitCode: 0,
        executionTime: 3,
      }),
    ).toBe(true)
    expect(
      isExecutionResult({
        status: 'bogus',
        stdout: '',
        stderr: '',
        exitCode: 0,
        executionTime: 3,
      }),
    ).toBe(false)
    expect(
      isExecutionResult({
        status: 'success',
        stdout: 'x'.repeat(70000),
        stderr: '',
        exitCode: 0,
        executionTime: 3,
      }),
    ).toBe(false)
  })
  it('bounds combined UTF-8 output and rejects oversized sandbox messages', () => {
    const output = boundExecutionOutput('é'.repeat(40000), 'Lỗi mẫu')
    expect(
      new TextEncoder().encode(output.stdout + output.stderr).length,
    ).toBeLessThanOrEqual(65536)
    expect(output.stdout).not.toContain('\uFFFD')
    expect(output.stderr).toBe('Lỗi mẫu')
    expect(
      isExecutionResult({
        status: 'success',
        stdout: 'é'.repeat(20000),
        stderr: 'é'.repeat(20000),
        exitCode: 0,
        executionTime: 1,
      }),
    ).toBe(false)
  })
  it('compares real output, not just successful exit codes', () => {
    expect(normalizeOutput('1 2 \r\n')).toBe('1 2')
    expect(
      passesTest(
        {
          status: 'success',
          stdout: '7\n',
          stderr: '',
          exitCode: 0,
          executionTime: 1,
        },
        '7',
      ),
    ).toBe(true)
    expect(
      passesTest(
        {
          status: 'runtime-error',
          stdout: '7',
          stderr: 'error',
          exitCode: 1,
          executionTime: 1,
        },
        '7',
      ),
    ).toBe(false)
    expect(
      passesTest(
        {
          status: 'success',
          stdout: '8',
          stderr: '',
          exitCode: 0,
          executionTime: 1,
        },
        '7',
      ),
    ).toBe(false)
  })
  it('inserts a memory maximum and rejects unsupported memory configurations', () => {
    const module = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 0, 1])
    expect(WebAssembly.validate(boundWasmMemory(module, 4))).toBe(true)
    expect([...boundWasmMemory(module, 4)].slice(-4)).toEqual([1, 1, 1, 4])
    expect(() => boundWasmMemory(module, 0)).toThrow()
  })
  it('keeps Java off-origin and disallows network; assets are static allowlists', () => {
    expect(javaSandboxPolicy).toContain("connect-src 'none'")
    expect(javaSandboxPolicy).toContain("frame-src 'none'")
    expect(runtimeNames('python')).not.toContain('doppio.js')
    expect(runtimeNames('java')).not.toContain('clang.wasm')
  })
})
