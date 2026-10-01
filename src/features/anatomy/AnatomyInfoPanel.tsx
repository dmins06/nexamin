import { ChevronLeft, ChevronRight, Eye, EyeOff, Focus } from 'lucide-react'
import { anatomyById, systemLabel } from './anatomyData'
import type { AnatomyLearningPrompt, AnatomyStructure } from './anatomyTypes'

interface Props {
  selected: AnatomyStructure | undefined
  visible: boolean
  isolated: boolean
  learning: boolean
  canStep: boolean
  quiz: AnatomyLearningPrompt | null
  onQuizAnswer: (id: string) => void
  onQuizNext: () => void
  onQuizExit: () => void
  onSelect: (id: string) => void
  onVisibility: () => void
  onIsolate: () => void
  onStep: (direction: number) => void
}
export function AnatomyInfoPanel({ selected, visible, isolated, learning, canStep, quiz, onQuizAnswer, onQuizNext, onQuizExit, onSelect, onVisibility, onIsolate, onStep }: Props) {
  return <div className="anatomy-info-content">
    {learning && <nav className="anatomy-learning" aria-label="Học bộ phận"><button aria-label="Bộ phận trước" disabled={!canStep} onClick={() => onStep(-1)}><ChevronLeft size={16} />Trước</button><span>Học bộ phận</span><button aria-label="Bộ phận tiếp theo" disabled={!canStep} onClick={() => onStep(1)}>Sau<ChevronRight size={16} /></button></nav>}
    {quiz ? <section className="anatomy-quiz" aria-label="Tự kiểm tra giải phẫu"><h2>Đây là bộ phận nào?</h2><p>Quan sát cấu trúc được tách riêng trên mô hình, rồi chọn một đáp án.</p><div className="anatomy-quiz-choices">{quiz.choices.map((id) => { const item = anatomyById.get(id); return item && <button key={id} disabled={quiz.answerId !== null} onClick={() => onQuizAnswer(id)}>{item.nameVi}</button> })}</div>{quiz.answerId !== null && <p className="anatomy-quiz-result" role="status">{quiz.answerId === quiz.structureId ? 'Chính xác!' : `Chưa đúng. Đáp án: ${anatomyById.get(quiz.structureId)?.nameVi ?? ''}.`}</p>}<div className="anatomy-quiz-actions">{quiz.answerId !== null && <button onClick={onQuizNext}>Câu tiếp theo</button>}<button onClick={onQuizExit}>Kết thúc</button></div></section> : !selected ? <div className="anatomy-info-empty"><Focus size={30} aria-hidden="true" /><h3>Khám phá từng bộ phận</h3><p>Chọn một bộ phận trên mô hình để xem thông tin.</p><p>Hoặc tìm tên trong danh sách bộ phận.</p></div> : <>
      <div aria-live="polite" aria-atomic="true"><h2>{selected.nameVi}</h2><p className="anatomy-english" lang="en">{selected.nameEn}</p>{selected.latinName && <p className="anatomy-latin" lang="la">{selected.latinName}</p>}</div>
      <div className="anatomy-info-actions"><button aria-label={visible ? 'Ẩn bộ phận' : 'Hiện bộ phận'} onClick={onVisibility}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}{visible ? 'Ẩn' : 'Hiện'}</button><button aria-pressed={isolated} onClick={onIsolate}><Focus size={16} />{isolated ? 'Bỏ tách riêng' : 'Tách riêng'}</button></div>
      {!visible && <p className="anatomy-muted">Bộ phận đang ẩn khỏi mô hình.</p>}
      <dl><dt>Hệ cơ quan</dt><dd>{systemLabel(selected.system)}</dd><dt>Vị trí</dt><dd>{selected.location}</dd><dt>Chức năng cơ bản</dt><dd>{selected.function}</dd></dl>
      <h3>Cấu trúc liên quan</h3><div className="anatomy-related">{selected.relatedStructures.map((id) => { const item = anatomyById.get(id); return item ? <button key={id} onClick={() => onSelect(id)}>{item.nameVi}</button> : null })}</div>
      <a className="anatomy-source" href={selected.source} target="_blank" rel="noreferrer">Tham khảo OpenStax (tiếng Anh)</a>
    </>}
    <p className="anatomy-disclaimer">Nội dung hỗ trợ học tập; không dùng để chẩn đoán hoặc điều trị.</p>
  </div>
}
