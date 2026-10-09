'use client'

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { CriterioDepuracion, PuntoSerie } from '@/features/datos/models/lineasBase'
import { TEXTOS_CRITERIO } from '@/features/datos/models/lineasBase'

/**
 * Gráfica SVG interactiva de perfiles mensuales de consumo: el eje X son los
 * 12 meses calendario («Mes de Año») y cada año registrado es su propia serie,
 * solo con marcadores de figura única por año (sin línea que los conecte).
 *
 * Tres líneas de referencia de 12 puntos: la línea base del modelo (media de
 * la columna activa por mes; en Valor Absoluto es exactamente la LBEn_m) y los
 * límites superior/inferior de la banda por mes calendario (§7.5.1; huecos en
 * meses `estimado`).
 *
 * Sin área de banda ni residuos Δ. Conserva crosshair + tooltip (ratón y
 * teclado ←/→/Home/End sobre un overlay `role="slider"` con `aria-live`),
 * meses descartados en hueco ámbar y leyenda interactiva en español con
 * `aria-pressed` por año y por cada línea de referencia. La entrada se anima
 * con framer-motion solo si el usuario no pide reducir el movimiento.
 */

type Columna = 'pred_va' | 'pred_coc' | 'pred_reg' | 'pred_conf'

export type LineaBaseChartProps = {
  serie: PuntoSerie[]
  columna: Columna
  /** Criterio de depuración del cálculo (textos de descartes). */
  criterio?: CriterioDepuracion
  etiquetaPred?: string
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

type Forma =
  | 'circulo'
  | 'cuadrado'
  | 'triangulo'
  | 'rombo'
  | 'cruz'
  | 'triangulo_abajo'

/** Figura única por año (cicla si hay más años que figuras). */
const FORMAS: Forma[] = [
  'circulo', 'cuadrado', 'triangulo', 'rombo', 'cruz', 'triangulo_abajo',
]

/** Color único por año (evita ámbar, reservado a los descartados). */
const PALETA = [
  { tinta: 'stroke-emerald-600 dark:stroke-emerald-400', relleno: 'fill-emerald-600 dark:fill-emerald-400' },
  { tinta: 'stroke-sky-600 dark:stroke-sky-400', relleno: 'fill-sky-600 dark:fill-sky-400' },
  { tinta: 'stroke-violet-600 dark:stroke-violet-400', relleno: 'fill-violet-600 dark:fill-violet-400' },
  { tinta: 'stroke-rose-600 dark:stroke-rose-400', relleno: 'fill-rose-600 dark:fill-rose-400' },
  { tinta: 'stroke-indigo-600 dark:stroke-indigo-400', relleno: 'fill-indigo-600 dark:fill-indigo-400' },
  { tinta: 'stroke-teal-600 dark:stroke-teal-400', relleno: 'fill-teal-600 dark:fill-teal-400' },
]

type ColorAnio = (typeof PALETA)[number]

const fmtCompacto = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const fmtKwh = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 1,
})

const ANCHO = 720
const ALTO = 260
const M = { arriba: 14, derecha: 16, abajo: 46, izquierda: 64 }

/** % del alto por debajo del cual el tooltip se ancla hacia abajo del punto. */
const UMBRAL_TOOLTIP_ABAJO = 35

function formaSvg(
  forma: Forma,
  cx: number,
  cy: number,
  r: number,
  className: string,
  strokeWidth: number
): React.ReactElement {
  const comunes = { className, strokeWidth }
  switch (forma) {
    case 'circulo':
      return <circle cx={cx} cy={cy} r={r} {...comunes} />
    case 'cuadrado':
      return (
        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...comunes} />
      )
    case 'triangulo':
      return (
        <polygon
          points={`${cx},${cy - r - 1} ${cx + r + 1},${cy + r} ${cx - r - 1},${cy + r}`}
          {...comunes}
        />
      )
    case 'triangulo_abajo':
      return (
        <polygon
          points={`${cx},${cy + r + 1} ${cx + r + 1},${cy - r} ${cx - r - 1},${cy - r}`}
          {...comunes}
        />
      )
    case 'rombo':
      return (
        <polygon
          points={`${cx},${cy - r - 1} ${cx + r + 1},${cy} ${cx},${cy + r + 1} ${cx - r - 1},${cy}`}
          {...comunes}
        />
      )
    case 'cruz':
      return (
        <path
          d={`M${cx - r},${cy - r}L${cx + r},${cy + r}M${cx + r},${cy - r}L${cx - r},${cy + r}`}
          {...comunes}
        />
      )
  }
}

