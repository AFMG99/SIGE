'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

/**
 * Data-driven select replacement for long `<select>` lists.
 *
 * Native option popups are drawn by the browser/OS: their geometry cannot be
 * measured or constrained from the page, so on small viewports they can grow
 * past the screen. This listbox renders its own panel (like the country picker
 * in `CountryPhoneInput`) and therefore keeps full control:
 *
 * - it opens below the trigger, flips above when there is not enough room,
 * - it clamps horizontally to the viewport (8px edge),
 * - it caps its height to the free space and scrolls internally,
 * - it is portalled to `<body>` as `position: fixed`, so no `overflow-hidden`
 *   ancestor (scrollable tables included) can clip it, and it re-anchors while
 *   the page or a container scrolls.
 *
 * Short, fixed lists (2–6 static options) should stay native: they cannot
 * overflow and keep the platform's own popup (keyboard, type-ahead, OS look).
 */

export interface ListboxOption {
  value: string
  label: string
  disabled?: boolean
  /** Options sharing a `group` are rendered under a heading, in first-appearance order. */
  group?: string
}

interface ListboxSelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: ListboxOption[]
  /** Rendered as the trigger text when `value` is empty (or not found). */
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
  /** Extra classes for the trigger (call sites pass `.ui-input …`). */
  className?: string
}

/** Distance kept from the viewport edges when clamping the panel. */
const EDGE = 8
/** Gap between trigger and panel. */
const GAP = 4
/** Minimum free space before flipping to the opposite side. */
const FLIP_MIN = 160
/** Tallest the panel is allowed to grow (it scrolls beyond that). */
const MAX_HEIGHT = 320
/** Narrowest the panel is allowed to be (never smaller than the trigger). */
const MIN_WIDTH = 176

interface Panel {
  top: number
  left: number
  ancho: number
  altura: number
}

export function ListboxSelect({
  id,
  value,
  onChange,
  options,
  placeholder = '— Seleccione —',
  disabled = false,
  invalid = false,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
  className = '',
}: ListboxSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [panel, setPanel] = useState<Panel>({
    top: 0,
    left: 0,
    ancho: MIN_WIDTH,
    altura: MAX_HEIGHT,
  })

  const selected = options.find((o) => o.value === value)
  const shown = selected ? selected.label : placeholder

  // Placement: measured against the viewport so the panel never leaves the
  // screen (flip when it does not fit below, clamp horizontally, cap height to
  // the free space). Coordinates are viewport-based because the panel is a
  // fixed-position portal; re-measured on resize and on any scroll so it stays
  // anchored to the trigger.
  useLayoutEffect(() => {
    if (!open) return

    const medir = () => {
      const root = rootRef.current
      if (!root) return
      const r = root.getBoundingClientRect()
      // Trigger scrolled out of view: close instead of floating a panel over
      // nothing (the user can reopen it from its new position).
      if (r.bottom <= 0 || r.top >= window.innerHeight) {
        setOpen(false)
        return
      }
      const espacioAbajo = window.innerHeight - r.bottom - GAP - EDGE
      const espacioArriba = r.top - GAP - EDGE
      const arriba = espacioAbajo < FLIP_MIN && espacioArriba > espacioAbajo
      const espacio = Math.max(0, arriba ? espacioArriba : espacioAbajo)
      const ancho = Math.min(
        Math.max(r.width, MIN_WIDTH),
        Math.max(MIN_WIDTH, window.innerWidth - 2 * EDGE)
      )
      const bordeDcho = Math.max(EDGE, window.innerWidth - ancho - EDGE)
      const altura = Math.min(MAX_HEIGHT, espacio)
      const siguiente: Panel = {
        top: arriba ? r.top - GAP - altura : r.bottom + GAP,
        left: Math.min(Math.max(r.left, EDGE), bordeDcho),
        ancho,
        altura,
      }
      setPanel((prev) =>
        prev.top === siguiente.top &&
        prev.left === siguiente.left &&
        prev.ancho === siguiente.ancho &&
        prev.altura === siguiente.altura
          ? prev
          : siguiente
      )
    }

    medir()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [open])

  // Close on outside click / Escape; move focus into the listbox.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      const dentro =
        (rootRef.current?.contains(e.target as Node) ?? false) ||
        (panelRef.current?.contains(e.target as Node) ?? false)
      if (!dentro) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => {
      const list = listRef.current
      const activo = list?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ;(activo ?? list?.querySelector<HTMLButtonElement>('[role="option"]:not([disabled])'))?.focus()
    }, 0)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  const pick = (option: ListboxOption) => {
    if (option.disabled) return
    onChange(option.value)
    close()
  }

  const handleListKeyDown = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []
    ).filter((b) => !b.disabled)
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        items[Math.min(items.length - 1, i + 1)].focus()
        break
      case 'ArrowUp':
        e.preventDefault()
        items[Math.max(0, i - 1)].focus()
        break
      case 'Home':
        e.preventDefault()
        items[0].focus()
        break
      case 'End':
        e.preventDefault()
        items[items.length - 1].focus()
        break
      case 'Tab':
        close()
        break
    }
  }

  const grupos: { nombre: string | undefined; items: ListboxOption[] }[] = []
  for (const option of options) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.nombre === option.group) ultimo.items.push(option)
    else grupos.push({ nombre: option.group, items: [option] })
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        data-value={value}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={`${className} flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-gray-400 dark:text-gray-500'}`}>
          {shown}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          aria-hidden="true"
          className="shrink-0 text-gray-400"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              top: panel.top,
              left: panel.left,
              width: panel.ancho,
              maxHeight: panel.altura,
            }}
            className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-fade-in dark:border-slate-700 dark:bg-slate-900"
          >
            <ul
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel ?? shown}
              onKeyDown={handleListKeyDown}
              className="min-h-0 flex-1 overflow-y-auto py-1"
            >
              {options.length === 0 && (
                <li role="presentation" className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                  Sin opciones
                </li>
              )}
              {grupos.map((grupo, gi) => (
                <li key={grupo.nombre ?? gi} role="presentation">
                  {grupo.nombre && (
                    <div className="border-b border-gray-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:border-slate-800 dark:text-gray-500">
                      {grupo.nombre}
                    </div>
                  )}
                  {grupo.items.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    data-value={option.value}
                    aria-selected={option.value === value}
                      disabled={option.disabled}
                      onClick={() => pick(option)}
                      className={`focus-ring flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 ${
                        option.value === value
                          ? 'bg-emerald-50/70 font-medium dark:bg-emerald-500/10'
                          : ''
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </div>
  )
}
