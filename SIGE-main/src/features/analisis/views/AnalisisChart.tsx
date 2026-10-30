'use client'

import React from 'react'
import {
  agregarAnual,
  etiquetaEje,
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
  TEXTO_CALENDARIO,
  TEXTO_DIRECCION,
  type PeriodoAnalizado,
  type PuntoAnual,
} from '../models/analisis'

/**
 * Gráfica SVG de la serie histórica de consumo de una edificación
 * (kWh normalizados a 30 días) con la capa de detección del Módulo 3:
 *
 *  - línea de la serie con puntos; los períodos atípicos salen en ámbar
 *    (mismo lenguaje visual que los descartados de `LineaBaseChart`),
 *    los meses sin banda quedan huecos (n < mínimos por mes),
 *  - envoltura de la banda de confianza de SU mes (§7.5.1): un rectángulo
 *    por mes entre `banda_inf` y `banda_sup`, que es exactamente lo que
 *    define «período inusual» — hoy visible de un vistazo,
 *  - overlay del calendario académico: los meses vacacionales se sombrean
 *    de fondo para relacionar de un vistazo los baches de consumo con los
 *    recesos del TdeA, y
 *  - simulación de umbral (exploratorio, Resolución ≠ simulador): si la
 *    vista la activa, se superpone la banda simulada en violeta y se
 *    marcan con anillo los períodos que ENTRARÍAN con ese umbral. El
 *    marcador ámbar normativo nunca se toca.
 *
 * Dos controles de «Línea base del análisis» cambian el trazado sin
 * salir del cliente: `lben` añade la línea punteada de la LBEn del
 * modelo elegido (por mes calendario), y `periodicidad="ano"` agrega la
 * serie a un punto por año —media en kWh/mes, la unidad NO cambia—
 * ocultando los overlays exclusivamente mensuales.
 *
 * El ancho se mide con ResizeObserver (1:1 con el contenedor) para que
 * el texto no escale ni se encoja en móvil. Tooltip por ratón sobre el
 * área de trazado; los puntos atípicos además son focalizables con
 * teclado (Tab) y anuncian su explicación.
 */

const ALTO = 320
const M = { arriba: 16, derecha: 18, abajo: 42, izquierda: 66 }
const ANCHO_RESPALDO = 720

/** Pasos «bonitos» 1/2/5×10ᵏ para que el eje Y muestre números redondos. */
function pasoBonito(bruto: number): number {
  const exp = Math.floor(Math.log10(bruto))
  const base = Math.pow(10, exp)
  const norm = bruto / base
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * base
}

/** Ticks del eje Y dentro de [min, max] con paso 1/2/5×10ᵏ (máx. 12). */
function ticksBonitos(min: number, max: number, cantidad = 5): number[] {
  if (!(max > min)) return [min]
  const paso = pasoBonito((max - min) / Math.max(1, cantidad - 1))
  const inicio = Math.ceil(min / paso) * paso
  const ticks: number[] = []
  for (let v = inicio; v <= max + paso * 1e-6 && ticks.length < 12; v += paso) {
    ticks.push(Math.round(v / paso) * paso)
  }
  return ticks
}

/** Un punto de la serie (mensual o anual) sin coordenadas de dibujo. */
type DatoSerie = {
  /** Índice cronológico (meses desde el inicio; en modo anual, años). */
  t: number
  /** Valor trazado: consumo en kWh/mes (ambos modos comparten unidad). */
  consumo: number
  /** LBEn del modelo en el punto (kWh/mes); null = sin valor ese mes. */
  lben: number | null
  /** Banda de confianza normativa del mes (§7.5.1); null = sin banda. */
  banda: { inf: number; sup: number } | null
  /** Banda simulada del mes (solo mensual y con simulación activa). */
  bandaSim: { inf: number; sup: number } | null
  /** Clave React. */
  clave: string
  /** Título del tooltip («marzo de 2024» / «Año 2024»). */
  titulo: string
  /** Etiqueta del eje X. */
  eje: string
  /** true = inusual (ámbar) · null = sin banda · false = dentro de banda. */
  estado: boolean | null
  /** Línea ámbar del tooltip (dirección · desviación); null si no aplica. */
  ambar: string | null
  /** Línea inferior del tooltip (calendario · días / meses del año). */
  pie: string | null
  /** Texto anunciado al enfocar un punto inusual. */
  aria: string
}