function segmentos(valores: (number | null | undefined)[]): [number, number][][] {
  // Troza la polyline en segmentos continuos (null = hueco).
  const tramos: [number, number][][] = []
  let actual: [number, number][] = []
  valores.forEach((v, i) => {
    if (v === null || v === undefined || !Number.isFinite(v)) {
      if (actual.length > 0) tramos.push(actual)
      actual = []
    } else {
      actual.push([i, v])
    }
  })
  if (actual.length > 0) tramos.push(actual)
  return tramos
}

function MarcaAnio({ forma, color }: { forma: Forma; color: ColorAnio }) {
  return (
    <svg viewBox="0 0 16 10" aria-hidden="true" className="h-2.5 w-4">
      <line x1={1} y1={5} x2={15} y2={5} strokeWidth={1.75} className={color.tinta} />
      {formaSvg(forma, 8, 5, 2.6, `${color.tinta} ${color.relleno}`, 1.25)}
    </svg>
  )
}

function BotonLeyenda({
  activo,
  etiqueta,
  marca,
  alAlternar,
}: {
  activo: boolean
  etiqueta: string
  marca: React.ReactNode
  alAlternar: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={alAlternar}
      className={`focus-ring inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-opacity ${
        activo ? '' : 'opacity-40'
      }`}
    >
      <span aria-hidden="true" className="inline-flex">
        {marca}
      </span>
      {etiqueta}
    </button>
  )
}

