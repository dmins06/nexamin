import { useEffect, useRef, useState } from 'react'
import {
  digestDemo,
  deriveDemo,
  encryptDemo,
  decryptDemo,
  demoAuthorization,
  secureQueryDemo,
  type CipherDemo,
} from './securityEngine'
import { useLabSettings } from '../shared/useLabSettings'
import { LabIntro } from '../shared/LabIntro'
const defaults = { lesson: 'hash' }
export function SecurityLab() {
  const { settings, change } = useLabSettings('security-lesson', defaults),
    [input, setInput] = useState('Nexamin demo'),
    [output, setOutput] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [cipher, setCipher] = useState<CipherDemo | null>(null),
    [role, setRole] = useState<'student' | 'admin'>('student'),
    [own, setOwn] = useState(true),
    [action, setAction] = useState<'read' | 'reset' | 'password'>('read'),
    job = useRef(0),
    lesson =
      ['hash', 'aes', 'policy', 'coding'].find((l) => l === settings.lesson) ??
      'hash'
  useEffect(
    () => () => {
      job.current++
    },
    [],
  )
  const run = async (
    kind: 'hash' | 'salt' | 'encrypt' | 'decrypt' | 'tamper',
  ) => {
    if (busy) return
    const id = ++job.current
    setBusy(true)
    setError('')
    setOutput('')
    try {
      let message = ''
      if (kind === 'hash') message = await digestDemo(input)
      else if (kind === 'salt') {
        const salt = crypto.getRandomValues(new Uint8Array(16)),
          hash = await deriveDemo(input, salt)
        message = `Salt (hex): ${[...salt].map((n) => n.toString(16).padStart(2, '0')).join('')}\nPBKDF2-SHA256 / 600000 iterations:\n${hash}\nSalt mới tạo kết quả khác dù chuỗi giống nhau; không lưu mật khẩu.`
      } else if (kind === 'encrypt') {
        const encrypted = await encryptDemo(input)
        if (id === job.current) setCipher(encrypted)
        message = `AES-GCM 256-bit; IV: ${[...encrypted.iv].map((v) => v.toString(16).padStart(2, '0')).join('')}\nCiphertext + authentication tag:\n${[...encrypted.cipher].map((v) => v.toString(16).padStart(2, '0')).join('')}\nKey không export, chỉ ở RAM của tab.`
      } else {
        if (!cipher) throw Error('Mã hóa trước khi giải mã.')
        message = await decryptDemo(cipher, kind === 'tamper')
      }
      if (id === job.current) setOutput(message)
    } catch {
      if (id === job.current)
        setError(
          kind === 'tamper'
            ? 'AES-GCM từ chối ciphertext đã sửa: authentication tag không hợp lệ.'
            : 'Không thực hiện được. Kiểm tra độ dài và dùng HTTPS/trình duyệt có Web Crypto.',
        )
    } finally {
      if (id === job.current) setBusy(false)
    }
  }
  const query = secureQueryDemo(input)
  return (
    <>
      <LabIntro
        title="Security Lab"
        description="Thử hash/salt, mã hóa có xác thực và kiểm tra chính sách quyền trên dữ liệu demo."
        notice="Chỉ dùng chuỗi giả lập, không nhập mật khẩu thật. Không gọi auth API, không đổi quyền tài khoản, không nhận URL mục tiêu và không khai thác website thật."
      />
      <div className="it-controls" aria-label="Bài học Security">
        {[
          ['hash', 'Hash & Salt'],
          ['aes', 'AES-GCM'],
          ['policy', 'Authentication / Authorization'],
          ['coding', 'Secure Coding'],
        ].map(([id, title]) => (
          <button
            key={id}
            className="it-button"
            disabled={busy}
            aria-pressed={lesson === id}
            onClick={() => {
              change('lesson', id ?? 'hash')
              setOutput('')
              setError('')
            }}
          >
            {title}
          </button>
        ))}
      </div>
      {lesson !== 'policy' && (
        <div className="it-sim-grid">
          <section className="it-panel">
            <h2>Dữ liệu demo</h2>
            <label>
              Chuỗi minh họa
              <textarea
                rows={5}
                value={input}
                maxLength={lesson === 'hash' ? 128 : 1024}
                disabled={busy}
                onChange={(e) => {
                  setInput(e.target.value)
                  setOutput('')
                  setError('')
                }}
              />
            </label>
            <p className="it-small">
              Chuỗi demo tối đa {lesson === 'hash' ? '128' : '1024'} ký tự;
              không dùng mật khẩu thật. Secure Coding chỉ so sánh 120 ký tự đầu.
            </p>
            {lesson === 'hash' && (
              <div className="it-controls">
                <button
                  className="it-button primary"
                  disabled={busy}
                  onClick={() => void run('hash')}
                >
                  Tính SHA-256
                </button>
                <button
                  className="it-button"
                  disabled={busy}
                  onClick={() => void run('salt')}
                >
                  Tạo salt & PBKDF2
                </button>
              </div>
            )}
            {lesson === 'aes' && (
              <div className="it-controls">
                <button
                  className="it-button primary"
                  disabled={busy}
                  onClick={() => void run('encrypt')}
                >
                  Mã hóa AES-GCM
                </button>
                <button
                  className="it-button"
                  disabled={busy || !cipher}
                  onClick={() => void run('decrypt')}
                >
                  Giải mã
                </button>
                <button
                  className="it-button"
                  disabled={busy || !cipher}
                  onClick={() => void run('tamper')}
                >
                  Thử sửa ciphertext
                </button>
              </div>
            )}
            <p>
              Chuỗi, salt, hash, key và ciphertext không lưu vào localStorage và
              không gửi lên server. Chỉ lựa chọn bài học được nhớ.
            </p>
          </section>
          <section className="it-panel">
            <h2>
              {lesson === 'coding'
                ? 'Dữ liệu và câu lệnh'
                : 'Kết quả Web Crypto'}
            </h2>
            {busy && <p role="status">Đang tính toán…</p>}
            {error && (
              <p role="alert" className="it-error">
                {error}
              </p>
            )}
            {output && <pre role="status">{output}</pre>}
            {lesson === 'hash' && (
              <p>
                SHA-256 là hash nhanh, không đủ để lưu mật khẩu an toàn. Demo
                PBKDF2 tạo salt riêng và tính bằng Web Crypto; đây là bài học cơ
                chế, không cấu hình hệ thống tài khoản thật.
              </p>
            )}
            {lesson === 'aes' && (
              <p>
                AES-GCM dùng IV ngẫu nhiên mới mỗi lần mã hóa và authentication
                tag. Giải mã dùng key đang giữ trong RAM. Thử sửa một byte để
                thấy kiểm tra toàn vẹn từ chối; không giả lập các vòng AES ở mức
                bit.
              </p>
            )}
            {lesson === 'coding' && (
              <>
                <h3>Ghép chuỗi không an toàn</h3>
                <pre>{query.unsafe}</pre>
                <h3>Parameter binding</h3>
                <pre>
                  {query.parameterized}\n{JSON.stringify(query.bindings)}
                </pre>
                <p>
                  So sánh cách dựng câu lệnh, không chạy payload SQL. Input là
                  dữ liệu, không phải mã nguồn. Bài này không kết nối SQL
                  Playground hay database thật.
                </p>
                <h3>Hiển thị text an toàn</h3>
                <pre>{input}</pre>
                <p>
                  Text được escape bởi React; không dùng innerHTML. Thử chuỗi
                  HTML để thấy nó vẫn là chữ, không thực thi script.
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {lesson === 'policy' && (
        <div className="it-sim-grid">
          <section className="it-panel">
            <h2>Chính sách demo, không phải quyền tài khoản</h2>
            <label>
              Role giả lập
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value === 'admin' ? 'admin' : 'student')
                }
              >
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>
              Tài nguyên
              <select
                value={own ? 'self' : 'other'}
                onChange={(e) => setOwn(e.target.value === 'self')}
              >
                <option value="self">Của chính mình</option>
                <option value="other">Của người khác</option>
              </select>
            </label>
            <label>
              Hành động
              <select
                value={action}
                onChange={(e) =>
                  setAction(
                    e.target.value === 'reset'
                      ? 'reset'
                      : e.target.value === 'password'
                        ? 'password'
                        : 'read',
                  )
                }
              >
                <option value="read">Đọc profile</option>
                <option value="reset">Hỗ trợ reset password</option>
                <option value="password">Xem mật khẩu gốc</option>
              </select>
            </label>
          </section>
          <section className="it-panel">
            <h2>Kiểm tra quyền</h2>
            <p role="status">
              {demoAuthorization(role, own, action)
                ? 'Cho phép trong chính sách demo.'
                : 'Từ chối trong chính sách demo.'}
            </p>
            <div className="it-flow">
              {[
                'Xác minh danh tính',
                'Tạo session',
                'Kiểm tra quyền',
                'Kiểm tra ownership',
              ].map((step) => (
                <div className="it-flow-node" key={step}>
                  {step}
                </div>
              ))}
            </div>
            <p>
              Authentication trả lời “bạn là ai”; authorization trả lời “được
              làm gì”. Đây chỉ là luồng minh họa, không thực hiện login. Admin
              hỗ trợ reset nhưng không đọc lại mật khẩu gốc; server phải kiểm
              tra quyền, không tin dropdown trên client. Không thay đổi tài
              khoản hiện tại.
            </p>
          </section>
        </div>
      )}
    </>
  )
}
