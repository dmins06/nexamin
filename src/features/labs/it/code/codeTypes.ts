export type CodeLanguage = 'python' | 'c' | 'cpp' | 'java' | 'javascript'
export type ExecutionStatus =
  | 'success'
  | 'compile-error'
  | 'runtime-error'
  | 'timeout'
  | 'stopped'
  | 'unavailable'
  | 'limit'
export interface ExecutionRequest {
  language: CodeLanguage
  sourceCode: string
  stdin: string
}
export interface ExecutionResult {
  status: ExecutionStatus
  stdout: string
  stderr: string
  exitCode: number | null
  executionTime: number
}
export interface CodeExecutionProvider {
  execute: (
    request: ExecutionRequest,
    signal: AbortSignal,
    onPhase?: (phase: string) => void,
  ) => Promise<ExecutionResult>
}
export interface ProgrammingExercise {
  id: string
  title: string
  description: string
  difficulty: string
  languageTemplates: Record<CodeLanguage, string>
  testCases: readonly { input: string; expectedOutput: string; hidden: false }[]
  algorithm?: 'bubble' | 'binary' | 'linear'
}
