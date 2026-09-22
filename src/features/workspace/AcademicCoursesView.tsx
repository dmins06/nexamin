import {
  Award,
  BookCheck,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  LoaderCircle,
  PencilLine,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { type CSSProperties, type FormEvent, useCallback, useEffect, useState } from 'react'
import { type AcademicSummary, type Course, workspaceApi } from '../../lib/workspaceApi'

export function CoursesView() {
  const [courses, setCourses] = useState<Course[]>([])
  const [summary, setSummary] = useState<AcademicSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [coursePage, academic] = await Promise.all([
        workspaceApi.courses(),
        workspaceApi.academicSummary(),
      ])
      setCourses(coursePage.items)
      setSummary(academic)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu môn học.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const nextCoursePayload = {
      name: String(data.get('name') ?? '').trim(),
      code: String(data.get('code') || '') || undefined,
      semester: String(data.get('semester') || '') || undefined,
      credits: Number(data.get('credits')) || 3,
      color: String(data.get('color') || '#7c6cff'),
    }
    setBusyId('create')
    setError('')
    try {
      const created = await workspaceApi.createCourse(nextCoursePayload)
      setCourses((current) => [created, ...current.filter((course) => course.id !== created.id)])
      if (form && typeof form.reset === 'function') form.reset()
      setFormOpen(false)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tạo môn học.')
    } finally {
      setBusyId(null)
    }
  }

  async function saveGrade(event: FormEvent<HTMLFormElement>, course: Course) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const completed = data.get('isCompleted') === 'on'
    const scoreValue = String(data.get('finalScore') || '')
    if (completed && scoreValue === '') {
      setError('Hãy nhập điểm hệ 10 trước khi đánh dấu đã học xong.')
      return
    }
    setBusyId(course.id)
    setError('')
    try {
      await workspaceApi.updateCourse(course.id, {
        credits: Number(data.get('credits')),
        final_score: scoreValue === '' ? null : Number(scoreValue),
        is_completed: completed,
      })
      setEditingId(null)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật kết quả môn học.')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteCourse(course: Course) {
    setBusyId(course.id)
    setError('')
    try {
      await workspaceApi.deleteCourse(course.id)
      setConfirmingId(null)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xóa môn học.')
    } finally {
      setBusyId(null)
    }
  }

  const gradeFor = (id: string) => summary?.grades.find((grade) => grade.course_id === id)

  return (
    <section className="workspace-page academic-courses" aria-labelledby="courses-title">
      <div className="workspace-heading">
        <div><p>Không gian môn học</p><h2 id="courses-title">Môn học của bạn</h2><span>Theo dõi điểm, tín chỉ và tiến độ trong cùng một nơi.</span></div>
        <button className="primary-action" type="button" onClick={() => setFormOpen((value) => !value)}>{formOpen ? <X size={18} /> : <Plus size={18} />}{formOpen ? 'Đóng' : 'Thêm môn học'}</button>
      </div>

      {summary && (
        <section className="academic-summary" aria-label="Tổng quan kết quả học tập">
          <div className="academic-stat"><GraduationCap size={19} /><span><small>GPA hệ 4</small><strong>{summary.gpa?.toFixed(2) ?? '—'}</strong></span></div>
          <div className="academic-stat"><BookCheck size={19} /><span><small>Tín chỉ tích lũy</small><strong>{summary.completed_credits}</strong></span></div>
          <div className="academic-stat"><Award size={19} /><span><small>Xếp loại dự kiến</small><strong>{summary.degree_classification}</strong></span></div>
          <div className="grading-policy"><span><small>Quy đổi đang dùng</small><strong>{summary.policy.name}</strong></span><a href={summary.policy.source_url} target="_blank" rel="noreferrer">Xem nguồn <ExternalLink size={13} /></a>{!summary.policy.is_school_specific && <em>Chưa có quy chế riêng trong dữ liệu; đang dùng khung chung.</em>}</div>
        </section>
      )}

      {formOpen && <form className="course-form" onSubmit={createCourse}>
        <label>Tên môn<input name="name" required placeholder="Ví dụ: Cấu trúc dữ liệu" /></label>
        <label>Mã môn<input name="code" placeholder="CTDL101" /></label>
        <label>Học kỳ<input name="semester" placeholder="HK1" /></label>
        <label>Tín chỉ<input name="credits" type="number" min="1" max="30" defaultValue="3" required /></label>
        <label>Màu nhận diện<input name="color" type="color" defaultValue="#7c6cff" aria-label="Màu môn học" /></label>
        <button className="primary-action" type="submit" disabled={busyId === 'create'}>{busyId === 'create' ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}{busyId === 'create' ? 'Đang lưu…' : 'Lưu môn học'}</button>
      </form>}

      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? <div className="workspace-state"><LoaderCircle className="spin" /><p>Đang mở sổ môn học…</p></div> : courses.length === 0 ? <div className="workspace-state empty-state"><span><BookOpen /></span><h3>Chưa có môn học</h3><p>Tạo môn đầu tiên để theo dõi tài liệu, điểm và tín chỉ.</p></div> : (
        <div className="course-grid">
          {courses.map((course) => {
            const grade = gradeFor(course.id)
            return <article className="course-tile" key={course.id} style={{ '--course-color': course.color ?? '#7c6cff' } as CSSProperties}>
              <span className="course-swatch" aria-hidden="true" />
              <div className="course-tile-heading"><div><small>{course.code ?? 'MÔN HỌC'}</small><h3>{course.name}</h3></div>{course.is_completed && <span className="completed-chip"><CheckCircle2 size={13} /> Đã học xong</span>}</div>
              <p>{course.description ?? 'Sẵn sàng để thêm tài liệu và chủ đề học.'}</p>
              <div className="course-grade-row"><span><small>Tín chỉ</small><strong>{course.credits}</strong></span><span><small>Hệ 10</small><strong>{course.final_score?.toFixed(1) ?? '—'}</strong></span><span><small>Hệ 4</small><strong>{grade?.grade4.toFixed(1) ?? '—'}</strong></span><span><small>Điểm chữ</small><strong>{grade?.letter ?? '—'}</strong></span></div>
              {editingId === course.id && <form className="grade-form" onSubmit={(event) => void saveGrade(event, course)}>
                <label>Tín chỉ<input name="credits" type="number" min="1" max="30" defaultValue={course.credits} required /></label>
                <label>Điểm hệ 10<input name="finalScore" type="number" min="0" max="10" step="0.1" defaultValue={course.final_score ?? ''} placeholder="0–10" /></label>
                <label className="completion-check"><input name="isCompleted" type="checkbox" defaultChecked={course.is_completed} /> Đã học xong</label>
                <div><button className="primary-action" disabled={busyId === course.id}>{busyId === course.id ? 'Đang lưu…' : 'Lưu kết quả'}</button><button className="text-button" type="button" onClick={() => setEditingId(null)}>Hủy</button></div>
              </form>}
              <footer><span>{course.semester ?? 'Chưa đặt học kỳ'}</span><span className="course-actions"><button className="grade-edit" type="button" onClick={() => { setEditingId(editingId === course.id ? null : course.id); setError('') }}><PencilLine size={15} /> Kết quả</button>{confirmingId === course.id ? <span className="course-delete-confirm"><button type="button" disabled={busyId === course.id} onClick={() => void deleteCourse(course)}>{busyId === course.id ? 'Đang xóa…' : 'Xóa môn'}</button><button type="button" onClick={() => setConfirmingId(null)}>Hủy</button></span> : <button className="icon-button" type="button" onClick={() => setConfirmingId(course.id)} aria-label={`Xóa môn ${course.name}`}><Trash2 size={16} /></button>}</span></footer>
            </article>
          })}
        </div>
      )}
    </section>
  )
}
