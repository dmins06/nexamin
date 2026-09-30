import { ArrowRight, PersonStanding } from 'lucide-react'
import { labCategoryTitle } from './labRegistry'
import type { LabDefinition } from './labTypes'

export function LabCard({ lab, canLaunch, onLaunch }: { lab: LabDefinition; canLaunch: boolean; onLaunch: () => void }) {
  return <article className="lab-card" aria-labelledby={`lab-title-${lab.id}`}>
    <div className="lab-card-main"><div className="lab-card-title">{lab.id === 'anatomy' && <PersonStanding size={38} aria-hidden="true" />}<h2 id={`lab-title-${lab.id}`}>{lab.title}</h2></div>
      <p className="lab-description">{lab.description}</p><ul className="lab-tags" aria-label={`Chủ đề ${lab.title}`}>{lab.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>{lab.note && <p className="lab-note">{lab.note}</p>}
    </div>
    <div className="lab-card-action"><span className="lab-status">{canLaunch ? lab.status === 'beta' ? 'Bản thử nghiệm' : 'Có thể khám phá' : 'Đang phát triển'}</span><p>{labCategoryTitle(lab.category)}</p><button className="lab-launch" disabled={!canLaunch} onClick={onLaunch}>{canLaunch ? 'Khám phá' : 'Chưa phát hành'}{canLaunch && <ArrowRight size={17} aria-hidden="true" />}</button></div>
  </article>
}
