import { ArrowRight, BrainCircuit, Eye, EyeOff, LockKeyhole, Mail, Moon, Orbit, Sun, UserRound } from 'lucide-react'
import { BrandLogo } from '../../components/BrandLogo'
import { AmbientOrbit } from '../../components/AmbientOrbit'
import { CosmicBackdrop } from '../../components/CosmicBackdrop'
import { MobileSplash } from '../../components/MobileSplash'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { getSession, login, register, type University } from '../../lib/api'
import { UniversityPicker } from './UniversityPicker'
import { MajorPicker } from './MajorPicker'
import type { MajorOption } from '../../lib/majorCatalog'
import { workspaceApi } from '../../lib/workspaceApi'

type Mode = 'login' | 'register'

export function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => getSession() !== null)
  const [mode, setMode] = useState<Mode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [university, setUniversity] = useState<University | null>(null)
  const [major, setMajor] = useState<MajorOption | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

  useEffect(() => {
    const sync = () => setAuthenticated(getSession() !== null)
    window.addEventListener('studyhub:auth-changed', sync)
    if (getSession()) void workspaceApi.profile().catch(() => {
      if (!getSession()) setAuthenticated(false)
    })
    return () => window.removeEventListener('studyhub:auth-changed', sync)
  }, [])

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

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
    window.localStorage.setItem('studyhub.theme.v1', next)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#070b14' : '#8bc9f0')
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
  }

  return (
    <main className="auth-page">
      <CosmicBackdrop />
      <MobileSplash />
      <button className="auth-theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Chuyển sang giao diện ban ngày' : 'Chuyển sang giao diện không gian'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
      <section className="auth-story" aria-label="Giới thiệu Nexamin">
        <div className="auth-brand"><span className="brand-logo"><BrandLogo /></span><span className="brand-name">Nexamin</span></div>
        <div className="auth-story-copy">
          <p className="folio">LEARN · PLAN · GROW</p>
          <h1>Một không gian học tập dành riêng cho bạn.</h1>
          <p>Lên lịch, quản lý tài liệu và hỏi EminAI trong cùng một hành trình liền mạch.</p>
          <div className="auth-proof"><BrainCircuit size={19} /><span><strong>Cá nhân hóa theo trường và ngành</strong><small>Dữ liệu thật, kế hoạch của chính bạn</small></span></div>
        </div>
        <div className="auth-orbit"><AmbientOrbit /></div><div className="auth-quote"><Orbit size={18} /><p>Lịch học, tài liệu và AI cùng chuyển động quanh mục tiêu của bạn.</p></div>
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
