'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ModuleNav } from './ModuleNav'
import type { HeaderPos } from './nav/NavContext'
import { MobileNavDrawer } from './nav/MobileNavDrawer'
import { useBreakpoint } from '@/shared/hooks/useBreakpoint'
import { toggleTheme, getCurrentTheme } from '@/shared/utils/theme'
import { Avatar } from './ui/Avatar'
import { DropdownMenu } from './ui/DropdownMenu'
import {
  IconBell,
  IconShield,
  IconSun,
  IconUser,
} from '@/features/users/views/settings/settingsIcons'

export type { HeaderPos }

/** Identity carried from the server session into the header's account menu. */
export interface HeaderAccount {
  name: string | null
  email: string
  avatarUrl?: string | null
}

// ==========================================
// Post-login header: brand + module nav + theme toggle + account menu.
// Modes:
//  - center (normal): full-width top bar, h-64px
//  - left/right SIDEBAR: full-height, rectangular, attached to the edge
//      · collapsed RAIL (64px): icons only
//      · expands to 220px on hover / press-and-hold / keyboard focus
// Interaction:
//  - drag freely → snaps to nearest zone (left/center/right) on release
//    (a drag only arms after the pointer is held for HOLD_MS)
//  - ⇄ button cycles the three positions
//  - pin button (panel-left-close / panel-left-open) locks the sidebar open
//    or releases it back to hover behaviour — hidden while in center
//  - position + pin persist in localStorage (uv-header-pos / uv-sidebar-pinned)
// Responsive (breakpoint `lg` = 1024px):
//  - below `lg` the chrome is mobile: the header is always the top bar, the
//    rail/drag/cycle controls are off (the saved position is kept for when the
//    viewport grows back) and the module nav moves into MobileNavDrawer
// Mounted via DashboardShell in dashboard/layout → only after login.
// ==========================================

export const SIDEBAR_W = 220
export const RAIL_W = 64
const BAR_H = 64
const STORAGE_KEY = 'uv-header-pos'
const PIN_KEY = 'uv-sidebar-pinned'
/** Pointer must be held this long before a drag arms. */
const HOLD_MS = 2000

const TRANSITION =
  'left 0.3s cubic-bezier(0.22,1,0.36,1), width 0.3s cubic-bezier(0.22,1,0.36,1), height 0.3s cubic-bezier(0.22,1,0.36,1)'

