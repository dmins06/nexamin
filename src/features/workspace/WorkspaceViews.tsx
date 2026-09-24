import {
  BookOpen,
  Bot,
  CheckCircle2,
  FileText,
  FolderOpen,
  LoaderCircle,
  Plus,
  Send,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { type Course, type StudyDocument, type TutorReply, workspaceApi } from '../../lib/workspaceApi'

function useCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = () => {
    setLoading(true)
    setError('')
    workspaceApi.courses().then((page) => setCourses(page.items)).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Không tải được môn học.')
    }).finally(() => setLoading(false))
  }
  useEffect(() => { void reload() }, [])
  return { courses, setCourses, loading, error, reload }
}

export function CoursesView() {
  const { courses, setCourses, loading, error, reload } = useCourses()
  const [creating, setCreating] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      code: String(data.get('code') || '') || undefined,
      semester: String(data.get('semester') || '') || undefined,
      color: String(data.get('color') || '#315c45'),
    }
    setCreating(true)
    setFormError('')
    try {
      const created = await workspaceApi.createCourse(payload)
      setCourses((current) => [created, ...current.filter((course) => course.id !== created.id)])
      if (form && typeof form.reset === 'function') form.reset()
      setFormOpen(false)
      reload()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Không thể tạo môn học.')
    } finally {
      setCreating(false)
    }
  }

  async function deleteCourse(course: Course) {
    setDeletingId(course.id)
    setFormError('')
    try {
      await workspaceApi.deleteCourse(course.id)
      setConfirmingId(null)
      reload()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Không thể xóa môn học.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="workspace-page" aria-labelledby="courses-title">
      <div className="workspace-heading">
        <div><p>Không gian môn học</p><h2 id="courses-title">Môn học của bạn</h2><span>Mỗi môn là một nơi gom tài liệu, câu hỏi và tiến độ.</span></div>
        <button className="primary-action" onClick={() => setFormOpen((value) => !value)}><Plus size={18} /> Thêm môn học</button>
      </div>
      {formOpen && <form className="course-form" onSubmit={createCourse}>
        <label>Tên môn<input name="name" required placeholder="Ví dụ: Cấu trúc dữ liệu" /></label>
        <label>Mã môn<input name="code" placeholder="CTDL101" /></label>
        <label>Học kỳ<input name="semester" placeholder="HK1" /></label>
        <label>Màu nhận diện<input name="color" type="color" defaultValue="#315c45" aria-label="Màu môn học" /></label>
        {formError && <p className="inline-error" role="alert">{formError}</p>}
        <button className="primary-action" type="submit" disabled={creating}>{creating ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}{creating ? 'Đang lưu…' : 'Lưu môn học'}</button>
      </form>}
      {!formOpen && formError && <p className="inline-error" role="alert">{formError}</p>}
      {loading ? <LoadingState label="Đang mở sổ môn học…" /> : error ? <ErrorState message={error} onRetry={reload} /> : courses.length === 0 ? <EmptyState icon={<BookOpen />} title="Chưa có môn học" text="Tạo môn đầu tiên để tải tài liệu và bắt đầu hỏi Emin AI." /> :
        <div className="course-grid">{courses.map((course) => <article className="course-tile" key={course.id} style={{ '--course-color': course.color ?? '#315c45' } as CSSProperties}>
          <span className="course-swatch" aria-hidden="true" /><div><small>{course.code ?? 'MÔN HỌC'}</small><h3>{course.name}</h3><p>{course.description ?? 'Sẵn sàng để thêm tài liệu và chủ đề học.'}</p></div><footer><span>{course.semester ?? 'Chưa đặt học kỳ'}</span>
            {confirmingId === course.id ? <span className="course-delete-confirm"><button type="button" disabled={deletingId === course.id} onClick={() => void deleteCourse(course)}>{deletingId === course.id ? 'Đang xóa…' : 'Xóa môn'}</button><button type="button" onClick={() => setConfirmingId(null)}>Hủy</button></span> :
              <button className="icon-button" type="button" onClick={() => setConfirmingId(course.id)} aria-label={`Xóa môn ${course.name}`}><Trash2 size={17} /></button>}
          </footer>
        </article>)}</div>}
    </section>
  )
}

