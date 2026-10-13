'use client'

import React from 'react'
import {
  etiquetaEje,
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
  TEXTO_CALENDARIO,
  TEXTO_DIRECCION,
  type PeriodoAnalizado,
} from '../models/analisis'

/**
 * Gráfica SVG de la serie histórica de consumo de una edificación
 * (kWh normalizados a 30 días) con la capa de detección del Módulo 3:
 *
 *  - línea de la serie con puntos; los períodos atípicos salen en ámbar
 *    (mismo lenguaje visual que los descartados de `LineaBaseChart`),
 *    los meses sin banda quedan huecos (n < mínimos por mes), y
 *  - overlay del calendario académico: los meses vacacionales se sombrean
 *    de fondo para relacionar de un vistazo los baches de consumo con los
 *    recesos del TdeA.
 *
 * El ancho se mide con ResizeObserver (1:1 con el contenedor) para que
 * el texto no escale ni se encoja en móvil. Tooltip por ratón sobre el
 * área de trazado; los puntos atípicos además son focalizables con
 * teclado (Tab) y anuncian su explicación.
 */

const ALTO = 260
const M = { arriba: 16, derecha: 18, abajo: 42, izquierda: 66 }
const ANCHO_RESPALDO = 720

type Punto = {
  x: number
  y: number
  periodo: PeriodoAnalizado
  /** Índice cronológico en meses desde el primer período. */
  t: number
}

function tDe(p: PeriodoAnalizado): number {
  return p.ano * 12 + (p.mes - 1)
}

function etiquetaTooltip(p: PeriodoAnalizado): string {
  const base = `${etiquetaPeriodo(p.mes, p.ano)}: ${formatoKwh(p.consumo_kwh)}`
  if (p.es_atipico && p.direccion) {
    const desvio = typeof p.desviacion_pct === 'number' ? ` (${formatoPct(p.desviacion_pct)})` : ''
    return `${base} — ${TEXTO_DIRECCION[p.direccion].toLowerCase()}${desvio}, ${TEXTO_CALENDARIO[p.calendario].toLowerCase()}`
  }
  if (p.es_atipico === null) {
    return `${base} — sin banda para evaluar`
  }
  return `${base} — dentro de la banda, ${TEXTO_CALENDARIO[p.calendario].toLowerCase()}`
}

export interface AnalisisChartProps {
  periodos: PeriodoAnalizado[]
  /** Media global de la serie (kWh); null si no hay estadísticos. */
  media: number | null
}