type Punto = DatoSerie & { x: number; y: number }

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

/** Dato mensual: el histórico tal cual, con la LBEn y las bandas del mes. */
function datoMensual(
  p: PeriodoAnalizado,
  lbenMensual: readonly (number | null)[] | null,
  bandasSim: readonly ({ inf: number; sup: number } | null)[] | null
): DatoSerie {
  const ambar =
    p.es_atipico && p.direccion
      ? `${TEXTO_DIRECCION[p.direccion]}${
          typeof p.desviacion_pct === 'number'
            ? ` · ${formatoPct(p.desviacion_pct)}`
            : ''
        }`
      : null
  return {
    t: tDe(p),
    consumo: p.consumo_kwh,
    lben: lbenMensual?.[p.mes - 1] ?? null,
    banda:
      p.banda_inf !== null && p.banda_sup !== null
        ? { inf: p.banda_inf, sup: p.banda_sup }
        : null,
    bandaSim: bandasSim?.[p.mes - 1] ?? null,
    clave: `p-${p.ano}-${p.mes}`,
    titulo: etiquetaPeriodo(p.mes, p.ano),
    eje: etiquetaEje(p.mes, p.ano),
    estado: p.es_atipico,
    ambar,
    pie: `${TEXTO_CALENDARIO[p.calendario]}${
      typeof p.dias_lectivos === 'number' ? ` · ${p.dias_lectivos} días` : ''
    }`,
    aria: etiquetaTooltip(p),
  }
}

/** Dato anual: media del año (kWh/mes) e inusuales acumulados. */
function datoAnual(p: PuntoAnual): DatoSerie {
  const inusuales =
    p.atipicos > 0
      ? `${p.atipicos} período${p.atipicos === 1 ? '' : 's'} inusual${p.atipicos === 1 ? '' : 'es'}`
      : null
  const pie = `${p.meses} mes${p.meses === 1 ? '' : 'es'}${inusuales ? ` · ${inusuales}` : ''}`
  const titulo = `Año ${p.ano}`
  return {
    t: p.ano,
    consumo: p.consumo,
    lben: p.lben,
    banda: null,
    bandaSim: null,
    clave: `a-${p.ano}`,
    titulo,
    eje: `${p.ano}`,
    estado: p.atipicos > 0,
    ambar: inusuales,
    pie,
    aria: `${titulo}: ${formatoKwh(p.consumo)} — ${pie}`,
  }
}

export interface AnalisisChartProps {
  periodos: PeriodoAnalizado[]
  /** Media global de la serie (kWh); null si no hay estadísticos. */
  media: number | null
  /**
   * LBEn del modelo elegido en el selector, por mes calendario (12);
   * null (o meses a null) dibuja la referencia solo donde hay valor.
   */
  lben?: readonly (number | null)[] | null
  /** Granularidad temporal: «Mes» mantiene el histórico intacto. */
  periodicidad?: 'mes' | 'ano'
  /**
   * Bandas del simulador de umbral por mes (índice mes−1); solo pinta
   * en modo mensual. La banda normativa NO depende de esta prop.
   */
  bandasSim?: readonly ({ inf: number; sup: number } | null)[] | null
}

