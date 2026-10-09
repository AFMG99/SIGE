'use client'

import { useEffect, useState } from 'react'

/** Breakpoints used for chrome decisions (mirrors Tailwind's defaults). */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const MIN_WIDTH: Record<Breakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

/**
 * `true` when the viewport is at least `bp` wide.
 *
 * Starts as `false` on purpose: the chrome is rendered on the server, so a
 * false first value keeps hydration deterministic and the effect flips it as
 * soon as the real width is known.
 */
export function useBreakpoint(bp: Breakpoint): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${MIN_WIDTH[bp]}px)`)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [bp])

  return matches
}
