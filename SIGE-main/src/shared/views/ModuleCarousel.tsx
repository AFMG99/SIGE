'use client'

import Link from 'next/link'
import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/** Real figure of a module, already formatted for display. */
export type EstadisticaModulo = {
  /** Formatted value (only ever fed with server-queried data). */
  valor: string
  etiqueta: string
}

export type TarjetaModulo = {
  id: string
  href: string
  titulo: string
  descripcion: string
  icon: React.ReactNode
  /** Absent when the server has no figure for this module (never invented). */
  estadistica?: EstadisticaModulo | null
  /** Placeholder module: shows the honest «Módulo en construcción» label. */
  enConstruccion?: boolean
}

const INTERVALO_DEFECTO_MS = 6000

/**
 * Home module carousel (S4): one slide per visible module with only real
 * statistics, auto-advance that pauses on hover/focus and is cancelled
 * permanently by the first user interaction, prev/next controls and dots
 * (≥40px touch targets below `lg`), keyboard ←/→ support and
 * `useReducedMotion` ⇒ no animation and manual navigation only.
 */
export function ModuleCarousel({
  modulos,
  intervaloMs = INTERVALO_DEFECTO_MS,
}: {
  modulos: TarjetaModulo[]
  /** Auto-advance period in ms; ≤0 disables it. */
  intervaloMs?: number
}) {
  const reducido = Boolean(useReducedMotion())
  const total = modulos.length
  const [indice, setIndice] = React.useState(0)
  const [manual, setManual] = React.useState(false)
  const [enPausa, setEnPausa] = React.useState(false)

  const i = total > 0 ? ((indice % total) + total) % total : 0
  const actual = total > 0 ? modulos[i] : null
  const automatico =
    total > 1 && intervaloMs > 0 && !reducido && !manual && !enPausa

  React.useEffect(() => {
    if (!automatico) return
    const timer = window.setInterval(() => {
      setIndice((v) => (v + 1) % total)
    }, intervaloMs)
    return () => window.clearInterval(timer)
  }, [automatico, intervaloMs, total])

  const irA = (siguiente: number): void => {
    // The first interaction cancels the auto-advance permanently (S4).
    setManual(true)
    setIndice(((siguiente % total) + total) % total)
  }

  if (total === 0 || actual === null) return null

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Módulos destacados"
      onMouseEnter={() => setEnPausa(true)}
      onMouseLeave={() => setEnPausa(false)}
      onFocus={() => setEnPausa(true)}
      onBlur={(evento) => {
        const destino = evento.relatedTarget
        if (!(destino instanceof Node) || !evento.currentTarget.contains(destino)) {
          setEnPausa(false)
        }
      }}
      onKeyDown={(evento) => {
        if (evento.key === 'ArrowLeft') {
          evento.preventDefault()
          irA(i - 1)
        } else if (evento.key === 'ArrowRight') {
          evento.preventDefault()
          irA(i + 1)
        }
      }}
      className="ui-panel p-4 sm:p-6"
    >
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={actual.id}
            initial={reducido ? false : { opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducido ? { opacity: 1 } : { opacity: 0, x: -32 }}
            transition={{ duration: reducido ? 0 : 0.25, ease: 'easeOut' }}
          >
            <Link
              href={actual.href}
              className="group focus-ring flex min-h-10 flex-col gap-3 rounded-xl sm:flex-row sm:items-center sm:gap-5"
            >
              <span
                aria-hidden
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
              >
                {actual.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="ui-title block text-lg">{actual.titulo}</span>
                <span className="mt-1 block text-sm ui-muted">
                  {actual.descripcion}
                </span>
              </span>
              <span className="flex items-center gap-3 sm:justify-end">
                {actual.enConstruccion ? (
                  <span className="inline-flex rounded-md bg-uv-mid/25 px-2 py-0.5 text-xs font-semibold text-uv-ink/70 dark:bg-slate-700 dark:text-slate-300">
                    Módulo en construcción
                  </span>
                ) : actual.estadistica ? (
                  <span className="block text-right">
                    <span className="block text-xl font-semibold tabular-nums">
                      {actual.estadistica.valor}
                    </span>
                    <span className="block text-xs ui-muted">
                      {actual.estadistica.etiqueta}
                    </span>
                  </span>
                ) : null}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="shrink-0 text-gray-300 transition-colors group-hover:text-emerald-600 dark:text-slate-600 dark:group-hover:text-emerald-400"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Elegir módulo"
          className="flex items-center gap-1"
        >
          {modulos.map((m, k) => (
            <button
              key={m.id}
              type="button"
              aria-label={`Ir al módulo ${m.titulo}`}
              aria-current={k === i ? 'true' : undefined}
              onClick={() => irA(k)}
              className="grid h-10 w-10 place-items-center rounded-lg focus-ring"
            >
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full ${
                  k === i
                    ? 'bg-uv-forest dark:bg-uv-soft'
                    : 'bg-uv-mid dark:bg-slate-600'
                }`}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xs tabular-nums ui-muted">
            {i + 1} / {total}
          </span>
          <button
            type="button"
            aria-label="Módulo anterior"
            onClick={() => irA(i - 1)}
            className="ui-btn ui-btn-ghost ui-btn-sm min-h-10 min-w-10"
          >
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
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Módulo siguiente"
            onClick={() => irA(i + 1)}
            className="ui-btn ui-btn-ghost ui-btn-sm min-h-10 min-w-10"
          >
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
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
