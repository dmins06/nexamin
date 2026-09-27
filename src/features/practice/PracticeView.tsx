import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpenCheck, CheckCircle2, Clock3, Flag, LoaderCircle, Play } from 'lucide-react'
import {
  workspaceApi,
  type PracticeAttempt,
  type PracticeChapter,
  type PracticeExam,
  type PracticeHistory,
  type PracticeResult,
  type PracticeSubject,
  type PracticeWeakTopic,
} from '../../lib/workspaceApi'
import './practice.css'

const ACTIVE_ATTEMPT_KEY = 'nexamin.practice.active.v1'
const REPORT_REASONS = [
  ['wrong_answer', 'Sai đáp án'],
  ['unclear', 'Câu hỏi không rõ'],
  ['multiple_correct', 'Có nhiều đáp án đúng'],
  ['duplicate', 'Câu hỏi trùng'],
  ['wrong_explanation', 'Giải thích sai'],
  ['outdated', 'Nội dung lỗi thời'],
  ['source_issue', 'Nguồn có vấn đề'],
] as const

export function PracticeView() {
  const [subjects, setSubjects] = useState<PracticeSubject[]>([])
  const [selected, setSelected] = useState<PracticeSubject | null>(null)
  const [exams, setExams] = useState<PracticeExam[]>([])
  const [history, setHistory] = useState<PracticeHistory[]>([])
  const [weakTopics, setWeakTopics] = useState<PracticeWeakTopic[]>([])
  const [chapters, setChapters] = useState<PracticeChapter[]>([])
  const [chapterId, setChapterId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [timeLimit, setTimeLimit] = useState('')
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null)
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [randomCount, setRandomCount] = useState(10)
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reportReasons, setReportReasons] = useState<Record<string, string>>({})
  const [reportingId, setReportingId] = useState('')
  const [reportNotice, setReportNotice] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    const savedId = window.localStorage.getItem(ACTIVE_ATTEMPT_KEY)
    void Promise.all([
      workspaceApi.practiceSubjects(),
      workspaceApi.practiceHistory(),
      savedId ? workspaceApi.practiceLoad(savedId).catch(() => null) : Promise.resolve(null),
    ]).then(([items, past, resumed]) => {
      if (!active) return
      setSubjects(items)
      setHistory(past)
      if (resumed?.status === 'in_progress') setAttempt(resumed)
      else window.localStorage.removeItem(ACTIVE_ATTEMPT_KEY)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Không tải được kho luyện đề.')
    }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [])

  async function selectSubject(subject: PracticeSubject) {
    setError('')
    setBusy(true)
    try {
      const [available, weak, outline] = await Promise.all([
        workspaceApi.practiceExams(subject.id),
        workspaceApi.practiceWeakTopics(subject.id),
        workspaceApi.practiceChapters(subject.id),
      ])
      setSelected(subject)
      setExams(available)
      setWeakTopics(weak)
      setChapters(outline)
      setChapterId('')
      setTopicId('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được đề thi.')
    } finally {
      setBusy(false)
    }
  }

  async function start(exam: PracticeExam) {
    setError('')
    setBusy(true)
    try {
      const opened = await workspaceApi.practiceStart(exam.id)
      setAttempt(opened)
      setResult(null)
      setQuestionIndex(0)
      window.localStorage.setItem(ACTIVE_ATTEMPT_KEY, opened.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không mở được đề thi.')
    } finally {
      setBusy(false)
    }
  }

  async function createRandom() {
    if (!selected) return
    setError('')
    setBusy(true)
    try {
      const exam = await workspaceApi.practiceRandomExam(selected.id, randomCount, {
        chapterId, topicId, difficulty,
        timeLimitMinutes: timeLimit ? Number(timeLimit) : undefined,
      })
      const opened = await workspaceApi.practiceStart(exam.id)
      setAttempt(opened)
      setResult(null)
      setQuestionIndex(0)
      window.localStorage.setItem(ACTIVE_ATTEMPT_KEY, opened.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tạo được đề ngẫu nhiên.')
    } finally {
      setBusy(false)
    }
  }

  async function saveAnswer(keys: string[], mark: boolean) {
    if (!attempt || saving) return
    const question = attempt.questions[questionIndex]
    if (!question) return
    setSaving(true)
    setError('')
    try {
      await workspaceApi.practiceSave(attempt.id, question.id, keys, mark)
      setAttempt((current) => current && ({
        ...current,
        questions: current.questions.map((item) => item.id === question.id
          ? { ...item, selected_keys: keys, marked_for_review: mark } : item),
      }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa lưu được câu trả lời. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (!attempt || saving || !window.confirm('Nộp bài? Bạn sẽ không thể sửa câu trả lời sau khi nộp.')) return
    setBusy(true)
    setError('')
    try {
      const scored = await workspaceApi.practiceSubmit(attempt.id)
      setResult(scored)
      setAttempt(null)
      window.localStorage.removeItem(ACTIVE_ATTEMPT_KEY)
      void workspaceApi.practiceHistory().then(setHistory).catch(() => {
        setError('Bài đã nộp và chấm điểm. Chưa làm mới được lịch sử; bạn có thể tải lại trang để xem.')
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa nộp được bài. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  async function repeatMistakes() {
    if (!result) return
    setBusy(true)
    setError('')
    try {
      const exam = await workspaceApi.practiceMistakesExam(result.attempt_id)
      const opened = await workspaceApi.practiceStart(exam.id)
      setAttempt(opened)
      setResult(null)
      setQuestionIndex(0)
      window.localStorage.setItem(ACTIVE_ATTEMPT_KEY, opened.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tạo được đề luyện câu sai.')
    } finally {
      setBusy(false)
    }
  }

  const question = attempt?.questions[questionIndex]
  const remaining = attempt?.deadline_at
    ? Math.max(0, Math.ceil((new Date(attempt.deadline_at).getTime() - now) / 1000))
    : null

  return <section className="learning-page" aria-labelledby="practice-title">
    <header className="learning-head">
      <div>
        <h1 id="practice-title">Luyện đề</h1>
        <p>Ôn tập theo môn, làm đề và xem lại phần kiến thức cần cải thiện.</p>
      </div>
      {(selected || result) && !attempt && <button className="learning-quiet" onClick={() => { setSelected(null); setResult(null); setError('') }}><ArrowLeft size={17} /> Danh sách môn</button>}
    </header>
    {error && <div className="learning-alert" role="alert"><AlertCircle size={18} />{error}</div>}
    {reportNotice && <p className="learning-status" role="status">{reportNotice}</p>}
    {busy && <p className="learning-status"><LoaderCircle className="spin" size={18} /> Đang tải…</p>}
    {result && <div className="learning-flow">
      <div className="learning-result"><CheckCircle2 size={24} /><h2>Kết quả bài làm</h2><strong>{result.score.toFixed(1)}/10</strong><p>{result.correct} đúng · {result.incorrect} sai · {result.unanswered} chưa trả lời</p>
        <div className="learning-actions"><button className="learning-primary" onClick={() => void start({ id: result.exam_id, subject_id: result.subject_id, title: '', description: null, kind: '', question_count: result.questions.length, time_limit_seconds: null })}>Làm lại đề</button>{result.incorrect + result.unanswered > 0 && <button className="learning-quiet" onClick={() => void repeatMistakes()}>Luyện câu sai</button>}</div>
      </div>
      <h2>Đáp án và giải thích</h2>
      {result.questions.map((item, index) => <article className="learning-question" key={item.id}>
        <h3>Câu {index + 1}. {item.text}</h3>
        <p>{item.is_correct ? 'Trả lời đúng' : 'Cần ôn lại'} · Đáp án: {item.correct_keys.join(', ')}</p>
        <p>{item.explanation}</p>
        <small>Nguồn: {item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_name}</a> : item.source_name}</small>
        <div className="learning-report">
          <label htmlFor={`report-${item.id}`}>Lý do báo lỗi
            <select id={`report-${item.id}`} value={reportReasons[item.id] ?? 'unclear'} onChange={(event) => setReportReasons((current) => ({ ...current, [item.id]: event.target.value }))}>
              {REPORT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="learning-quiet" disabled={reportingId === item.id} onClick={() => {
            setReportingId(item.id)
            setReportNotice('')
            void workspaceApi.practiceReport(item.question_id, reportReasons[item.id] ?? 'unclear')
              .then(() => setReportNotice(`Đã ghi nhận báo lỗi câu ${index + 1}.`))
              .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không gửi được báo lỗi.'))
              .finally(() => setReportingId(''))
          }}><Flag size={15} /> Gửi báo cáo</button>
        </div>
      </article>)}
    </div>}
    {attempt && question && !result && <div className="learning-flow">
      <div className="learning-exam-bar">
        <div><h2>{attempt.exam_title}</h2><p>Câu {questionIndex + 1}/{attempt.questions.length} · Đã trả lời {attempt.questions.filter((item) => item.selected_keys.length > 0).length}</p></div>
        {remaining !== null && <span className="learning-timer"><Clock3 size={17} /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
      </div>
      <div className="learning-question-nav" aria-label="Chọn câu hỏi">
        {attempt.questions.map((item, index) => <button key={item.id} onClick={() => setQuestionIndex(index)} className={index === questionIndex ? 'is-current' : item.selected_keys.length ? 'is-answered' : ''} aria-current={index === questionIndex ? 'step' : undefined} aria-label={`Câu ${index + 1}${item.marked_for_review ? ', đã đánh dấu' : ''}`}>{index + 1}</button>)}
      </div>
      <article className="learning-question">
        <p className="learning-meta">{question.chapter ?? 'Câu hỏi'}{question.topic ? ` · ${question.topic}` : ''}</p>
        <h3>{question.text}</h3>
        <fieldset disabled={remaining === 0}>
          <legend>{question.question_type === 'multiple_choice' ? 'Chọn tất cả đáp án đúng' : 'Chọn một đáp án'}</legend>
          {question.options.map((option) => <label className="learning-option" key={option.key}>
            <input type={question.question_type === 'multiple_choice' ? 'checkbox' : 'radio'} name={question.id} checked={question.selected_keys.includes(option.key)} disabled={saving || busy}
              onChange={() => {
                const next = question.question_type === 'multiple_choice'
                  ? question.selected_keys.includes(option.key) ? question.selected_keys.filter((key) => key !== option.key) : [...question.selected_keys, option.key]
                  : [option.key]
                void saveAnswer(next, question.marked_for_review)
              }} />
            <span>{option.key}. {option.text}</span>
          </label>)}
        </fieldset>
        <button className="learning-quiet" disabled={saving} onClick={() => void saveAnswer(question.selected_keys, !question.marked_for_review)}><Flag size={16} /> {question.marked_for_review ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'}</button>
      </article>
      <div className="learning-actions">
        <button className="learning-quiet" disabled={questionIndex === 0} onClick={() => setQuestionIndex((value) => value - 1)}>Câu trước</button>
        {questionIndex < attempt.questions.length - 1 && <button className="learning-primary" onClick={() => setQuestionIndex((value) => value + 1)}>Câu tiếp</button>}
        <button className="learning-primary" disabled={busy || saving} onClick={() => void submit()}>Nộp bài</button>
      </div>
      {remaining === 0 && <p className="learning-alert" role="alert">Đã hết giờ. Hãy nộp bài để xem kết quả.</p>}
    </div>}
    {!attempt && !result && !busy && <div className="learning-flow">
      {!selected ? subjects.length === 0
        ? <div className="learning-empty"><BookOpenCheck size={32} /><h2>Chưa có bộ câu hỏi được duyệt</h2><p>Khi quản trị viên thêm câu hỏi có nguồn và kiểm duyệt, đề luyện tập sẽ xuất hiện tại đây.</p></div>
        : <div className="learning-subjects">{subjects.map((subject) => <button className="learning-subject" key={subject.id} onClick={() => void selectSubject(subject)}>
          <BookOpenCheck size={22} /><strong>{subject.name}</strong><span>{subject.question_count} câu hỏi · {subject.exam_count} đề</span>
        </button>)}</div>
        : <>
          <div className="learning-exam-bar"><div><h2>{selected.name}</h2><p>{selected.question_count} câu hỏi đã duyệt · {selected.exam_count} đề sẵn có</p></div></div>
          {selected.question_count > 0 && <div className="learning-random">
            <label htmlFor="random-count">Số câu</label><input id="random-count" type="number" min="1" max="50" value={randomCount} onChange={(event) => setRandomCount(Number(event.target.value))} />
            <label htmlFor="random-chapter">Chương</label><select id="random-chapter" value={chapterId} onChange={(event) => { setChapterId(event.target.value); setTopicId('') }}><option value="">Tất cả</option>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select>
            <label htmlFor="random-topic">Chủ đề</label><select id="random-topic" value={topicId} onChange={(event) => setTopicId(event.target.value)}><option value="">Tất cả</option>{chapters.filter((chapter) => !chapterId || chapter.id === chapterId).flatMap((chapter) => chapter.topics).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
            <label htmlFor="random-difficulty">Độ khó</label><select id="random-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">Hỗn hợp</option><option value="easy">Dễ</option><option value="medium">Trung bình</option><option value="hard">Khó</option></select>
            <label htmlFor="random-time">Thời gian</label><select id="random-time" value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)}><option value="">Không giới hạn</option><option value="15">15 phút</option><option value="30">30 phút</option><option value="45">45 phút</option><option value="60">60 phút</option></select>
            <button className="learning-primary" disabled={!Number.isInteger(randomCount) || randomCount < 1 || randomCount > 50} onClick={() => void createRandom()}><Play size={16} /> Tạo đề ngẫu nhiên</button>
          </div>}
          {exams.length ? <div className="learning-list">{exams.map((exam) => <article key={exam.id}><div><h3>{exam.title}</h3><p>{exam.question_count} câu{exam.time_limit_seconds ? ` · ${Math.ceil(exam.time_limit_seconds / 60)} phút` : ''}</p></div><button className="learning-primary" onClick={() => void start(exam)}>Bắt đầu</button></article>)}</div> : <p className="learning-status">Môn này chưa có đề được xuất bản.</p>}
          {weakTopics.some((topic) => topic.accuracy < 70) && <section><h2>Chủ đề cần ôn</h2><div className="learning-list">{weakTopics.filter((topic) => topic.accuracy < 70).map((topic) => <article key={topic.topic}><strong>{topic.topic}</strong><span>{topic.correct}/{topic.answered} câu đúng · {Math.round(topic.accuracy)}%</span><button className="learning-quiet" onClick={() => { const match = chapters.flatMap((chapter) => chapter.topics).find((item) => item.title === topic.topic); if (match) { setTopicId(match.id); setChapterId(chapters.find((chapter) => chapter.topics.some((item) => item.id === match.id))?.id ?? '') } }}>Luyện phần này</button></article>)}</div></section>}
        </>}
      {history.length > 0 && <section><h2>Lịch sử làm bài</h2><div className="learning-list">{history.filter((item) => !selected || item.subject_id === selected.id).map((item) => <article key={item.attempt_id}><div><h3>{item.exam_title}</h3><p>{new Date(item.submitted_at).toLocaleDateString('vi-VN')} · {item.score.toFixed(1)}/10</p></div><button className="learning-quiet" onClick={() => void workspaceApi.practiceResult(item.attempt_id).then(setResult).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không tải được kết quả.'))}>Xem lại</button></article>)}</div></section>}
    </div>}
  </section>
}
