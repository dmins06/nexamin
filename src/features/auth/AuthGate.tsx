import { ArrowRight, BookOpen, Eye, EyeOff, Leaf, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { getSession, login, register, type University } from '../../lib/api'
import { UniversityPicker } from './UniversityPicker'
import { MajorPicker } from './MajorPicker'
import type { MajorOption } from '../../lib/majorCatalog'

type Mode = 'login' | 'register'

export function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => getSession() !== null)
  const [mode, setMode] = useState<Mode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [university, setUniversity] = useState<University | null>(null)
  const [major, setMajor] = useState<MajorOption | null>(null)

  if (authenticated) return <>{children}</>

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError('')
    if (mode === 'register' && !university) {
      setError('Hãy chọn trường đại học bạn đang theo học.')
      return
    }
    setBusy(true)
    try {
      const email = String(data.get('email'))
      const password = String(data.get('password'))
      if (mode === 'login') await login(email, password)
      else {
        await register({
          email,
          password,
          full_name: String(data.get('fullName')),
          university_id: university!.id,
          major: String(data.get('major') || '') || undefined,
          student_year: Number(data.get('studentYear')) || undefined,
        })
      }
      setAuthenticated(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đã có lỗi xảy ra.')
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Giới thiệu StudyHub AI">
        <div className="auth-brand"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span className="brand-name">StudyHub <span>AI</span></span></div>
        <div className="auth-story-copy">
          <p className="folio">Không gian học tập cá nhân</p>
          <h1>Học có nhịp.<br />Tiến bộ có dấu vết.</h1>
          <p>Gom lịch học, tài liệu và trợ lý AI vào một nơi yên tĩnh để bạn tập trung vào điều quan trọng nhất.</p>
          <div className="auth-proof"><Leaf size={19} /><span><strong>426 cơ sở đào tạo</strong><small>Đồng bộ từ Cổng tuyển sinh Bộ GD&ĐT</small></span></div>
        </div>
        <div className="auth-quote"><BookOpen size={18} /><p>“Mỗi buổi học là một trang mới trong hành trình của bạn.”</p></div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Tài khoản">
            <button role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>Đăng nhập</button>
            <button role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')}>Tạo tài khoản</button>
          </div>
          <header>
            <p className="folio">{mode === 'login' ? 'Chào bạn trở lại' : 'Bắt đầu hành trình'}</p>
            <h2>{mode === 'login' ? 'Tiếp tục buổi học' : 'Tạo góc học tập của bạn'}</h2>
            <p>{mode === 'login' ? 'Đăng nhập để mở kế hoạch hôm nay.' : 'Chọn đúng trường để cá nhân hóa môn học và cộng đồng.'}</p>
          </header>
          <form onSubmit={submit}>
            {mode === 'register' && (
              <>
                <label>Họ và tên<div className="auth-input"><UserRound size={17} /><input name="fullName" required minLength={2} autoComplete="name" placeholder="Nguyễn Minh Anh" /></div></label>
                <UniversityPicker value={university} onChange={(next) => { setUniversity(next); setMajor(null) }} />
                <div className="auth-row">
                  <MajorPicker university={university} value={major} onChange={setMajor} />
                  <label>Năm học<select name="studentYear" defaultValue="1"><option value="1">Năm 1</option><option value="2">Năm 2</option><option value="3">Năm 3</option><option value="4">Năm 4</option><option value="5">Năm 5+</option></select></label>
                </div>
              </>
            )}
            <label>Email<div className="auth-input"><Mail size={17} /><input name="email" type="email" required autoComplete="email" placeholder="ban@university.edu.vn" /></div></label>
            <label>Mật khẩu<div className="auth-input"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} required minLength={mode === 'register' ? 6 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? 'Ít nhất 6 ký tự' : 'Nhập mật khẩu'} /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}<ArrowRight size={17} /></button>
          </form>
          <p className="auth-switch">{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}</button></p>
        </div>
      </section>
    </main>
  )
}
