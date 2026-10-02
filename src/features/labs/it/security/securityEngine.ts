function bytes(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
export async function digestDemo(text: string): Promise<string> {
  if (text.length > 1024) throw Error('Demo nhận tối đa 1024 ký tự.')
  return bytes(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  )
}
export async function deriveDemo(
  password: string,
  salt: Uint8Array,
): Promise<string> {
  if (password.length > 128 || salt.length !== 16)
    throw Error('Demo cần chuỗi ≤128 ký tự và salt 16 bytes.')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const saltBuffer = new Uint8Array(salt).buffer
  return bytes(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBuffer, iterations: 600000, hash: 'SHA-256' },
      key,
      256,
    ),
  )
}
export interface CipherDemo {
  key: CryptoKey
  iv: Uint8Array
  cipher: Uint8Array
}
export async function encryptDemo(text: string): Promise<CipherDemo> {
  if (text.length > 1024) throw Error('Demo nhận tối đa 1024 ký tự.')
  const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    cipher = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(text),
      ),
    )
  return { key, iv, cipher }
}
export async function decryptDemo(
  demo: CipherDemo,
  tamper = false,
): Promise<string> {
  const cipher = new Uint8Array(demo.cipher)
  if (tamper && cipher.length) cipher[0] = (cipher[0] ?? 0) ^ 1
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(demo.iv) },
      demo.key,
      cipher,
    ),
  )
}
export function demoAuthorization(
  role: 'student' | 'admin',
  own: boolean,
  action: 'read' | 'reset' | 'password',
): boolean {
  return (
    action !== 'password' &&
    (action === 'read' ? own || role === 'admin' : role === 'admin')
  )
}
export function secureQueryDemo(input: string): {
  unsafe: string
  parameterized: string
  bindings: string[]
} {
  return {
    unsafe: `SELECT * FROM demo_users WHERE name = '${input.slice(0, 120)}';`,
    parameterized: 'SELECT * FROM demo_users WHERE name = ?;',
    bindings: [input.slice(0, 120)],
  }
}