export function AnalisisChart({ periodos, media }: AnalisisChartProps) {
  const contenedorRef = React.useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = React.useState(ANCHO_RESPALDO)
  const [activo, setActivo] = React.useState<number | null>(null)

  React.useEffect(() => {
    const el = contenedorRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0)
      setAncho((prev) => (Math.abs(prev - w) < 1 ? prev : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const disposicion = React.useMemo(() => {
    if (periodos.length === 0) return null
    const plotW = Math.max(40, ancho - M.izquierda - M.derecha)
    const plotH = ALTO - M.arriba - M.abajo

    const t0 = tDe(periodos[0])
    const t1 = tDe(periodos[periodos.length - 1])
    const spanT = Math.max(1, t1 - t0)

    const valores = periodos.map((p) => p.consumo_kwh)
    if (typeof media === 'number') valores.push(media)
    let min = Math.min(...valores)
    let max = Math.max(...valores)
    const margen = (max - min || Math.abs(max) || 1) * 0.1
    min -= margen
    max += margen

    const xDe = (t: number) => M.izquierda + ((t - t0) / spanT) * plotW
    const yDe = (v: number) => M.arriba + (1 - (v - min) / (max - min)) * plotH

    const puntos: Punto[] = periodos.map((p) => ({
      x: xDe(tDe(p)),
      y: yDe(p.consumo_kwh),
      periodo: p,
      t: tDe(p),
    }))

    // Segmentos separados donde falta un mes en el histórico (hueco real).
    const segmentos: Punto[][] = []
    for (const punto of puntos) {
      const ultimo = segmentos[segmentos.length - 1]
      const previo = ultimo?.[ultimo.length - 1]
      if (previo && punto.t - previo.t > 1) segmentos.push([punto])
      else if (ultimo) ultimo.push(punto)
      else segmentos.push([punto])
    }

    // Etiquetas del eje X: nunca más densas que ~68px entre marca y marca.
    const maxEtiquetas = Math.max(2, Math.floor(plotW / 68))
    const paso = Math.max(1, Math.ceil(puntos.length / maxEtiquetas))

    const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      v: min + f * (max - min),
      y: yDe(min + f * (max - min)),
    }))

    // Ancho de la banda sombreada de vacaciones: 1 periodo + separación.
    const pasoX = puntos.length > 1 ? puntos[1].x - puntos[0].x : 16
    const anchoBanda = Math.max(6, Math.min(28, Math.abs(pasoX) * 0.72))

    return {
      puntos,
      segmentos,
      ticksY,
      xDe,
      yDe,
      paso,
      anchoBanda,
      plotW,
      mediaY: typeof media === 'number' ? yDe(media) : null,
    }
  }, [periodos, media, ancho])

  if (!disposicion) return null
  const { puntos, segmentos, ticksY, paso, anchoBanda, mediaY } = disposicion

  // Punto más cercano al cursor (coordenadas del viewBox = píxeles reales).
  const indiceCercano = (evento: React.MouseEvent<SVGRectElement>) => {
    const rect = (evento.currentTarget as SVGRectElement).getBoundingClientRect()
    const x = evento.clientX - rect.left + M.izquierda
    let mejor = 0
    for (let i = 1; i < puntos.length; i += 1) {
      if (Math.abs(puntos[i].x - x) < Math.abs(puntos[mejor].x - x)) mejor = i
    }
    return mejor
  }

  const puntoActivo = activo !== null ? puntos[activo] : null
  const tooltipX = puntoActivo
    ? Math.min(Math.max(puntoActivo.x - 110, 4), Math.max(4, ancho - 224))
    : 0

  const resumen =
    periodos.length > 0
      ? `Serie mensual de consumo de ${periodos.length} períodos (${etiquetaPeriodo(periodos[0].mes, periodos[0].ano)} a ${etiquetaPeriodo(periodos[periodos.length - 1].mes, periodos[periodos.length - 1].ano)}); los puntos en ámbar son períodos inusuales.`
      : 'Serie mensual de consumo.'

  return (
    <figure className="w-full">
      <div className="relative" ref={contenedorRef}>
        <svg
          viewBox={`0 0 ${ancho} ${ALTO}`}
          className="h-auto w-full text-gray-400 dark:text-slate-500"
          role="img"
          aria-label={resumen}
        >
          {/* Overlay del calendario académico: meses vacacionales */}
          {puntos.map((p) =>
            p.periodo.calendario === 'vacaciones' ? (
              <rect
                key={`vac-${p.periodo.ano}-${p.periodo.mes}`}
                x={p.x - anchoBanda / 2}
                y={M.arriba}
                width={anchoBanda}
                height={ALTO - M.arriba - M.abajo}
                className="fill-slate-100 dark:fill-slate-800/70"
              />
            ) : null
          )}

          {/* Rejilla + eje Y */}
          {ticksY.map((t) => (
            <g key={t.y}>
              <line
                x1={M.izquierda}
                x2={ancho - M.derecha}
                y1={t.y}
                y2={t.y}
                className="stroke-gray-200 dark:stroke-slate-800"
                strokeWidth={1}
              />
              <text
                x={M.izquierda - 8}
                y={t.y + 3.5}
                textAnchor="end"
                fontSize={10}
                className="fill-gray-400 dark:fill-slate-500"
              >
                {formatoNumero(Math.round(t.v), 0)}
              </text>
            </g>
          ))}
          <text
            x={M.izquierda - 8}
            y={11}
            textAnchor="end"
            fontSize={9}
            className="fill-gray-400 dark:fill-slate-500"
          >
            kWh
          </text>

          {/* Media global de la serie */}
          {mediaY !== null && (
            <g>
              <line
                x1={M.izquierda}
                x2={ancho - M.derecha}
                y1={mediaY}
                y2={mediaY}
                className="stroke-gray-400 dark:stroke-slate-500"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
              <text
                x={M.izquierda + 6}
                y={mediaY - 5}
                fontSize={10}
                className="fill-gray-500 dark:fill-slate-400"
              >
                {`media ${formatoNumero(media ?? 0, 0)} kWh`}
              </text>
            </g>
          )}

          {/* Serie */}
          {segmentos.map((segmento, i) => (
            <polyline
              key={`seg-${i}`}
              points={segmento.map((p) => `${p.x},${p.y}`).join(' ')}
              className="fill-none stroke-uv-forest"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Puntos: normales / sin banda (hueco) / atípicos (ámbar) */}
          {puntos.map((p, i) => {
            const { periodo } = p
            if (periodo.es_atipico === null) {
              return (
                <circle
                  key={`p-${periodo.ano}-${periodo.mes}`}
                  cx={p.x}
                  cy={p.y}
                  r={3.5}
                  className="fill-gray-100 stroke-gray-400 dark:fill-slate-700 dark:stroke-slate-500"
                  strokeWidth={1.5}
                  strokeDasharray="2 1.5"
                />
              )
            }
            if (periodo.es_atipico) {
              return (
                <circle
                  key={`p-${periodo.ano}-${periodo.mes}`}
                  cx={p.x}
                  cy={p.y}
                  r={5.5}
                  tabIndex={0}
                  role="img"
                  aria-label={etiquetaTooltip(periodo)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo((prev) => (prev === i ? null : prev))}
                  className="cursor-pointer fill-amber-500 stroke-white dark:fill-amber-400 dark:stroke-slate-900"
                  strokeWidth={1.5}
                >
                  <title>{etiquetaTooltip(periodo)}</title>
                </circle>
              )
            }
            return (
              <circle
                key={`p-${periodo.ano}-${periodo.mes}`}
                cx={p.x}
                cy={p.y}
                r={3.5}
                className="cursor-pointer fill-uv-forest"
              />
            )
          })}

          {/* Eje X */}
          {puntos.map((p, i) =>
            i % disposicion.paso === 0 ? (
              <text
                key={`x-${p.periodo.ano}-${p.periodo.mes}`}
                x={p.x}
                y={ALTO - M.abajo + 16}
                textAnchor="middle"
                fontSize={10}
                className="fill-gray-400 dark:fill-slate-500"
              >
                {etiquetaEje(p.periodo.mes, p.periodo.ano)}
              </text>
            ) : null
          )}

          {/* Overlay de hover (ratón) */}
          <rect
            x={M.izquierda}
            y={M.arriba}
            width={disposicion.plotW}
            height={ALTO - M.arriba - M.abajo}
            className="cursor-crosshair"
            fill="transparent"
            onMouseMove={(e) => setActivo(indiceCercano(e))}
            onMouseLeave={() => setActivo(null)}
          />

          {/* Crosshair */}
          {puntoActivo && (
            <line
              x1={puntoActivo.x}
              x2={puntoActivo.x}
              y1={M.arriba}
              y2={ALTO - M.abajo}
              className="stroke-gray-400 dark:stroke-slate-500"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
        </svg>

        {/* Tooltip */}
        {puntoActivo && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-52 rounded-lg border border-gray-200 bg-white p-2.5 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
            style={{ left: tooltipX }}
            role="status"
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {etiquetaPeriodo(puntoActivo.periodo.mes, puntoActivo.periodo.ano)}
            </p>
            <p className="mt-1 text-gray-700 dark:text-gray-300">
              {formatoKwh(puntoActivo.periodo.consumo_kwh)}
            </p>
            {puntoActivo.periodo.es_atipico && puntoActivo.periodo.direccion ? (
              <p className="mt-1 font-medium text-amber-700 dark:text-amber-300">
                {`${TEXTO_DIRECCION[puntoActivo.periodo.direccion]} · ${
                  typeof puntoActivo.periodo.desviacion_pct === 'number'
                    ? formatoPct(puntoActivo.periodo.desviacion_pct)
                    : ''
                }`}
              </p>
            ) : puntoActivo.periodo.es_atipico === null ? (
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                Sin banda para evaluar
              </p>
            ) : null}
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              {TEXTO_CALENDARIO[puntoActivo.periodo.calendario]}
              {typeof puntoActivo.periodo.dias_lectivos === 'number'
                ? ` · ${puntoActivo.periodo.dias_lectivos} días`
                : ''}
            </p>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-uv-forest" aria-hidden />
          Consumo mensual
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden />
          Período inusual
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full border border-dashed border-gray-400 bg-gray-100 dark:border-slate-500 dark:bg-slate-700"
            aria-hidden
          />
          Sin banda (n &lt; mín. del mes)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-slate-100 dark:bg-slate-800" aria-hidden />
          Vacaciones (calendario académico)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-0 w-5 border-t-2 border-dashed border-gray-400 dark:border-slate-500"
            aria-hidden
          />
          Media de la serie
        </span>
      </div>
    </figure>
  )
}