export function LibraryView() {
  const { courses, loading: coursesLoading } = useCourses()
  const [documents, setDocuments] = useState<StudyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [courseId, setCourseId] = useState('')
  const reload = () => workspaceApi.documents().then((page) => setDocuments(page.items)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không tải được tài liệu.')).finally(() => setLoading(false))
  useEffect(() => { void reload() }, [])
  useEffect(() => { if (!courseId && courses[0]) setCourseId(courses[0].id) }, [courseId, courses])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!courseId || !file) { setError('Hãy chọn môn học và một tệp tài liệu.'); return }
    setBusy(true); setError('')
    try { await workspaceApi.uploadDocument(courseId, file); if (fileRef.current) fileRef.current.value = ''; reload() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Tải lên thất bại.') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    setBusy(true)
    try { await workspaceApi.deleteDocument(id); setDocuments((items) => items.filter((item) => item.id !== id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể xóa tài liệu.') }
    finally { setBusy(false) }
  }

  return <section className="workspace-page" aria-labelledby="library-title">
    <div className="workspace-heading"><div><p>Kho kiến thức</p><h2 id="library-title">Tài liệu học tập</h2><span>PDF, DOCX, PPTX và TXT sẽ được Emin AI xử lý để trích dẫn.</span></div></div>
    <form className="upload-strip" onSubmit={upload}>
      <UploadCloud size={25} /><label>Chọn môn<select value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={coursesLoading || courses.length === 0}><option value="">Chọn môn học</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
      <label>Tệp tài liệu<input ref={fileRef} type="file" required accept=".pdf,.docx,.pptx,text/plain" /></label>
      <button className="primary-action" disabled={busy || courses.length === 0}>{busy ? <LoaderCircle className="spin" size={18} /> : <UploadCloud size={18} />} Tải lên</button>
    </form>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {loading ? <LoadingState label="Đang đọc danh mục tài liệu…" /> : documents.length === 0 ? <EmptyState icon={<FolderOpen />} title="Kho tài liệu còn trống" text="Tải tài liệu của môn học lên để tạo nguồn kiến thức riêng." /> : <div className="document-list">{documents.map((document) => <article key={document.id}>
      <span className="file-icon"><FileText /></span><div><h3>{document.original_filename}</h3><p>{formatBytes(document.size)} · {document.page_count ? `${document.page_count} trang` : 'Đang đọc số trang'}</p></div><span className={`status-chip ${document.processing_status}`}>{statusLabel(document.processing_status)}</span><button className="icon-button" disabled={busy} onClick={() => void remove(document.id)} aria-label={`Xóa ${document.original_filename}`}><Trash2 size={17} /></button>
    </article>)}</div>}
  </section>
}

interface ChatMessage { role: 'student' | 'assistant'; text: string; citations?: TutorReply['citations'] }

export function TutorView() {
  const { courses, loading } = useCourses()
  const [courseId, setCourseId] = useState('')
  const [conversationId, setConversationId] = useState<string>()
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: 'Chào bạn, mình là Emin AI. Hãy chọn môn học và đặt câu hỏi; mình sẽ ưu tiên trả lời từ tài liệu bạn đã tải lên.' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft] = useState(() => {
    const value = window.sessionStorage.getItem('studyhub.ai.draft.v1') ?? ''
    window.sessionStorage.removeItem('studyhub.ai.draft.v1')
    return value
  })
  useEffect(() => { if (!courseId && courses[0]) setCourseId(courses[0].id) }, [courseId, courses])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.elements.namedItem('message') as HTMLTextAreaElement
    const text = input.value.trim()
    if (!courseId || !text) return
    setMessages((items) => [...items, { role: 'student', text }]); input.value = ''; setBusy(true); setError('')
    try {
      const reply = await workspaceApi.chat({ course_id: courseId, conversation_id: conversationId, message: text })
      setConversationId(reply.conversation_id)
      setMessages((items) => [...items, { role: 'assistant', text: reply.answer, citations: reply.citations }])
    } catch (reason) {
      setMessages((items) => items.slice(0, -1))
      input.value = text
      setError(reason instanceof Error ? reason.message : 'Emin AI chưa thể trả lời.')
    }
    finally { setBusy(false) }
  }

  return <section className="workspace-page tutor-page" aria-labelledby="tutor-title">
    <div className="workspace-heading"><div><p>Gia sư học tập</p><h2 id="tutor-title">Hỏi Emin AI</h2><span>Emin AI ưu tiên tài liệu của bạn và trích dẫn khi tìm được nội dung phù hợp.</span></div><label className="course-select">Ngữ cảnh<select value={courseId} onChange={(event) => { setCourseId(event.target.value); setConversationId(undefined) }} disabled={loading}><option value="">Chọn môn học</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label></div>
    <div className="chat-shell"><div className="chat-thread" aria-live="polite">{messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
      <span>{message.role === 'assistant' ? <Bot size={18} /> : 'Bạn'}</span><div><p>{message.text}</p>{message.citations && message.citations.length > 0 && <div className="citations">{message.citations.map((citation) => <span key={citation.chunk_id}><FileText size={13} /> {citation.filename}{citation.page ? ` · trang ${citation.page}` : ''}</span>)}</div>}</div>
    </article>)}{busy && <div className="typing"><i /><i /><i /><span>Đang chuẩn bị câu trả lời</span></div>}</div>
      <form className="chat-composer" onSubmit={send}><textarea name="message" rows={2} required defaultValue={draft} placeholder={courseId ? 'Hỏi về khái niệm, bài tập hoặc nội dung trong tài liệu…' : 'Chọn môn học trước khi đặt câu hỏi'} disabled={!courseId || busy} /><button className="primary-action" aria-label="Gửi câu hỏi" disabled={!courseId || busy}><Send size={18} /></button></form>{error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  </section>
}

function LoadingState({ label }: { label: string }) { return <div className="workspace-state"><LoaderCircle className="spin" /><p>{label}</p></div> }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="workspace-state error-state"><p>{message}</p><button className="secondary-action" onClick={onRetry}>Thử lại</button></div> }
function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="workspace-state empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div> }
function formatBytes(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB` }
function statusLabel(status: StudyDocument['processing_status']) { return { uploaded: 'Đã tải lên', processing: 'Đang xử lý', ready: 'Sẵn sàng', failed: 'Có lỗi' }[status] }
