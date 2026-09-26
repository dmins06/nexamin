import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, ExternalLink, GraduationCap, LoaderCircle } from 'lucide-react'
import { workspaceApi, type Career, type Curriculum, type ElectiveAvailability, type ElectivePlan } from '../../lib/workspaceApi'
import '../practice/practice.css'

export function ElectivesView({ onOpenProfile }: { onOpenProfile: () => void }) {
  const [availability, setAvailability] = useState<ElectiveAvailability | null>(null)
  const [curricula, setCurricula] = useState<Curriculum[]>([])
  const [careers, setCareers] = useState<Career[]>([])
  const [curriculumId, setCurriculumId] = useState('')
  const [careerCode, setCareerCode] = useState('')
  const [compareCode, setCompareCode] = useState('')
  const [plan, setPlan] = useState<ElectivePlan | null>(null)
  const [comparison, setComparison] = useState<ElectivePlan | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void workspaceApi.electiveAvailability().then(async (info) => {
      if (!active) return
      setAvailability(info)
      if (info.status !== 'supported') return
      const [versions, paths] = await Promise.all([
        workspaceApi.electiveCurricula(),
        workspaceApi.electiveCareers(),
      ])
      if (!active) return
      setCurricula(versions)
      setCareers(paths)
      setCurriculumId(versions[0]?.id ?? '')
      setCareerCode(paths[0]?.code ?? '')
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu chương trình.')
    }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [])

  async function recommend() {
    if (!curriculumId || !careerCode) return
    setBusy(true)
    setError('')
    setComparison(null)
    try {
      setPlan(await workspaceApi.electiveRecommend(curriculumId, careerCode))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lập được kế hoạch môn tự chọn.')
    } finally {
      setBusy(false)
    }
  }

  async function compare() {
    if (!curriculumId || !careerCode || !compareCode) return
    setBusy(true)
    setError('')
    try {
      const result = await workspaceApi.electiveCompare(curriculumId, careerCode, compareCode)
      setPlan(result.first)
      setComparison(result.second)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không so sánh được hai định hướng.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="learning-page" aria-labelledby="electives-title">
    <header className="learning-head">
      <div><h1 id="electives-title">Gợi ý môn tự chọn</h1><p>Đối chiếu CTĐT UTH đã duyệt với định hướng nghề nghiệp của bạn.</p></div>
    </header>
    {error && <div className="learning-alert" role="alert"><AlertCircle size={18} />{error}</div>}
    {busy && <p className="learning-status"><LoaderCircle className="spin" size={18} /> Đang tải…</p>}
    {availability && availability.status !== 'supported' && <div className="learning-empty">
      <GraduationCap size={32} />
      <h2>Chưa thể gợi ý cho hồ sơ này</h2>
      <p>{availability.message}</p>
      {(availability.status === 'missing_university' || availability.status === 'missing_major') && <button className="learning-primary" onClick={onOpenProfile}>Cập nhật hồ sơ <ArrowRight size={16} /></button>}
    </div>}
    {availability?.status === 'supported' && !busy && <div className="learning-flow">
      {curricula.length === 0 ? <div className="learning-empty">
        <BookOpen size={32} /><h2>Chưa tìm thấy CTĐT phù hợp</h2>
        <p>Ngành hoặc chuyên ngành trong hồ sơ chưa khớp dữ liệu UTH đã duyệt. Hãy kiểm tra lại hồ sơ; hệ thống không gợi ý từ ngành khác.</p>
        <button className="learning-primary" onClick={onOpenProfile}>Xem hồ sơ <ArrowRight size={16} /></button>
      </div> : <>
        <form className="learning-selector" onSubmit={(event) => { event.preventDefault(); void recommend() }}>
          <label>Chương trình đào tạo
            <select value={curriculumId} onChange={(event) => { setCurriculumId(event.target.value); setPlan(null); setComparison(null) }}>
              {curricula.map((item) => <option key={item.id} value={item.id}>{item.specialization} · Khóa {item.cohort} · {item.source_file}</option>)}
            </select>
          </label>
          <label>Định hướng nghề nghiệp
            <select value={careerCode} onChange={(event) => { setCareerCode(event.target.value); setPlan(null); setComparison(null) }}>
              {careers.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </label>
          <button className="learning-primary" type="submit" disabled={!curriculumId || !careerCode}>Xem gợi ý <ArrowRight size={16} /></button>
        </form>
        {plan && <PlanDetails plan={plan} />}
        {plan && <div className="learning-compare">
          <label htmlFor="compare-career">So sánh với định hướng khác</label>
          <select id="compare-career" value={compareCode} onChange={(event) => setCompareCode(event.target.value)}>
            <option value="">Chọn định hướng thứ hai</option>
            {careers.filter((item) => item.code !== careerCode).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
          <button className="learning-quiet" disabled={!compareCode} onClick={() => void compare()}>So sánh</button>
        </div>}
        {comparison && <div className="learning-comparison">
          <h2>So sánh định hướng</h2>
          <p><strong>{plan?.career.label}</strong>: {plan?.selected_credits} tín chỉ đã ghép, {plan?.courses.length} môn gợi ý.</p>
          <p><strong>{comparison.career.label}</strong>: {comparison.selected_credits} tín chỉ đã ghép, {comparison.courses.length} môn gợi ý.</p>
          <PlanDetails plan={comparison} />
        </div>}
      </>}
    </div>}
  </section>
}

function PlanDetails({ plan }: { plan: ElectivePlan }) {
  const valid = plan.status === 'valid_known_rules'
  return <section className="learning-plan" aria-label={`Kế hoạch ${plan.career.label}`}>
    <div className="learning-plan-head">
      <div><h2>{plan.career.label}</h2><p>{plan.curriculum.specialization} · Khóa {plan.curriculum.cohort}</p></div>
      <span className={valid ? 'learning-badge is-valid' : 'learning-badge is-partial'}>{valid ? 'Đủ quy tắc đã biết' : 'Cần kiểm tra thêm'}</span>
    </div>
    <p className="learning-credits">{plan.selected_credits}{plan.required_credits !== null ? `/${plan.required_credits}` : ''} <span>tín chỉ được ghép</span></p>
    <p>{plan.explanation}</p>
    {plan.warnings.length > 0 && <div className="learning-alert" role="status"><AlertCircle size={18} /><ul>{plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    <h3>Điều kiện nhóm</h3>
    <div className="learning-list">{plan.groups.map((group) => <article key={group.name}>
      <div><strong>{group.name}</strong><p>{group.required_credits === null ? 'Chưa xác định số tín chỉ cần chọn' : `${group.selected_credits}/${group.required_credits} tín chỉ`}</p></div>
      <span>{group.status === 'satisfied' ? <CheckCircle2 size={18} aria-label="Đã đáp ứng" /> : 'Cần đối chiếu'}</span>
    </article>)}</div>
    <h3>Môn được gợi ý</h3>
    {plan.courses.length === 0 ? <p>Chưa thể chọn môn hợp lệ từ dữ liệu hiện có.</p> : <div className="learning-list">{plan.courses.map((course) => <article className="learning-course" key={course.curriculum_course_id}>
      <div><h4>{course.name}</h4><p>{course.code ? `${course.code} · ` : ''}{course.credits} tín chỉ · {course.group}</p>
        <p>{course.reasons.join(' ')}</p>
        {course.source_url && <a href={course.source_url} target="_blank" rel="noreferrer">Xem nguồn CTĐT <ExternalLink size={14} /></a>}
      </div>
      <span>{Math.round(course.relevance_score * 100)}% phù hợp</span>
    </article>)}</div>}
    <p className="learning-source">Nguồn: {plan.curriculum.source_url
      ? <a href={plan.curriculum.source_url} target="_blank" rel="noreferrer">{plan.curriculum.source_file} <ExternalLink size={14} /></a>
      : plan.curriculum.source_file}. Dữ liệu học kỳ và tiên quyết có thể thiếu; hãy xác nhận với cố vấn học tập trước khi đăng ký.</p>
  </section>
}
