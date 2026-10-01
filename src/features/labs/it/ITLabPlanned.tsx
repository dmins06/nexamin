import { useLocation, Link } from 'react-router'
import { itLabRegistry } from './itLabRegistry'
export function ITLabPlanned() {
  const location = useLocation()
  const lab = itLabRegistry.find((item) => item.route === location.pathname)
  if (!lab) return null
  return (
    <section className="it-panel">
      <header className="it-heading">
        <h1>{lab.title}</h1>
        <p>{lab.description}</p>
      </header>
      <span className="it-status coming-soon">Chưa phát hành</span>
      <h2>Lộ trình phát triển</h2>
      <p>{lab.next}</p>
      <ul>
        {lab.topics.map((topic) => (
          <li key={topic}>{topic}</li>
        ))}
      </ul>
      <p>Trang này mới có cấu trúc và phạm vi; chưa có mô phỏng hoạt động.</p>
      <Link className="it-button primary" to="/labs/it/code">
        Thực hành trong Code Lab
      </Link>
    </section>
  )
}
