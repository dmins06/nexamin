import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MailCheck,
  Orbit,
  UserRound,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { BrandLogo } from '../../components/BrandLogo'
import { CosmicBackdrop } from '../../components/CosmicBackdrop'
import { MobileSplash } from '../../components/MobileSplash'
import {
  getSession,
  login,
  register,
  verifyRegistration,
  type RegistrationChallenge,
  type University,
} from '../../lib/api'
import type { MajorOption } from '../../lib/majorCatalog'
import { workspaceApi } from '../../lib/workspaceApi'
import { MajorPicker } from './MajorPicker'
import { UniversityPicker } from './UniversityPicker'

type Mode = 'login' | 'register'
type PendingVerification = RegistrationChallenge & { email: string; password: string }

export function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => getSession() !== null)
  const [mode, setMode] = useState<Mode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [university, setUniversity] = useState<University | null>(null)
  const [major, setMajor] = useState<MajorOption | null>(null)
  const [verification, setVerification] = useState<PendingVerification | null>(null)

  useEffect(() => {
    const sync = () => setAuthenticated(getSession() !== null)
    window.addEventListener('studyhub:auth-changed', sync)
    if (getSession()) void workspaceApi.profile().catch(() => setAuthenticated(false))
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
      if (mode === 'login') {
        await login(email, password)
        setAuthenticated(true)
      } else {
        const challenge = await register({
          email,
          password,
          full_name: String(data.get('fullName')),
          university_id: university!.id,
          major: String(data.get('major') || '') || undefined,
          student_year: Number(data.get('studentYear')) || undefined,
        })
        setVerification({ ...challenge, email, password })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đã có lỗi xảy ra.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verification) return
    const otp = String(new FormData(event.currentTarget).get('otp'))
    setBusy(true)
    setError('')
    try {
      await verifyRegistration(
        verification.challenge_id,
        otp,
        verification.email,
        verification.password,
      )
      setAuthenticated(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xác thực mã OTP.')
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setVerification(null)
    setError('')
  }

  return (
    <main className="auth-page">
      <MobileSplash />
      <CosmicBackdrop />
      <section className="auth-story" aria-label="Giới thiệu StudyHubAI">
        <button className="auth-brand" type="button" onClick={() => switchMode('login')} aria-label="StudyHubAI - về đăng nhập">
          <span className="brand-logo"><BrandLogo /></span>
          <span className="brand-name">StudyHub<span>AI</span></span>
        </button>
        <div className="auth-story-copy">
          <p className="folio">LEARN · PLAN · GROW</p>
          <h1>Một không gian học tập dành riêng cho bạn.</h1>
          <p>Lên lịch, quản lý tài liệu và hỏi EminAI trong cùng một hành trình liền mạch.</p>
          <div className="auth-proof"><BrainCircuit size={19} /><span><strong>Cá nhân hóa theo trường và ngành</strong><small>Dữ liệu thật, kế hoạch của chính bạn</small></span></div>
        </div>
        <div className="auth-earth-orbits" aria-hidden="true"><span /><span /></div>
        <div className="auth-quote"><Orbit size={18} /><p>Lịch học, tài liệu và AI cùng chuyển động quanh mục tiêu của bạn.</p></div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          {verification ? (
            <>
              <button className="auth-back" type="button" onClick={() => { setVerification(null); setError('') }}><ArrowLeft size={17} /> Sửa thông tin</button>
              <header className="otp-heading">
                <span className="otp-icon"><MailCheck size={25} /></span>
                <p className="folio">Xác thực email</p>
                <h2>Nhập mã gồm 6 chữ số</h2>
                <p>Mã đã được gửi đến <strong>{verification.masked_email}</strong> và hết hạn sau {Math.round(verification.expires_in / 60)} phút.</p>
              </header>
              <form onSubmit={verifyOtp}>
                <label>Mã xác thực<div className="auth-input otp-input"><Mail size={17} /><input name="otp" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" /></div></label>
                {verification.debug_otp && <p className="otp-debug">Môi trường phát triển: mã OTP là <strong>{verification.debug_otp}</strong></p>}
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Đang xác thực…' : 'Xác thực và đăng nhập'}<ArrowRight size={17} /></button>
              </form>
            </>
          ) : (
            <>
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
                <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Gửi mã xác thực'}<ArrowRight size={17} /></button>
              </form>
              <p className="auth-switch">{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}</button></p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
