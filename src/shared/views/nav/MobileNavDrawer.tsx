'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useBreakpoint } from '@/shared/hooks/useBreakpoint'
import { ModuleNav } from '../ModuleNav'

/**
 * Off-canvas navigation for viewports below `lg`.
 *
 * The desktop chrome (side rail, inline module bar, module sidebar) is
 * desktop-only; this drawer is its mobile counterpart. It mirrors the rail
 * content (`ModuleNav` in sidebar mode, including the datos section tree) and
 * closes on route change, section pick (the datos tree switches tabs without
 * touching the URL), Escape, backdrop click or once the viewport grows past
 * `lg`.
 */
export function MobileNavDrawer({
  open,
  onClose,
  role,
  extraModules = [],
}: {
  open: boolean
  onClose: () => void
  role?: string | null
  extraModules?: string[]
}) {
  const pathname = usePathname()
  const isDesktop = useBreakpoint('lg')
  // framer-motion anima con temporizadores JS que las reglas CSS de
  // `prefers-reduced-motion` no alcanzan: con la preferencia activa el
  // cajón aparece sin deslizamiento ni crossfade (mismo criterio que
  // DatosContent vía MotionConfig).
  const reducirMovimiento = useReducedMotion()
  const panelRef = useRef<HTMLElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const lastPathRef = useRef(pathname)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // close as soon as the route changes (Link clicks inside the drawer)
  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname
      onCloseRef.current()
    }
  }, [pathname])

  // the desktop chrome takes over again above `lg`
  useEffect(() => {
    if (isDesktop && open) onCloseRef.current()
  }, [isDesktop, open])

  // Escape closes, body scroll is locked while open
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // move focus into the dialog on open and give it back on close
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null
      panelRef.current?.focus()
    } else if (returnFocusRef.current) {
      returnFocusRef.current.focus()
      returnFocusRef.current = null
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="nav-movil"
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducirMovimiento ? 0 : 0.2 }}
        >
          <button
            type="button"
            aria-label="Cerrar el menú de navegación"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-emerald-950/70 backdrop-blur-sm"
          />
          <motion.aside
            id="nav-movil"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            tabIndex={-1}
            initial={{ x: reducirMovimiento ? 0 : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: reducirMovimiento ? 0 : '-100%' }}
            transition={{
              duration: reducirMovimiento ? 0 : 0.25,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col border-r border-emerald-950/70 chrome-forest outline-none"
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
              <Link
                href="/dashboard"
                onClick={onClose}
                className="flex min-w-0 items-center gap-3"
              >
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-uv-lime text-[13px] font-bold text-emerald-950 shadow-[0_0_12px_rgba(146,189,36,0.35)]"
                >
                  SIGE
                </span>
                <span className="min-w-0 truncate text-lg font-semibold text-white">
                  SIGE-TdeA
                </span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar el menú"
                title="Cerrar menú"
                className="chrome-btn grid h-10 w-10 shrink-0 place-items-center"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ModuleNav
                role={role ?? null}
                variant="sidebar"
                extraModules={extraModules}
                onNavigate={onClose}
              />
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
