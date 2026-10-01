// Add a linear-memory maximum before instantiation, including compiled C/C++.
export function boundWasmMemory(
  bytes: Uint8Array,
  maxPages: number,
): Uint8Array {
  let offset = 8
  const read = () => {
    let value = 0,
      shift = 0
    for (let i = 0; i < 5; i++) {
      const b = bytes[offset++]
      if (b === undefined) throw Error('WASM không hợp lệ.')
      value |= (b & 127) << shift
      if (!(b & 128)) return value >>> 0
      shift += 7
    }
    throw Error('WASM không hợp lệ.')
  }
  const encode = (value: number) => {
    const out: number[] = []
    do {
      const b = value & 127
      value >>>= 7
      out.push(b | (value ? 128 : 0))
    } while (value)
    return out
  }
  while (offset < bytes.length) {
    const begin = offset,
      id = bytes[offset++],
      length = read(),
      end = offset + length
    if (end > bytes.length) throw Error('WASM không hợp lệ.')
    if (id === 5) {
      const count = read()
      if (count !== 1) throw Error('Chỉ hỗ trợ một vùng nhớ WASM.')
      const flags = read(),
        min = read(),
        oldMax = flags === 1 ? read() : maxPages
      if (flags > 1 || min > maxPages)
        throw Error('Runtime yêu cầu bộ nhớ quá lớn.')
      const payload = new Uint8Array([
        1,
        1,
        ...encode(min),
        ...encode(Math.min(maxPages, oldMax)),
      ])
      const header = new Uint8Array([5, ...encode(payload.length)])
      const result = new Uint8Array(
        begin + header.length + payload.length + bytes.length - end,
      )
      result.set(bytes.subarray(0, begin))
      result.set(header, begin)
      result.set(payload, begin + header.length)
      result.set(bytes.subarray(end), begin + header.length + payload.length)
      return result
    }
    offset = end
  }
  throw Error('Runtime không có vùng nhớ WASM hợp lệ.')
}
