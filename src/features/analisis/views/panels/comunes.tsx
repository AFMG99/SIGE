import React from 'react'
import {
  formatoNumero,
  formatoPct,
  etiquetaPeriodo,
  TEXTO_CALENDARIO,
  type PeriodoAnalizado,
} from '../../models/analisis'
import { trazarSparkline, type SerieXm } from '../../models/xm'

/**
 * Piezas visuales compartidas por los submódulos del análisis
 * (Resumen · Comparativo · Patrones · Ahorros). Extraídas del antiguo
 * AnalisisView monolítico sin cambiar markup ni clases.
 */

export const CLASE_BADGE =
  'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium'

export function BadgeCalendario({ periodo }: { periodo: PeriodoAnalizado }) {
  const clases =
    periodo.calendario === 'lectivo'
      ? 'border-emerald-600/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
      : periodo.calendario === 'vacaciones'
        ? 'border-sky-600/40 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300'
        : 'border-gray-300 bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
  return (
    <span className={`${CLASE_BADGE} ${clases}`}>
      {TEXTO_CALENDARIO[periodo.calendario]}
      {typeof periodo.dias_lectivos === 'number' ? ` · ${periodo.dias_lectivos} d` : ''}
    </span>
  )
}

/**
 * Chip de icono de las tarjetas KPI. Decorativo (aria-hidden): la etiqueta
 * de al lado carga el significado, el icono solo da jerarquía visual.
 */
export function ChipIcon({ children, amber = false }: { children: React.ReactNode; amber?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md p-1.5 ${
        amber
          ? 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
          : 'bg-emerald-600/10 text-uv-forest dark:bg-emerald-500/15 dark:text-emerald-400'
      }`}
      aria-hidden
    >
      {children}
    </span>
  )
}

export const ATRIBUTOS_ICONO = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Encabezado estándar de sección: título a la izquierda, meta a la derecha. */
export function SeccionTitulo({
  id,
  titulo,
  meta,
}: {
  id?: string
  titulo: string
  meta?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 id={id} className="ui-title text-sm">
        {titulo}
      </h3>
      {meta != null && <div className="ui-muted text-xs">{meta}</div>}
    </div>
  )
}

/** ISO de la consulta → 'dd/mm/aaaa' en la zona local del navegador. */
export function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  const dia = String(fecha.getDate()).padStart(2, '0')
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${fecha.getFullYear()}`
}

export function periodoDe(periodo: string): { mes: number; anio: number } {
  return { anio: Number(periodo.slice(0, 4)), mes: Number(periodo.slice(5, 7)) }
}

/**
 * Tarjeta de una serie XM: demanda mensual, índice base 100,
 * variación interanual y sparkline de 13 meses.
 */
export function TarjetaSerieXm({
  serie,
  advertencias,
}: {
  serie: SerieXm
  advertencias: string[]
}) {
  const primero = serie.puntos[0]
  const ultimo = serie.puntos[serie.puntos.length - 1]
  if (!primero || !ultimo) return null
  const base = periodoDe(primero.periodo)
  const tope = periodoDe(ultimo.periodo)
  const colorVariacion =
    serie.variacionInteranual === null
      ? 'text-gray-500 dark:text-gray-400'
      : serie.variacionInteranual > 0
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-emerald-700 dark:text-emerald-300'
  return (
    <div className="ui-card-stat">
      <p className="ui-muted text-xs">{serie.nombre}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {formatoNumero(ultimo.kwh / 1_000_000, 1)}{' '}
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">GWh/mes</span>
      </p>
      <p className="ui-muted mt-1 text-xs">
        {etiquetaPeriodo(tope.mes, tope.anio)} · base 100 ={' '}
        {etiquetaPeriodo(base.mes, base.anio)}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium tabular-nums">
            Índice {formatoNumero(ultimo.indice, 1)}
          </p>
          <p className={`text-sm font-medium tabular-nums ${colorVariacion}`}>
            Interanual{' '}
            {serie.variacionInteranual === null
              ? '—'
              : formatoPct(serie.variacionInteranual)}
          </p>
        </div>
        <svg
          width={132}
          height={40}
          viewBox="0 0 132 40"
          role="img"
          aria-label={`Índice de ${serie.nombre}: base 100 en ${etiquetaPeriodo(base.mes, base.anio)} y ${formatoNumero(ultimo.indice, 1)} en ${etiquetaPeriodo(tope.mes, tope.anio)}`}
          className="shrink-0 text-uv-forest"
        >
          <polyline
            points={trazarSparkline(serie.puntos)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {advertencias.map((advertencia) => (
        <p key={advertencia} className="ui-callout ui-callout-info mt-3">
          {advertencia}
        </p>
      ))}
    </div>
  )
}