export function AnalisisChart({
  periodos,
  media,
  lben = null,
  periodicidad = 'mes',
  bandasSim = null,
}: AnalisisChartProps) {
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
    const anual = periodicidad === 'ano'
    const plotW = Math.max(40, ancho - M.izquierda - M.derecha)
    const plotH = ALTO - M.arriba - M.abajo

    // La serie mensual es el histórico intacto; la anual agrega por año.
    const datos: DatoSerie[] = anual
      ? agregarAnual(periodos, lben).map(datoAnual)
      : periodos.map((p) => datoMensual(p, lben, bandasSim))

    const t0 = datos[0].t
    const t1 = datos[datos.length - 1].t
    const spanT = Math.max(1, t1 - t0)

    // El eje Y cubre consumo, media, LBEn del modelo y las bandas
    // (normativa y simulada) para que ninguna capa quede recortada.
    const valores = datos.map((d) => d.consumo)
    if (typeof media === 'number') valores.push(media)
    for (const d of datos) {
      if (d.lben !== null) valores.push(d.lben)
      if (d.banda) valores.push(d.banda.inf, d.banda.sup)
      if (d.bandaSim) valores.push(d.bandaSim.inf, d.bandaSim.sup)
    }
    let min = Math.min(...valores)
    let max = Math.max(...valores)
    const margen = (max - min || Math.abs(max) || 1) * 0.1
    min -= margen
    max += margen

    const xDe = (t: number) => M.izquierda + ((t - t0) / spanT) * plotW
    const yDe = (v: number) => M.arriba + (1 - (v - min) / (max - min)) * plotH

    const puntos: Punto[] = datos.map((d) => ({
      ...d,
      x: xDe(d.t),
      y: yDe(d.consumo),
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

    // Trazado de la LBEn: se corta donde el modelo no tiene valor.
    const segmentosLben: { x: number; y: number }[][] = []
    let previoConLben: Punto | null = null
    for (const punto of puntos) {
      if (punto.lben === null) {
        previoConLben = null
        continue
      }
      const marca = { x: punto.x, y: yDe(punto.lben) }
      const ultimo = segmentosLben[segmentosLben.length - 1]
      const discontinuo = !previoConLben || punto.t - previoConLben.t > 1
      if (!ultimo || discontinuo) segmentosLben.push([marca])
      else ultimo.push(marca)
      previoConLben = punto
    }

    // Etiquetas del eje X: nunca más densas que ~68px entre marca y marca.
    const maxEtiquetas = Math.max(2, Math.floor(plotW / 68))
    const paso = Math.max(1, Math.ceil(puntos.length / maxEtiquetas))

    // Ticks «bonitos» (1/2/5×10ᵏ) en vez de fracciones arbitrarias.
    const ticksY = ticksBonitos(min, max).map((v) => ({
      v,
      y: yDe(v),
    }))

    // Ancho de la banda sombreada de vacaciones: 1 periodo + separación.
    const pasoX = puntos.length > 1 ? puntos[1].x - puntos[0].x : 16
    const anchoBanda = Math.max(6, Math.min(28, Math.abs(pasoX) * 0.72))

    // Posiciones x de los meses vacacionales (solo aplican en modo mes).
    const vacacionesX = anual
      ? []
      : puntos
          .filter((_, i) => periodos[i]?.calendario === 'vacaciones')
          .map((p) => p.x)

    return {
      anual,
      datos,
      puntos,
      segmentos,
      segmentosLben,
      ticksY,
      xDe,
      yDe,
      paso,
      anchoBanda,
      plotW,
      vacacionesX,
      mediaY: typeof media === 'number' ? yDe(media) : null,
    }
  }, [periodos, media, lben, periodicidad, bandasSim, ancho])

  if (!disposicion) return null
  const {
    anual,
    datos,
    puntos,
    segmentos,
    segmentosLben,
    ticksY,
    paso,
    anchoBanda,
    plotW,
    vacacionesX,
    mediaY,
    yDe,
  } = disposicion
  const hayLben = puntos.some((p) => p.lben !== null)
  const hayBanda = !anual && puntos.some((p) => p.banda !== null)
  const hayBandaSim = !anual && puntos.some((p) => p.bandaSim !== null)

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

  const resumen = anual
    ? `Serie anual de consumo de ${datos.length} años (${datos[0].t} a ${datos[datos.length - 1].t}), media mensual por año; los puntos en ámbar tienen períodos inusuales.`
    : `Serie mensual de consumo de ${periodos.length} períodos (${etiquetaPeriodo(periodos[0].mes, periodos[0].ano)} a ${etiquetaPeriodo(periodos[periodos.length - 1].mes, periodos[periodos.length - 1].ano)}); los puntos en ámbar son períodos inusuales.${
        hayBandaSim
          ? ' La banda simulada (exploratoria) se superpone en violeta.'
          : ''
      }`

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
          {vacacionesX.map((x, i) => (
            <rect
              key={`vac-${i}`}
              x={x - anchoBanda / 2}
              y={M.arriba}
              width={anchoBanda}
              height={ALTO - M.arriba - M.abajo}
              className="fill-slate-100 dark:fill-slate-800/70"
            />
          ))}

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
                fontSize={11}
                className="fill-gray-500 dark:fill-slate-400"
              >
                {formatoNumero(Math.round(t.v), 0)}
              </text>
            </g>
          ))}
          <text
            x={M.izquierda - 8}
            y={11}
            textAnchor="end"
            fontSize={10}
            className="fill-gray-400 dark:fill-slate-500"
          >
            kWh
          </text>

          {/* Banda de confianza normativa: un rectángulo por mes entre
              banda_inf y banda_sup (§7.5.1); los meses sin banda no pinta. */}
          {!anual &&
            puntos.map((p) =>
              p.banda ? (
                <rect
                  key={`banda-${p.clave}`}
                  x={p.x - anchoBanda / 2}
                  y={yDe(p.banda.sup)}
                  width={anchoBanda}
                  height={Math.max(1, yDe(p.banda.inf) - yDe(p.banda.sup))}
                  className="fill-emerald-600/10 dark:fill-emerald-400/10"
                />
              ) : null
            )}

          {/* Banda simulada (exploratorio): solo con la simulación activa
              y en modo mensual; violeta para no confundirla con la normativa. */}
          {!anual &&
            puntos.map((p) =>
              p.bandaSim ? (
                <rect
                  key={`banda-sim-${p.clave}`}
                  x={p.x - anchoBanda / 2}
                  y={yDe(p.bandaSim.sup)}
                  width={anchoBanda}
                  height={Math.max(1, yDe(p.bandaSim.inf) - yDe(p.bandaSim.sup))}
                  className="fill-uv-purple/15 dark:fill-uv-purple/25"
                />
              ) : null
            )}

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
                fontSize={11}
                className="fill-gray-500 dark:fill-slate-400"
              >
                {`media ${formatoNumero(media ?? 0, 0)} kWh`}
              </text>
            </g>
          )}

          {/* Línea base del modelo elegido (selector de la vista) */}
          {segmentosLben.map((segmento, i) => (
            <polyline
              key={`lben-${i}`}
              points={segmento.map((p) => `${p.x},${p.y}`).join(' ')}
              className="fill-none stroke-slate-700 dark:stroke-slate-200"
              strokeWidth={1.5}
              strokeDasharray="2 4"
            />
          ))}

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
            if (p.estado === null) {
              return (
                <circle
                  key={p.clave}
                  cx={p.x}
                  cy={p.y}
                  r={3.5}
                  className="fill-gray-100 stroke-gray-400 dark:fill-slate-700 dark:stroke-slate-500"
                  strokeWidth={1.5}
                  strokeDasharray="2 1.5"
                />
              )
            }
            if (p.estado) {
              return (
                <circle
                  key={p.clave}
                  cx={p.x}
                  cy={p.y}
                  r={5.5}
                  tabIndex={0}
                  role="img"
                  aria-label={p.aria}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo((prev) => (prev === i ? null : prev))}
                  className="cursor-pointer fill-amber-500 stroke-white dark:fill-amber-400 dark:stroke-slate-900"
                  strokeWidth={1.5}
                >
                  <title>{p.aria}</title>
                </circle>
              )
            }
            return (
              <circle
                key={p.clave}
                cx={p.x}
                cy={p.y}
                r={3.5}
                className="cursor-pointer fill-uv-forest"
              />
            )
          })}

          {/* Anillo de la simulación: períodos NORMATIVAMENTE dentro de
              banda que entrarían como inusuales con el umbral simulado
              (decorativo: el marcador ámbar normativo manda). */}
          {!anual &&
            puntos.map((p) => {
              if (p.estado !== false || !p.bandaSim) return null
              const fuera =
                p.consumo < p.bandaSim.inf || p.consumo > p.bandaSim.sup
              if (!fuera) return null
              return (
                <circle
                  key={`sim-${p.clave}`}
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  className="fill-none stroke-uv-purple dark:stroke-uv-purple"
                  strokeWidth={2}
                  strokeDasharray="3 2"
                  aria-hidden
                />
              )
            })}

          {/* Eje X */}
          {puntos.map((p, i) =>
            i % paso === 0 ? (
              <text
                key={`x-${p.clave}`}
                x={p.x}
                y={ALTO - M.abajo + 16}
                textAnchor="middle"
                fontSize={11}
                className="fill-gray-500 dark:fill-slate-400"
              >
                {p.eje}
              </text>
            ) : null
          )}

          {/* Overlay de hover (ratón) */}
          <rect
            x={M.izquierda}
            y={M.arriba}
            width={plotW}
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
              {puntoActivo.titulo}
            </p>
            <p className="mt-1 text-gray-700 dark:text-gray-300">
              {formatoKwh(puntoActivo.consumo)}
            </p>
            {puntoActivo.ambar ? (
              <p className="mt-1 font-medium text-amber-700 dark:text-amber-300">
                {puntoActivo.ambar}
              </p>
            ) : puntoActivo.estado === null ? (
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                Sin banda para evaluar
              </p>
            ) : null}
            {puntoActivo.banda && (
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {`Banda del mes: ${formatoNumero(puntoActivo.banda.inf, 0)} – ${formatoNumero(puntoActivo.banda.sup, 0)} kWh`}
              </p>
            )}
            {puntoActivo.bandaSim && (
              <p className="mt-1 font-medium text-purple-700 dark:text-purple-300">
                {`Simulada: ${formatoNumero(puntoActivo.bandaSim.inf, 0)} – ${formatoNumero(puntoActivo.bandaSim.sup, 0)} kWh`}
              </p>
            )}
            {puntoActivo.lben !== null && (
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {`LBEn: ${formatoKwh(puntoActivo.lben)}`}
              </p>
            )}
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              {puntoActivo.pie}
            </p>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-uv-forest" aria-hidden />
          {anual ? 'Consumo (media mensual por año)' : 'Consumo mensual'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden />
          Período inusual
        </span>
        {hayBanda && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-4 rounded-sm bg-emerald-600/10 dark:bg-emerald-400/10"
              aria-hidden
            />
            Banda de confianza del mes (§7.5.1)
          </span>
        )}
        {!anual && (
          <>
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
          </>
        )}
        {hayBandaSim && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-3 w-4 rounded-sm bg-uv-purple/15 dark:bg-uv-purple/25"
                aria-hidden
              />
              Banda simulada (exploratoria)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full border-2 border-dashed border-uv-purple"
                aria-hidden
              />
              Entraría como inusual
            </span>
          </>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-0 w-5 border-t-2 border-dashed border-gray-400 dark:border-slate-500"
            aria-hidden
          />
          Media de la serie
        </span>
        {hayLben && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0 w-5 border-t-2 border-dotted border-slate-700 dark:border-slate-200"
              aria-hidden
            />
            Línea base (modelo)
          </span>
        )}
      </div>
    </figure>
  )
}
