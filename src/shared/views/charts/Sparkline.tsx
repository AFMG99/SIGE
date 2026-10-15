/**
 * Sparkline — mini-gráfico SVG para tarjetas KPI (curva + área degradada).
 * Decorativo por defecto (`aria-hidden`); con `titulo` expone role="img".
 */
import * as React from 'react'

import { caminoMonotono, limitesSerie, tramosContinuos } from './curvas'
import type { ColorSerie } from './SeriesChart'

const RELLENOS: Record<ColorSerie, string> = {
  forest: 'fill-uv-forest dark:fill-uv-soft',
  sky: 'fill-uv-sky dark:fill-sky-400',
  purple: 'fill-uv-purple dark:fill-violet-400',
  turquoise: 'fill-uv-turquoise dark:fill-teal-400',
  deep: 'fill-uv-deep dark:fill-sky-300',
  yellow: 'fill-yellow-600 dark:fill-uv-yellow',
}

const TRAZOS: Record<ColorSerie, string> = {
  forest: 'stroke-uv-forest dark:stroke-uv-soft',
  sky: 'stroke-uv-sky dark:stroke-sky-400',
  purple: 'stroke-uv-purple dark:stroke-violet-400',
  turquoise: 'stroke-uv-turquoise dark:stroke-teal-400',
  deep: 'stroke-uv-deep dark:stroke-sky-300',
  yellow: 'stroke-yellow-600 dark:stroke-uv-yellow',
}

export type SparklineProps = {
  /** Valores de la serie; null = hueco (la curva se troza). */
  valores: readonly (number | null | undefined)[]
  /** Tamaño CSS en px (default 132×40). */
  ancho?: number
  alto?: number
  color?: ColorSerie
  /** Relleno degradado bajo la curva (default true). */
  relleno?: boolean
  /** Nombre accesible; si falta, el SVG es decorativo (aria-hidden). */
  titulo?: string
}

export function Sparkline({
  valores,
  ancho = 132,
  alto = 40,
  color = 'forest',
  relleno = true,
  titulo,
}: SparklineProps) {
  const idGradiente = React.useId()
  const conDatos = valores.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  )
  if (conDatos.length < 2) return null

  const [min, max] = limitesSerie(conDatos)
  const xDe = (i: number) => 1 + (i / (valores.length - 1)) * (ancho - 2)
  const yDe = (v: number) => alto - 2 - ((v - min) / (max - min)) * (alto - 4)

  const tramos = tramosContinuos(valores)
  const baseY = alto - 1

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      width={ancho}
      height={alto}
      className="shrink-0"
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <defs>
        <linearGradient id={`${idGradiente}-sp`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopOpacity={0.3} className={RELLENOS[color]} />
          <stop offset="100%" stopOpacity={0.02} className={RELLENOS[color]} />
        </linearGradient>
      </defs>
      {relleno
        ? tramos
            .filter((t) => t.length >= 2)
            .map((t) => {
              const pts = t.map((i) => ({ x: xDe(i), y: yDe(valores[i] as number) }))
              const area = `${caminoMonotono(pts)}L${pts[pts.length - 1].x},${baseY}L${pts[0].x},${baseY}Z`
              return <path key={`a-${t[0]}`} d={area} fill={`url(#${idGradiente}-sp)`} />
            })
        : null}
      {tramos.map((t) => {
        const pts = t.map((i) => ({ x: xDe(i), y: yDe(valores[i] as number) }))
        const d = t.length === 1 ? `M${pts[0].x},${pts[0].y}` : caminoMonotono(pts)
        return (
          <path
            key={`l-${t[0]}`}
            d={d}
            fill="none"
            strokeWidth={1.75}
            strokeLinecap="round"
            className={TRAZOS[color]}
          />
        )
      })}
    </svg>
  )
}
