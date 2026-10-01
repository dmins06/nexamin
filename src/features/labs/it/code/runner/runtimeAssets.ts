import type { CodeLanguage } from '../codeTypes'
const cache = new Map<string, Uint8Array>()
export const runtimeBase = '/runtimes/code/'
export function runtimeNames(language: CodeLanguage): readonly string[] {
  switch (language) {
    case 'python':
      return ['python-3.11.3.wasm', 'python-3.11.3.tar.gz']
    case 'javascript':
      return ['wasmedge_quickjs.wasm']
    case 'java':
      return [
        'java_home.tar.gz',
        'browserfs.js',
        'doppio.js',
        'doppio.jar',
        'fflate.js',
      ]
    default:
      return ['clang.wasm', 'clang-fs.tar.gz', 'wasm-ld.wasm']
  }
}
export async function loadRuntimeAssets(
  language: CodeLanguage,
  signal: AbortSignal,
): Promise<Record<string, Uint8Array>> {
  const result: Record<string, Uint8Array> = {}
  await Promise.all(
    runtimeNames(language).map(async (name) => {
      const old = cache.get(name)
      if (old) {
        result[name] = old
        return
      }
      const response = await fetch(
        runtimeBase + name + (name.endsWith('.gz') ? '.bin' : ''),
        { signal, credentials: 'omit' },
      )
      if (!response.ok)
        throw Error('Không tải được runtime. Kiểm tra kết nối rồi thử lại.')
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > 80 * 1024 * 1024)
        throw Error('Runtime vượt kích thước cho phép.')
      cache.set(name, bytes)
      result[name] = bytes
    }),
  )
  return result
}
