export function BrandLogo({ className = '' }: { className?: string }) {
  return <img className={`nexamin-mark ${className}`.trim()} src="/nexamin-mark-black.png" alt="" aria-hidden="true" />
}
