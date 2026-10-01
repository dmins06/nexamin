import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import type { ITLabDefinition } from './itLabTypes'
export function ITLabCard({ lab }: { lab: ITLabDefinition }) {
  const Icon = lab.icon
  return (
    <article className="it-card" aria-labelledby={`it-${lab.id}`}>
      <div className="it-card-heading">
        <Icon size={26} aria-hidden="true" />
        <h2 id={`it-${lab.id}`}>{lab.title}</h2>
      </div>
      <p>{lab.description}</p>
      <ul className="it-topics" aria-label="Chủ đề">
        {lab.topics.map((topic) => (
          <li key={topic}>{topic}</li>
        ))}
      </ul>
      <div className="it-card-footer">
        <span className={`it-status ${lab.status}`}>
          {lab.status === 'beta' ? 'Bản thử nghiệm' : 'Chưa phát hành'}
        </span>
        {lab.status === 'beta' ? (
          <Link className="it-button primary" to={lab.route}>
            Mở lab
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <Link className="it-button" to={lab.route}>
            Xem lộ trình
          </Link>
        )}
      </div>
    </article>
  )
}
