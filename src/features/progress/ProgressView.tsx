import { Sparkles } from 'lucide-react'
import type { StudyState } from '../../types'

export function ProgressView({ study }: { study: StudyState }) {
  const done = study.tasks.filter((task) => task.completed).length
  const completion = study.tasks.length ? Math.round((done / study.tasks.length) * 100) : 0
  const grouped = study.tasks.reduce<Map<string, { total: number; done: number }>>((result, task) => {
    const current = result.get(task.course) ?? { total: 0, done: 0 }
    current.total += 1
    if (task.completed) current.done += 1
    result.set(task.course, current)
    return result
  }, new Map())
  const courseProgress = [...grouped].map(([name, value]) => ({ name, value: Math.round(value.done / value.total * 100) }))
  return <section className="page-view" aria-labelledby="progress-title">
    <div className="page-intro"><span className="folio">Nhật ký tuần</span><h2 id="progress-title">Tiến bộ đang bén rễ</h2><p>Nhìn lại vừa đủ để biết bước tiếp theo nên đặt ở đâu.</p></div>
    <div className="progress-spread">
      <div className="progress-summary"><span className="big-number">{completion}%</span><h3>Kế hoạch của bạn</h3><p>{done} trong {study.tasks.length} việc đã hoàn thành. Dữ liệu được lưu trên thiết bị này.</p></div>
      <div className="course-progress">
        {courseProgress.length === 0 && <p className="progress-empty">Chưa có dữ liệu môn học. Hãy thêm lịch và hoàn thành buổi học đầu tiên.</p>}
        {courseProgress.map((course) => <div className="progress-line" key={course.name}><div><span>{course.name}</span><strong>{course.value}%</strong></div><span className="progress-track"><i style={{ width: `${course.value}%` }} /></span></div>)}
      </div>
    </div>
    <div className="insight-note"><Sparkles size={20} /><div><h3>Dữ liệu thuộc về bạn</h3><p>Nexamin chỉ tạo nhận xét sau khi bạn có đủ hoạt động học tập thực tế.</p></div></div>
  </section>
}