export function LineaBaseChart({
  serie,
  columna,
  criterio = 'banda_10_pct',
  etiquetaPred = 'Línea base',
}: LineaBaseChartProps) {
  const textos = TEXTOS_CRITERIO[criterio]
  const reduce = useReducedMotion()
  const svgRef = React.useRef<SVGSVGElement>(null)
  const overlayRef = React.useRef<HTMLDivElement>(null)
  const contenedorRef = React.useRef<HTMLDivElement>(null)

  const [activo, setActivo] = React.useState<number | null>(null)
  const [origen, setOrigen] = React.useState<'raton' | 'teclado' | null>(null)
  // Ancho real del gráfico: el vuelco horizontal del tooltip se calcula en px
  // (los umbrales fijos en % sólo valen en pantallas anchas).
  const [anchoContenedor, setAnchoContenedor] = React.useState(0)
  const [visibles, setVisibles] = React.useState({
    base: true,
    sup: true,
    inf: true,
  })
  const [aniosOcultos, setAniosOcultos] = React.useState<number[]>([])

  React.useEffect(() => {
    const el = contenedorRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0)
      setAnchoContenedor((prev) => (Math.abs(prev - w) < 1 ? prev : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const anios = React.useMemo(
    () => Array.from(new Set(serie.map((p) => p.ano))).sort((a, b) => a - b),
    [serie]
  )

  const series = React.useMemo(
    () =>
      anios.map((ano, idx) => {
        const porMes = new Map<number, PuntoSerie>()
        for (const p of serie) {
          if (p.ano === ano) porMes.set(p.mes, p)
        }
        const puntos = MESES.map((_, i) => porMes.get(i + 1) ?? null)
        return {
          ano,
          color: PALETA[idx % PALETA.length],
          forma: FORMAS[idx % FORMAS.length],
          valores: puntos.map((p) =>
            typeof p?.real === 'number' ? p.real : null
          ),
          descartados: puntos.map((p) => !!p?.descartado),
        }
      }),
    [serie, anios]
  )

  const referencias = React.useMemo(
    () =>
      MESES.map((_, i) => {
        const mes = i + 1
        const pts = serie.filter((p) => p.mes === mes)
        const preds = pts
          .map((p) => p[columna])
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        const conSup = pts.find((p) => typeof p.banda_sup === 'number')
        const conInf = pts.find((p) => typeof p.banda_inf === 'number')
        return {
          base: preds.length > 0 ? preds.reduce((a, b) => a + b, 0) / preds.length : null,
          sup: conSup && typeof conSup.banda_sup === 'number' ? conSup.banda_sup : null,
          inf: conInf && typeof conInf.banda_inf === 'number' ? conInf.banda_inf : null,
          estimado: pts.some((p) => p.estimado),
        }
      }),
    [serie, columna]
  )

  const limites = React.useMemo(() => {
    const valores: number[] = []
    for (const s of series) {
      for (const v of s.valores) if (typeof v === 'number') valores.push(v)
    }
    for (const r of referencias) {
      if (typeof r.base === 'number') valores.push(r.base)
      if (typeof r.sup === 'number') valores.push(r.sup)
      if (typeof r.inf === 'number') valores.push(r.inf)
    }
    if (valores.length === 0) return { min: 0, max: 1 }
    let min = Math.min(...valores)
    let max = Math.max(...valores)
    const margen = (max - min || Math.abs(max) || 1) * 0.08
    min -= margen
    max += margen
    return { min, max }
  }, [series, referencias])

  if (serie.length === 0) {
    return (
      <p className="ui-muted py-8 text-center text-sm">
        No hay serie mensual para graficar.
      </p>
    )
  }

  const anchoGrafica = ANCHO - M.izquierda - M.derecha
  const altoGrafica = ALTO - M.arriba - M.abajo
  const baseY = M.arriba + altoGrafica
  const x = (i: number) =>
    M.izquierda + (i / (MESES.length - 1)) * anchoGrafica
  const y = (v: number) =>
    M.arriba +
    (1 - (v - limites.min) / (limites.max - limites.min)) * altoGrafica

  const ticks = Array.from({ length: 4 }, (_, k) => {
    const v = limites.min + ((k + 1) * (limites.max - limites.min)) / 5
    return { v, yy: y(v) }
  })

  const tramosBase = segmentos(referencias.map((r) => r.base))
  const tramosSup = segmentos(referencias.map((r) => r.sup))
  const tramosInf = segmentos(referencias.map((r) => r.inf))
  const hayBase = referencias.some((r) => typeof r.base === 'number')
  const haySup = referencias.some((r) => typeof r.sup === 'number')
  const hayInf = referencias.some((r) => typeof r.inf === 'number')

  const visAnio = (ano: number) => !aniosOcultos.includes(ano)
  const alternarAnio = (ano: number) =>
    setAniosOcultos((prev) =>
      prev.includes(ano) ? prev.filter((a) => a !== ano) : [...prev, ano]
    )
  const alternar = (clave: 'base' | 'sup' | 'inf') =>
    setVisibles((v) => ({ ...v, [clave]: !v[clave] }))

  const mesActivo = activo !== null ? referencias[activo] : null
  const filasAnio =
    activo !== null
      ? series.map((s) => ({
          ano: s.ano,
          color: s.color,
          valor: s.valores[activo],
          descartado: s.descartados[activo],
        }))
      : []
  const aniosDescartados = filasAnio
    .filter((f) => f.descartado)
    .map((f) => f.ano)

  // Lectura en texto plano: aria-valuetext del slider y región viva.
  const lectura = (() => {
    if (activo === null || !mesActivo) return ''
    const partes: string[] = [MESES[activo]]
    for (const f of filasAnio) {
      if (typeof f.valor === 'number') {
        partes.push(`${f.ano} ${fmtKwh.format(f.valor)} kWh`)
      }
    }
    if (typeof mesActivo.base === 'number') {
      partes.push(`línea base ${fmtKwh.format(mesActivo.base)} kWh`)
    }
    if (typeof mesActivo.sup === 'number' && typeof mesActivo.inf === 'number') {
      partes.push(
        `límites ${fmtKwh.format(mesActivo.inf)} a ${fmtKwh.format(mesActivo.sup)} kWh`
      )
    }
    if (aniosDescartados.length > 0) {
      partes.push(
        `descartado ${aniosDescartados.join(', ')} ${textos.descarte}`
      )
    }
    if (mesActivo.estimado) {
      partes.push('mes estimado, sin banda (menos de 3 valores)')
    }
    return partes.join(', ')
  })()

  // Índice del mes más cercano a una X del navegador (viewBox 0..ANCHO).
  const indiceDesdeClientX = (clientX: number): number | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return null
    const px = ((clientX - rect.left) / rect.width) * ANCHO
    const bruto = ((px - M.izquierda) / anchoGrafica) * (MESES.length - 1)
    return Math.max(0, Math.min(MESES.length - 1, Math.round(bruto)))
  }

  const alPuntero = (e: React.MouseEvent<HTMLDivElement>) => {
    const i = indiceDesdeClientX(e.clientX)
    if (i === null) return
    setOrigen('raton')
    setActivo(i)
  }

  const alSalir = () => {
    // Con el teclado enfocado el cruce se mantiene (lo limpia el blur).
    if (overlayRef.current === document.activeElement) return
    setActivo(null)
    setOrigen(null)
  }

  const alEnfocar = () => {
    setOrigen('teclado')
    setActivo((prev) => prev ?? 0)
  }

  const alDeshacerFoco = () => {
    setActivo(null)
    setOrigen(null)
  }

  const alTecla = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const ultimo = MESES.length - 1
    const actual = activo ?? 0
    let siguiente: number
    if (e.key === 'ArrowRight') siguiente = Math.min(ultimo, actual + 1)
    else if (e.key === 'ArrowLeft') siguiente = Math.max(0, actual - 1)
    else if (e.key === 'Home') siguiente = 0
    else if (e.key === 'End') siguiente = ultimo
    else return
    e.preventDefault()
    setOrigen('teclado')
    setActivo(siguiente)
  }

  // Geometría del tooltip (se ancla al punto más alto del mes con vuelco).
  let estiloTooltip: React.CSSProperties | undefined
  if (activo !== null && mesActivo) {
    let yPunto = Infinity
    for (const f of filasAnio) {
      if (typeof f.valor === 'number') yPunto = Math.min(yPunto, y(f.valor))
    }
    if (!Number.isFinite(yPunto) && typeof mesActivo.base === 'number') {
      yPunto = y(mesActivo.base)
    }
    const pctX = (x(activo) / ANCHO) * 100
    const pctY = ((Number.isFinite(yPunto) ? yPunto : baseY) / ALTO) * 100
    const abajo = pctY < UMBRAL_TOOLTIP_ABAJO
    let left = `${pctX}%`
    let tx = pctX < 14 ? '0%' : pctX > 86 ? '-100%' : '-50%'
    if (anchoContenedor > 0) {
      // Media anchura máxima del tooltip (max-w en CSS) y vuelco por px para
      // que la caja nunca sobresalga del gráfico en pantallas estrechas.
      const mitad = Math.min(120, anchoContenedor / 2)
      const xPx = (pctX / 100) * anchoContenedor
      const centro = Math.min(Math.max(xPx, mitad), anchoContenedor - mitad)
      left = `${(centro / anchoContenedor) * 100}%`
      tx = '-50%'
    }
    estiloTooltip = {
      left,
      top: abajo ? `calc(${pctY}% + 14px)` : `calc(${pctY}% - 14px)`,
      transform: `translate(${tx}, ${abajo ? '0%' : '-100%'})`,
    }
  }

  const filasTooltip: { label: string; valor: string; clase: string }[] = []
  if (mesActivo) {
    for (const f of filasAnio) {
      if (typeof f.valor === 'number') {
        filasTooltip.push({
          label: String(f.ano),
          valor: `${fmtKwh.format(f.valor)} kWh`,
          clase: 'text-gray-600 dark:text-gray-300',
        })
      }
    }
    if (typeof mesActivo.base === 'number') {
      filasTooltip.push({
        label: etiquetaPred,
        valor: `${fmtKwh.format(mesActivo.base)} kWh`,
        clase: 'text-slate-600 dark:text-slate-300',
      })
    }
    if (typeof mesActivo.sup === 'number') {
      filasTooltip.push({
        label: 'Límite superior',
        valor: `${fmtKwh.format(mesActivo.sup)} kWh`,
        clase: 'text-gray-500 dark:text-gray-400',
      })
    }
    if (typeof mesActivo.inf === 'number') {
      filasTooltip.push({
        label: 'Límite inferior',
        valor: `${fmtKwh.format(mesActivo.inf)} kWh`,
        clase: 'text-gray-500 dark:text-gray-400',
      })
    }
  }

  return (
    <figure className="w-full">
      <div className="relative" ref={contenedorRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="h-auto w-full text-gray-400 dark:text-slate-500"
          role="img"
          aria-label={`Serie mensual de consumo contra ${etiquetaPred.toLowerCase()}`}
        >
          {/* Rejilla + eje Y */}
          {ticks.map((t) => (
            <g key={t.v}>
              <line
                x1={M.izquierda}
                x2={ANCHO - M.derecha}
                y1={t.yy}
                y2={t.yy}
                className="stroke-gray-200 dark:stroke-slate-800"
                strokeWidth={1}
              />
              <text
                x={M.izquierda - 8}
                y={t.yy + 3.5}
                textAnchor="end"
                fontSize={10}
                className="fill-gray-400 dark:fill-slate-500"
              >
                {fmtCompacto.format(Math.round(t.v))}
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

          {/* Límites de referencia (detrás de las series) */}
          {visibles.sup &&
            tramosSup.map((tramo, i) => (
              <motion.polyline
                key={`lim-sup-${i}`}
                className="ref-limite-sup stroke-slate-400 dark:stroke-slate-500"
                points={tramo.map(([xi, v]) => `${x(xi)},${y(v)}`).join(' ')}
                fill="none"
                strokeWidth={1.25}
                strokeDasharray="6 4"
                strokeLinejoin="round"
                initial={{ opacity: reduce ? 1 : 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              />
            ))}
          {visibles.inf &&
            tramosInf.map((tramo, i) => (
              <motion.polyline
                key={`lim-inf-${i}`}
                className="ref-limite-inf stroke-slate-400 dark:stroke-slate-500"
                points={tramo.map(([xi, v]) => `${x(xi)},${y(v)}`).join(' ')}
                fill="none"
                strokeWidth={1.25}
                strokeDasharray="3 3"
                strokeLinejoin="round"
                initial={{ opacity: reduce ? 1 : 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              />
            ))}

          {/* Series por año: solo marcadores de figura única (sin línea que los une) */}
          {series
            .filter((s) => visAnio(s.ano))
            .map((s) => (
              <React.Fragment key={s.ano}>
                {s.valores.map((v, i) => {
                  if (typeof v !== 'number') return null
                  const cx = x(i)
                  const cy = y(v)
                  const claseSerie = `serie-real serie-real-${s.ano}`
                  if (s.descartados[i]) {
                    return (
                      <g key={`descartado-${s.ano}-${i}`}>
                        {formaSvg(
                          s.forma,
                          cx,
                          cy,
                          3.4,
                          `${claseSerie} serie-descartado fill-none stroke-amber-500 dark:stroke-amber-400`,
                          1.75
                        )}
                      </g>
                    )
                  }
                  return (
                    <motion.g
                      key={`punto-${s.ano}-${i}`}
                      initial={{ opacity: reduce ? 1 : 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25, delay: 0.45 + i * 0.03 }}
                    >
                      {formaSvg(
                        s.forma,
                        cx,
                        cy,
                        3,
                        `${claseSerie} ${s.color.tinta} ${s.color.relleno}`,
                        1
                      )}
                    </motion.g>
                  )
                })}
              </React.Fragment>
            ))}

          {/* Línea base del modelo (encima de las series) */}
          {visibles.base &&
            tramosBase.map((tramo, i) => (
              <motion.polyline
                key={`base-${i}`}
                className="ref-base stroke-slate-700 dark:stroke-slate-200"
                points={tramo.map(([xi, v]) => `${x(xi)},${y(v)}`).join(' ')}
                fill="none"
                strokeWidth={1.75}
                strokeLinejoin="round"
                initial={{ opacity: reduce ? 1 : 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            ))}

          {/* Crosshair + resaltado de los puntos activos del mes */}
          {activo !== null && (
            <g className="crosshair">
              <line
                x1={x(activo)}
                x2={x(activo)}
                y1={M.arriba}
                y2={baseY}
                className="stroke-gray-300 dark:stroke-slate-600"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {filasAnio.map((f) =>
                typeof f.valor === 'number' ? (
                  <circle
                    key={`activa-${f.ano}`}
                    cx={x(activo)}
                    cy={y(f.valor)}
                    r={4.5}
                    className={`fill-white dark:fill-slate-900 ${f.color.tinta}`}
                    strokeWidth={1.75}
                  />
                ) : null
              )}
            </g>
          )}

          {/* Eje X: 12 meses calendario + título del eje */}
          {MESES.map((mes, i) => (
            <text
              key={mes}
              x={x(i)}
              y={ALTO - 26}
              textAnchor="middle"
              fontSize={9.5}
              className="fill-gray-400 dark:fill-slate-500"
            >
              {mes}
            </text>
          ))}
          <text
            x={M.izquierda + anchoGrafica / 2}
            y={ALTO - 8}
            textAnchor="middle"
            fontSize={10.5}
            className="fill-gray-500 dark:fill-slate-400"
          >
            Mes de Año
          </text>
        </svg>

        {/* Overlay de exploración: cruce con ratón y con el teclado */}
        <div
          ref={overlayRef}
          role="slider"
          aria-label="Explorador de la serie"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={MESES.length - 1}
          aria-valuenow={activo ?? 0}
          aria-valuetext={mesActivo ? lectura : undefined}
          tabIndex={0}
          className="focus-ring absolute inset-0 cursor-crosshair"
          onMouseOver={alPuntero}
          onMouseMove={alPuntero}
          onMouseLeave={alSalir}
          onFocus={alEnfocar}
          onBlur={alDeshacerFoco}
          onKeyDown={alTecla}
        />

        {/* Tooltip del mes activo */}
        {estiloTooltip && mesActivo && (
          <div
            role="tooltip"
            style={estiloTooltip}
            className="pointer-events-none absolute z-10 min-w-[10rem] max-w-[min(15rem,100%)] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] leading-snug shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {MESES[activo ?? 0]}
            </p>
            {filasTooltip.length > 0 && (
              <dl className="mt-1 space-y-0.5">
                {filasTooltip.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <dt className="text-gray-500 dark:text-gray-400">
                      {f.label}
                    </dt>
                    <dd className={`text-right font-mono font-semibold ${f.clase}`}>
                      {f.valor}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {aniosDescartados.length > 0 && (
              <p className="mt-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                Descartado · {textos.descarte} ({aniosDescartados.join(', ')})
              </p>
            )}
            {mesActivo.estimado && (
              <p className="mt-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 dark:bg-sky-950/70 dark:text-sky-300">
                Estimado · sin banda (menos de 3 valores)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Leyenda interactiva: cada entrada oculta/restaura su capa */}
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {series.map((s) => (
          <BotonLeyenda
            key={s.ano}
            activo={visAnio(s.ano)}
            etiqueta={String(s.ano)}
            marca={<MarcaAnio forma={s.forma} color={s.color} />}
            alAlternar={() => alternarAnio(s.ano)}
          />
        ))}
        {hayBase && (
          <BotonLeyenda
            activo={visibles.base}
            etiqueta={etiquetaPred}
            marca={
              <span className="h-0.5 w-4 rounded bg-slate-700 dark:bg-slate-200" />
            }
            alAlternar={() => alternar('base')}
          />
        )}
        {haySup && (
          <BotonLeyenda
            activo={visibles.sup}
            etiqueta="Límite superior"
            marca={
              <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-slate-400 dark:border-slate-500" />
            }
            alAlternar={() => alternar('sup')}
          />
        )}
        {hayInf && (
          <BotonLeyenda
            activo={visibles.inf}
            etiqueta="Límite inferior"
            marca={
              <span className="h-0.5 w-4 rounded border-t-2 border-dotted border-slate-400 dark:border-slate-500" />
            }
            alAlternar={() => alternar('inf')}
          />
        )}
      </figcaption>

      {/* El slider ya anuncia aria-valuetext al moverse con teclado; esta
          región viva cubre el cambio de cruce con el ratón. */}
      <div aria-live="polite" className="sr-only">
        {origen === 'raton' && activo !== null ? lectura : ''}
      </div>
    </figure>
  )
}
