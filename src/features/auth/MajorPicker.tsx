import { BookOpen, Check, LoaderCircle, Search } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from 'react'
import { filterMajors, getUniversityMajors, type MajorOption } from '../../lib/majorCatalog'
import type { University } from '../../lib/api'

interface MajorPickerProps {
  university: University | null
  value: MajorOption | null
  onChange: (major: MajorOption | null) => void
}

export function MajorPicker({ university, value, onChange }: MajorPickerProps) {
  const id = useId()
  const [majors, setMajors] = useState<MajorOption[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const matches = useMemo(() => filterMajors(majors, query).slice(0, 50), [majors, query])

  useEffect(() => {
    let active = true
    setQuery('')
    setOpen(false)
    setMajors([])
    setError('')
    if (!university) return () => { active = false }
    setLoading(true)
    getUniversityMajors(university.official_code ?? university.short_name)
      .then((items) => { if (active) setMajors(items) })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Không tải được danh sách ngành.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [university])

  function select(major: MajorOption) {
    onChange(major)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') return setOpen(false)
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && matches.length) {
      event.preventDefault()
      setOpen(true)
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + direction + matches.length) % matches.length)
    }
    if (event.key === 'Enter' && open && matches[activeIndex]) {
      event.preventDefault()
      select(matches[activeIndex])
    }
  }

  const unavailable = Boolean(university && !loading && !error && majors.length === 0)

  return (
    <div className="major-field" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <label htmlFor={id}>Ngành học</label>
      <input type="hidden" name="major" value={value?.name ?? ''} />
      <div className={`major-combobox${open ? ' is-open' : ''}`}>
        <Search size={17} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open && matches[activeIndex] ? `${id}-major-${activeIndex}` : undefined}
          aria-autocomplete="list"
          disabled={!university || unavailable}
          placeholder={!university ? 'Chọn trường trước' : value ? `${value.code} · ${value.name}` : 'Tìm mã hoặc tên ngành…'}
          value={query}
          onFocus={() => setOpen(majors.length > 0)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0) }}
          onKeyDown={handleKeyDown}
        />
        {loading && <LoaderCircle className="spin" size={17} aria-label="Đang tải ngành" />}
      </div>
      {value && !open && (
        <div className="selected-major">
          <BookOpen size={17} aria-hidden="true" />
          <span><strong>{value.name}</strong><small>Mã ngành {value.code}</small></span>
          <Check size={17} aria-hidden="true" />
        </div>
      )}
      {open && (
        <div className="major-results" id={`${id}-listbox`} role="listbox">
          <div className="result-summary" aria-live="polite">{matches.length} ngành phù hợp</div>
          {matches.map((major, index) => (
            <button
              id={`${id}-major-${index}`}
              type="button"
              role="option"
              aria-selected={value?.code === major.code}
              className={activeIndex === index ? 'is-active' : undefined}
              key={`${major.code}-${major.name}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(major)}
            >
              <span className="major-code">{major.code}</span>
              <span>{major.name}</span>
              {value?.code === major.code && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
          {matches.length === 0 && <p>Không tìm thấy ngành phù hợp.</p>}
        </div>
      )}
      {unavailable && <p className="field-hint">Trường chưa công bố danh sách ngành trong nguồn dữ liệu. Bạn vẫn có thể tạo tài khoản và cập nhật sau.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
