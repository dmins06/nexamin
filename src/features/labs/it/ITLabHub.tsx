import { ITLabCard } from './ITLabCard'
import { itLabRegistry } from './itLabRegistry'
export function ITLabHub() {
  return (
    <section aria-labelledby="it-hub-title">
      <header className="it-heading">
        <h1 id="it-hub-title">CNTT Lab</h1>
        <p>
          Học, lập trình và khám phá cách hệ thống máy tính hoạt động qua mô
          phỏng tương tác.
        </p>
      </header>
      <div className="it-catalog">
        {itLabRegistry.map((lab) => (
          <ITLabCard key={lab.id} lab={lab} />
        ))}
      </div>
    </section>
  )
}
