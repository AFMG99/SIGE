'use client'

import React from 'react'
import { ListboxSelect, type ListboxOption } from '@/shared/views/ui/ListboxSelect'
import { ejecutarAnalisis } from '@/features/analisis/controllers/analisis'
import {
  cargarContextoXm,
  cargarSerieMercadoXm,
  cargarSerieSistemaXm,
} from '@/features/analisis/controllers/xm'
import {
  ahorroAnual,
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
  FORMULA_AHORRO,
  lbenPromedio,
  MESES_ES,
  modeloPorDefecto,
  opcionesModelo,
  PERIODICIDAD,
  PRECISION_TEXTO,
  TEXTO_CALENDARIO,
  TEXTO_DIRECCION,
  TEXTO_MODELO,
  textoCriterio,
  type AnalisisResultado,
  type ModeloClave,
  type Periodicidad,
  type PeriodoAnalizado,
} from '../models/analisis'
import {
  trazarSparkline,
  URLS_XM,
  type RespuestaContextoXm,
  type RespuestaSerieXm,
  type SerieXm,
} from '../models/xm'
import { AnalisisChart } from './AnalisisChart'

/**
 * Módulo 3 — Análisis estadístico y detección de patrones (HU-07 esc. 2,
 * HU-04 esc. 2).
 *
 * Todo dato entra por props; el análisis se ejecuta bajo demanda vía
 * server action (guard `consumption`/`analyze` en el servidor) y no se
 * persiste. El selector es por EDIFICACIÓN: la factura es el dato medido
 * (no un share estimado) y la detección por mes calendario es invariante
 * a la escala, así que el patrón temporal es el mismo que cualquier
 * reparto lineal del bloque produciría.
 */

const CLASE_BADGE =
  'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium'

