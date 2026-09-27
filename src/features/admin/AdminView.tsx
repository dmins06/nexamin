import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, FilePlus2, LockKeyhole, Mail, Shield, UnlockKeyhole } from 'lucide-react'
import { type AdminPendingQuestion, type AdminUser, workspaceApi } from '../../lib/workspaceApi'
import './admin.css'

export function AdminView({ ownId }: { ownId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [questions, setQuestions] = useState<AdminPendingQuestion[]>([])
  const [verified, setVerified] = useState<AdminPendingQuestion[]>([])
  const [query, setQuery] = useState('')
  const [mailEnabled, setMailEnabled] = useState(false)
  const [packageText, setPackageText] = useState('')
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void Promise.all([workspaceApi.adminUsers(''), workspaceApi.adminPendingQuestions(), workspaceApi.adminVerifiedQuestions(), workspaceApi.adminCapabilities()])
      .then(([people, pending, ready, capabilities]) => {
        setUsers(people)
        setQuestions(pending)
        setVerified(ready)
        setMailEnabled(capabilities.mail_enabled)
      }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu quản trị.'))
  }, [])

  async function action(task: () => Promise<void>) {
    setBusy(true)
    setError('')
    setNotice('')
    try { await task() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể hoàn tất thao tác.') }
    finally { setBusy(false) }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void action(async () => { setUsers(await workspaceApi.adminUsers(query)) })
  }

  function toggleLock(person: AdminUser) {
    const verb = person.is_active ? 'khóa' : 'mở khóa'
    if (!window.confirm(`Bạn chắc chắn muốn ${verb} tài khoản ${person.email}?`)) return
    void action(async () => {
      const updated = person.is_active ? await workspaceApi.adminLock(person.id) : await workspaceApi.adminUnlock(person.id)
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice(`Đã ${verb} tài khoản ${person.email}.`)
    })
  }

  function sendReset(person: AdminUser) {
    if (!window.confirm(`Gửi liên kết đặt lại mật khẩu tới ${person.email}? Admin sẽ không thấy liên kết hoặc mật khẩu.`)) return
    void action(async () => {
      const result = await workspaceApi.adminResetHelp(person.id)
      setNotice(result.message)
    })
  }

  function importQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void action(async () => {
      const parsed: unknown = JSON.parse(packageText)
      const result = await workspaceApi.adminImportQuestions(parsed)
      setQuestions(await workspaceApi.adminPendingQuestions())
      setNotice(`Đã nhập ${result.imported} câu chờ duyệt; bỏ qua ${result.duplicates} câu trùng.`)
    })
  }

  function review(question: AdminPendingQuestion, decision: 'verify' | 'reject') {
    if (!window.confirm(`${decision === 'verify' ? 'Duyệt' : 'Từ chối'} câu hỏi này sau khi kiểm tra đáp án và quyền sử dụng?`)) return
    void action(async () => {
      const result = await workspaceApi.adminReviewQuestion(question.id, decision)
      setQuestions((current) => current.filter((item) => item.id !== question.id))
      if (decision === 'verify') setVerified((current) => [...current, question])
      setNotice(result.message)
    })
  }

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selected.length === 0) { setError('Hãy chọn câu hỏi đã duyệt để xuất bản đề.'); return }
    const chosen = verified.filter((item) => selected.includes(item.id))
    const subjectId = chosen[0]?.subject_id
    if (!subjectId || chosen.length !== selected.length || chosen.some((item) => item.subject_id !== subjectId)) {
      setError('Các câu hỏi trong một đề phải cùng môn.')
      return
    }
    void action(async () => {
      const result = await workspaceApi.adminPublishExam({ subject_id: subjectId, title, question_ids: selected })
      setNotice(result.message)
      setTitle('')
      setSelected([])
    })
  }

  return <section className="admin-view" aria-labelledby="admin-title">
    <div className="page-intro"><span className="folio">Bảo mật & nội dung</span><h2 id="admin-title">Quản trị Nexamin</h2><p>Quản lý tài khoản và chỉ xuất bản câu hỏi đã kiểm tra nguồn, đáp án.</p></div>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <section className="admin-panel" aria-labelledby="admin-users-title">
      <h3 id="admin-users-title"><Shield size={20} /> Tài khoản</h3>
      <p>Admin không thể xem mật khẩu hoặc liên kết đặt lại. Khóa tài khoản sẽ thu hồi phiên đăng nhập và chặn yêu cầu tiếp theo.</p>
      <form className="admin-search" onSubmit={search}><label htmlFor="admin-user-search">Tìm theo email hoặc tên</label><input id="admin-user-search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} /><button disabled={busy}>Tìm</button></form>
      {!mailEnabled && <p className="admin-hint">Chưa cấu hình Resend API và địa chỉ web HTTPS; chức năng gửi email đặt lại mật khẩu tạm thời chưa khả dụng.</p>}
      <div className="admin-user-list">{users.map((person) => <article key={person.id} className="admin-user">
        <div><strong>{person.full_name} {person.role === 'admin' && <BadgeCheck size={16} color="#48a8ff" aria-label="Quản trị viên Nexamin" />}</strong><small>{person.email} · {person.is_active ? 'Đang hoạt động' : 'Đã khóa'}</small></div>
        <div className="admin-actions"><button type="button" disabled={busy || person.id === ownId || person.role === 'admin'} onClick={() => toggleLock(person)}>{person.is_active ? <LockKeyhole size={15} /> : <UnlockKeyhole size={15} />}{person.is_active ? 'Khóa' : 'Mở khóa'}</button><button type="button" disabled={busy || !mailEnabled || !person.is_active} onClick={() => sendReset(person)}><Mail size={15} />Gửi đặt lại</button></div>
      </article>)}</div>
    </section>
    <section className="admin-panel" aria-labelledby="admin-practice-title">
      <h3 id="admin-practice-title"><FilePlus2 size={20} /> Ngân hàng đề</h3>
      <p>Nhập gói câu hỏi JSON có nguồn và quyền sử dụng rõ ràng. Câu mới luôn ở trạng thái chờ duyệt; nguồn web phải được phê duyệt trước.</p>
      <form className="admin-import" onSubmit={importQuestions}><label htmlFor="admin-package">Gói câu hỏi JSON</label><textarea id="admin-package" value={packageText} onChange={(event) => setPackageText(event.target.value)} rows={8} required spellCheck={false} placeholder={'{"subject_name":"...","source":{"name":"...","license":"...","source_type":"user_provided","reuse_confirmed":true},"questions":[...]}'}/><button disabled={busy}>Nhập câu hỏi</button></form>
      <h4>Câu hỏi chờ duyệt ({questions.length})</h4>
      {questions.length === 0 && <p>Chưa có câu hỏi chờ duyệt.</p>}
      <div className="admin-question-list">{questions.map((question) => <article key={question.id} className="admin-question"><strong>{question.question_text}</strong><small>Nguồn: {question.source_name} · {question.source_license}{question.source_url && <> · <a href={question.source_url} target="_blank" rel="noreferrer">Xem nguồn</a></>}</small><ul>{question.options.map((option) => <li key={option.key}>{option.key}. {option.text} {option.correct ? '(đáp án)' : ''}</li>)}</ul><p>Giải thích: {question.explanation || 'Chưa có'}</p><div className="admin-actions"><button type="button" disabled={busy} onClick={() => review(question, 'verify')}>Duyệt</button><button type="button" disabled={busy} onClick={() => review(question, 'reject')}>Từ chối</button></div></article>)}</div>
      <form className="admin-publish" onSubmit={publish}><h4>Xuất bản đề</h4><p>Chọn các câu đã duyệt thuộc cùng một môn. Câu chưa duyệt không thể xuất bản.</p><label htmlFor="admin-exam-title">Tên đề</label><input id="admin-exam-title" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={250} required /><div className="admin-verified-list" role="group" aria-label="Câu hỏi đã duyệt">{verified.map((question) => <label key={question.id}><input type="checkbox" checked={selected.includes(question.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, question.id] : current.filter((id) => id !== question.id))} /><span>{question.question_text}<small>Môn: {question.subject_id}</small></span></label>)}</div><button disabled={busy || selected.length === 0}>Xuất bản đề ({selected.length} câu)</button></form>
    </section>
  </section>
}
