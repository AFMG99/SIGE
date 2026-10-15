'use client'

/**
 * SeriesChart — gráfico SVG de 1–3 series (área/línea) sin librerías externas.
 *
 * Calidad de biblioteca (S5): curvas cúbicas monotonas (sin sobrepasar los
 * datos), gradiente de relleno, gridlines discretas, crosshair con tooltip,
 * leyenda interactiva (toggle), navegación por teclado, vacío explícito y
 * animación que respeta `prefers-reduced-motion` (vía `useReducedMotion`).
 *
 * Colores: tokens `uv-*` de la marca (nunca `emerald-500` en contenido).
 * Unidades: el viewBox es 720×alto y el SVG escala a `w-full`.
 */
import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import {
  caminoMonotono,
  limitesSerie,
  puntosTramo,
  ticksBonitos,
  tramosContinuos,
} from './curvas'

export type ColorSerie = 'forest' | 'sky' | 'purple' | 'turquoise' | 'deep' | 'yellow'

/** Tinta por color: trazo + relleno con variante dark explícita. */
const TINTAS: Record<ColorSerie, { trazo: string; relleno: string }> = {
  forest: { trazo: 'stroke-uv-forest dark:stroke-uv-soft', relleno: 'fill-uv-forest dark:fill-uv-soft' },
  sky: { trazo: 'stroke-uv-sky dark:stroke-sky-400', relleno: 'fill-uv-sky dark:fill-sky-400' },
  purple: { trazo: 'stroke-uv-purple dark:stroke-violet-400', relleno: 'fill-uv-purple dark:fill-violet-400' },
  turquoise: { trazo: 'stroke-uv-turquoise dark:stroke-teal-400', relleno: 'fill-uv-turquoise dark:fill-teal-400' },
  deep: { trazo: 'stroke-uv-deep dark:stroke-sky-300', relleno: 'fill-uv-deep dark:fill-sky-300' },
  yellow: { trazo: 'stroke-yellow-600 dark:stroke-uv-yellow', relleno: 'fill-yellow-600 dark:fill-uv-yellow' },
}

/** Orden por defecto de colores cuando el llamador no asigna uno. */
const ORDEN_COLORES: ColorSerie[] = ['forest', 'sky', 'purple']

export type SerieGrafica = {
  clave: string
  nombre: string
  /** Valor por punto; null/undefined = hueco (la línea se troza, no inventa). */
  valores: readonly (number | null | undefined)[]
  /** `area` dibuja relleno degradado bajo la curva; `linea` solo el trazo. */
  tipo?: 'area' | 'linea'
  color?: ColorSerie
}

export type SeriesChartProps = {
  /** Etiqueta de cada punto del eje X (mismo largo que las series). */
  etiquetas: readonly string[]
  series: readonly SerieGrafica[]
  /** Nombre accesible del gráfico (role="img" + <title>). */
  titulo: string
  /** Formato numérico del tooltip eje Y (default: es-CO, 1 decimal). */
  formatoValor?: (valor: number) => string
  /** Alto del área de trazado en unidades del viewBox (default 220). */
  altoGrafica?: number
  /** Ancla el piso del eje Y en 0. */
  desdeCero?: boolean
  /** Texto del estado vacío (cuando ninguna serie tiene datos). */
  sinDatos?: string
}

const ANCHO = 720
const M = { arriba: 14, derecha: 14, abajo: 34, izquierda: 60 }
const ALTO_DEFECTO = 220

const fmtDefecto = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

/** Etiqueta corta de eje: máximo 8 marcas + la última siempre visible. */
function pasoEtiquetas(cantidad: number): number {
  return Math.max(1, Math.ceil(cantidad / 8))
}