function BadgeCalendario({ periodo }: { periodo: PeriodoAnalizado }) {
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
function ChipIcon({ children, amber = false }: { children: React.ReactNode; amber?: boolean }) {
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

const ATRIBUTOS_ICONO = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** ISO de la consulta → 'dd/mm/aaaa' en la zona local del navegador. */
function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  const dia = String(fecha.getDate()).padStart(2, '0')
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${fecha.getFullYear()}`
}

function periodoDe(periodo: string): { mes: number; anio: number } {
  return { anio: Number(periodo.slice(0, 4)), mes: Number(periodo.slice(5, 7)) }
}

/**
 * Tarjeta de una serie XM: demanda mensual, índice base 100,
 * variación interanual y sparkline de 13 meses.
 */
function TarjetaSerieXm({
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

export interface AnalisisViewProps {
  edificaciones: { id: string; nombre: string }[]
  /** false = puede consultar la página pero no ejecutar el análisis. */
  puedeAnalizar: boolean
}

export function AnalisisView({ edificaciones, puedeAnalizar }: AnalisisViewProps) {
  const [edificacionId, setEdificacionId] = React.useState(
    edificaciones.length === 1 ? edificaciones[0].id : ''
  )
  const [resultado, setResultado] = React.useState<AnalisisResultado | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  /** Nivel de los KPIs de gestión: 'edi' (exacto) | 'b:<id>' | 'e:<id>'. */
  const [nivelId, setNivelId] = React.useState('edi')
  /** Modelo de LBEn elegido («» = automático: el primero disponible, §7.4). */
  const [modeloId, setModeloId] = React.useState('')
  /** Granularidad de la serie y de la tabla de ahorros §8.1. */
  const [periodicidad, setPeriodicidad] = React.useState<Periodicidad>('mes')
  /** Resultado del benchmark XM: se carga una sola vez por análisis. */
  const [serieSistema, setSerieSistema] = React.useState<RespuestaSerieXm | null>(null)
  const [serieMercado, setSerieMercado] = React.useState<RespuestaSerieXm | null>(null)
  const [contexto, setContexto] = React.useState<RespuestaContextoXm | null>(null)
  const [benchmarkCargando, setBenchmarkCargando] = React.useState(false)
  const benchmarkSolicitado = React.useRef(false)

  const opciones: ListboxOption[] = edificaciones.map((e) => ({
    value: e.id,
    label: e.nombre,
  }))

  const analizar = React.useCallback(async () => {
    if (!edificacionId) {
      setError('Seleccione una edificación para ejecutar el análisis.')
      return
    }
    setCargando(true)
    setError(null)
    try {
      const respuesta = await ejecutarAnalisis({ edificacionId })
      if (respuesta.ok) {
        setResultado(respuesta.analisis)
        // Un análisis nuevo vuelve al nivel exacto (edificación), al modelo
        // automático del selector y a la serie mensual.
        setNivelId('edi')
        setModeloId('')
        setPeriodicidad('mes')
      } else {
        setResultado(null)
        setError(respuesta.error)
      }
    } catch {
      setResultado(null)
      setError('No se pudo ejecutar el análisis. Intente nuevamente.')
    } finally {
      setCargando(false)
    }
  }, [edificacionId])

  const salida = resultado?.salida
  const resumen = salida?.resumen
  const niveles = resultado?.gestion.niveles ?? []
  const nivel = niveles.find((n) => n.clave === nivelId) ?? niveles[0] ?? null
  const opcionesNivel: ListboxOption[] = niveles.map((n) => ({
    value: n.clave,
    label: n.precision === 'estimado' ? `${n.nombre} · estimado` : n.nombre,
  }))

  // ── Línea base del análisis: selector §7.4 + ahorros §8.1 ────────────
  const modelos = salida?.modelos ?? null
  const opcionesSelectorModelo = opcionesModelo(modelos)
  const modeloClave: ModeloClave | null =
    modelos &&
    opcionesSelectorModelo.some((o) => o.clave === modeloId && o.habilitado)
      ? (modeloId as ModeloClave)
      : modeloPorDefecto(modelos)
  const modeloActual = modelos && modeloClave ? modelos[modeloClave] : null
  const descripcionModelo = modeloClave ? TEXTO_MODELO[modeloClave] : null
  const ahorro = modeloActual?.ahorro ?? null
  // Modo anual de la tabla §8.1: Σ de las 12 filas mensuales.
  const ahorroAnualTotal = ahorro && periodicidad === 'ano' ? ahorroAnual(ahorro) : null
  const lbenMedia = modeloActual ? lbenPromedio(modeloActual) : null
  const mesesConLben =
    modeloActual?.lben_mensual.filter((v): v is number => typeof v === 'number') ?? []
  const lbenAnual =
    mesesConLben.length > 0 ? mesesConLben.reduce((suma, v) => suma + v, 0) : null

  // Chips de validación: sólo los criterios aplicables al modelo elegido.
  const chipsValidacion: string[] = []
  if (modeloActual) {
    const v = modeloActual.validacion
    chipsValidacion.push(`n = ${formatoNumero(v.n, 0)} datos depurados`)
    const criterio = textoCriterio(v.criterio)
    if (criterio) chipsValidacion.push(criterio)
    if (v.intervalo_inf !== null && v.intervalo_sup !== null) {
      chipsValidacion.push(
        `Intervalo 95 %: [${formatoNumero(v.intervalo_inf)}, ${formatoNumero(v.intervalo_sup)}]`
      )
    }
    if (v.r2 !== null) chipsValidacion.push(`R² = ${formatoNumero(v.r2, 4)}`)
    if (v.mape !== null) chipsValidacion.push(`MAPE = ${formatoNumero(v.mape, 2)} %`)
    if (v.p_value_max !== null) {
      chipsValidacion.push(`p-valor máx. = ${formatoNumero(v.p_value_max, 4)}`)
    }
  }
  // Valores display de los KPIs de la línea base (la unidad del dominio
  // es kWh/mes en todos los modelos; el modo anual sólo agrega).
  const lbenKpi =
    periodicidad === 'ano'
      ? lbenAnual !== null
        ? `${formatoNumero(lbenAnual, 0)} kWh/año`
        : '—'
      : lbenMedia !== null
        ? `${formatoNumero(lbenMedia, 0)} kWh/mes`
        : '—'
  const potencialKpi = ahorro
    ? periodicidad === 'ano'
      ? `${formatoNumero(ahorroAnualTotal?.potencial ?? 0, 1)} kWh/año`
      : `${formatoNumero(ahorro.potencial_mensual, 1)} kWh/mes`
    : 'No aplica'
  const pctAhorro =
    periodicidad === 'ano'
      ? ahorroAnualTotal?.potencial_pct ?? null
      : ahorro?.potencial_pct ?? null

  // Benchmark XM: tres acciones en paralelo, una sola vez por análisis.
  React.useEffect(() => {
    if (!resultado || benchmarkSolicitado.current) return
    benchmarkSolicitado.current = true
    let vivo = true
    setBenchmarkCargando(true)
    void Promise.allSettled([
      cargarSerieSistemaXm(),
      cargarSerieMercadoXm(),
      cargarContextoXm(),
    ]).then(([sistema, mercado, ctx]) => {
      if (!vivo) return
      const falloSerie =
        'No se pudo contactar la API de XM. El análisis no se ve afectado.'
      setSerieSistema(
        sistema.status === 'fulfilled' ? sistema.value : { estado: 'error', mensaje: falloSerie }
      )
      setSerieMercado(
        mercado.status === 'fulfilled' ? mercado.value : { estado: 'error', mensaje: falloSerie }
      )
      setContexto(
        ctx.status === 'fulfilled'
          ? ctx.value
          : {
              estado: 'error',
              mensaje: 'No se pudo cargar la comparación interna y el catálogo de XM.',
            }
      )
      setBenchmarkCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [resultado])

  const respuestasSerie: (RespuestaSerieXm | null)[] = [serieSistema, serieMercado]
  const seriesOk = respuestasSerie.filter(
    (r): r is Extract<RespuestaSerieXm, { estado: 'ok' }> => r?.estado === 'ok'
  )
  const erroresSerie = respuestasSerie.filter(
    (r): r is Extract<RespuestaSerieXm, { estado: 'error' }> => r?.estado === 'error'
  )
  const comparacion =
    contexto?.estado === 'ok' ? contexto.contexto.comparacionInterna : null
  const catalogo = contexto?.estado === 'ok' ? contexto.contexto.catalogo : []
  const fechaConsulta =
    contexto?.estado === 'ok' ? fechaCorta(contexto.contexto.fechaConsulta) : null

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="ui-title text-2xl">Análisis estadístico y patrones</h1>
        <p className="ui-muted max-w-3xl text-sm leading-relaxed">
          Señala las épocas de consumo inusual del histórico completo de facturas y las
          relaciona con el calendario académico. Cada período se evalúa contra la banda de
          confianza de su mes (±10 %, ec. 3; ±2·DesvEst, ec. 4-5 cuando hay 10 o más
          muestras del mes) según la Resolución UPME 0016 de 2024.
        </p>
      </div>

      {/* Controles */}
      <div className="ui-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
          <div className="ui-field min-w-0 flex-1">
            <label htmlFor="analisis-edificacion" className="ui-label">
              Edificación
            </label>
            <ListboxSelect
              id="analisis-edificacion"
              value={edificacionId}
              onChange={setEdificacionId}
              options={opciones}
              placeholder="— Seleccione una edificación —"
              disabled={!puedeAnalizar || cargando}
              className="ui-input min-h-10 w-full"
            />
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-primary focus-ring w-full sm:w-auto"
            onClick={analizar}
            disabled={!puedeAnalizar || cargando || !edificacionId}
          >
            {cargando ? 'Analizando…' : 'Ejecutar análisis'}
          </button>
        </div>

        {!puedeAnalizar && (
          <p className="ui-callout ui-callout-info">
            Su rol puede consultar este módulo, pero ejecutar análisis requiere el permiso
            «Analizar consumo» (gestor energético o permiso personalizado).
          </p>
        )}
      </div>

      {error && (
        <p className="ui-callout ui-callout-danger" role="alert">
          {error}
        </p>
      )}

      {/* Estado inicial */}
      {!resultado && !error && (
        <div className="ui-empty py-12">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-uv-forest dark:text-emerald-400"
            aria-hidden
          >
            <path d="M3 3v18h18" />
            <path d="m7 15 4-6 4 3 5-8" />
          </svg>
          <p className="ui-title text-sm">Sin análisis ejecutado</p>
          <p className="max-w-md text-xs">
            Seleccione una edificación y ejecute el análisis para ver la serie histórica, los
            períodos inusuales y su relación con el calendario académico. No se guarda
            información: el análisis se calcula bajo demanda.
          </p>
        </div>
      )}

      {/* Resultado */}
      {salida && resumen && resultado && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="ui-title text-base">{resultado.nombreEdificacion}</h2>
            <p className="ui-muted text-xs tabular-nums">
              {resultado.desde} → {resultado.hasta} · calculado el{' '}
              {new Date(resultado.calculadoEn).toLocaleString('es-CO', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'America/Bogota',
              })}
            </p>
          </div>

          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="ui-card-stat h-full">
              <div className="flex items-center gap-2">
                <ChipIcon>
                  <svg {...ATRIBUTOS_ICONO}>
                    <rect x="3" y="4" width="18" height="17" rx="2" />
                    <path d="M8 2v4M16 2v4M3 10h18" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">Períodos analizados</p>
              </div>
              <p className="ui-title mt-2 text-2xl tabular-nums">
                {formatoNumero(resumen.periodos, 0)}
              </p>
            </div>
            <div className="ui-card-stat h-full">
              <div className="flex items-center gap-2">
                <ChipIcon amber>
                  <svg {...ATRIBUTOS_ICONO}>
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">Períodos inusuales</p>
              </div>
              <p
                className={`mt-2 text-2xl font-semibold tabular-nums ${
                  resumen.atipicos > 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {formatoNumero(resumen.atipicos, 0)}
              </p>
            </div>
            <div className="ui-card-stat h-full">
              <div className="flex items-center gap-2">
                <ChipIcon>
                  <svg {...ATRIBUTOS_ICONO}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">Evaluados con banda</p>
              </div>
              <p className="ui-title mt-2 text-2xl tabular-nums">
                {resumen.periodos > 0
                  ? `${formatoNumero((resumen.periodos_con_banda / resumen.periodos) * 100, 0)} %`
                  : '—'}
              </p>
            </div>
            <div className="ui-card-stat h-full">
              <div className="flex items-center gap-2">
                <ChipIcon>
                  <svg {...ATRIBUTOS_ICONO}>
                    <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
                    <path d="M16 7h6v6" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">Tendencia anual</p>
              </div>
              <p className="ui-title mt-2 text-2xl tabular-nums">
                {typeof salida.tendencia.variacion_pct_anual === 'number'
                  ? formatoPct(salida.tendencia.variacion_pct_anual)
                  : '—'}
              </p>
            </div>
          </div>

          {/* Avisos de cobertura */}
          {(salida.meses_insuficientes.length > 0 ||
            resumen.sin_calendario > 0 ||
            resumen.ajustes > 0) && (
            <div className="space-y-3">
              {salida.meses_insuficientes.length > 0 && (
                <p className="ui-callout ui-callout-warn">
                  {salida.meses_insuficientes.length}{' '}
                  {salida.meses_insuficientes.length === 1
                    ? 'mes sin banda evaluable'
                    : 'meses sin banda evaluable'}
                  {' (se requieren '}
                  {salida.min_valores_por_mes} facturas del mismo mes calendario): sus
                  períodos aparecen como «sin banda» y no se pudieron evaluar.
                </p>
              )}
              {resumen.sin_calendario > 0 && (
                <p className="ui-callout ui-callout-info">
                  {resumen.sin_calendario}{' '}
                  {resumen.sin_calendario === 1
                    ? 'período no tiene'
                    : 'períodos no tienen'}{' '}
                  datos de días lectivos. Registre las variables operativas de los bloques
                  para ver el overlay del calendario académico.
                </p>
              )}
              {resumen.ajustes > 0 && (
                <p className="ui-callout ui-callout-info">
                  Se aplicaron {resumen.ajustes}{' '}
                  {resumen.ajustes === 1 ? 'ajuste no rutinario' : 'ajustes no rutinarios'}{' '}
                  del Anexo 4 antes del análisis (períodos ya justificados por el gestor no
                  se reportan como inusuales).
                </p>
              )}
            </div>
          )}

          {/* Línea base del análisis: selector §7.4-7.5 + ahorros §8.1 */}
          {salida.modelos ? (
            <section
              aria-labelledby="titulo-lben-analisis"
              className="ui-card space-y-4 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="titulo-lben-analisis" className="ui-title text-sm">
                  Línea base del análisis
                </h3>
                <p className="ui-muted text-xs">
                  Recálculo al vuelo · Resolución UPME 0016 de 2024 §7.4-7.5 y §8.1
                </p>
              </div>

              {/* Selectores: modelo (§7.4) y periodicidad de la serie */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="ui-field">
                  <label htmlFor="analisis-modelo" className="ui-label">
                    Modelo de línea base
                  </label>
                  <ListboxSelect
                    id="analisis-modelo"
                    value={modeloClave ?? ''}
                    onChange={setModeloId}
                    options={opcionesSelectorModelo.map((o) => ({
                      value: o.clave,
                      label: o.etiqueta,
                      disabled: !o.habilitado,
                    }))}
                    placeholder="— Ningún modelo disponible —"
                    className="ui-input min-h-10 w-full"
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="analisis-periodicidad" className="ui-label">
                    Periodicidad
                  </label>
                  <ListboxSelect
                    id="analisis-periodicidad"
                    value={periodicidad}
                    onChange={(valor) => setPeriodicidad(valor as Periodicidad)}
                    options={PERIODICIDAD.map((p) => ({
                      value: p.valor,
                      label: p.habilitado ? p.etiqueta : `${p.etiqueta} — ${p.motivo}`,
                      disabled: !p.habilitado,
                    }))}
                    className="ui-input min-h-10 w-full"
                  />
                </div>
              </div>

              {!modeloClave || !modeloActual || !descripcionModelo ? (
                <p className="ui-callout ui-callout-warn">
                  Ninguno de los modelos de línea base pudo calcularse con esta serie.
                  Revise el motor para conocer el motivo de cada modelo.
                </p>
              ) : (
                <>
                  {/* Identidad del modelo: etiqueta, fórmula, chips y faltantes */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-uv-ink dark:text-slate-100">
                        {modeloActual.etiqueta}
                      </h4>
                      <code className="ui-chip">{modeloActual.unidad}</code>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      {modeloActual.formula}
                    </p>
                    <p className="ui-muted text-xs">{descripcionModelo}</p>
                    {opcionesSelectorModelo.some((o) => !o.habilitado) && (
                      <ul className="ui-muted space-y-1 text-xs">
                        {opcionesSelectorModelo
                          .filter((o) => !o.habilitado)
                          .map((o) => (
                            <li key={o.clave}>
                              <span className="font-medium">{o.etiqueta}:</span>{' '}
                              {o.motivo}
                            </li>
                          ))}
                      </ul>
                    )}
                    <ul className="flex flex-wrap gap-1.5">
                      {chipsValidacion.map((chip) => (
                        <li key={chip}>
                          <code className="ui-chip">{chip}</code>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* KPIs de la línea base (kWh/mes: unidad del dominio) */}
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <div className="ui-card-stat h-full">
                      <div className="flex items-center gap-2">
                        <ChipIcon>
                          <svg {...ATRIBUTOS_ICONO}>
                            <path d="M3 3v18h18" />
                            <path d="m7 15 4-6 4 3 5-8" />
                          </svg>
                        </ChipIcon>
                        <p className="ui-muted text-xs">
                          {periodicidad === 'ano'
                            ? 'LBEn (total anual)'
                            : 'LBEn (promedio)'}
                        </p>
                      </div>
                      <p className="ui-title mt-2 text-2xl tabular-nums">{lbenKpi}</p>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {periodicidad === 'ano'
                          ? 'Suma de los 12 meses calendario del modelo.'
                          : 'Media de los 12 meses calendario del modelo.'}
                      </p>
                    </div>
                    <div className="ui-card-stat h-full">
                      <div className="flex items-center gap-2">
                        <ChipIcon>
                          <svg {...ATRIBUTOS_ICONO}>
                            <path d="m13 2-2 8h5l-3 12" />
                          </svg>
                        </ChipIcon>
                        <p className="ui-muted text-xs">Potencial de ahorro §8.1</p>
                      </div>
                      <p className="ui-title mt-2 text-2xl tabular-nums">
                        {potencialKpi}
                      </p>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {ahorro
                          ? periodicidad === 'ano'
                            ? 'Suma de los 12 potenciales mensuales.'
                            : 'Media de los 12 potenciales mensuales (ec. 9).'
                          : 'La Resolución no define potencial para este modelo.'}
                      </p>
                    </div>
                    <div className="ui-card-stat h-full">
                      <div className="flex items-center gap-2">
                        <ChipIcon>
                          <svg {...ATRIBUTOS_ICONO}>
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 3" />
                          </svg>
                        </ChipIcon>
                        <p className="ui-muted text-xs">% de la LBEn</p>
                      </div>
                      <p className="ui-title mt-2 text-2xl tabular-nums">
                        {pctAhorro !== null ? `${formatoNumero(pctAhorro, 1)} %` : '—'}
                      </p>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Ec. 12 — potencial ÷ LBEn del mismo período.
                      </p>
                    </div>
                  </div>

                  {/* Tabla §8.1: potencial de ahorro por mes calendario */}
                  {ahorro ? (
                    <div className="space-y-2">
                      <div className="ui-table-shell">
                        <table className="ui-table text-sm">
                          <thead>
                            <tr>
                              <th scope="col">
                                {periodicidad === 'ano' ? 'Período' : 'Mes'}
                              </th>
                              <th scope="col" className="text-right">
                                LBEn
                              </th>
                              <th scope="col" className="text-right">
                                Mejor desempeño
                              </th>
                              <th scope="col" className="text-right">
                                Potencial
                              </th>
                              <th scope="col" className="text-right">
                                % de la LBEn
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {periodicidad === 'ano' ? (
                              <tr>
                                <td>Total anual (12 meses)</td>
                                <td className="text-right tabular-nums">
                                  {formatoNumero(ahorroAnualTotal?.lben ?? 0)}
                                </td>
                                <td className="text-right tabular-nums">
                                  {formatoNumero(ahorroAnualTotal?.mejor ?? 0)}
                                </td>
                                <td className="text-right tabular-nums">
                                  {formatoNumero(ahorroAnualTotal?.potencial ?? 0)}
                                </td>
                                <td className="text-right tabular-nums">
                                  {ahorroAnualTotal?.potencial_pct === null ||
                                  ahorroAnualTotal === null
                                    ? '—'
                                    : `${formatoNumero(ahorroAnualTotal.potencial_pct, 1)} %`}
                                </td>
                              </tr>
                            ) : (
                              ahorro.por_mes.map((fila) => (
                                <tr key={fila.mes}>
                                  <td>{MESES_ES[fila.mes - 1]}</td>
                                  <td className="text-right tabular-nums">
                                    {formatoNumero(fila.lben)}
                                  </td>
                                  <td className="text-right tabular-nums">
                                    {formatoNumero(fila.mejor)}
                                  </td>
                                  <td className="text-right tabular-nums">
                                    {formatoNumero(fila.potencial)}
                                  </td>
                                  <td className="text-right tabular-nums">
                                    {fila.potencial_pct === null
                                      ? '—'
                                      : `${formatoNumero(fila.potencial_pct, 1)} %`}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <p className="ui-muted text-xs">
                        {periodicidad === 'ano'
                          ? `Modo anual: suma de los 12 meses en ${modeloActual.unidad.replace('/mes', '/año')}.`
                          : `LBEn y potencial en ${modeloActual.unidad}; «Mejor desempeño» es el consumo mínimo del mes en el periodo base.`}
                      </p>
                      {FORMULA_AHORRO[modeloClave] && (
                        <p className="ui-muted text-xs">
                          {FORMULA_AHORRO[modeloClave]}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="ui-empty py-8">
                      <p className="ui-title text-sm">§8.1 no define potencial</p>
                      <p className="max-w-xl text-xs">
                        {modeloActual.nota ??
                          'La Resolución no define potencial de ahorro para este modelo.'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
          ) : (
            <p className="ui-callout ui-callout-warn">
              El motor no devolvió la sección de modelos de línea base (versión
              anterior del servicio engine). El análisis de períodos inusuales está
              completo; actualice el motor para habilitar el selector de modelos y
              los ahorros §8.1.
            </p>
          )}

          {/* Indicadores de gestión por nivel (KPIs ahorro/elevado/inusuales) */}
          {nivel && (
            <div className="ui-card space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="ui-title text-sm">Ahorro y consumo elevado</h3>
                <span
                  className={
                    nivel.precision === 'exacto'
                      ? `${CLASE_BADGE} border-emerald-600/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300`
                      : `${CLASE_BADGE} border-sky-600/40 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300`
                  }
                >
                  {PRECISION_TEXTO[nivel.tipo]}
                </span>
              </div>

              <div className="ui-field">
                <label htmlFor="analisis-nivel" className="ui-label">
                  Nivel de análisis
                </label>
                <ListboxSelect
                  id="analisis-nivel"
                  value={nivel.clave}
                  onChange={setNivelId}
                  options={opcionesNivel}
                  placeholder="— Seleccione un nivel —"
                  className="ui-input min-h-10 w-full sm:max-w-md"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Ahorro frente a la línea base guardada */}
                <div className="ui-card-stat">
                  <div className="flex items-center gap-2">
                    <ChipIcon>
                      <svg {...ATRIBUTOS_ICONO}>
                        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                      </svg>
                    </ChipIcon>
                    <p className="ui-muted text-xs">Ahorro vs línea base</p>
                  </div>
                  {nivel.ahorro.ahorroPct !== null ? (
                    <>
                      <p
                        className={`mt-2 text-2xl font-semibold tabular-nums ${
                          nivel.ahorro.ahorroPct < 0
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {formatoPct(nivel.ahorro.ahorroPct)}
                      </p>
                      <p className="ui-muted mt-1 text-xs tabular-nums">
                        {formatoNumero(nivel.ahorro.ahorroKwh ?? 0, 0)} kWh/mes vs{' '}
                        {formatoNumero(nivel.ahorro.lbKwh ?? 0, 0)} · {nivel.ahorro.lbModelo}
                      </p>
                      {nivel.ahorro.lbCobertura && (
                        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                          {nivel.ahorro.lbCobertura}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                      {nivel.ahorro.nota ?? 'Sin línea base para comparar.'}
                    </p>
                  )}
                </div>

                {/* Consumo elevado: por encima de la banda superior del mes */}
                <div className="ui-card-stat">
                  <div className="flex items-center gap-2">
                    <ChipIcon amber={nivel.elevado.meses > 0}>
                      <svg {...ATRIBUTOS_ICONO}>
                        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </ChipIcon>
                    <p className="ui-muted text-xs">Consumo elevado</p>
                  </div>
                  <p
                    className={`mt-2 text-2xl font-semibold tabular-nums ${
                      nivel.elevado.meses > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {formatoNumero(nivel.elevado.meses, 0)}
                  </p>
                  <p className="ui-muted mt-1 text-xs">
                    {nivel.elevado.meses === 1
                      ? 'mes por encima de la banda superior'
                      : 'meses por encima de la banda superior'}
                  </p>
                  {nivel.elevado.maximoPeriodo && nivel.elevado.maximoKwh !== null && (
                    <p className="mt-1 text-xs tabular-nums text-gray-600 dark:text-gray-300">
                      Máximo:{' '}
                      {etiquetaPeriodo(
                        Number(nivel.elevado.maximoPeriodo.slice(5, 7)),
                        Number(nivel.elevado.maximoPeriodo.slice(0, 4))
                      )}{' '}
                      · {formatoKwh(nivel.elevado.maximoKwh)}
                    </p>
                  )}
                </div>

                {/* Períodos inusuales ya escala al nivel seleccionado */}
                <div className="ui-card-stat">
                  <div className="flex items-center gap-2">
                    <ChipIcon amber={nivel.inusuales.cantidad > 0}>
                      <svg {...ATRIBUTOS_ICONO}>
                        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                        <path d="M12 9v4M12 17h.01" />
                      </svg>
                    </ChipIcon>
                    <p className="ui-muted text-xs">Períodos inusuales del nivel</p>
                  </div>
                  <p
                    className={`mt-2 text-2xl font-semibold tabular-nums ${
                      nivel.inusuales.cantidad > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {formatoNumero(nivel.inusuales.cantidad, 0)}
                  </p>
                  <p className="ui-muted mt-1 text-xs tabular-nums">
                    {formatoKwh(nivel.inusuales.kwh)} en el período
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                    El conteo es igual en todos los niveles: la detección es por mes
                    calendario, invariante a la escala.
                  </p>
                </div>
              </div>

              <p className="ui-muted text-xs tabular-nums">
                Consumo promedio del nivel: {formatoKwh(nivel.consumoPromedioKwh)}/mes (30 d)
                {nivel.share !== null && ` · share ${formatoNumero(nivel.share * 100, 1)} %`}
                {nivel.elevado.variacionPctAnual !== null &&
                  ` · tendencia ${formatoPct(nivel.elevado.variacionPctAnual)}`}
              </p>
            </div>
          )}

          {/* Gráfica */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="ui-title text-sm">Serie histórica de consumo</h3>
              <p className="ui-muted text-xs tabular-nums">
                kWh normalizados a 30 días · media de la serie:{' '}
                {typeof salida.estadisticos.media === 'number'
                  ? formatoKwh(salida.estadisticos.media)
                  : '—'}
                {modeloActual?.estado === 'disponible' &&
                  ` · LBEn: ${modeloActual.etiqueta}`}
                {periodicidad === 'ano' && ' · serie anual'}
              </p>
            </div>
            <div className="ui-card p-5 sm:p-6">
              <AnalisisChart
                periodos={salida.periodos}
                media={salida.estadisticos.media}
                lben={
                  modeloActual?.estado === 'disponible' ? modeloActual.lben_mensual : null
                }
                periodicidad={periodicidad === 'ano' ? 'ano' : 'mes'}
              />
            </div>
          </div>

          {/* Períodos inusuales */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="ui-title text-sm">Períodos inusuales</h3>
              <p className="ui-muted text-xs">
                {resumen.atipicos_alza} en alza · {resumen.atipicos_caida} en caída ·{' '}
                {resumen.en_lectivo} en período lectivo · {resumen.en_vacaciones} en
                vacaciones
              </p>
            </div>

            {resumen.atipicos === 0 ? (
              <div className="ui-empty py-10">
                <p className="ui-title text-sm">Sin períodos inusuales</p>
                <p className="max-w-md text-xs">
                  Todos los períodos con banda evaluada quedaron dentro del rango esperado de
                  su mes calendario.
                </p>
              </div>
            ) : (
              <div className="ui-table-shell">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Período</th>
                      <th scope="col">Consumo</th>
                      <th scope="col">Banda del mes</th>
                      <th scope="col">Desviación</th>
                      <th scope="col">Señal</th>
                      <th scope="col">Calendario</th>
                      <th scope="col">Explicación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salida.periodos
                      .filter((p) => p.es_atipico)
                      .map((p) => (
                        <tr
                          key={`${p.ano}-${p.mes}`}
                          className="bg-amber-50/70 dark:bg-amber-950/25"
                        >
                          <td className="whitespace-nowrap font-medium">
                            {etiquetaPeriodo(p.mes, p.ano)}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">
                            {formatoKwh(p.consumo_kwh)}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">
                            {p.banda_inf !== null && p.banda_sup !== null
                              ? `${formatoNumero(p.banda_inf, 0)} – ${formatoNumero(p.banda_sup, 0)} kWh`
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap text-right font-medium tabular-nums text-amber-700 dark:text-amber-300">
                            {typeof p.desviacion_pct === 'number'
                              ? formatoPct(p.desviacion_pct)
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap">
                            <span
                              className={`${CLASE_BADGE} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300`}
                            >
                              {p.direccion === 'alza' ? '↑' : '↓'}{' '}
                              {p.direccion ? TEXTO_DIRECCION[p.direccion] : ''}
                            </span>
                          </td>
                          <td>
                            <BadgeCalendario periodo={p} />
                          </td>
                          <td className="min-w-72 text-xs font-normal">
                            {p.explicacion}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Benchmark XM: series nacionales, comparación interna y catálogo */}
          <div className="space-y-6">
            <section
              aria-labelledby="titulo-benchmark-xm"
              className="ui-card space-y-4 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="titulo-benchmark-xm" className="ui-title text-sm">
                  Comparación respecto al sistema (datos XM)
                </h3>
                <p className="ui-muted text-xs tabular-nums">
                  {fechaConsulta ? `Consulta: ${fechaConsulta}` : 'Consultando…'}
                </p>
              </div>

              {benchmarkCargando ? (
                <div aria-busy="true" aria-live="polite" className="space-y-3">
                  <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
                  <p className="ui-muted text-xs">Consultando las series de XM…</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {erroresSerie.length > 0 && (
                    <p className="ui-callout ui-callout-warn">{erroresSerie[0].mensaje}</p>
                  )}
                  {seriesOk.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {seriesOk.map(({ serie, advertencias }) => (
                        <TarjetaSerieXm
                          key={serie.clave}
                          serie={serie}
                          advertencias={advertencias}
                        />
                      ))}
                    </div>
                  )}
                  <p className="ui-callout ui-callout-info">
                    XM no publica consumo por edificación: estas series describen el
                    comportamiento del sistema (tendencia y estacionalidad), no la magnitud
                    de la edificación. El detalle por sector CIIU solo existe en forma
                    horaria sin filtros, por lo que la comparación se hace con las series
                    nacionales del SIN.
                  </p>
                </div>
              )}
            </section>

            <section
              aria-labelledby="titulo-comparacion-interna"
              className="ui-card space-y-4 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="titulo-comparacion-interna" className="ui-title text-sm">
                  Tendencia interna entre edificaciones SIGE
                </h3>
                {comparacion && (
                  <p className="ui-muted text-xs tabular-nums">
                    {comparacion.ventanaReciente} vs {comparacion.ventanaPrevia}
                  </p>
                )}
              </div>

              {contexto?.estado === 'error' ? (
                <p className="ui-callout ui-callout-warn">{contexto.mensaje}</p>
              ) : comparacion === null ? (
                !benchmarkCargando && (
                  <div className="ui-empty py-8">
                    <p className="max-w-md text-xs">
                      Sin datos disponibles para la comparación interna.
                    </p>
                  </div>
                )
              ) : comparacion.filas.length === 0 ? (
                <div className="ui-empty py-8">
                  <p className="ui-title text-sm">Sin facturas registradas</p>
                  <p className="max-w-md text-xs">
                    Aún no hay facturas en los últimos 24 meses para comparar las
                    edificaciones entre sí.
                  </p>
                </div>
              ) : (
                <div className="ui-table-shell">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">Edificación</th>
                        <th scope="col">Promedio últimos 12 meses</th>
                        <th scope="col">Interanual</th>
                        <th scope="col">Datos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparacion.filas.map((fila) => {
                        const esActual = fila.edificacionId === edificacionId
                        return (
                          <tr
                            key={fila.edificacionId}
                            className={
                              esActual
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/25'
                                : undefined
                            }
                          >
                            <td className="whitespace-nowrap font-medium">
                              {fila.nombre}
                              {esActual && (
                                <span
                                  className={`${CLASE_BADGE} ml-2 border-emerald-600/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300`}
                                >
                                  Tu edificación
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap text-right tabular-nums">
                              {fila.promedioKwh !== null ? formatoKwh(fila.promedioKwh) : '—'}
                            </td>
                            <td
                              className={`whitespace-nowrap text-right font-medium tabular-nums ${
                                fila.variacionPct === null
                                  ? 'text-gray-500 dark:text-gray-400'
                                  : fila.variacionPct > 0
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {fila.variacionPct !== null
                                ? formatoPct(fila.variacionPct)
                                : 'datos insuficientes'}
                            </td>
                            <td className="whitespace-nowrap text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                              {fila.mesesConDatos}/24 meses
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section
              aria-labelledby="titulo-documentos-xm"
              className="ui-card space-y-4 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="titulo-documentos-xm" className="ui-title text-sm">
                  Datos y documentos XM
                </h3>
                {fechaConsulta && (
                  <p className="ui-muted text-xs tabular-nums">
                    Última consulta: {fechaConsulta}
                  </p>
                )}
              </div>
              <p className="ui-muted text-xs">
                Catálogo oficial de las métricas usadas en el benchmark, tal como las
                publica la API de XM: fuente citable para el informe técnico.
              </p>
              <div className="ui-table-shell">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Métrica</th>
                      <th scope="col">Descripción oficial</th>
                      <th scope="col">Unidades</th>
                      <th scope="col">Cruce</th>
                      <th scope="col">Endpoint</th>
                      <th scope="col">Límite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogo.map((metrica) => (
                      <tr key={metrica.metricId}>
                        <td className="font-medium">
                          {metrica.nombre}
                          <br />
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                            {metrica.metricId}
                          </span>
                        </td>
                        <td className="min-w-80 text-xs font-normal">
                          {metrica.descripcion}
                        </td>
                        <td className="whitespace-nowrap">{metrica.unidades}</td>
                        <td className="whitespace-nowrap">{metrica.cruce}</td>
                        <td className="whitespace-nowrap text-xs">
                          POST{' '}
                          {metrica.endpoint.replace('https://servapibi.xm.com.co', '')}
                        </td>
                        <td className="whitespace-nowrap text-right tabular-nums">
                          {metrica.maxDias} días
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                <li>
                  <a
                    href={URLS_XM.documentacion}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded font-medium text-uv-forest underline underline-offset-2 focus-ring"
                  >
                    Documentación oficial de la API XM
                  </a>
                </li>
                <li>
                  <a
                    href={URLS_XM.portal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded font-medium text-uv-forest underline underline-offset-2 focus-ring"
                  >
                    Portal de XM (datos y operación)
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
