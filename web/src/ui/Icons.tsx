/**
 * Hand-drawn inline SVG icons. No icon package: five glyphs are not worth a
 * dependency. Each is `aria-hidden` — the accessible name lives on the button
 * that wraps it.
 */

interface IconProps {
  readonly size?: number
}

function svgProps(size: number): {
  width: number
  height: number
  viewBox: string
  'aria-hidden': true
  focusable: 'false'
  fill: 'none'
} {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
    focusable: 'false',
    fill: 'none',
  }
}

export function MenuIcon({ size = 24 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" />
        <line x1="3.5" y1="12" x2="20.5" y2="12" />
        <line x1="3.5" y1="17.5" x2="20.5" y2="17.5" />
      </g>
    </svg>
  )
}

/** Three ascending bars — the Progress affordance. */
export function BarChartIcon({ size = 24 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <g fill="currentColor">
        <rect x="3.4" y="13.4" width="4.3" height="8.2" rx="1.1" />
        <rect x="9.85" y="8.3" width="4.3" height="13.3" rx="1.1" />
        <rect x="16.3" y="4.5" width="4.3" height="17.1" rx="1.1" />
      </g>
    </svg>
  )
}

export function BackIcon({ size = 24 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="20" y1="12" x2="4.5" y2="12" />
        <polyline points="11,5 4,12 11,19" />
      </g>
    </svg>
  )
}

export function RefreshIcon({ size = 24 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12a8 8 0 1 1-2.6-5.9" />
        <polyline points="20,3 20,8 15,8" />
      </g>
    </svg>
  )
}

export function InfoIcon({ size = 24 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="11" x2="12" y2="16.5" />
        <line x1="12" y1="7.6" x2="12" y2="7.7" />
      </g>
    </svg>
  )
}

export function CloseIcon({ size = 24 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </g>
    </svg>
  )
}
