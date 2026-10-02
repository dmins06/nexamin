export function integer(
  value: string | number,
  name: string,
  min: number,
  max: number,
): number {
  if (typeof value === 'string' && !/^-?\d+$/.test(value.trim()))
    throw Error(`${name}: cần số nguyên ${min}–${max}.`)
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw Error(`${name}: cần số nguyên ${min}–${max}.`)
  return n
}
export function numbers(
  text: string,
  name: string,
  min: number,
  max: number,
  limit = 20,
): number[] {
  const parts = text.trim().split(/[\s,]+/)
  if (!text.trim() || parts.length > limit)
    throw Error(`${name}: nhập 1–${limit} số.`)
  return parts.map((value) => integer(value, name, min, max))
}
export function decimal(
  text: string,
  name: string,
  min: number,
  max: number,
): number {
  const n = Number(text)
  if (!text.trim() || !Number.isFinite(n) || n < min || n > max)
    throw Error(`${name}: cần số ${min}–${max}.`)
  return n
}
export function attempt<T>(
  fn: () => T,
): { value: T; error: null } | { value: null; error: string } {
  try {
    return { value: fn(), error: null }
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.',
    }
  }
}
