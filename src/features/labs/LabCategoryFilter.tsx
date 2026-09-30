import { labCategories } from './labRegistry'
import type { LabCategoryId, LabDefinition } from './labTypes'

export function LabCategoryFilter({ selected, labs, onSelect }: { selected: LabCategoryId | 'all'; labs: readonly LabDefinition[]; onSelect: (id: LabCategoryId | 'all') => void }) {
  return <section className="lab-fields" aria-labelledby="lab-fields-title"><div className="lab-section-heading"><h2 id="lab-fields-title">Lĩnh vực</h2><button aria-pressed={selected === 'all'} onClick={() => onSelect('all')}>Tất cả</button></div><div className="lab-category-grid" role="group" aria-label="Lọc theo lĩnh vực">{labCategories.map((category) => {
    const count = labs.filter((lab) => lab.category === category.id && lab.status !== 'coming-soon').length
    return <button key={category.id} aria-label={category.title} aria-pressed={selected === category.id} onClick={() => onSelect(category.id)}><span>{category.title}</span><small>{count ? `${count} lab có thể khám phá` : 'Đang phát triển'}</small></button>
  })}</div></section>
}
