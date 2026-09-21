import { useId } from 'react'

export function BrandLogo({ className = '' }: { className?: string }) {
  const gradientId = `studyhub-s-${useId().replaceAll(':', '')}`
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38D9FF" />
          <stop offset=".5" stopColor="#7C6CFF" />
          <stop offset="1" stopColor="#B25CFF" />
        </linearGradient>
      </defs>
      <path d="M45.5 13.5C40.7 9.6 34.7 8 28.8 9.2 20.7 10.8 15 17.1 15 24.2c0 6.7 5.1 10.7 13.2 12.1l7.3 1.2c3.5.6 5.2 2 5.2 4.1 0 2.8-2.9 5-7.7 5-5.3 0-9.5-2.1-13.4-5.7l-7.2 8.2C18 54 24.8 56.6 32.8 56.6c12.2 0 20.4-6.5 20.4-15.9 0-7.5-4.8-11.7-14.7-13.3l-6.9-1.1c-3.1-.5-4.5-1.6-4.5-3.5 0-2.4 2.5-4.2 6.4-4.2 3.8 0 7.4 1.4 10.8 4.1l7-8.4-5.8-.8Z" fill={`url(#${gradientId})`}/>
      <path d="M13 18.5 25.5 6l5.8 11.6L19.6 30 13 18.5Z" fill="#A47CFF" opacity=".66"/>
    </svg>
  )
}
