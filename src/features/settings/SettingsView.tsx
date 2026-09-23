import { CheckCircle2, KeyRound, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { logout } from '../../lib/api'
import { workspaceApi } from '../../lib/workspaceApi'

export function SettingsView() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [changed, setChanged] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('currentPassword'))
    const newPassword = String(data.get('newPassword'))
    const confirmation = String(data.get('confirmation'))
    setError('')
    if (newPassword !== confirmation) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }
    setBusy(true)
    try {
      await workspaceApi.changePassword({ current_password: currentPassword, new_password: newPassword })
      form.reset()
      setChanged(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đổi mật khẩu.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="settings-view" aria-labelledby="settings-title">
    <div className="page-intro"><span className="folio">Tài khoản & bảo mật</span><h2 id="settings-title">Cài đặt</h2><p>Quản lý mật khẩu và các phiên đăng nhập của bạn.</p></div>
    <div className="settings-grid">
      <form className="settings-card" onSubmit={submit}>
        <header><span><KeyRound size={20} /></span><div><h3>Đổi mật khẩu</h3><p>Mật khẩu mới cần ít nhất 6 ký tự.</p></div></header>
        <label>Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label>Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" minLength={6} required /></label>
        <label>Xác nhận mật khẩu mới<input name="confirmation" type="password" autoComplete="new-password" minLength={6} required /></label>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {changed && <div className="settings-success" role="status"><CheckCircle2 size={18} /><span><strong>Đã đổi mật khẩu</strong><small>Các phiên làm mới trước đó đã bị thu hồi.</small></span></div>}
        <button className="primary-action" disabled={busy || changed}>{busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}{busy ? 'Đang cập nhật…' : changed ? 'Đã cập nhật' : 'Cập nhật mật khẩu'}</button>
      </form>
      <aside className="settings-note"><ShieldCheck size={26} /><h3>Bảo vệ tài khoản</h3><p>Sau khi đổi mật khẩu, StudyHubAI thu hồi toàn bộ refresh token. Hãy đăng nhập lại để bắt đầu phiên mới an toàn.</p><div className="settings-session"><span><strong>Phiên hiện tại</strong><small>Đăng xuất an toàn khỏi thiết bị này.</small></span><button className="settings-logout" type="button" onClick={() => void logout().finally(() => window.location.reload())}><LogOut size={17} />{changed ? 'Đăng nhập lại' : 'Đăng xuất'}</button></div></aside>
    </div>
  </section>
}
