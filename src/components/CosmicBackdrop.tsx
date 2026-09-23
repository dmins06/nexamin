import { useEffect, useRef } from 'react'

export function CosmicBackdrop() {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = backdropRef.current
    if (!element || typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const update = (event: PointerEvent) => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2
        const y = (event.clientY / window.innerHeight - 0.5) * 2
        element.style.setProperty('--parallax-x', x.toFixed(3))
        element.style.setProperty('--parallax-y', y.toFixed(3))
      })
    }
    window.addEventListener('pointermove', update, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', update)
    }
  }, [])

  return (
    <div className="cosmic-backdrop" ref={backdropRef} aria-hidden="true">
      <div className="cosmic-earth cosmic-earth-night" />
      <div className="cosmic-earth cosmic-earth-day" />
      <div className="cosmic-stars" />
      <div className="cosmic-clouds" />
      <div className="cosmic-orbit cosmic-orbit-one" />
      <div className="cosmic-orbit cosmic-orbit-two" />
      <div className="cosmic-vignette" />
    </div>
  )
}
