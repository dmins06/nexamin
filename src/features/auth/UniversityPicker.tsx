import { Check, LoaderCircle, Search, School } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { searchUniversities, type University } from '../../lib/api'

interface UniversityPickerProps {
  value: University | null
  onChange: (university: University) => void
}

export function UniversityPicker({ value, onChange }: UniversityPickerProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<University[]>([])
  const [total, setTotal] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      searchUniversities(query, controller.signal)
        .then((page) => {
          setItems(page.items)
          setTotal(page.total)
          setActiveIndex(0)
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return
          setError(reason instanceof Error ? reason.message : 'Không tải được danh sách trường.')
        })
        .finally(() => setLoading(false))
    }, query ? 260 : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function select(university: University) {
    onChange(university)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + direction + items.length) % Math.max(items.length, 1))
    }
    if (event.key === 'Enter' && open && items[activeIndex]) {
      event.preventDefault()
      select(items[activeIndex])
    }
  }

  return (
    <div
      className="university-field"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <label htmlFor={id}>Trường đại học đang học</label>
      <div className={`university-combobox${open ? ' is-open' : ''}`}>
        <Search size={17} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open && items[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="off"
          placeholder={value ? value.name : 'Tìm theo tên hoặc mã trường…'}
          value={query}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        {loading && <LoaderCircle className="spin" size={17} aria-label="Đang tải" />}
      </div>
      {value && !open && (
        <div className="selected-university">
          <UniversityLogo key={value.id} university={value} />
          <span><strong>{value.name}</strong><small>Mã tuyển sinh {value.official_code ?? value.short_name}</small></span>
          <Check size={17} aria-hidden="true" />
        </div>
      )}
      {open && (
        <div className="university-results" id={`${id}-listbox`} role="listbox">
          <div className="result-summary" aria-live="polite">
            {loading ? 'Đang tải danh mục…' : `${total.toLocaleString('vi-VN')} cơ sở phù hợp`}
          </div>
          {error ? <p className="field-error" id={`${id}-error`} role="alert">{error}</p> : items.map((university, index) => (
            <button
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={value?.id === university.id}
              className={activeIndex === index ? 'is-active' : undefined}
              key={university.id}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(university)}
            >
              <UniversityLogo university={university} />
              <span><strong>{university.name}</strong><small>{university.official_code ?? university.short_name}</small></span>
              {value?.id === university.id && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
          {!loading && !error && items.length === 0 && <p>Không tìm thấy trường phù hợp.</p>}
        </div>
      )}
    </div>
  )
}

function UniversityLogo({ university }: { university: University }) {
  const code = university.official_code ?? university.short_name
  const sources = [`/university-logos/${encodeURIComponent(code)}.png`, university.logo_url].filter(
    (source, index, values): source is string => Boolean(source) && values.indexOf(source) === index,
  )
  const [sourceIndex, setSourceIndex] = useState(0)
  const source = sources[sourceIndex]

  if (source) {
    return (
      <img
        className="university-logo"
        src={source}
        alt={`Logo ${university.name}`}
        width="38"
        height="38"
        loading="lazy"
        onError={() => setSourceIndex((index) => index + 1)}
      />
    )
  }
  return <span className="university-seal" aria-label={`Mã trường ${code}`}><School size={15} aria-hidden="true" /><small>{code}</small></span>
}