export function DashboardHeader({
  onPosChange,
  onSidebarWidth,
  role,
  extraModules = [],
  account = null,
}: {
  onPosChange?: (p: HeaderPos) => void
  onSidebarWidth?: (w: number) => void
  /** Current user role (from DB) — drives the module nav visibility. */
  role?: string | null
  /** Module IDs granted via temporary overrides. */
  extraModules?: string[]
  /** Logged-in identity — drives the avatar trigger and the account menu. */
  account?: HeaderAccount | null
}) {
  const router = useRouter()
  const [pos, setPos] = useState<HeaderPos>('center')
  /** Below `lg` the desktop chrome (rail, drag, inline module nav) is off. */
  const isDesktop = useBreakpoint('lg')
  /** Off-canvas navigation drawer (mobile counterpart of the module nav). */
  const [menuOpen, setMenuOpen] = useState(false)
  /** Position actually rendered: the saved one on desktop, always the bar below `lg`. */
  const effectivePos: HeaderPos = isDesktop ? pos : 'center'
  const [expanded, setExpanded] = useState(false)
  /** Sidebar locked open (survives pointer-leave / blur / navigation). */
  const [pinned, setPinned] = useState(false)
  const [vw, setVw] = useState(0)
  const [vh, setVh] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [dragLeft, setDragLeft] = useState(0)
  const [ready, setReady] = useState(false)
  const [dark, setDark] = useState(false)

  // Sync the toggle icon with the theme applied by the layout script.
  useEffect(() => {
    setDark(getCurrentTheme() === 'dark')
  }, [])

  const handleThemeToggle = () => {
    toggleTheme()
    setDark(getCurrentTheme() === 'dark')
  }

  /** Submits the (hidden) logout form kept next to the trigger. */
  const logoutFormRef = useRef<HTMLFormElement>(null)

  const goToSettingsTab = (tab: string) =>
    router.push(`/dashboard/configuracion?tab=${tab}`)

  const headerRef = useRef<HTMLElement>(null)
  const posRef = useRef<HeaderPos>('center')
  const draggingRef = useRef(false)
  const offsetRef = useRef(0)
  const dragLeftRef = useRef(0)
  const timersRef = useRef<{ ready?: number; resize?: number }>({})
  const onPosRef = useRef(onPosChange)
  const onRailWRef = useRef(onSidebarWidth)
  const pendingRef = useRef<{ pointerId: number; clientX: number } | null>(
    null
  )
  const holdTimerRef = useRef<number | undefined>(undefined)
  const movedRef = useRef(false)
  /** 3s hold elapsed, but the header has not visually detached yet. */
  const armedRef = useRef(false)
  const hoverRef = useRef(false)
  /** Ref mirror of `pinned` so event handlers never read a stale value. */
  const pinnedRef = useRef(false)

  useEffect(() => {
    onPosRef.current = onPosChange
  }, [onPosChange])
  useEffect(() => {
    onRailWRef.current = onSidebarWidth
  }, [onSidebarWidth])

  const setDrag = useCallback((v: number) => {
    const max = Math.max(0, window.innerWidth - SIDEBAR_W)
    const clamped = Math.min(Math.max(v, 0), max)
    dragLeftRef.current = clamped
    setDragLeft(clamped)
  }, [])

  const applyPos = useCallback((c: HeaderPos, persist = true) => {
    posRef.current = c
    setPos(c)
    // the shell is notified from the effect below, so it always receives the
    // rendered position (`effectivePos`) instead of the saved one
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, c)
      } catch {
        /* position just won't persist */
      }
    }
  }, [])

  /** Pin the sidebar open (true) or release it to hover behaviour (false). */
  const applyPinned = useCallback((next: boolean, persist = true) => {
    pinnedRef.current = next
    setPinned(next)
    if (persist) {
      try {
        localStorage.setItem(PIN_KEY, next ? '1' : '0')
      } catch {
        /* pin just won't persist */
      }
    }
  }, [])

  // restore saved position + viewport tracking
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(STORAGE_KEY)
    } catch {
      /* storage unavailable */
    }
    const initial: HeaderPos =
      saved === 'left' || saved === 'right' ? saved : 'center'
    setVw(window.innerWidth)
    setVh(window.innerHeight)
    applyPos(initial, false)

    let savedPin: string | null = null
    try {
      savedPin = localStorage.getItem(PIN_KEY)
    } catch {
      /* storage unavailable */
    }
    applyPinned(savedPin === '1', false)

    const onResize = () => {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
      setReady(false)
      window.clearTimeout(timersRef.current.resize)
      timersRef.current.resize = window.setTimeout(() => setReady(true), 150)
    }
    window.addEventListener('resize', onResize)
    timersRef.current.ready = window.setTimeout(() => setReady(true), 100)

    return () => {
      window.removeEventListener('resize', onResize)
      window.clearTimeout(timersRef.current.ready)
      window.clearTimeout(timersRef.current.resize)
    }
  }, [applyPos, applyPinned])

  // sidebar is open when pinned OR temporarily expanded (hover / focus / press)
  const isOpen = expanded || pinned

  // tell the shell which position is rendered and how much horizontal padding
  // the sidebar needs — below `lg` it is always the plain top bar
  useEffect(() => {
    onPosRef.current?.(effectivePos)
    onRailWRef.current?.(
      effectivePos === 'center' ? 0 : isOpen ? SIDEBAR_W : RAIL_W
    )
  }, [effectivePos, isOpen])

  /** Cycle: left → center (normal bar) → right → left */
  const cycle = useCallback(() => {
    const cur = posRef.current
    applyPos(cur === 'left' ? 'center' : cur === 'center' ? 'right' : 'left')
  }, [applyPos])

  /** Pin open ↔ release; releasing also collapses the sidebar right away. */
  const togglePin = useCallback(() => {
    const next = !pinnedRef.current
    applyPinned(next)
    if (!next) setExpanded(false)
  }, [applyPinned])

  // ---- expand on hover / press / keyboard focus (sidebar only) ----
  const expand = useCallback(() => setExpanded(true), [])
  const collapse = useCallback(() => {
    // a pinned sidebar never auto-collapses
    if (pinnedRef.current) return
    setExpanded(false)
  }, [])

  // ---- pointer drag (arms only after a 3s hold) ----
  const beginDrag = useCallback((clientX: number) => {
    const fromCenter = posRef.current === 'center'
    const curLeft =
      posRef.current === 'right'
        ? Math.max(0, window.innerWidth - SIDEBAR_W)
        : 0
    // from the bar: the sidebar appears centred under the pointer
    const startLeft = fromCenter
      ? clientX - SIDEBAR_W / 2
      : clientX - curLeft
    offsetRef.current = clientX - startLeft
    armedRef.current = true
    movedRef.current = false
    setDrag(startLeft)
    // setDragging(true) is deferred to the first move after arming so a
    // still-held pointer never visually detaches the header.
  }, [setDrag])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // the rail/hold-to-drag interaction only exists on desktop: below `lg`
      // there is nothing to expand or detach, so taps go straight to the links
      if (!isDesktop) return
      // the pin controls swap the rail layout: expanding on pointerdown would
      // unmount them before `click` fires, so they opt out of the hold-expand.
      // Everything else (nav links, logout, cycle) keeps expanding on press.
      if ((e.target as HTMLElement).closest('[data-no-expand]')) return
      expand() // press-and-hold → expanded (touch)
      if ((e.target as HTMLElement).closest('[data-no-drag]')) return
      const el = headerRef.current
      if (!el) return
      pendingRef.current = { pointerId: e.pointerId, clientX: e.clientX }
      el.setPointerCapture(e.pointerId)
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = window.setTimeout(() => {
        if (pendingRef.current) beginDrag(pendingRef.current.clientX)
      }, HOLD_MS)
    },
    [isDesktop, expand, beginDrag]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // before the 3s hold elapses: track the pointer, never move
      if (!armedRef.current) {
        if (pendingRef.current) pendingRef.current.clientX = e.clientX
        return
      }
      if (!draggingRef.current) {
        // first movement after arming → the header actually detaches
        draggingRef.current = true
        setDragging(true)
      }
      movedRef.current = true
      setDrag(e.clientX - offsetRef.current)
    },
    [setDrag]
  )

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      window.clearTimeout(holdTimerRef.current)
      pendingRef.current = null
      armedRef.current = false
      const el = headerRef.current
      if (el && el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId)
      }
      if (!draggingRef.current) return
      draggingRef.current = false
      setDragging(false)
      // armed but never moved (or held still for the full 3s) → keep the old position
      if (!movedRef.current) return
      const cx = dragLeftRef.current + SIDEBAR_W / 2
      const zoneVw = window.innerWidth
      const c: HeaderPos =
        cx < zoneVw / 3 ? 'left' : cx > (zoneVw * 2) / 3 ? 'right' : 'center'
      applyPos(c)
    },
    [applyPos]
  )

  // clear the pending hold timer on unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(holdTimerRef.current)
    }
  }, [])

  // ---- geometry (all px → clean transitions) ----
  const isBar = !dragging && effectivePos === 'center'
  const rail = !dragging && effectivePos !== 'center' && !isOpen
  const activeW = isOpen ? SIDEBAR_W : RAIL_W

  let left: number
  let width: number | string
  let height: number | string

  if (dragging) {
    left = dragLeft
    width = SIDEBAR_W
    height = vh || '100vh'
  } else if (effectivePos === 'center') {
    left = 0
    width = vw ? vw : '100%'
    height = BAR_H
  } else {
    left =
      effectivePos === 'left' ? 0 : Math.max(0, (vw || SIDEBAR_W * 2) - activeW)
    width = activeW
    height = vh || '100vh'
  }

  const borderCls = dragging
    ? 'border border-emerald-950/70 shadow-xl'
    : effectivePos === 'left'
      ? 'border-r border-emerald-950/70'
      : effectivePos === 'right'
        ? 'border-l border-emerald-950/70'
        : 'border-b border-emerald-950/70'

  return (
    <>
      <header
        ref={headerRef}
        aria-label="Encabezado del panel"
        className={`fixed top-0 z-40 chrome-forest select-none ${borderCls}`}
        style={{
          left,
          top: 0,
          width,
          height,
          transition: dragging || !ready ? 'none' : TRANSITION,
          cursor: dragging ? 'grabbing' : isDesktop ? 'grab' : 'default',
          touchAction: 'none',
        }}
        onPointerEnter={() => {
          hoverRef.current = true
          expand()
        }}
        onPointerLeave={() => {
          hoverRef.current = false
          collapse()
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onFocusCapture={expand}
        onBlurCapture={(e) => {
          if (
            !hoverRef.current &&
            !e.currentTarget.contains(e.relatedTarget as Node | null)
          ) {
            collapse()
          }
        }}
      >
        <div
          className={
            isBar
              ? 'mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8'
              : 'flex h-full w-full flex-col justify-between gap-4 p-4'
          }
        >
          {/* title / brand — the pin control lives here, never in center */}
          {isBar ? (
            <h1 className="whitespace-nowrap text-xl font-semibold text-white">
              SIGE-TdeA
            </h1>
          ) : (
            <div className="flex items-center gap-3">
              {rail ? (
                // collapsed: the brand symbol itself becomes the expand toggle
                <button
                  type="button"
                  data-no-drag
                  data-no-expand
                  onClick={togglePin}
                  aria-label="Anclar y expandir la barra lateral"
                  title="Anclar barra"
                  className="group grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-transparent bg-uv-lime text-[13px] font-bold text-emerald-950 shadow-[0_0_12px_rgba(146,189,36,0.35)] transition-colors hover:border-uv-lime/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-uv-lime"
                >
                  <span aria-hidden className="group-hover:hidden">
                    SIGE
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    className="hidden group-hover:block"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                    <path d="m14 9 3 3-3 3" />
                  </svg>
                </button>
              ) : (
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-uv-lime text-[13px] font-bold text-emerald-950 shadow-[0_0_12px_rgba(146,189,36,0.35)]"
                >
                  SIGE
                </span>
              )}
              {!rail && (
                <span className="min-w-0 truncate text-lg font-semibold leading-snug text-white">
                  SIGE-TdeA
                </span>
              )}
              {/* collapse control sits right next to the project name */}
              {!rail && effectivePos !== 'center' && (
                <button
                  type="button"
                  data-no-drag
                  data-no-expand
                  onClick={togglePin}
                  aria-label="Desanclar y contraer la barra lateral"
                  title="Contraer barra"
                  className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-none border border-white/15 bg-white/10 text-emerald-50 transition-colors hover:border-white/30 hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-uv-lime"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                    <path d="m16 15-3-3 3-3" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* module navigation — middle child in all modes */}
          <ModuleNav
            role={role ?? null}
            variant={isBar ? 'bar' : rail ? 'rail' : 'sidebar'}
            extraModules={extraModules}
          />

          <div
            className={`flex ${
              isBar ? 'items-center gap-2' : 'w-full flex-col gap-2'
            }`}
            data-no-drag
          >
            {/* mobile navigation: the module bar becomes a drawer below `lg` */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir el menú de navegación"
              aria-expanded={menuOpen}
              aria-controls="nav-movil"
              title="Menú"
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-none border border-white/15 bg-white/10 text-emerald-50 transition-colors hover:border-white/30 hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-uv-lime lg:hidden"
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
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>

            {/* theme toggle: light ↔ dark (persisted in localStorage) */}
            <button
              type="button"
              onClick={handleThemeToggle}
              aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              title={dark ? 'Tema claro' : 'Tema oscuro'}
              className={`cursor-pointer items-center justify-center gap-2 rounded-none border border-white/15 bg-white/10 text-emerald-50 transition-colors hover:border-white/30 hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-uv-lime ${
                isBar
                  ? 'grid h-10 w-10 lg:h-8 lg:w-8'
                  : rail
                    ? 'flex h-8 w-full'
                    : 'flex w-full px-4 py-2.5 text-sm'
              }`}
            >
              {dark ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
              <span className={rail || isBar ? 'hidden' : 'whitespace-nowrap'}>
                {dark ? 'Tema claro' : 'Tema oscuro'}
              </span>
            </button>

            {/* account menu: avatar trigger → settings sections + logout */}
            {account && (
              <DropdownMenu
                align="right"
                header={
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={account.name}
                      email={account.email}
                      src={account.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {account.name?.trim() || account.email}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {account.email}
                      </p>
                    </div>
                  </div>
                }
                trigger={
                  <button
                    type="button"
                    data-no-expand
                    aria-label="Menú de cuenta"
                    title="Menú de cuenta"
                    className={`cursor-pointer items-center gap-1.5 border border-white/15 bg-white/10 text-emerald-50 transition-colors hover:border-white/30 hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-uv-lime ${
                      isBar
                        ? 'flex h-10 pr-2 lg:h-8'
                        : rail
                          ? 'flex h-8 w-full justify-center'
                          : 'flex w-full px-3 py-2.5'
                    }`}
                  >
                    <Avatar
                      name={account.name}
                      email={account.email}
                      src={account.avatarUrl}
                      size="sm"
                    />
                    {!rail && (
                      <>
                        {isBar ? null : (
                          <span className="min-w-0 flex-1 truncate text-left text-sm">
                            {account.name?.trim() || account.email}
                          </span>
                        )}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                          className="shrink-0 opacity-80"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </>
                    )}
                  </button>
                }
                items={[
                  {
                    label: 'Perfil',
                    icon: <IconUser width={16} height={16} />,
                    onClick: () => goToSettingsTab('perfil'),
                  },
                  {
                    label: 'Apariencia',
                    icon: <IconSun width={16} height={16} />,
                    onClick: () => goToSettingsTab('apariencia'),
                  },
                  {
                    label: 'Seguridad',
                    icon: <IconShield width={16} height={16} />,
                    onClick: () => goToSettingsTab('seguridad'),
                  },
                  {
                    label: 'Notificaciones',
                    icon: <IconBell width={16} height={16} />,
                    onClick: () => goToSettingsTab('notificaciones'),
                  },
                  {
                    label: 'Cerrar sesión',
                    variant: 'destructive' as const,
                    icon: (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    ),
                    onClick: () => logoutFormRef.current?.requestSubmit(),
                  },
                ]}
              />
            )}
            <form ref={logoutFormRef} action="/api/auth/logout" method="POST" hidden />

            {/* position cycle: left → normal bar → right */}
            <button
              type="button"
              onClick={cycle}
              aria-label="Cambiar la posición del encabezado (izquierda, centro, derecha)"
              title="Cambiar posición"
              className={`cursor-pointer items-center justify-center gap-2 rounded-none border border-white/15 bg-white/10 text-emerald-50 transition-colors hover:border-white/30 hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-uv-lime ${
                isBar
                  ? 'hidden lg:grid h-8 w-8'
                  : rail
                    ? 'flex h-8 w-full'
                    : 'flex w-full px-4 py-2.5 text-sm'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M2 5h9M8.5 2.5 11 5 8.5 7.5M14 11H5M7.5 8.5 5 11l2.5 2.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className={rail || isBar ? 'hidden' : 'whitespace-nowrap'}
              >
                Mover encabezado
              </span>
            </button>
          </div>
        </div>
      </header>
      <MobileNavDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        role={role ?? null}
        extraModules={extraModules}
      />
    </>
  )
}
