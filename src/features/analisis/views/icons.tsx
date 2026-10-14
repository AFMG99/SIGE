import type { SVGProps } from 'react'

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconResumen(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IconComparativo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20v-6" />
      <path d="M10 20V6" />
      <path d="M16 20v-9" />
      <path d="M21 20H3" />
    </svg>
  )
}

export function IconPatrones(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-6 4 3 5-8" />
      <circle cx="11" cy="9" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconAhorros(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M15 9.5a3 2.5 0 0 0-3-1.5c-1.7 0-3 .9-3 2.2 0 2.8 6 1.5 6 4.2 0 1.3-1.3 2.3-3 2.3a3 2.5 0 0 1-3-1.5" />
    </svg>
  )
}
