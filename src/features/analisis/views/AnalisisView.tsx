'use client'

import React from 'react'
import { ListboxSelect, type ListboxOption } from '@/shared/views/ui/ListboxSelect'
import { ejecutarAnalisis } from '@/features/analisis/controllers/analisis'
import {
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
  PRECISION_TEXTO,
  TEXTO_CALENDARIO,
  TEXTO_DIRECCION,
  type AnalisisResultado,
  type PeriodoAnalizado,
} from '../models/analisis'
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
        // Un análisis nuevo vuelve al nivel exacto (edificación).
        setNivelId('edi')
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
              </p>
            </div>
            <div className="ui-card p-5 sm:p-6">
              <AnalisisChart periodos={salida.periodos} media={salida.estadisticos.media} />
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
        </>
      )}
    </div>
  )
}
