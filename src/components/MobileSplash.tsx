import { BrandLogo } from './BrandLogo'

export function MobileSplash() {
  return (
    <div className="mobile-splash" aria-hidden="true">
      <span className="splash-logo"><BrandLogo /></span>
      <strong>Nexamin</strong>
      <small>LEARN · PLAN · GROW</small>
    </div>
  )
}
