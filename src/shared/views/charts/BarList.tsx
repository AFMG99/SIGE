'use client'

/**
 * BarList — barras horizontales con etiqueta, valor y delta (estilo «pipeline
 * stages» del dashboard de referencia). HTML+CSS puro, sin SVG ni librerías.
 *
 * Semántica de color: delta positivo usa `uv-forest`/`uv-soft` (acciones y
 * texto verde); negativo usa rose explícito. Nunca `emerald-500`/`uv-lime`
 * en contenido (regla dura de AGENTS.md).
 */
import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import type { ColorSerie } from './SeriesChart'

const RELLENOS: Record<ColorSerie, string> = {
  forest: 'bg-uv-forest dark:bg-uv-soft',
  sky: 'bg-uv-sky dark:bg-sky-400',
  purple: 'bg-uv-purple dark:bg-violet-400',
  turquoise: 'bg-uv-turquoise dark:bg-teal-400',
  deep: 'bg-uv-deep dark:bg-sky-300',
  yellow: 'bg-yellow-600 dark:bg-uv-yellow',
}

const ORDEN_COLORES: ColorSerie[] = ['forest', 'sky', 'purple', 'turquoise', 'deep']

const fmtDefecto = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export type DatoBarra = {
  clave: string
  etiqueta: string
  valor: number
  /** Texto ya formateado del valor; si falta se usa `formatoValor`. */
  textoValor?: string
  /** Delta en % contra la referencia del período anterior; null = sin Δ. */
  delta?: number | null
  color?: ColorSerie
}

export type BarListProps = {
  datos: readonly DatoBarra[]
  /** Nombre accesible de la lista (aria-label del <ul>). */
  titulo: string
  /** % de la barra más grande (default: el mayor de los datos = 100 %). */
  maximo?: number
  formatoValor?: (valor: number) => string
  formatoDelta?: (valor: number) => string
  vacio?: string
}

const fmtDelta = (v: number): string => {
  const signo = v < 0 ? '−' : '+'
  return `${signo}${fmtDefecto.format(Math.abs(v))} %`
}

export function BarList({
  datos,
  titulo,
  maximo,
  formatoValor = (v) => fmtDefecto.format(v),
  formatoDelta = fmtDelta,
  vacio = 'Sin datos para mostrar',
}: BarListProps) {
  const reducir = useReducedMotion()

  if (datos.length === 0) {
    return (
      <div className="ui-empty" role="status">
        <p>{vacio}</p>
      </div>
    )
  }

  const tope = maximo ?? Math.max(...datos.map((d) => d.valor), Number.EPSILON)

  return (
    <ul aria-label={titulo} className="space-y-3">
      {datos.map((d, i) => {
        const color = d.color ?? ORDEN_COLORES[i % ORDEN_COLORES.length]
        const pct = tope > 0 ? Math.max(0, (d.valor / tope) * 100) : 0
        const delta = typeof d.delta === 'number' && Number.isFinite(d.delta) ? d.delta : null
        return (
          <li key={d.clave} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium text-uv-ink dark:text-slate-200">
                {d.etiqueta}
              </span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-sm font-semibold text-uv-ink dark:text-slate-100">
                  {d.textoValor ?? formatoValor(d.valor)}
                </span>
                {delta !== null ? (
                  <span
                    className={`text-xs font-medium ${
                      delta < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-uv-forest dark:text-uv-soft'
                    }`}
                  >
                    <span aria-hidden="true">{delta < 0 ? '▼' : '▲'}</span>{' '}
                    {formatoDelta(delta)}
                  </span>
                ) : null}
              </span>
            </div>
            <div
              role="meter"
              aria-label={d.etiqueta}
              aria-valuenow={d.valor}
              aria-valuemin={0}
              aria-valuemax={tope}
              className="h-2.5 overflow-hidden rounded-full bg-uv-mid/25 dark:bg-slate-700"
            >
              <motion.div
                className={`h-full rounded-full ${RELLENOS[color]}`}
                initial={reducir ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 * i }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
