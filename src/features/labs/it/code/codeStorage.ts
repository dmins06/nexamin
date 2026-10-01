import { exercises, isCodeLanguage } from './codeRegistry'
import type { CodeLanguage } from './codeTypes'
export interface CodePreferences {
  version: 1
  language: CodeLanguage
  exerciseId: string
  drafts: Record<string, string>
  stdin: string
}
export const codeKey = 'nexamin.it.code.v1'
export function defaultCodePreferences(): CodePreferences {
  return {
    version: 1,
    language: 'python',
    exerciseId: 'hello',
    drafts: {},
    stdin: '',
  }
}
export function loadCodePreferences(): CodePreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(codeKey) ?? 'null')
    if (
      !value ||
      typeof value !== 'object' ||
      !('version' in value) ||
      value.version !== 1 ||
      !('language' in value) ||
      !isCodeLanguage(value.language) ||
      !('exerciseId' in value) ||
      !exercises.some((e) => e.id === value.exerciseId) ||
      !('drafts' in value) ||
      !value.drafts ||
      typeof value.drafts !== 'object'
    )
      return defaultCodePreferences()
    const drafts: Record<string, string> = {}
    for (const [key, code] of Object.entries(value.drafts))
      if (
        exercises.some((e) => languagesKey(e.id, key)) &&
        typeof code === 'string' &&
        code.length <= 32768
      )
        drafts[key] = code
    return {
      version: 1,
      language: value.language,
      exerciseId:
        typeof value.exerciseId === 'string' ? value.exerciseId : 'hello',
      drafts,
      stdin:
        'stdin' in value && typeof value.stdin === 'string'
          ? value.stdin.slice(0, 16384)
          : '',
    }
  } catch {
    return defaultCodePreferences()
  }
}
function languagesKey(exercise: string, key: string) {
  const [id, language] = key.split(':')
  return id === exercise && isCodeLanguage(language)
}
export function saveCodePreferences(value: CodePreferences) {
  try {
    localStorage.setItem(codeKey, JSON.stringify(value))
  } catch {
    /* Usable without storage. */
  }
}