export function SeriesChart({
  etiquetas,
  series,
  titulo,
  formatoValor = (v) => fmtDefecto.format(v),
  altoGrafica = ALTO_DEFECTO,
  desdeCero = false,
  sinDatos = 'Sin datos para mostrar',
}: SeriesChartProps) {
  const reducir = useReducedMotion()
  const [ocultas, setOcultas] = React.useState<string[]>([])
  const [activo, setActivo] = React.useState<number | null>(null)
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const idGradiente = React.useId()

  const visibles = series.filter((s) => !ocultas.includes(s.clave))
  const totalPuntos = etiquetas.length
  const hayDatos = visibles.some((s) =>
    s.valores.some((v) => typeof v === 'number' && Number.isFinite(v))
  )

  const colorDe = (indice: number, serie: SerieGrafica): ColorSerie =>
    serie.color ?? ORDEN_COLORES[indice % ORDEN_COLORES.length]

  function alternar(clave: string) {
    setOcultas((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]
    )
  }

  if (!hayDatos || totalPuntos === 0) {
    return (
      <div className="ui-empty" role="status">
        <p>{sinDatos}</p>
      </div>
    )
  }

  const altoTotal = M.arriba + altoGrafica + M.abajo
  const anchoGrafica = ANCHO - M.izquierda - M.derecha

  const todos = visibles.flatMap((s) =>
    s.valores.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  )
  const [min, max] = limitesSerie(todos, { desdeCero })
  const xDe = (i: number) =>
    M.izquierda + (totalPuntos === 1 ? anchoGrafica / 2 : (i / (totalPuntos - 1)) * anchoGrafica)
  const yDe = (v: number) =>
    M.arriba + (1 - (v - min) / (max - min)) * altoGrafica

  const ticks = ticksBonitos(min, max)
  const pasoX = pasoEtiquetas(totalPuntos)

  // Índice del punto más cercano a una X del navegador (viewBox 0..ANCHO).
  const indiceDesdeClientX = (clientX: number): number | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return null
    const px = ((clientX - rect.left) / rect.width) * ANCHO
    const bruto = ((px - M.izquierda) / anchoGrafica) * (totalPuntos - 1)
    return Math.max(0, Math.min(totalPuntos - 1, Math.round(bruto)))
  }

  const alPuntero = (e: React.MouseEvent<HTMLDivElement>) => {
    const i = indiceDesdeClientX(e.clientX)
    if (i !== null) setActivo(i)
  }

  const alSalir = () => {
    // Con el teclado enfocado el cruce se mantiene (lo limpia el blur).
    if (overlayRef.current === document.activeElement) return
    setActivo(null)
  }

  const alTecla = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setActivo((prev) => {
        const base = prev ?? 0
        const sig = e.key === 'ArrowRight' ? base + 1 : base - 1
        return Math.max(0, Math.min(totalPuntos - 1, sig))
      })
    } else if (e.key === 'Escape') {
      setActivo(null)
    }
  }

  const puntoActivo = activo !== null ? activo : null
  const xActiva = puntoActivo !== null ? xDe(puntoActivo) : 0
  const anchoTooltip = 176
  const izquierdaTooltip = Math.min(
    Math.max(xActiva - anchoTooltip / 2, M.izquierda),
    ANCHO - M.derecha - anchoTooltip
  )

  return (
    <figure className="space-y-2" aria-label={titulo}>
      {/* Leyenda interactiva: cada botón alterna la visibilidad de su serie. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s, i) => {
          const color = colorDe(i, s)
          const visible = !ocultas.includes(s.clave)
          return (
            <button
              key={s.clave}
              type="button"
              aria-pressed={visible}
              onClick={() => alternar(s.clave)}
              className={`flex min-h-10 items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors focus-ring ${
                visible ? 'text-uv-ink dark:text-slate-200' : 'text-uv-mid dark:text-slate-500'
              }`}
            >
              <svg viewBox="0 0 16 10" aria-hidden="true" className="h-2.5 w-4 shrink-0">
                <line
                  x1={1}
                  y1={5}
                  x2={15}
                  y2={5}
                  strokeWidth={2.25}
                  className={`${TINTAS[color].trazo} ${visible ? '' : 'opacity-40'}`}
                />
                {s.tipo !== 'linea' ? (
                  <rect
                    x={1}
                    y={2}
                    width={14}
                    height={6}
                    rx={1.5}
                    className={`${TINTAS[color].relleno} ${visible ? 'opacity-30' : 'opacity-10'}`}
                  />
                ) : (
                  <circle
                    cx={8}
                    cy={5}
                    r={2.6}
                    className={`${TINTAS[color].relleno} ${visible ? '' : 'opacity-40'}`}
                  />
                )}
              </svg>
              <span className={visible ? '' : 'line-through'}>{s.nombre}</span>
            </button>
          )
        })}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${ANCHO} ${altoTotal}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={titulo}
        >
          <title>{titulo}</title>

          <defs>
            {visibles.map((s, i) => {
              if (s.tipo === 'linea') return null
              const color = colorDe(series.indexOf(s), s)
              return (
                <linearGradient
                  key={s.clave}
                  id={`${idGradiente}-${s.clave}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopOpacity={0.28} className={TINTAS[color].relleno} />
                  <stop offset="100%" stopOpacity={0.02} className={TINTAS[color].relleno} />
                </linearGradient>
              )
            })}
          </defs>

          {/* Gridlines + ticks del eje Y */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.izquierda}
                y1={yDe(t)}
                x2={ANCHO - M.derecha}
                y2={yDe(t)}
                strokeWidth={1}
                className="stroke-uv-mid/30 dark:stroke-slate-700"
              />
              <text
                x={M.izquierda - 8}
                y={yDe(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-uv-ink/70 text-[11px] tabular-nums dark:fill-slate-400"
              >
                {formatoValor(t)}
              </text>
            </g>
          ))}

          {/* Etiquetas del eje X (submuestreadas para no solaparse) */}
          {etiquetas.map((et, i) =>
            i % pasoX === 0 || i === totalPuntos - 1 ? (
              <text
                key={`${et}-${i}`}
                x={xDe(i)}
                y={M.arriba + altoGrafica + 20}
                textAnchor="middle"
                className="fill-uv-ink/70 text-[11px] dark:fill-slate-400"
              >
                {et}
              </text>
            ) : null
          )}

          {/* Series: área degradada + curva monotona, trozada en huecos */}
          {visibles.map((s) => {
            const indiceSerie = series.indexOf(s)
            const color = colorDe(indiceSerie, s)
            const tramos = tramosContinuos(s.valores)
            return (
              <g key={s.clave}>
                {s.tipo !== 'linea'
                  ? tramos
                      .filter((t) => t.length >= 2)
                      .map((t) => {
                        const pts = puntosTramo(t, xDe, yDe, s.valores)
                        const baseY = M.arriba + altoGrafica
                        const area = `${caminoMonotono(pts)}L${pts[pts.length - 1].x},${baseY}L${pts[0].x},${baseY}Z`
                        return (
                          <motion.path
                            key={`a-${t[0]}`}
                            d={area}
                            fill={`url(#${idGradiente}-${s.clave})`}
                            initial={reducir ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.15 }}
                          />
                        )
                      })
                  : null}
                {tramos.map((t) => {
                  const pts = puntosTramo(t, xDe, yDe, s.valores)
                  const d =
                    t.length === 1
                      ? `M${pts[0].x},${pts[0].y}`
                      : caminoMonotono(pts)
                  return (
                    <motion.path
                      key={`l-${t[0]}`}
                      d={d}
                      fill="none"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      className={TINTAS[color].trazo}
                      initial={reducir ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                  )
                })}
              </g>
            )
          })}

          {/* Crosshair + puntos activos */}
          {puntoActivo !== null ? (
            <g aria-hidden="true">
              <line
                x1={xActiva}
                y1={M.arriba}
                x2={xActiva}
                y2={M.arriba + altoGrafica}
                strokeWidth={1}
                className="stroke-uv-mid dark:stroke-slate-600"
              />
              {visibles.map((s) => {
                const v = s.valores[puntoActivo]
                if (typeof v !== 'number' || !Number.isFinite(v)) return null
                const color = colorDe(series.indexOf(s), s)
                return (
                  <circle
                    key={s.clave}
                    cx={xActiva}
                    cy={yDe(v)}
                    r={4}
                    strokeWidth={2}
                    className={`fill-white dark:fill-slate-900 ${TINTAS[color].trazo}`}
                  />
                )
              })}
            </g>
          ) : null}

          {/* Base del área de trazado */}
          <line
            x1={M.izquierda}
            y1={M.arriba + altoGrafica}
            x2={ANCHO - M.derecha}
            y2={M.arriba + altoGrafica}
            strokeWidth={1}
            className="stroke-uv-mid/60 dark:stroke-slate-600"
          />
        </svg>

        {/* Capa de interacción (ratón + teclado), sin capturar el scroll */}
        <div
          ref={overlayRef}
          tabIndex={0}
          role="application"
          aria-label={`${titulo}: usa las flechas para recorrer los puntos`}
          onMouseMove={alPuntero}
          onMouseLeave={alSalir}
          onFocus={() => setActivo((prev) => prev ?? 0)}
          onBlur={() => setActivo(null)}
          onKeyDown={alTecla}
          className="absolute inset-0 rounded-lg focus-ring"
          style={{ cursor: 'crosshair' }}
        />

        {/* Tooltip */}
        {puntoActivo !== null ? (
          <div
            aria-live="polite"
            className="pointer-events-none absolute z-10 rounded-xl border border-uv-mid/40 bg-white/95 p-2.5 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900/95"
            style={{
              left: `${(izquierdaTooltip / ANCHO) * 100}%`,
              top: 8,
              width: anchoTooltip,
            }}
          >
            <p className="font-semibold text-uv-ink dark:text-slate-100">
              {etiquetas[puntoActivo]}
            </p>
            <ul className="mt-1 space-y-0.5">
              {visibles.map((s) => {
                const v = s.valores[puntoActivo]
                const color = colorDe(series.indexOf(s), s)
                return (
                  <li
                    key={s.clave}
                    className="flex items-center justify-between gap-2 tabular-nums"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 rounded-full ${TINTAS[color].relleno}`}
                      />
                      <span className="truncate text-uv-ink/80 dark:text-slate-300">
                        {s.nombre}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-uv-ink dark:text-slate-100">
                      {typeof v === 'number' && Number.isFinite(v) ? formatoValor(v) : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </figure>
  )
}
