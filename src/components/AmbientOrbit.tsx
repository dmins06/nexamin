import { BrandLogo } from './BrandLogo'

export function AmbientOrbit() {
  return (
    <div className="orbit-scene" aria-hidden="true">
      <div className="orbit-halo orbit-halo-one" />
      <div className="orbit-halo orbit-halo-two" />
      <div className="orbit-plane" />
      <div className="orbit-core"><BrandLogo /></div>
      <span className="orbit-node node-one" />
      <span className="orbit-node node-two" />
      <span className="orbit-node node-three" />
      <span className="orbit-data data-one">AI</span>
      <span className="orbit-data data-two">24/7</span>
    </div>
  )
}
